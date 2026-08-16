import { describe, expect, it } from 'vitest'
import type { Holding, Plan } from '../engine/plan'
import { aHolding, aPlan, aSalary } from '../engine/testing/planFixture'
import { simulateChecked } from '../engine/testing/simulateChecked'
import type { YearResult } from '../engine/yearResult'
import { returnTax } from './returnTax'

/** Husstandens egen skat: årets skat minus den, beholdningerne selv bærer.
    Det er den, skatten af afkastet er en del af. */
function householdTax(year: { tax: number; holdings: { tax: number }[] }): number {
  return year.tax - year.holdings.reduce((sum, holding) => sum + holding.tax, 0)
}

function aShareDepot(): Holding {
  return aHolding({
    id: 'depot',
    name: 'Aktiedepot',
    variant: 'ShareDepot',
    balance: 6_000_000,
    grossReturn: 0.05,
  })
}

function aSavingsAccount(): Holding {
  return aHolding({
    id: 'konto',
    name: 'Opsparingskonto',
    variant: 'SavingsAccount',
    balance: 2_000_000,
    grossReturn: 0.03,
  })
}

/** Et år, hvor afkastet er husstandens eneste indkomst. Bufferen forrenter
    sig ikke, så alt, der beskattes, kommer fra de to øvrige beholdninger. */
function aYearOfReturnAlone(): Plan {
  return aPlan({
    startYear: 2026,
    balance: 100_000,
    grossReturn: 0,
    holdings: [aShareDepot(), aSavingsAccount()],
  })
}

describe('skatten af afkastet', () => {
  it('er hele husstandens egen skat i et år, hvor afkastet er den eneste indkomst', () => {
    // Er der intet andet at beskatte, er hele regningen afkastets. Et tal,
    // der påstod mere, ville påstå en skat, husstanden ikke betalte — og det
    // er præcis dét, en flad fordeling af kommuneskatten gør, når
    // personfradraget har ædt den skattepligtige indkomst.
    const year = simulateChecked(aYearOfReturnAlone())[0]!

    expect(returnTax(year)).toBeCloseTo(householdTax(year), 6)
  })

  it('er nul i et år, hvor ingen fri beholdning gav afkast', () => {
    // Ratepensionen bærer sin egen beholdningsskat, og den passerer aldrig
    // husstandens indkomst — den er hverken en del af skattebåndet eller af
    // det, der skal forklares.
    const year = simulateChecked(
      aPlan({
        startYear: 2026,
        balance: 100_000,
        grossReturn: 0,
        entries: [aSalary({ amountInRealKroner: 600_000 })],
        holdings: [
          aHolding({
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            balance: 1_000_000,
            grossReturn: 0.05,
          }),
        ],
      }),
    )[0]!

    expect(householdTax(year)).toBeGreaterThan(0)
    expect(year.holdings.some((holding) => holding.tax > 0)).toBe(true)
    expect(returnTax(year)).toBe(0)
  })

  it('måler kapitalindkomsten som indkomstens øverste skive og ikke som en flad andel', () => {
    // Kommune- og kirkeskatten måler af den skattepligtige indkomst under
    // ét. Uden anden indkomst æder personfradraget grundlaget ned til en
    // rest, der er mindre end kapitalindkomsten selv, og den flade andel —
    // hele kapitalindkomsten ganget med satsen — ville påstå mere skat af
    // afkast, end husstanden betalte i skat overhovedet.
    //
    // Med en løn, der bærer personfradraget, ligger kapitalindkomsten frit
    // oven på resten, og de to målemåder falder sammen, jf. ADR-0027.
    const alene = simulateChecked(aYearOfReturnAlone())[0]!
    const medLoen = simulateChecked({
      ...aYearOfReturnAlone(),
      entries: [aSalary({ amountInRealKroner: 800_000 })],
    })[0]!

    expect(byLayers(alene) + flatShare(alene)).toBeGreaterThan(householdTax(alene))
    expect(returnTax(alene)).toBeCloseTo(householdTax(alene), 6)

    expect(returnTax(medLoen)).toBeCloseTo(byLayers(medLoen) + flatShare(medLoen), 6)
    expect(returnTax(medLoen)).toBeLessThan(householdTax(medLoen))
  })
})

/** De lag, der måler på afkastet alene: aktieindkomstens to og
    kapitalindkomstens eget bidrag med sit loftnedslag. */
function byLayers(year: YearResult): number {
  return (
    Object.values(year.shareIncomeTax).reduce((sum, layer) => sum + layer.amount, 0) +
    year.persons.reduce(
      (sum, person) =>
        sum +
        Object.values(person.tax.capitalIncomeContribution ?? {}).reduce(
          (total, layer) => total + (layer?.amount ?? 0),
          0,
        ),
      0,
    )
  )
}

/** Den forkastede målemåde: hele kapitalindkomsten ganget med kommune- og
    kirkeskattens satser, uden hensyn til hvad personfradraget lod stå. */
function flatShare(year: YearResult): number {
  return year.persons.reduce(
    (sum, person) =>
      sum +
      person.capitalIncome *
        (person.tax.layers.municipalTax.rate + person.tax.layers.churchTax.rate),
    0,
  )
}
