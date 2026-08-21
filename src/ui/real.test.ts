import { describe, expect, it } from 'vitest'
import { aPlan } from '../engine/testing/planFixture'
import { inRealKroner } from './real'

describe('inRealKroner', () => {
  it('lader startårets beløb stå — startåret er prisniveauet', () => {
    const plan = aPlan({ startYear: 2026, inflationAssumption: 0.02 })

    expect(inRealKroner(40_000, 2026, plan)).toBeCloseTo(40_000, 6)
  })

  it('deflaterer et senere års fremtidskroner tilbage til nutidskroner', () => {
    const plan = aPlan({ startYear: 2026, inflationAssumption: 0.02 })

    expect(inRealKroner(40_800, 2027, plan)).toBeCloseTo(40_000, 6)
    expect(inRealKroner(41_616, 2028, plan)).toBeCloseTo(40_000, 6)
  })
})
