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

  {
    name: 'lønmodtager i mellemskattelaget, 750.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk) og de fire ' +
      'lag på personlig indkomst (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Kommunesatsen ligger under det skrå skatteloftets første trin, så
    // trappen ikke binder og mellemskattens sats står ren.
    // AM-bidrag   8,00 %  af 750.000             =  60.000,00
    // Personlig indkomst  750.000 − 60.000       = 690.000,00
    // Efter personfradrag 690.000 − 54.100       = 635.900,00
    // Bundskat   12,01 %  af 635.900             =  76.371,59
    // Kommuneskat 23,40 % af 635.900             = 148.800,60
    // Mellemskat  7,50 %  af (690.000 − 641.200) =   3.660,00
    // Topskat                690.000 < 777.900   =       0,00
    //                                              ──────────
    //                                              288.832,19
    input: {
      earnedIncome: 750_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    },
    expected: {
      personalIncome: 690_000,
      layers: {
        labourMarketContribution: 60_000,
        bottomBracketTax: 76_371.59,
        municipalTax: 148_800.6,
        middleBracketTax: 3_660,
        topBracketTax: 0,
      },
      total: 288_832.19,
    },
  },

  {
    name: 'lønmodtager i topskattelaget, 950.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk) og de fire ' +
      'lag på personlig indkomst (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Mellem- og topskat ligger oven på hinanden: kronen over
    // topskattegrænsen bærer begge satser.
    // AM-bidrag   8,00 %  af 950.000             =  76.000,00
    // Personlig indkomst  950.000 − 76.000       = 874.000,00
    // Efter personfradrag 874.000 − 54.100       = 819.900,00
    // Bundskat   12,01 %  af 819.900             =  98.469,99
    // Kommuneskat 23,40 % af 819.900             = 191.856,60
    // Mellemskat  7,50 %  af (874.000 − 641.200) =  17.460,00
    // Topskat     7,50 %  af (874.000 − 777.900) =   7.207,50
    //                                              ──────────
    //                                              390.994,09
    input: {
      earnedIncome: 950_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    },
    expected: {
      personalIncome: 874_000,
      layers: {
        labourMarketContribution: 76_000,
        bottomBracketTax: 98_469.99,
        municipalTax: 191_856.6,
        middleBracketTax: 17_460,
        topBracketTax: 7_207.5,
        additionalTopBracketTax: 0,
      },
      total: 390_994.09,
    },
  },

  {
    name: 'lønmodtager i top-topskattelaget, 3.000.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk) og de fire ' +
      'lag på personlig indkomst (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Alle tre progressionslag i brug på én gang, hvert af sin egen del af
    // indkomsten og med sin egen sats.
    // AM-bidrag   8,00 %  af 3.000.000               =   240.000,00
    // Personlig indkomst 3.000.000 − 240.000         = 2.760.000,00
    // Efter personfradrag 2.760.000 − 54.100         = 2.705.900,00
    // Bundskat    12,01 % af 2.705.900               =   324.978,59
    // Kommuneskat 23,40 % af 2.705.900               =   633.180,60
    // Mellemskat   7,50 % af (2.760.000 −   641.200) =   158.910,00
    // Topskat      7,50 % af (2.760.000 −   777.900) =   148.657,50
    // Top-topskat  5,00 % af (2.760.000 − 2.592.700) =     8.365,00
    //                                                  ────────────
    //                                                  1.514.091,69
    input: {
      earnedIncome: 3_000_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    },
    expected: {
      personalIncome: 2_760_000,
      layers: {
        labourMarketContribution: 240_000,
        bottomBracketTax: 324_978.59,
        municipalTax: 633_180.6,
        middleBracketTax: 158_910,
        topBracketTax: 148_657.5,
        additionalTopBracketTax: 8_365,
      },
      total: 1_514_091.69,
    },
  },

  {
    name: 'lønmodtager hvor det skrå skatteloft binder, 950.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk) og det skrå skatteloft, trappet ' +
      'fra 2026 (skatteguiden.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Samme indkomst som topskattecasen ovenfor, men med en kommunesats der
    // lægger trappen fri:
    //   12,01 + 7,50 + 25,40         = 44,91 % mod første trins 44,57 %
    //   12,01 + 7,50 + 7,50 + 25,40  = 52,41 % mod andet trins  52,07 %
    // Begge trin overskrides med 0,34 procentpoint, så de to lag regnes med
    // 7,16 % i stedet for 7,50 %. Kirkeskatten er med i opgørelsen, men ikke
    // i den sats, loftet måles på — og AM-bidraget hverken eller.
    // AM-bidrag   8,00 %  af 950.000             =  76.000,00
    // Personlig indkomst  950.000 − 76.000       = 874.000,00
    // Efter personfradrag 874.000 − 54.100       = 819.900,00
    // Bundskat   12,01 %  af 819.900             =  98.469,99
    // Kommuneskat 25,40 % af 819.900             = 208.254,60
    // Kirkeskat    0,74 % af 819.900             =   6.067,26
    // Mellemskat   7,16 % af 232.800             =  16.668,48
    // Topskat      7,16 % af  96.100             =   6.880,76
    //                                              ──────────
    //                                              412.341,09
    input: {
      earnedIncome: 950_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    },
    expected: {
      personalIncome: 874_000,
      layers: {
        labourMarketContribution: 76_000,
        bottomBracketTax: 98_469.99,
        municipalTax: 208_254.6,
        churchTax: 6_067.26,
        middleBracketTax: 16_668.48,
        topBracketTax: 6_880.76,
      },
      total: 412_341.09,
    },
  },
]
