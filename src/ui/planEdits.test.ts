import { describe, expect, it } from 'vitest'
import { aPlan } from '../engine/testing/planFixture'
import type { Plan } from '../engine/plan'
import { removePerson } from './planEdits'

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
          holdings: [
            {
              id: 'marias-konto',
              name: 'Marias frie midler',
              variant: 'CapitalIncome',
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
})
