import { describe, expect, it } from 'vitest'
import { rateYear2026 } from '../rates/rateYear2026'
import { assessTax, totalTax } from './assessTax'
import type { TaxLayer } from './assessTax'
import { workedExamples } from './testing/workedExamples'

/** Facitcasene. Testen er den samme for dem alle — det er dataene, der bærer
    beregningen, kilden og verifikationsdatoen. En ny case er en ny post i
    listen og ikke en ny test. */

describe('facitcase', () => {
  for (const example of workedExamples) {
    it(example.name, () => {
      const assessment = assessTax(example.input, rateYear2026)
      const { personalIncome, layers, total } = example.expected

      expect(assessment.personalIncome).toBeCloseTo(personalIncome, 2)
      for (const [layer, expected] of Object.entries(layers)) {
        expect(
          assessment.layers[layer as TaxLayer],
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

    // Casen hviler alene på tal fra skm.dk og skat.dk selv. Fradragene (#6)
    // trækker på ⚠︎-mærkede procenter, og deres cases vil sige det her.
    expect(workedExamples[0]!.dependsOnUnconfirmed).toEqual([])
  })
})
