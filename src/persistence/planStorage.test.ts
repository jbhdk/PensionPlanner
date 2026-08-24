import { beforeEach, describe, expect, it } from 'vitest'
import { simulate } from '../engine/simulate'
import { aHolding, aPlan, aTransfer } from '../engine/testing/planFixture'
import { loadPlan, savePlan, STORAGE_KEY } from './planStorage'

describe('planStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('giver den gemte plan tilbage uændret', () => {
    const plan = aPlan()

    savePlan(plan)
    const result = loadPlan()

    expect(result).toEqual({ kind: 'Loaded', plan })
  })

  it('giver Empty, når intet er gemt endnu', () => {
    expect(loadPlan()).toEqual({ kind: 'Empty' })
  })

  it('giver Failed med en forklaring, når det gemte ikke er gyldig JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'ikke json{')

    const result = loadPlan()

    expect(result.kind).toBe('Failed')
    expect((result as { reason: string }).reason).toMatch(/./)
  })

  it('afviser en gemt plan hvis buffer peger på en beholdning, der ikke findes', () => {
    const plan = { ...aPlan(), buffer: 'findes-ikke' }
    savePlan(plan)

    const result = loadPlan()

    expect(result.kind).toBe('Failed')
  })

  it('afviser en gemt plan med to beholdninger, der begge har bufferens id', () => {
    const base = aPlan()
    const duplicateHolding = { ...base.household.persons[0]!.holdings[0]! }
    const plan = {
      ...base,
      household: {
        persons: [
          {
            ...base.household.persons[0]!,
            holdings: [base.household.persons[0]!.holdings[0]!, duplicateHolding],
          },
        ],
      },
    }
    savePlan(plan)

    const result = loadPlan()

    expect(result.kind).toBe('Failed')
  })

  it('giver Failed frem for at kaste, når skemaversionen ikke kan migreres frem', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, plan: aPlan() }))

    const result = loadPlan()

    expect(result.kind).toBe('Failed')
  })

  it('afviser en ukendt fremtidig skemaversion i stedet for at indlæse den umigreret', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, plan: aPlan() }))

    const result = loadPlan()

    expect(result.kind).toBe('Failed')
    expect((result as { reason: string }).reason).toMatch(/nyere version/i)
  })

  it('reparerer en gemt overførsel, der henter før afgiverens dør, frem for at afvise planen', () => {
    // Planen kan ligge i localStorage fra før klemningen kom til fladen, og
    // uden reparationen ville næste indlæsning give fejlskærmen, uden at
    // brugeren havde rørt noget, jf. ADR-0045.
    const plan = aPlan({
      holdings: [
        aHolding({
          id: 'aldersopsparing',
          name: 'Aldersopsparing',
          variant: 'OldAgeSavings',
          payoutAge: 67,
          balance: 300_000,
        }),
      ],
      transfers: [
        aTransfer({
          name: 'Tømning',
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 50_000,
          period: { anchor: 'CalendarYear', from: 2030 },
        }),
      ],
    })
    savePlan(plan)

    const result = loadPlan()

    expect(result.kind).toBe('Loaded')
    expect(() => simulate((result as { plan: typeof plan }).plan)).not.toThrow()
    expect((result as { notice?: string }).notice).toMatch(/Tømning/)
  })

  it('giver Failed frem for at kaste, når det gemte er gyldig JSON men ikke en konvolut', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ noget: 'helt andet' }))

    const result = loadPlan()

    expect(result.kind).toBe('Failed')
  })

  it('giver Failed frem for at kaste, når konvolutten er gyldig men planen ikke er det', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, plan: null }))

    const result = loadPlan()

    expect(result.kind).toBe('Failed')
  })
})
