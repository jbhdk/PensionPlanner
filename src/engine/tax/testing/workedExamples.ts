import type { Nominal } from '../../plan'
import type { TaxAssessmentInput, TaxLayer } from '../assessTax'

/** Et gennemregnet eksempel med kilde og verifikationsdato.

    `dependsOnUnconfirmed` navngiver de satstal i beregningen, der er ⚠︎ i
    docs/satser/. En case, der hviler på et ubekræftet tal, er stadig en
    bindende regressionstest af regnereglerne — men den er ikke et bevis for,
    at beløbet er det, en årsopgørelse ville vise. */
export type WorkedExample = {
  name: string
  source: string
  verifiedOn: string
  dependsOnUnconfirmed: readonly string[]
  input: TaxAssessmentInput
  expected: {
    personalIncome: Nominal
    layers: Partial<Record<TaxLayer, Nominal>>
    total: Nominal
  }
}

export const workedExamples: readonly WorkedExample[] = [
  {
    name: 'lønmodtager under mellemskattegrænsen, 600.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk) og de fire ' +
      'lag på personlig indkomst (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // 600.000 brutto inkl. arbejdsgiverbidrag, jf. ADR-0007.
    // AM-bidrag  8,00 %  af 600.000            =  48.000,00
    // Personlig indkomst  600.000 − 48.000     = 552.000,00  (< 641.200)
    // Efter personfradrag 552.000 − 54.100     = 497.900,00
    // Bundskat   12,01 %                       =  59.797,79
    // Kommuneskat 25,40 %                      = 126.466,60
    // Kirkeskat    0,74 %                      =   3.684,46
    //                                            ──────────
    //                                            237.948,85
    input: {
      earnedIncome: 600_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    },
    expected: {
      personalIncome: 552_000,
      layers: {
        labourMarketContribution: 48_000,
        bottomBracketTax: 59_797.79,
        municipalTax: 126_466.6,
        churchTax: 3_684.46,
      },
      total: 237_948.85,
    },
  },
]
