import { beforeEach, describe, expect, it } from 'vitest'
import { aPlan } from '../engine/testing/planFixture'
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
