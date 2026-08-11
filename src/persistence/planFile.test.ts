import { describe, expect, it } from 'vitest'
import { simulate } from '../engine/simulate'
import { aPlan } from '../engine/testing/planFixture'
import { exportPlan, importPlan } from './planFile'

describe('planFile', () => {
  it('giver præcis den samme årsrække tilbage efter en eksport efterfulgt af en import', () => {
    const plan = aPlan()

    const result = importPlan(exportPlan(plan))

    expect(result).toEqual({ kind: 'Loaded', plan })
    expect(simulate((result as { plan: typeof plan }).plan)).toEqual(simulate(plan))
  })

  it('afviser en fil fra en nyere version af værktøjet, forklaret som sådan', () => {
    const result = importPlan(JSON.stringify({ schemaVersion: 99, plan: aPlan() }))

    expect(result.kind).toBe('Failed')
    expect((result as { reason: string }).reason).toMatch(/nyere version/i)
  })

  it('afviser en fil, der ikke er en gyldig plan', () => {
    const result = importPlan('ikke json{')

    expect(result.kind).toBe('Failed')
  })
})
