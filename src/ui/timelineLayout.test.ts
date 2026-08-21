import { describe, expect, it } from 'vitest'
import { personLastYear, yearAtAge } from '../engine/age'
import type { Plan } from '../engine/plan'
import { holdingColor, orderedHoldings } from './palette'
import {
  aContribution,
  aHolding,
  aHoldingContribution,
  aPlan,
  anExpense,
  aSalary,
  aTaxFreeIncome,
  aTransfer,
} from '../engine/testing/planFixture'
import { timelineLayout } from './timelineLayout'

describe('tidslinjens lag', () => {
  it('giver et item i indtægtsgruppen for en indtægtspost og ét i udgiftsgruppen for en udgiftspost', () => {
    const plan = aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000 }), anExpense({ amountInRealKroner: 300_000 })],
    })

    const groups = timelineLayout(plan)
    const income = groups.find((g) => g.name === 'IncomeEntries')!
    const expense = groups.find((g) => g.name === 'ExpenseEntries')!

    expect(income.items.map((item) => item.name)).toEqual(['Løn'])
    expect(expense.items.map((item) => item.name)).toEqual(['Faste udgifter'])
  })

  it('giver et item for et beholdningskildet bidrag, men intet for et lønkildet', () => {
    const plan = aPlan({
      holdings: [
        aHolding({ id: 'aldersopsparing', name: 'Aldersopsparing', variant: 'OldAgeSavings', balance: 0 }),
      ],
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [
        aContribution({ id: 'loenbidrag', source: 'salary', to: 'aldersopsparing', percentageOfEntry: 0.1 }),
        aHoldingContribution({
          id: 'bufferbidrag',
          source: 'free-assets',
          to: 'aldersopsparing',
          amountInRealKroner: 10_000,
        }),
      ],
    })

    const groups = timelineLayout(plan)
    const contributions = groups.find((g) => g.name === 'Contributions')!

    expect(contributions.items).toHaveLength(1)
    expect(contributions.items[0]!.target).toEqual({ kind: 'contribution', id: 'bufferbidrag' })
  })

  it('giver et item i overførselsgruppen for en overførsel', () => {
    const plan = aPlan({
      holdings: [
        aHolding({ id: 'aktiedepot', name: 'Aktiedepot', variant: 'ShareDepot', balance: 500_000 }),
      ],
      transfers: [
        aTransfer({ id: 'omplacering', from: 'free-assets', to: 'aktiedepot', amountInRealKroner: 50_000 }),
      ],
    })

    const groups = timelineLayout(plan)
    const transfers = groups.find((g) => g.name === 'Transfers')!

    expect(transfers.items).toHaveLength(1)
    expect(transfers.items[0]!.target).toEqual({ kind: 'transfer', id: 'omplacering' })
  })

  it('giver et boks-item for en udbetalingsplan og for en livrentes ydelse, men intet for en ordning uden udbetaling', () => {
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
          payout: { start: 67, duration: 15, principle: 'AnnuityPrinciple' },
        },
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
        aHolding({ id: 'aldersopsparing', name: 'Aldersopsparing', variant: 'OldAgeSavings', balance: 0 }),
      ],
    })

    const groups = timelineLayout(plan)
    const jesper = plan.household.persons[0]!
    const payouts = groups.find((g) => g.name === 'HoldingPayouts')!

    expect(payouts.items.map((item) => item.target)).toEqual([
      { kind: 'holding', id: 'ratepension' },
      { kind: 'holding', id: 'livrente' },
    ])
    const ratepension = payouts.items.find(
      (item) => item.target.kind === 'holding' && item.target.id === 'ratepension',
    )!
    const livrente = payouts.items.find(
      (item) => item.target.kind === 'holding' && item.target.id === 'livrente',
    )!
    if (ratepension.point || livrente.point) throw new Error('begge er bokse, ikke punkter')
    expect(livrente.from).toEqual({ kind: 'Free', year: yearAtAge(jesper, 68) })
    expect(livrente.to).toEqual({ kind: 'Locked', year: personLastYear(jesper) - 1 })
  })

  it('markerer et endepunkt bundet til erhvervsophør som låst og opløser det til rette kalenderår', () => {
    const plan = aPlan({
      entries: [
        aSalary({ amountInRealKroner: 600_000, period: { anchor: 'PersonAge', to: 'WorkEndAge' } }),
      ],
    })

    const groups = timelineLayout(plan)
    const income = groups.find((g) => g.name === 'IncomeEntries')!
    const item = income.items[0]!
    if (item.point) throw new Error('lønnen skal være en periode, ikke et punkt')

    const jesper = plan.household.persons[0]!
    expect(item.from).toEqual({ kind: 'Open' })
    expect(item.to).toEqual({ kind: 'Locked', year: yearAtAge(jesper, jesper.workEndAge) - 1 })
  })

  it('markerer et fast alderendepunkt som frit og opløser det til rette kalenderår', () => {
    const plan = aPlan({
      entries: [
        aSalary({ amountInRealKroner: 600_000, period: { anchor: 'PersonAge', from: 45, to: 65 } }),
      ],
    })

    const groups = timelineLayout(plan)
    const item = groups.find((g) => g.name === 'IncomeEntries')!.items[0]!
    if (item.point) throw new Error('lønnen skal være en periode, ikke et punkt')

    const jesper = plan.household.persons[0]!
    expect(item.from).toEqual({ kind: 'Free', year: yearAtAge(jesper, 45) })
    expect(item.to).toEqual({ kind: 'Free', year: yearAtAge(jesper, 65) })
  })

  it('måler en overførsels alder på afgiverbeholdningens ejer, og et beholdningskildet bidrags på destinationens', () => {
    // Jesper ejer bufferen, Anne ejer aktiedepotet. Begge objekter henter fra
    // aktiedepotet, men overførslen måler på afgiveren (Anne) og bidraget på
    // destinationen (Jesper) — de to skal derfor lande på hver sit årstal.
    const plan: Plan = {
      name: 'To ejere',
      startYear: 2026,
      inflationAssumption: 0,
      section20ProjectionAssumption: 0,
      statePensionProjectionAssumption: 0,
      buffer: 'free-assets',
      entries: [],
      transfers: [
        aTransfer({
          id: 'omplacering',
          from: 'aktiedepot',
          to: 'free-assets',
          amountInRealKroner: 50_000,
          period: { anchor: 'PersonAge', from: 'WorkEndAge' },
        }),
      ],
      contributions: [
        aHoldingContribution({
          id: 'bufferbidrag',
          source: 'aktiedepot',
          to: 'free-assets',
          amountInRealKroner: 10_000,
          period: { anchor: 'PersonAge', from: 'WorkEndAge' },
        }),
      ],
      household: {
        persons: [
          {
            id: 'jesper',
            name: 'Jesper',
            birthYear: 1973,
            birthMonth: 6,
            workEndAge: 58,
            horizon: 90,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              aHolding({ id: 'free-assets', name: 'Frie midler', variant: 'SavingsAccount', balance: 0 }),
            ],
          },
          {
            id: 'anne',
            name: 'Anne',
            birthYear: 1975,
            birthMonth: 3,
            workEndAge: 62,
            horizon: 90,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              aHolding({ id: 'aktiedepot', name: 'Aktiedepot', variant: 'ShareDepot', balance: 500_000 }),
            ],
          },
        ],
      },
    }

    const groups = timelineLayout(plan)
    const jesper = plan.household.persons[0]!
    const anne = plan.household.persons[1]!

    const transfer = groups.find((g) => g.name === 'Transfers')!.items[0]!
    const contribution = groups.find((g) => g.name === 'Contributions')!.items[0]!
    if (transfer.point || contribution.point) throw new Error('begge er perioder, ikke punkter')

    expect(transfer.owner).toBe('anne')
    expect(transfer.from).toEqual({ kind: 'Locked', year: yearAtAge(anne, anne.workEndAge) })

    expect(contribution.owner).toBe('jesper')
    expect(contribution.from).toEqual({ kind: 'Locked', year: yearAtAge(jesper, jesper.workEndAge) })
  })

  it('giver et punktitem for en engangspost i stedet for en periode', () => {
    const plan = aPlan({
      entries: [
        aTaxFreeIncome({
          amountInRealKroner: 100_000,
          period: { anchor: 'CalendarYear', from: 2030 },
          recurrence: { kind: 'Once' },
        }),
      ],
    })

    const groups = timelineLayout(plan)
    const item = groups.find((g) => g.name === 'IncomeEntries')!.items[0]!

    if (!item.point) throw new Error('en engangspost skal være et punkt')
    expect(item.at).toEqual({ kind: 'Free', year: 2030 })
  })

  it('opløser en udbetalingsplans start og varighed, og en livrentes boks til ejerens horisont', () => {
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
          payout: { start: 'WorkEndAge', duration: 15, principle: 'AnnuityPrinciple' },
        },
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

    const groups = timelineLayout(plan)
    const jesper = plan.household.persons[0]!
    const startYear = yearAtAge(jesper, jesper.workEndAge)
    const payouts = groups.find((g) => g.name === 'HoldingPayouts')!

    const ratepension = payouts.items.find(
      (item) => item.target.kind === 'holding' && item.target.id === 'ratepension',
    )!
    const livrente = payouts.items.find(
      (item) => item.target.kind === 'holding' && item.target.id === 'livrente',
    )!
    if (ratepension.point || livrente.point) throw new Error('begge er bokse, ikke punkter')

    expect(ratepension.from).toEqual({ kind: 'Locked', year: startYear })
    expect(ratepension.to).toEqual({ kind: 'Free', year: startYear + 14 })
    expect(livrente.from).toEqual({ kind: 'Free', year: yearAtAge(jesper, 68) })
    expect(livrente.to).toEqual({ kind: 'Locked', year: personLastYear(jesper) - 1 })
  })

  it('pakker overlappende poster i hver sin række, og ikke-overlappende i samme, nulstillet pr. gruppe', () => {
    const plan = aPlan({
      entries: [
        {
          ...aSalary({ amountInRealKroner: 1 }),
          id: 'a',
          name: 'A',
          period: { anchor: 'CalendarYear', from: 2026, to: 2030 },
        },
        {
          ...aSalary({ amountInRealKroner: 1 }),
          id: 'b',
          name: 'B',
          period: { anchor: 'CalendarYear', from: 2028, to: 2035 },
        },
        {
          ...aSalary({ amountInRealKroner: 1 }),
          id: 'c',
          name: 'C',
          period: { anchor: 'CalendarYear', from: 2031, to: 2040 },
        },
        // I udgiftsgruppen: samme årstal som A og B, men pakningen må ikke
        // blande sig med indtægternes rækker.
        {
          ...anExpense({ amountInRealKroner: 1 }),
          id: 'd',
          name: 'D',
          period: { anchor: 'CalendarYear', from: 2026, to: 2030 },
        },
      ],
    })

    const groups = timelineLayout(plan)
    const income = groups.find((g) => g.name === 'IncomeEntries')!
    const expense = groups.find((g) => g.name === 'ExpenseEntries')!

    const row = (items: typeof income.items, name: string) => items.find((i) => i.name === name)!.row

    // A og B overlapper (2028-2030) og skal ligge i hver sin række.
    expect(row(income.items, 'A')).not.toBe(row(income.items, 'B'))
    // C overlapper hverken med A eller B og kan lægge sig i A's frigivne række.
    expect(row(income.items, 'C')).toBe(row(income.items, 'A'))
    expect(income.rowCount).toBe(2)

    // D i udgiftsgruppen starter forfra, uanset hvad indtægterne brugte.
    expect(row(expense.items, 'D')).toBe(0)
    expect(expense.rowCount).toBe(1)
  })

  it('genbruger beholdningens egen farve på udbetalingsboksen, og giver de fire øvrige grupper hver sin faste farve', () => {
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
          payout: { start: 67, duration: 15, principle: 'AnnuityPrinciple' },
        },
      ],
      entries: [aSalary({ amountInRealKroner: 1 }), anExpense({ amountInRealKroner: 1 })],
      transfers: [
        aTransfer({ id: 'omplacering', from: 'free-assets', to: 'free-assets', amountInRealKroner: 1 }),
      ],
      contributions: [
        aHoldingContribution({
          id: 'bufferbidrag',
          source: 'free-assets',
          to: 'ratepension',
          amountInRealKroner: 1,
        }),
      ],
    })

    const groups = timelineLayout(plan)
    const colorOf = (groupName: string) => groups.find((g) => g.name === groupName)!.items[0]!.color

    const holdingIndex = orderedHoldings(plan.household).findIndex((holding) => holding.id === 'ratepension')
    expect(colorOf('HoldingPayouts')).toBe(holdingColor(holdingIndex))

    const categoryColors = new Set([
      colorOf('IncomeEntries'),
      colorOf('ExpenseEntries'),
      colorOf('Contributions'),
      colorOf('Transfers'),
    ])
    expect(categoryColors.size).toBe(4)
  })

  it('pakker to ikke-overlappende poster i samme række, selv om de har hver sin ejer', () => {
    const plan: Plan = {
      name: 'To ejere, ingen overlap',
      startYear: 2026,
      inflationAssumption: 0,
      section20ProjectionAssumption: 0,
      statePensionProjectionAssumption: 0,
      buffer: 'jespers-konto',
      entries: [
        {
          ...aSalary({ amountInRealKroner: 1, owner: 'jesper' }),
          id: 'jespers-loen',
          name: 'Jespers løn',
          period: { anchor: 'CalendarYear', from: 2026, to: 2030 },
        },
        {
          ...aSalary({ amountInRealKroner: 1, owner: 'anne' }),
          id: 'annes-loen',
          name: 'Annes løn',
          period: { anchor: 'CalendarYear', from: 2031, to: 2035 },
        },
      ],
      transfers: [],
      contributions: [],
      household: {
        persons: [
          {
            id: 'jesper',
            name: 'Jesper',
            birthYear: 1973,
            birthMonth: 6,
            workEndAge: 58,
            horizon: 90,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              aHolding({ id: 'jespers-konto', name: 'Frie midler', variant: 'SavingsAccount', balance: 0 }),
            ],
          },
          {
            id: 'anne',
            name: 'Anne',
            birthYear: 1975,
            birthMonth: 3,
            workEndAge: 62,
            horizon: 90,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              aHolding({ id: 'annes-konto', name: 'Frie midler', variant: 'SavingsAccount', balance: 0 }),
            ],
          },
        ],
      },
    }

    const groups = timelineLayout(plan)
    const income = groups.find((g) => g.name === 'IncomeEntries')!

    expect(income.items.map((item) => item.row)).toEqual([0, 0])
    expect(income.rowCount).toBe(1)
  })
})
