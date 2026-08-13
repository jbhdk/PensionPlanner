import { describe, expect, it } from 'vitest'
import { aContribution, aPlan, aSalary, aTransfer } from '../engine/testing/planFixture'
import type { Plan } from '../engine/plan'
import { validatePlan } from '../engine/validatePlan'
import { addEntry, removeEntry, removeHolding, removePerson } from './planEdits'

/** Et to-personers udgangspunkt: fixturens Jesper har bufferen
    ("free-assets"), Maria har en anden beholdning ved siden af. */
function aTwoPersonPlan(): Plan {
  const base = aPlan()
  return {
    ...base,
    household: {
      persons: [
        ...base.household.persons,
        {
          id: 'maria',
          name: 'Maria',
          birthYear: 1975,
          birthMonth: 1,
          workEndAge: 65,
          horizon: 90,
          municipality: 'Hvidovre',
          churchMember: true,
          holdings: [
            {
              id: 'marias-konto',
              name: 'Marias frie midler',
              variant: 'SavingsAccount',
              balance: 500_000,
              grossReturn: 0,
              annualCostRate: 0,
            },
          ],
        },
      ],
    },
  }
}

describe('removePerson', () => {
  it('flytter bufferen til en tilbageværende beholdning, når ejeren af bufferen fjernes', () => {
    const plan = aTwoPersonPlan()
    expect(plan.buffer).toBe('free-assets') // ejet af Jesper

    const result = removePerson(plan, 'jesper')

    expect(result.household.persons.map((p) => p.id)).toEqual(['maria'])
    expect(result.buffer).toBe('marias-konto')
  })

  it('giver bufferrollen til frie midler, også når personens første beholdning er en ordning', () => {
    const base = aTwoPersonPlan()
    const maria = base.household.persons[1]!
    const plan: Plan = {
      ...base,
      household: {
        persons: [
          base.household.persons[0]!,
          {
            ...maria,
            holdings: [
              {
                id: 'marias-ratepension',
                name: 'Marias ratepension',
                variant: 'InstalmentPension',
                balance: 1_000_000,
                grossReturn: 0,
                annualCostRate: 0,
              },
              ...maria.holdings,
            ],
          },
        ],
      },
    }

    const result = removePerson(plan, 'jesper')

    expect(result.buffer).toBe('marias-konto')
    expect(validatePlan(result)).toBeUndefined()
  })

  it('lader bufferen stå, når dens ejer ikke er den, der fjernes', () => {
    const plan = aTwoPersonPlan()

    const result = removePerson(plan, 'maria')

    expect(result.household.persons.map((p) => p.id)).toEqual(['jesper'])
    expect(result.buffer).toBe('free-assets')
  })

  it('fjerner posterne, den fjernede person ejer', () => {
    const plan = aTwoPersonPlan()
    const withEntry: Plan = {
      ...plan,
      entries: [
        {
          id: 'marias-loen',
          name: 'Marias løn',
          amountInRealKroner: 400_000,
          owner: 'maria',
          direction: 'Income',
          taxTreatment: 'EarnedIncome',
          timing: 'Even',
          period: { anchor: 'CalendarYear' },
          recurrence: { kind: 'Annual' },
          regulationRate: 0,
        },
      ],
    }

    const result = removePerson(withEntry, 'maria')

    expect(result.entries).toEqual([])
  })

  it('fjerner overførslerne, der peger på den fjernede persons beholdninger', () => {
    // removeHolding ryddede allerede op efter sig; removePerson gjorde ikke,
    // og overførslen blev stående og flyttede penge ud i et ingenting.
    const plan = aTwoPersonPlan()
    const withTransfer: Plan = {
      ...plan,
      transfers: [
        aTransfer({ from: 'free-assets', to: 'marias-konto', amountInRealKroner: 50_000 }),
      ],
    }

    const result = removePerson(withTransfer, 'maria')

    expect(result.transfers).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })
})

describe('addEntry', () => {
  it('tilføjer en indtægt med lønindkomst som skattebehandling', () => {
    const plan = aPlan()

    const result = addEntry(plan, 'Income')

    expect(result.entries).toHaveLength(1)
    const entry = result.entries[0]!
    expect(entry.name).toBe('Indtægt 1')
    expect(entry.owner).toBe('jesper')
    expect(entry.direction).toBe('Income')
    expect(entry.direction === 'Income' && entry.taxTreatment).toBe('EarnedIncome')
  })

  it('tilføjer en udgift uden skattebehandling', () => {
    const plan = aPlan()

    const result = addEntry(plan, 'Expense')

    expect(result.entries).toHaveLength(1)
    const entry = result.entries[0]!
    expect(entry.name).toBe('Udgift 1')
    expect(entry.direction).toBe('Expense')
  })

  it('tæller kun poster med samme retning ved navngivningen', () => {
    const plan = addEntry(addEntry(aPlan(), 'Income'), 'Expense')

    const result = addEntry(plan, 'Income')

    expect(result.entries.map((e) => e.name)).toEqual(['Indtægt 1', 'Udgift 1', 'Indtægt 2'])
  })
})

describe('removeHolding', () => {
  /** Fixturens buffer, en ratepension lige efter, og frie midler til sidst —
      rækkefølgen er den, en arvtager til bufferrollen møder. */
  function aPlanWithPensionFirst(): Plan {
    return aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
        },
        {
          id: 'anden-frie',
          name: 'Andre frie midler',
          variant: 'SavingsAccount',
          balance: 200_000,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })
  }

  it('lader bufferrollen gå videre til frie midler og springer pensionsbeholdningen over', () => {
    const plan = aPlanWithPensionFirst()

    const result = removeHolding(plan, 'free-assets')

    expect(result.buffer).toBe('anden-frie')
    expect(validatePlan(result)).toBeUndefined()
  })
})


describe('indbetalingens pegere overlever ikke det, de peger på', () => {
  /** Fixturens Jesper med en lønpost og en ratepension, og et bidrag imellem
      dem. Bufferen er stadig "free-assets". */
  function aPlanWithContribution(): Plan {
    return aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          balance: 0,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
      ],
    })
  }

  it('fjerner indbetalingen, når dens lønpost fjernes', () => {
    // Et bidrag uden sin post ville ikke bare udeblive: planen kan slet ikke
    // regnes, og hele resultatspalten går i stå, jf. ADR-0013.
    const result = removeEntry(aPlanWithContribution(), 'salary')

    expect(result.contributions).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })

  it('fjerner indbetalingen, når dens destination fjernes', () => {
    const result = removeHolding(aPlanWithContribution(), 'ratepension')

    expect(result.contributions).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })

  it('fjerner indbetalingen, når personen bag begge ender fjernes', () => {
    const base = aPlanWithContribution()
    const plan: Plan = {
      ...base,
      buffer: 'marias-konto',
      household: {
        persons: [
          ...base.household.persons,
          {
            id: 'maria',
            name: 'Maria',
            birthYear: 1975,
            birthMonth: 1,
            workEndAge: 65,
            horizon: 90,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              {
                id: 'marias-konto',
                name: 'Marias frie midler',
                variant: 'SavingsAccount',
                balance: 500_000,
                grossReturn: 0,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    const result = removePerson(plan, 'jesper')

    expect(result.contributions).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })
})
