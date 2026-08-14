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
      'det skrå skatteloft, trappet fra 2026 (skatteguiden.dk), og trinnenes ' +
      'måleform, jf. selvkontrollen i docs/satser/2026.md',
    verifiedOn: '2026-08-14',
    dependsOnUnconfirmed: [],

    // Samme indkomst som topskattecasen ovenfor, men med en kommunesats der
    // lægger trappen fri:
    //   12,01 + 7,50 + 25,40         = 44,91 % mod første trins 44,57 %
    // Første trin overskrides med 0,34 procentpoint. Lagene beholder lovens
    // satser, og de 0,34 % af mellemskattens grundlag står som et lag for
    // sig — loftnedslaget. Andet trin binder ikke: er første trin bragt ned
    // på loftet, er 44,57 + 7,50 = 52,07 % præcis andet trin.
    // Kirkeskatten er med i opgørelsen, men ikke i den sats, loftet måles
    // på — og AM-bidraget hverken eller.
    // AM-bidrag   8,00 % af 950.000              =  76.000,00
    // Personlig indkomst  950.000 − 76.000       = 874.000,00
    // Skattepligtig indkomst 874.000 − 66.400    = 807.600,00
    // Bundskat   12,01 % af (874.000 − 54.100)   =  98.469,99
    // Kommuneskat 25,40 % af (807.600 − 54.100)  = 191.389,00
    // Kirkeskat    0,74 % af (807.600 − 54.100)  =   5.575,90
    // Mellemskat   7,50 % af 232.800             =  17.460,00
    // Topskat      7,50 % af  96.100             =   7.207,50
    // Loftnedslag −0,34 % af 232.800             =    −791,52
    //                                              ──────────
    //                                              395.310,87
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
        middleBracketTax: 17_460,
        topBracketTax: 7_207.5,
        taxCeilingRelief: -791.52,
      },
      total: 395_310.87,
    },
  },

  {
    name:
      'pensionsindbetalende arbejdsår, 700.000 kr. brutto og 105.000 kr. ' +
      'ind på en livrente',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk), fradragsprocenterne (skat.dk), ' +
      'det ekstra pensionsfradrags satser og 15-årsgrænse (LL § 9 L, stk. 3), ' +
      'fradragsgrundlagets måleform efter AM-bidrag (LL § 9 L, stk. 1), ' +
      'fradragsrettens virkning på den personlige indkomst (PBL § 19) og ' +
      'den livsvarige ordnings fravær af årligt loft (PBL § 16, stk. 2, ' +
      'modsætningsvis, og skat.dk om livsvarig livrente)',
    verifiedOn: '2026-08-14',
    dependsOnUnconfirmed: [],

    // Lønmodtageren fra ADR-0007: 700.000 kr. brutto, hvoraf 105.000 kr.
    // forlader lønnen som arbejdsgiverbidrag. Der lander 105.000 × 0,92 =
    // 96.600 kr. på ordningen, og det er dét beløb, både fradragsretten og
    // det ekstra pensionsfradrags grundlag måler på — se docs/satser/2026.md.
    // Tolv indkomstår til det år, personen når folkepensionsalderen, altså
    // den høje sats.
    //
    // Ordningen er en arbejdsgiveradministreret livrente, og hele beløbet
    // beholder derfor sin fradragsret: den livsvarige alderspension står ikke
    // i PBL § 16, stk. 2's udtømmende opremsning og har intet årligt loft.
    // Samme beløb i en ratepension ville have mistet fradragsretten for
    // 27.900 kr. — det er casen *loftet binder* nedenfor, og de to er ét par.
    //
    // Casen er den, indbetalingens to skattevirkninger mødes i. Fradragsretten
    // holder de 96.600 kr. uden for den personlige indkomst og virker dermed
    // på hvert lag ovenpå; det ekstra pensionsfradrag er et ligningsmæssigt
    // fradrag og rører kun den skattepligtige. AM-bidraget måles imens af hele
    // bruttolønnen. Mellemskatten forsvinder helt: 547.400 ligger under
    // grænsen, hvor 644.000 lå over — det er fradragsrettens virkning på et
    // lag ovenpå, gjort til et tal.
    //
    // AM-bidrag   8,00 % af 700.000                =  56.000,0000
    // Personlig indkomst  700.000 − 56.000 − 96.600 = 547.400,0000
    // Beskæftigelsesfradrag, i loft                =  63.300,0000
    // Jobfradrag, i loft                           =   3.100,0000
    // Ekstra pensionsfradrag 32 % af 87.800        =  28.096,0000  (grundlag i loft)
    // Skattepligtig indkomst 547.400 − 94.496      = 452.904,0000
    // Bundskat   12,01 % af (547.400 − 54.100)     =  59.245,3300
    // Kommuneskat 25,40 % af (452.904 − 54.100)    = 101.296,2160
    // Kirkeskat    0,74 % af (452.904 − 54.100)    =   2.951,1496
    // Mellemskat            547.400 < 641.200      =       0,0000
    //                                                ────────────
    //                                                219.492,6956
    input: {
      earnedIncome: 700_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
      contribution: { withDeductibility: 96_600, yearsToStatePensionAge: 12 },
    },
    expected: {
      personalIncome: 547_400,
      taxableIncome: 452_904,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
        extraPensionAllowance: 28_096,
      },
      layers: {
        labourMarketContribution: 56_000,
        bottomBracketTax: 59_245.33,
        municipalTax: 101_296.216,
        churchTax: 2_951.1496,
        middleBracketTax: 0,
        topBracketTax: 0,
      },
      total: 219_492.6956,
    },
  },

  {
    name:
      'loftet binder, 700.000 kr. brutto og 105.000 kr. ind på en ratepension',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk), fradragsprocenterne (skat.dk), ' +
      'ratepensionens fradragsloft og dets måleform efter AM-bidrag (PBL ' +
      '§ 16, stk. 2, jf. stk. 3, og Den juridiske vejledning C.A.10.2.2.3.3) ' +
      'og det ekstra pensionsfradrags satser (LL § 9 L, stk. 1 og 3)',
    verifiedOn: '2026-08-14',
    dependsOnUnconfirmed: [],

    // Tvillingen til livrentecasen ovenfor: samme lønmodtager, samme bidrag,
    // og den ene forskel, at pengene går i en ratepension. Den har et
    // fradragsloft på 68.700 kr., og de 96.600 kr., der landede, bryder det
    // med 27.900 kr. Det er parret, der viser, at loftet hænger på ordningens
    // slags og ikke på beløbet.
    //
    // Det overskydende bliver liggende i ordningen — motoren flytter ikke
    // pengene tilbage, jf. ADR-0018 — men det mister sin fradragsret og
    // bliver dermed personlig indkomst igen. At de 96.600 kr. rent faktisk
    // skæres ned til loftets 68.700 kr. er `simulate`s arbejde og prøvet
    // dér; her står, hvad nedskæringen koster i skat.
    //
    // Det ekstra pensionsfradrags grundlag følger med ned: det er netop de
    // indbetalinger, fradragsretten omfatter, jf. LL § 9 L, stk. 1, og
    // C.A.4.3.9. Grundlaget er derfor 68.700 og ikke 87.800 — ordningens loft
    // binder før fradragets eget.
    //
    // AM-bidrag   8,00 % af 700.000                =  56.000,0000
    // Personlig indkomst  700.000 − 56.000 − 68.700 = 575.300,0000
    // Beskæftigelsesfradrag, i loft                =  63.300,0000
    // Jobfradrag, i loft                           =   3.100,0000
    // Ekstra pensionsfradrag 32 % af 68.700        =  21.984,0000  (under grundlagsloftet)
    // Skattepligtig indkomst 575.300 − 88.384      = 486.916,0000
    // Bundskat   12,01 % af (575.300 − 54.100)     =  62.596,1200
    // Kommuneskat 25,40 % af (486.916 − 54.100)    = 109.935,2640
    // Kirkeskat    0,74 % af (486.916 − 54.100)    =   3.202,8384
    // Mellemskat            575.300 < 641.200      =       0,0000
    //                                                ────────────
    //                                                231.734,2224
    //
    // Loftet koster 231.734,2224 − 219.492,6956 = 12.241,5268 kr. mod
    // livrentecasen: 12,01 % i bundskat af de 27.900 kr., der kom tilbage i
    // den personlige indkomst, plus 26,14 % kommune- og kirkeskat af de
    // 34.012 kr., den skattepligtige indkomst steg med — de 27.900 og de
    // 6.112 kr., det ekstra pensionsfradrag faldt med.
    input: {
      earnedIncome: 700_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
      contribution: { withDeductibility: 68_700, yearsToStatePensionAge: 12 },
    },
    expected: {
      personalIncome: 575_300,
      taxableIncome: 486_916,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
        extraPensionAllowance: 21_984,
      },
      layers: {
        labourMarketContribution: 56_000,
        bottomBracketTax: 62_596.12,
        municipalTax: 109_935.264,
        churchTax: 3_202.8384,
        middleBracketTax: 0,
        topBracketTax: 0,
      },
      total: 231_734.2224,
    },
  },

  {
    name:
      'det ekstra pensionsfradrags lave sats, 16 indkomstår til ' +
      'folkepensionsalderen',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk), fradragsprocenterne (skat.dk) og ' +
      'det ekstra pensionsfradrags to satser og 15-årsgrænse (LL § 9 L, ' +
      'stk. 3)',
    verifiedOn: '2026-08-14',
    dependsOnUnconfirmed: [],

    // Første halvdel af parret om 15-årsgrænsen. De to caser er ens på hvert
    // eneste tal på nær ét — antallet af indkomstår til det år, personen når
    // folkepensionsalderen — så forskellen mellem dem *er* satsspringet og
    // ikke andet.
    //
    // § 9 L, stk. 3, giver de 32 % "fra og med det 15. indkomstår før" det år.
    // Her er der seksten, altså ét år for tidligt, og satsen er de 12 %.
    //
    // Bidraget er 60.000 kr. med vilje: under ratepensionens loft på 68.700
    // og under fradragets eget grundlagsloft på 87.800, så procenten står
    // ren. Var grundlaget i loft, ville de to caser måle 12 og 32 % af det
    // samme loftbeløb og ikke af årets indbetaling.
    //
    // AM-bidrag   8,00 % af 700.000                =  56.000,00
    // Personlig indkomst  700.000 − 56.000 − 60.000 = 584.000,00
    // Beskæftigelsesfradrag, i loft                =  63.300,00
    // Jobfradrag, i loft                           =   3.100,00
    // Ekstra pensionsfradrag 12 % af 60.000        =   7.200,00
    // Skattepligtig indkomst 584.000 − 73.600      = 510.400,00
    // Bundskat   12,01 % af (584.000 − 54.100)     =  63.640,99
    // Kommuneskat 23,40 % af (510.400 − 54.100)    = 106.774,20
    // Mellemskat            584.000 < 641.200      =       0,00
    //                                                ──────────
    //                                                226.415,19
    input: {
      earnedIncome: 700_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
      contribution: { withDeductibility: 60_000, yearsToStatePensionAge: 16 },
    },
    expected: {
      personalIncome: 584_000,
      taxableIncome: 510_400,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
        extraPensionAllowance: 7_200,
      },
      layers: {
        labourMarketContribution: 56_000,
        bottomBracketTax: 63_640.99,
        municipalTax: 106_774.2,
        churchTax: 0,
        middleBracketTax: 0,
      },
      total: 226_415.19,
    },
  },

  {
    name:
      'det ekstra pensionsfradrags høje sats, 15 indkomstår til ' +
      'folkepensionsalderen',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk), de fire ' +
      'lag på personlig indkomst (skat.dk), fradragsprocenterne (skat.dk) og ' +
      'det ekstra pensionsfradrags to satser og 15-årsgrænse (LL § 9 L, ' +
      'stk. 3)',
    verifiedOn: '2026-08-14',
    dependsOnUnconfirmed: [],

    // Anden halvdel af parret. Ét indkomstår senere end casen ovenfor, og
    // dermed det første år, hvor "fra og med det 15. indkomstår før" er
    // opfyldt: satsen springer fra 12 til 32 %. Grænsen har ingen øvre ende
    // — satsen bliver ved med at være den høje efter folkepensionsalderen —
    // og springet er derfor ét og ikke to.
    //
    // Fradraget vokser fra 7.200 til 19.200 kr., og hele forskellen ligger i
    // kommuneskatten: et ligningsmæssigt fradrag rører kun den skattepligtige
    // indkomst, hvor fradragsretten rører alle lag ovenpå den personlige. De
    // to caser skiller sig derfor med præcis 23,40 % af 12.000 = 2.808 kr.,
    // og bundskatten står stille på 63.640,99 i begge.
    //
    // AM-bidrag   8,00 % af 700.000                =  56.000,00
    // Personlig indkomst  700.000 − 56.000 − 60.000 = 584.000,00
    // Beskæftigelsesfradrag, i loft                =  63.300,00
    // Jobfradrag, i loft                           =   3.100,00
    // Ekstra pensionsfradrag 32 % af 60.000        =  19.200,00
    // Skattepligtig indkomst 584.000 − 85.600      = 498.400,00
    // Bundskat   12,01 % af (584.000 − 54.100)     =  63.640,99
    // Kommuneskat 23,40 % af (498.400 − 54.100)    = 103.966,20
    // Mellemskat            584.000 < 641.200      =       0,00
    //                                                ──────────
    //                                                223.607,19
    input: {
      earnedIncome: 700_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
      contribution: { withDeductibility: 60_000, yearsToStatePensionAge: 15 },
    },
    expected: {
      personalIncome: 584_000,
      taxableIncome: 498_400,
      allowances: {
        employmentAllowance: cappedEmploymentAllowance,
        jobAllowance: cappedJobAllowance,
        extraPensionAllowance: 19_200,
      },
      layers: {
        labourMarketContribution: 56_000,
        bottomBracketTax: 63_640.99,
        municipalTax: 103_966.2,
        churchTax: 0,
        middleBracketTax: 0,
      },
      total: 223_607.19,
    },
  },
]
