import { describe, expect, it } from 'vitest'
import { rateYear2026 } from '../rates/rateYear2026'
import { assessTax, totalTax } from './assessTax'
import type { Allowance, TaxLayer } from './assessTax'
import { workedExamples } from './testing/workedExamples'

/** Facitcasene. Testen er den samme for dem alle — det er dataene, der bærer
    beregningen, kilden og verifikationsdatoen. En ny case er en ny post i
    listen og ikke en ny test. */

describe('facitcase', () => {
  for (const example of workedExamples) {
    it(example.name, () => {
      const assessment = assessTax(example.input, rateYear2026)
      const { personalIncome, taxableIncome, allowances, layers, total } =
        example.expected

      expect(assessment.personalIncome).toBeCloseTo(personalIncome, 2)
      expect(assessment.taxableIncome).toBeCloseTo(taxableIncome, 2)
      for (const [allowance, expected] of Object.entries(allowances)) {
        expect(
          assessment.allowances[allowance as Allowance],
          `${allowance} i "${example.name}"`,
        ).toBeCloseTo(expected, 2)
      }
      for (const [layer, expected] of Object.entries(layers)) {
        expect(
          assessment.layers[layer as TaxLayer].amount,
          `${layer} i "${example.name}"`,
        ).toBeCloseTo(expected, 2)
      }
      expect(totalTax(assessment)).toBeCloseTo(total, 2)
    })
  }

  it('siger selv, hvad den hviler på, og hvornår det sidst er efterset', () => {
    for (const example of workedExamples) {
      expect(example.source, `${example.name} mangler en kilde`).not.toBe('')
      expect(example.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }

    // Ingen af casene hviler på et ⚠︎-mærket tal: beløbsgrænserne står i
    // skm.dk's § 20-tabel, de fire lag og fradragsprocenterne på skat.dk, og
    // det ekstra pensionsfradrags satser i loven selv.
    for (const example of workedExamples) {
      expect(example.dependsOnUnconfirmed, example.name).toEqual([])
    }
  })
})
