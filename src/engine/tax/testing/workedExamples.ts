import type { Nominal } from '../../plan'
import type { Allowance, TaxAssessmentInput, TaxLayer } from '../assessTax'

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
    taxableIncome: Nominal
    allowances: Partial<Record<Allowance, Nominal>>
    layers: Partial<Record<TaxLayer, Nominal>>
    total: Nominal
  }
}

/** De to fradrag, enhver lønmodtager får. Begge måles på grundlaget for
    arbejdsmarkedsbidrag — altså bruttolønnen før AM-bidrag, jf. LL § 9 J og
    § 9 K — og begge ligger i loft ved de lønninger, casene herunder bruger:
    beskæftigelsesfradraget fra 496.471 kr. og jobfradraget fra 304.089 kr. */
const cappedEmploymentAllowance = 63_300
const cappedJobAllowance = 3_100

export const workedExamples: readonly WorkedExample[] = [
  {
    name: 'lønmodtager under mellemskattegrænsen, 600.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk) og fradragsprocenterne (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // 600.000 brutto inkl. arbejdsgiverbidrag, jf. ADR-0007.
    // AM-bidrag   8,00 % af 600.000              =  48.000,00
    // Personlig indkomst  600.000 − 48.000       = 552.000,00  (< 641.200)
    // Beskæftigelsesfradrag, i loft              =  63.300,00
    // Jobfradrag, i loft                         =   3.100,00
    // Skattepligtig indkomst 552.000 − 66.400    = 485.600,00
    // Bundskat   12,01 % af (552.000 − 54.100)   =  59.797,79
    // Kommuneskat 25,40 % af (485.600 − 54.100)  = 109.601,00
    // Kirkeskat    0,74 % af (485.600 − 54.100)  =   3.193,10
    //                                              ──────────
    //                                              220.591,89
    input: {
      earnedIncome: 600_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    },
    expected: {
      personalIncome: 552_000,
      taxableIncome: 485_600,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
        extraPensionAllowance: 0,
      },
      layers: {
        labourMarketContribution: 48_000,
        bottomBracketTax: 59_797.79,
        municipalTax: 109_601,
        churchTax: 3_193.1,
      },
      total: 220_591.89,
    },
  },

  {
    name: 'lønmodtager i mellemskattelaget, 750.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk) og fradragsprocenterne (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Kommunesatsen ligger under det skrå skatteloftets første trin, så
    // trappen ikke binder og mellemskattens sats står ren.
    // AM-bidrag   8,00 % af 750.000              =  60.000,00
    // Personlig indkomst  750.000 − 60.000       = 690.000,00
    // Skattepligtig indkomst 690.000 − 66.400    = 623.600,00
    // Bundskat   12,01 % af (690.000 − 54.100)   =  76.371,59
    // Kommuneskat 23,40 % af (623.600 − 54.100)  = 133.263,00
    // Mellemskat  7,50 % af (690.000 − 641.200)  =   3.660,00
    // Topskat               690.000 < 777.900    =       0,00
    //                                              ──────────
    //                                              273.294,59
    input: {
      earnedIncome: 750_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    },
    expected: {
      personalIncome: 690_000,
      taxableIncome: 623_600,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
      },
      layers: {
        labourMarketContribution: 60_000,
        bottomBracketTax: 76_371.59,
        municipalTax: 133_263,
        middleBracketTax: 3_660,
        topBracketTax: 0,
      },
      total: 273_294.59,
    },
  },

  {
    name: 'lønmodtager i topskattelaget, 950.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk) og fradragsprocenterne (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Mellem- og topskat ligger oven på hinanden: kronen over
    // topskattegrænsen bærer begge satser. Fradragene rører ingen af dem —
    // de nedsætter kun kommuneskattens grundlag.
    // AM-bidrag   8,00 % af 950.000              =  76.000,00
    // Personlig indkomst  950.000 − 76.000       = 874.000,00
    // Skattepligtig indkomst 874.000 − 66.400    = 807.600,00
    // Bundskat   12,01 % af (874.000 − 54.100)   =  98.469,99
    // Kommuneskat 23,40 % af (807.600 − 54.100)  = 176.319,00
    // Mellemskat  7,50 % af (874.000 − 641.200)  =  17.460,00
    // Topskat     7,50 % af (874.000 − 777.900)  =   7.207,50
    //                                              ──────────
    //                                              375.456,49
    input: {
      earnedIncome: 950_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    },
    expected: {
      personalIncome: 874_000,
      taxableIncome: 807_600,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
      },
      layers: {
        labourMarketContribution: 76_000,
        bottomBracketTax: 98_469.99,
        municipalTax: 176_319,
        middleBracketTax: 17_460,
        topBracketTax: 7_207.5,
        additionalTopBracketTax: 0,
      },
      total: 375_456.49,
    },
  },

  {
    name: 'lønmodtager i top-topskattelaget, 3.000.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk) og fradragsprocenterne (skat.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Alle tre progressionslag i brug på én gang, hvert af sin egen del af
    // indkomsten og med sin egen sats. Fradragene står stille i loft: de er
    // de samme 66.400 kr. som ved 600.000 kr. i løn.
    // AM-bidrag   8,00 % af 3.000.000                =   240.000,00
    // Personlig indkomst 3.000.000 − 240.000         = 2.760.000,00
    // Skattepligtig indkomst 2.760.000 − 66.400      = 2.693.600,00
    // Bundskat    12,01 % af (2.760.000 −    54.100) =   324.978,59
    // Kommuneskat 23,40 % af (2.693.600 −    54.100) =   617.643,00
    // Mellemskat   7,50 % af (2.760.000 −   641.200) =   158.910,00
    // Topskat      7,50 % af (2.760.000 −   777.900) =   148.657,50
    // Top-topskat  5,00 % af (2.760.000 − 2.592.700) =     8.365,00
    //                                                  ────────────
    //                                                  1.498.554,09
    input: {
      earnedIncome: 3_000_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    },
    expected: {
      personalIncome: 2_760_000,
      taxableIncome: 2_693_600,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
      },
      layers: {
        labourMarketContribution: 240_000,
        bottomBracketTax: 324_978.59,
        municipalTax: 617_643,
        middleBracketTax: 158_910,
        topBracketTax: 148_657.5,
        additionalTopBracketTax: 8_365,
      },
      total: 1_498_554.09,
    },
  },

  {
    name: 'lønmodtager hvor det skrå skatteloft binder, 950.000 kr. brutto',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk), fradragsprocenterne (skat.dk) og ' +
      'det skrå skatteloft, trappet fra 2026 (skatteguiden.dk)',
    verifiedOn: '2026-08-10',
    dependsOnUnconfirmed: [],

    // Samme indkomst som topskattecasen ovenfor, men med en kommunesats der
    // lægger trappen fri:
    //   12,01 + 7,50 + 25,40         = 44,91 % mod første trins 44,57 %
    //   12,01 + 7,50 + 7,50 + 25,40  = 52,41 % mod andet trins  52,07 %
    // Begge trin overskrides med 0,34 procentpoint, så de to lag regnes med
    // 7,16 % i stedet for 7,50 %. Kirkeskatten er med i opgørelsen, men ikke
    // i den sats, loftet måles på — og AM-bidraget hverken eller.
    // AM-bidrag   8,00 % af 950.000              =  76.000,00
    // Personlig indkomst  950.000 − 76.000       = 874.000,00
    // Skattepligtig indkomst 874.000 − 66.400    = 807.600,00
    // Bundskat   12,01 % af (874.000 − 54.100)   =  98.469,99
    // Kommuneskat 25,40 % af (807.600 − 54.100)  = 191.389,00
    // Kirkeskat    0,74 % af (807.600 − 54.100)  =   5.575,90
    // Mellemskat   7,16 % af 232.800             =  16.668,48
    // Topskat      7,16 % af  96.100             =   6.880,76
    //                                              ──────────
    //                                              394.984,13
    input: {
      earnedIncome: 950_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    },
    expected: {
      personalIncome: 874_000,
      taxableIncome: 807_600,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
      },
      layers: {
        labourMarketContribution: 76_000,
        bottomBracketTax: 98_469.99,
        municipalTax: 191_389,
        churchTax: 5_575.9,
        middleBracketTax: 16_668.48,
        topBracketTax: 6_880.76,
      },
      total: 394_984.13,
    },
  },

  {
    name:
      'pensionsindbetalende arbejdsår, 700.000 kr. brutto og 105.000 kr. ' +
      'ind på ordningen',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk), fradragsprocenterne (skat.dk) og ' +
      'det ekstra pensionsfradrags satser og 15-årsgrænse (LL § 9 L, stk. 3) ' +
      'samt fradragsgrundlagets måleform efter AM-bidrag (LL § 9 L, stk. 1)',
    verifiedOn: '2026-08-13',
    dependsOnUnconfirmed: [],

    // Lønmodtageren fra ADR-0007: 700.000 kr. brutto, hvoraf 105.000 kr.
    // forlader lønnen som arbejdsgiverbidrag. Der lander 105.000 × 0,92 =
    // 96.600 kr. på ordningen, og det er dét beløb, fradragsgrundlaget måler
    // på — se docs/satser/2026.md. Tolv indkomstår til det år, personen når
    // folkepensionsalderen, altså den høje sats.
    //
    // Casen dækker fradragene alene. Indbetalingens bortseelsesret er ikke
    // modelleret endnu — se docs/udskudt.md — og den personlige indkomst
    // står derfor med hele bruttolønnen bag sig. En årsopgørelse ville vise
    // en lavere skat; det er de tre fradrags regneregler, casen binder.
    //
    // AM-bidrag   8,00 % af 700.000              =  56.000,00
    // Personlig indkomst  700.000 − 56.000       = 644.000,00
    // Beskæftigelsesfradrag, i loft              =  63.300,00
    // Jobfradrag, i loft                         =   3.100,00
    // Ekstra pensionsfradrag 32 % af 87.800      =  28.096,00  (grundlag i loft)
    // Skattepligtig indkomst 644.000 − 94.496    = 549.504,00
    // Bundskat   12,01 % af (644.000 − 54.100)   =  70.846,99
    // Kommuneskat 25,40 % af (549.504 − 54.100)  = 125.832,62
    // Kirkeskat    0,74 % af (549.504 − 54.100)  =   3.665,99
    // Mellemskat   7,16 % af (644.000 − 641.200) =     200,48  (loftet binder)
    //                                              ──────────
    //                                              256.546,08
    input: {
      earnedIncome: 700_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
      contribution: { amount: 96_600, yearsToStatePensionAge: 12 },
    },
    expected: {
      personalIncome: 644_000,
      taxableIncome: 549_504,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
        extraPensionAllowance: 28_096,
      },
      layers: {
        labourMarketContribution: 56_000,
        bottomBracketTax: 70_846.99,
        municipalTax: 125_832.62,
        churchTax: 3_665.99,
        middleBracketTax: 200.48,
        topBracketTax: 0,
      },
      total: 256_546.08,
    },
  },
]
