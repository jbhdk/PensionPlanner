import { describe, expect, it } from 'vitest'
import { aHolding, aHoldingContribution, aPlan, aSalary, aTransfer } from '../engine/testing/planFixture'
import { timelineLayout } from './timelineLayout'
import { applyTimelineDrag } from './timelineDrag'

describe('applyTimelineDrag', () => {
  it('rykker en kalenderårsforankret periodes frie from-endepunkt med det trukne antal år', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 3)

    expect(next.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2033, to: 2035 },
    })
  })

  it('rykker kun to-endepunktet, når det er det, der trækkes', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', -2)

    expect(next.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2030, to: 2033 },
    })
  })

  it('rykker begge endepunkter lige meget, når hele kroppen trækkes', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'body', 4)

    expect(next.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2034, to: 2039 },
    })
  })

  it('rykker et aldersforankret frit endepunkt ved at forskyde den faste alder, ikke det opløste årstal', () => {
    // Jesper er født i juni 1973 (jf. aPlan). Et fast alderendepunkt på 57 år
    // løses til 2030 — forskydes alderen med 3, giver det 60, som løses til 2033.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'PersonAge', from: 57, to: 62 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 3)

    expect(next.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 60, to: 62 },
    })
  })

  it('rykker en overførsels periode på samme måde som en posts', () => {
    const plan = aPlan({
      transfers: [
        aTransfer({
          from: 'free-assets',
          to: 'free-assets',
          amountInRealKroner: 10_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Transfers')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'body', 2)

    expect(next.transfers[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2032, to: 2037 },
    })
  })

  it('rykker et beholdningskildet bidrags periode på samme måde som en posts', () => {
    const plan = aPlan({
      holdings: [
        aHolding({ id: 'aldersopsparing', name: 'Aldersopsparing', variant: 'OldAgeSavings', balance: 0 }),
      ],
      contributions: [
        aHoldingContribution({
          source: 'free-assets',
          to: 'aldersopsparing',
          amountInRealKroner: 10_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Contributions')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 1)

    expect(next.contributions[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2030, to: 2036 },
    })
  })

  it('rykker en ratepensions udbetalingsstart, når fra-håndtaget trækkes', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 67,
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 2)

    const holding = next.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 69, duration: 15 } })
  })

  it('ændrer kun varigheden, når til-håndtaget trækkes, og lader starten stå', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 67,
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 3)

    const holding = next.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 67, duration: 18 } })
  })

  it('rykker en livrentes omsætningstidspunkt, når boksens fra-håndtag trækkes', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          payoutAge: 67,
          balance: 800_000,
          grossReturn: 0,
          annualCostRate: 0,
          quotedReserve: 1_000_000,
          quotedAnnualBenefit: 50_000,
          bonusRate: 0,
          payout: { start: 68 },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', -1)

    const holding = next.household.persons[0]!.holdings.find((h) => h.id === 'livrente')!
    expect(holding).toMatchObject({ payout: { start: 67 } })
  })

  it('klemmer livrentens fra-håndtag til pensionsudbetalingsalderen, ikke længere ned', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          payoutAge: 67,
          balance: 800_000,
          grossReturn: 0,
          annualCostRate: 0,
          quotedReserve: 1_000_000,
          quotedAnnualBenefit: 50_000,
          bonusRate: 0,
          payout: { start: 68 },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    // Fem år tilbage ville lande på 63, men pensionsudbetalingsalderen er 67
    // — trækket klemmes, det bliver ikke afvist bagefter.
    const next = applyTimelineDrag(plan, item, 'from', -5)

    const holding = next.household.persons[0]!.holdings.find((h) => h.id === 'livrente')!
    expect(holding).toMatchObject({ payout: { start: 67 } })
  })

  it('klemmer livrentens fra-håndtag til ét år før ejerens horisont, ikke længere op', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          payoutAge: 67,
          balance: 800_000,
          grossReturn: 0,
          annualCostRate: 0,
          quotedReserve: 1_000_000,
          quotedAnnualBenefit: 50_000,
          bonusRate: 0,
          payout: { start: 68 },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    // Tredive år frem ville lande på 98, men standardpersonens horisont er 90
    // — ét år før det, 89, er det seneste boksen selv kan vise uden at vende om.
    const next = applyTimelineDrag(plan, item, 'from', 30)

    const holding = next.household.persons[0]!.holdings.find((h) => h.id === 'livrente')!
    expect(holding).toMatchObject({ payout: { start: 89 } })
  })
})
