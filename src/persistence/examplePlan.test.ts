import { describe, expect, it } from 'vitest'
import { simulate } from '../engine/simulate'
import { validatePlan } from '../engine/validatePlan'
import { exampleName, loadExamplePlan } from './examplePlan'

describe('examplePlan', () => {
  it('indlæses uden fejl, ligesom en importeret fil ville', () => {
    // Bagstopperen for issue #2's "Indlæs eksempel"-knap: skulle skemaet gå
    // fra 15 til 16, uden at eksempelfilen er fulgt med, skal denne test
    // fejle bygningen — ikke en bruger, der trykker knappen.
    const result = loadExamplePlan()

    expect(result.kind).toBe('Loaded')
    expect(result.kind === 'Loaded' && result.notice).toBeUndefined()
  })

  it('kan simuleres og overholder balanceinvarianten', () => {
    const result = loadExamplePlan()
    if (result.kind !== 'Loaded') throw new Error('Eksemplet kunne ikke indlæses')

    expect(validatePlan(result.plan)).toBeUndefined()
    expect(() => simulate(result.plan)).not.toThrow()
  })

  it('bærer det navn, bekræftelsesteksten viser', () => {
    const result = loadExamplePlan()
    if (result.kind !== 'Loaded') throw new Error('Eksemplet kunne ikke indlæses')

    expect(exampleName).toBe(result.plan.name)
  })
})
