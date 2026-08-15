import { describe, expect, it } from 'vitest'
import type { RateYear } from './rateYear'
import { rateYear2026 } from './rateYear2026'
import { rateYearFor } from './rates'

const noProjection = { section20ProjectionAssumption: 0, statePensionProjectionAssumption: 0 }

describe('rateYearFor', () => {
  it('bruger det kendte satsår uændret, når simuleringsåret rammer det', () => {
    const { rates, basis } = rateYearFor(2026, noProjection)

    expect(rates).toEqual(rateYear2026)
    expect(basis).toEqual({ knownYear: 2026, projected: false })
  })

  it('fremskriver § 20-grænserne med § 20-satsen sammensat over årene siden det kendte satsår', () => {
    const { rates, basis } = rateYearFor(2030, {
      section20ProjectionAssumption: 0.02,
      statePensionProjectionAssumption: 0,
    })

    expect(basis).toEqual({ knownYear: 2026, projected: true })
    expect(rates.thresholds.personalAllowance).toBeCloseTo(
      rateYear2026.thresholds.personalAllowance * 1.02 ** 4,
      6,
    )
    expect(rates.thresholds.shareIncome).toBeCloseTo(
      rateYear2026.thresholds.shareIncome * 1.02 ** 4,
      6,
    )
  })

  it('fremskriver satsregulerede ydelser med satsreguleringen, uden at røre aftrapningens procent', () => {
    const { rates } = rateYearFor(2030, {
      section20ProjectionAssumption: 0,
      statePensionProjectionAssumption: 0.03,
    })

    const factor = 1.03 ** 4
    const baseTaper = rateYear2026.statePension.taper[0]!
    const taper = rates.statePension.taper[0]!

    expect(rates.statePension.basicAmount).toBeCloseTo(
      rateYear2026.statePension.basicAmount * factor,
      6,
    )
    expect(taper.pensionSupplement).toBeCloseTo(baseTaper.pensionSupplement * factor, 6)
    expect(taper.allowance).toBeCloseTo(baseTaper.allowance * factor, 6)
    expect(taper.cutOff).toBeCloseTo(baseTaper.cutOff * factor, 6)
    expect(taper.rate).toBe(baseTaper.rate)
  })

  it('holder alle procenter uændret, når der fremskrives', () => {
    const { rates } = rateYearFor(2040, {
      section20ProjectionAssumption: 0.02,
      statePensionProjectionAssumption: 0.02,
    })

    expect(rates.bracketTaxRates).toEqual(rateYear2026.bracketTaxRates)
    expect(rates.taxRates).toEqual(rateYear2026.taxRates)
    // Amortisationsrenten er en procent som de øvrige og holdes uændret ved
    // fremskrivning — også selv om Finans Danmark fastsætter den hvert år.
    // Satsåret er stadig tilgængeligt for et fremskrevet år, jf. ADR-0005.
    expect(rates.amortisationRate).toEqual(rateYear2026.amortisationRate)
    expect(rates.taxCeiling).toEqual(rateYear2026.taxCeiling)
    expect(rates.allowanceRates).toEqual(rateYear2026.allowanceRates)
  })

  it('lader et nyt kendt satsår automatisk overtage de simuleringsår, der før blev fremskrevet', () => {
    const rateYear2028: RateYear = {
      ...rateYear2026,
      year: 2028,
      thresholds: { ...rateYear2026.thresholds, personalAllowance: 60_000 },
    }
    const knownYears = [rateYear2026, rateYear2028]

    const before = rateYearFor(2027, noProjection, knownYears)
    const at = rateYearFor(2028, noProjection, knownYears)
    const after = rateYearFor(2029, { ...noProjection, section20ProjectionAssumption: 0.02 }, knownYears)

    expect(before.basis).toEqual({ knownYear: 2026, projected: true })
    expect(at.basis).toEqual({ knownYear: 2028, projected: false })
    expect(after.basis).toEqual({ knownYear: 2028, projected: true })
    expect(after.rates.thresholds.personalAllowance).toBeCloseTo(60_000 * 1.02, 6)
  })
})
