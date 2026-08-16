import type { Nominal } from '../../plan'
import type { HouseholdTaxInput } from '../assessHousehold'
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
  /** Hele husstanden, fordi sømmet er husstandens, jf. ADR-0014. De fleste
      caser har ét medlem og skriver det med `onePerson`; aftrapningens caser
      skriver husstanden ud, fordi ægtefællens indkomst dér er selve
      pointen. */
  input: HouseholdTaxInput
  /** Én post pr. person, i samme rækkefølge som `input.persons`. Hvert felt
      er valgfrit: en skattecase har sit tyngdepunkt i lagene og en
      aftrapningscase i folkepensionen, og en case, der skulle opremse nuller
      for alt, den ikke handler om, kunne ikke længere læses. */
  expected: readonly PersonExpectation[]
}

/** Det, én person i husstanden skal komme ud på. */
export type PersonExpectation = {
  personalIncome?: Nominal
  taxableIncome?: Nominal
  allowances?: Partial<Record<Allowance, Nominal>>
  layers?: Partial<Record<TaxLayer, Nominal>>
  total?: Nominal
  /** Folkepensionens to beløb efter aftrapningen, og det grundlag, den
      aftrappede efter — `totalTaperBase` af bestanddelene, så casen kan
      sige, hvilken indtægt der kostede tillæg, og ikke kun hvor meget. */
  statePension?: {
    basicAmount: Nominal
    pensionSupplement: Nominal
    taperBase: Nominal
  }
}

/** Husstanden med ét medlem og ingen aktieindkomst. */
function onePerson(tax: TaxAssessmentInput): HouseholdTaxInput {
  return { persons: [{ tax, shareIncome: 0 }] }
}

/** De to fradrag, enhver lønmodtager får. Begge måles på grundlaget for
    arbejdsmarkedsbidrag — altså bruttolønnen før AM-bidrag, jf. LL § 9 J og
    § 9 K — og begge ligger i loft ved de lønninger, casene herunder bruger:
    beskæftigelsesfradraget fra 496.471 kr. og jobfradraget fra 304.089 kr. */
const cappedEmploymentAllowance = 63_300
const cappedJobAllowance = 3_100

/** De fem aftrapningscasers fælles kilde. Hvert tal i deres regnestykker står
    i Beskæftigelsesministeriets egen vejledning om regulering pr. 1. januar
    2026, og hver linje dér bærer sin paragraf. Det er en officiel tabel og
    ikke en sekundær kilde — derfor er ingen af de fem mærket. */
const taperSource =
  'https://www.retsinformation.dk/eli/retsinfo/2026/9336 — VEJ nr 9336 af ' +
  '24/03/2026, tabel 12 (grundbeløbet, § 49, stk. 1, nr. 1, og ' +
  'pensionstillægget, § 49, stk. 1, nr. 2) og tabel 15 (fradragsbeløbet, ' +
  '§ 49, stk. 1, nr. 5, med den midlertidige forhøjelse efter § 49 c, ' +
  'aftrapningsprocenterne, § 31, stk. 1, og bortseelsen, § 49, stk. 1, ' +
  'nr. 4). Indtægtsgrundlagets opgørelse står i PL § 29: stk. 1, nr. 10 og ' +
  '11 (arbejdsindkomsten indgår ikke), stk. 4, nr. 1 (folkepensionen indgår ' +
  'ikke i sit eget grundlag), stk. 5 (bortseelsen) og stk. 6 (nedrundingen ' +
  'til nærmeste hundrede). Se også docs/satser/2026.md. Grundbeløbet er ' +
  'desuden set i Udbetaling Danmarks egen beregner på minpensionssag.dk ' +
  '16. august 2026, som viser 7.544,00 kr. pr. måned'

/** Det, beregneren kunne prøve for case 4. Den regner uden login på perioden
    fra den førstkommende 1. — her 1. september 2026 — og altså på fire
    måneder. Casens årsbeløb tastet som en tredjedel annualiserer derfor
    tilbage til casen selv, og svaret er casens eget tal delt med tolv. Det er
    ikke en analogi: det er case 4, kørt igennem myndighedens egen flade. */
const verifiedAgainstCalculator =
  '. Efterprøvet mod Udbetaling Danmarks beregner på ' +
  'https://www.minpensionssag.dk/pe-selvbetjening/simulering/foerdubegynder/' +
  'simuleringFolkepension den 16. august 2026: 60.000 kr. til pensionisten og ' +
  '40.000 kr. til ægtefællen, begge som anden personlig indkomst i perioden ' +
  '1. september til 31. december 2026, gav 7.544,00 kr. i grundbeløb og ' +
  '3.496,00 kr. i pensionstillæg pr. måned — casens 41.956 kr. delt med tolv, ' +
  'afkortet til hele kroner. De tre øvrige parringer af sats og bortseelse ' +
  'ville have givet 1.768,33, 3.981,67 eller 3.117,67 kr., så svaret udpeger ' +
  'rækken entydigt. Beregneren siger desuden selv, at ægtefællens ' +
  'arbejdsindkomst ikke skal oplyses, "da de ikke indgår i beregningen af din ' +
  'pension", og den har intet felt til den hos nogen af de to'

/** Case 5's række kan ikke nås gennem beregneren. Uden login spørger den
    aldrig, om ægtefællen selv modtager social pension, og vælger dermed
    ikke-pensionistrækken på forhånd — B1's svar viser netop, at den regner
    med 32 % og 54 %. Rækken står derfor på tabellen og lovteksten alene, og
    det er værd at sige i dataene frem for at lade de to halvdele af parret se
    ens verificerede ud. */
const beyondCalculator =
  '. Denne række kan ikke nås gennem Udbetaling Danmarks beregner: den ' +
  'spørger ikke, om ægtefællen selv modtager social pension, og regner uden ' +
  'login altid med en ikke-pensionist. Hvor den forrige case er prøvet både ' +
  'mod tabellen og mod myndighedens egen beregning, står denne på tabellen og ' +
  'lovteksten alene'

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
    input: onePerson({
      earnedIncome: 600_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 750_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 950_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 3_000_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 950_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 700_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
      contribution: { withDeductibility: 96_600, yearsToStatePensionAge: 12 },
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 700_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
      contribution: { withDeductibility: 68_700, yearsToStatePensionAge: 12 },
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 700_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
      contribution: { withDeductibility: 60_000, yearsToStatePensionAge: 16 },
    }),
    expected: [
      {
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
    ],
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
    input: onePerson({
      earnedIncome: 700_000,
      municipalTaxRate: 0.234,
      churchTaxRate: 0,
      contribution: { withDeductibility: 60_000, yearsToStatePensionAge: 15 },
    }),
    expected: [
      {
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
    ],
  },

  {
    name: 'pensionist uden arbejdsindkomst, 350.000 kr. i pensionsindkomst',
    source:
      'docs/satser/2026.md — beløbsgrænser efter PSL § 20 (skm.dk) og de fire ' +
      'lag på personlig indkomst (skat.dk). Fradragene måler efter LL § 9 J ' +
      'og § 9 K på grundlaget for arbejdsmarkedsbidrag, som her er nul.',
    verifiedOn: '2026-08-15',
    dependsOnUnconfirmed: [],

    // Folkepension, ATP og en rateudbetaling på tilsammen 350.000 kr. Det er
    // casen, der holder de tre led, arbejde udløser, ude: bidraget er betalt
    // på vejen ind i ordningen, og begge arbejdsfradrag måler på et grundlag,
    // der er nul. Beskæftigelsesfradraget alene ville ellers have kostet
    // 25,40 % af 44.625 kr. = knap 11.300 kr. for lidt i skat, og hele
    // sammenligningen mellem et arbejdsår og et pensionsår ville være skæv.
    //
    // AM-bidrag             8,00 % af 0             =       0,00
    // Personlig indkomst                            = 350.000,00  (< 641.200)
    // Beskæftigelsesfradrag 12,75 % af 0            =       0,00
    // Jobfradrag             4,50 % af 0            =       0,00
    // Skattepligtig indkomst                        = 350.000,00
    // Bundskat   12,01 % af (350.000 − 54.100)      =  35.537,59
    // Kommuneskat 25,40 % af (350.000 − 54.100)     =  75.158,60
    // Kirkeskat    0,74 % af (350.000 − 54.100)     =   2.189,66
    //                                                 ──────────
    //                                                 112.885,85
    input: onePerson({
      earnedIncome: 0,
      pensionIncome: 350_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    }),
    expected: [
      {
        personalIncome: 350_000,
        // Uden et ligningsmæssigt fradrag at trække fra er de to grundlag ens.
        taxableIncome: 350_000,
        allowances: {
          employmentAllowance: 0,
          jobAllowance: 0,
          extraPensionAllowance: 0,
        },
        layers: {
          labourMarketContribution: 0,
          bottomBracketTax: 35_537.59,
          municipalTax: 75_158.6,
          churchTax: 2_189.66,
          middleBracketTax: 0,
          topBracketTax: 0,
          additionalTopBracketTax: 0,
        },
        total: 112_885.85,
      },
    ],
  },

  {
    name: 'folkepensionist under fradragsbeløbet, enlig med 60.000 kr. i rater',
    source: taperSource,
    verifiedOn: '2026-08-16',
    dependsOnUnconfirmed: [],

    // Aftrapningens ene ende. Grundlaget er 60.000 kr. mod et fradragsbeløb
    // på 99.200, og der er derfor intet at aftrappe med — tillægget står
    // fuldt. Casen holder fast, at fradragsbeløbet er en tærskel og ikke et
    // bundfradrag, der altid trækkes fra.
    //
    //   grundlag                60.000  (< 99.200)
    //   pensionstillæg         104.748  fuldt
    //   grundbeløb              90.528
    //
    // Skatten regnes af det hele. Folkepensionen bærer intet AM-bidrag og
    // giver ingen af de to arbejdsfradrag:
    //   Personlig indkomst 60.000 + 90.528 + 104.748 = 255.276,0000
    //   Bundskat    12,01 % af (255.276 − 54.100)    =  24.161,2376
    //   Kommuneskat 25,40 % af  201.176              =  51.098,7040
    //   Kirkeskat    0,74 % af  201.176              =   1.488,7024
    //                                                  ───────────
    //                                                   76.748,6440
    input: {
      persons: [
        {
          tax: {
            earnedIncome: 0,
            pensionIncome: 60_000,
            municipalTaxRate: 0.254,
            churchTaxRate: 0.0074,
          },
          shareIncome: 0,
          statePension: { civilStatus: 'Single' },
        },
      ],
    },
    expected: [
      {
        personalIncome: 255_276,
        taxableIncome: 255_276,
        statePension: {
          basicAmount: 90_528,
          pensionSupplement: 104_748,
          taperBase: 60_000,
        },
        layers: {
          labourMarketContribution: 0,
          bottomBracketTax: 24_161.2376,
          municipalTax: 51_098.704,
          churchTax: 1_488.7024,
        },
        total: 76_748.644,
      },
    ],
  },

  {
    name: 'folkepensionist inde i aftrapningsintervallet, enlig med 250.149 kr. i rater',
    source: taperSource,
    verifiedOn: '2026-08-16',
    dependsOnUnconfirmed: [],

    // Aftrapningens midte, og den ene case med et skævt grundlag. De 250.149
    // kr. rundes ned til 250.100, jf. PL § 29, stk. 6. En case på et rundt
    // tal kan ikke se forskel på en motor, der runder, og en, der ikke gør —
    // og de øvrige fire er netop runde.
    //
    //   grundlag                250.149 → 250.100 nedrundet
    //   250.100 − 99.200                = 150.900 over fradragsbeløbet
    //   30,9 % af 150.900               =  46.628,10 aftrappet
    //   104.748 − 46.628,10             =  58.119,90 tilbage
    //
    // Det er de 58.119,90 — ikke de 104.748 — der beskattes. Aftrapningen
    // ligger før skatten, og den personlige indkomst bærer beviset:
    //   Personlig indkomst 250.149 + 90.528 + 58.119,90 = 398.796,9000
    //   Bundskat    12,01 % af (398.796,90 − 54.100)    =  41.398,0977
    //   Kommuneskat 25,40 % af  344.696,90              =  87.553,0126
    //   Kirkeskat    0,74 % af  344.696,90              =   2.550,7571
    //                                                     ───────────
    //                                                     131.501,8674
    input: {
      persons: [
        {
          tax: {
            earnedIncome: 0,
            pensionIncome: 250_149,
            municipalTaxRate: 0.254,
            churchTaxRate: 0.0074,
          },
          shareIncome: 0,
          statePension: { civilStatus: 'Single' },
        },
      ],
    },
    expected: [
      {
        personalIncome: 398_796.9,
        taxableIncome: 398_796.9,
        statePension: {
          basicAmount: 90_528,
          pensionSupplement: 58_119.9,
          taperBase: 250_100,
        },
        layers: {
          bottomBracketTax: 41_398.0977,
          municipalTax: 87_553.0126,
          churchTax: 2_550.7571,
        },
        total: 131_501.8674,
      },
    ],
  },

  {
    name: 'folkepensionist over bortfaldsgrænsen, enlig med 500.000 kr. i rater',
    source: taperSource,
    verifiedOn: '2026-08-16',
    dependsOnUnconfirmed: [],

    // Aftrapningens anden ende. Bortfaldsgrænsen er 438.200 kr. — ikke et
    // selvstændigt satstal, men konsekvensen af de tre andre, jf.
    // selvkontrollen i docs/satser/2026.md — og 500.000 ligger over:
    //   500.000 − 99.200        = 400.800 over fradragsbeløbet
    //   30,9 % af 400.800       = 123.847,20, altså mere end de 104.748
    //   tillæg                  =       0
    //
    // Tillægget kan skæres helt væk, men aldrig til under nul, og det tager
    // ikke grundbeløbet med sig ned: grundbeløbet er fladt, og aftrapningen
    // efter egen arbejdsindkomst blev afskaffet med virkning fra 2023.
    //   Personlig indkomst 500.000 + 90.528          = 590.528,0000
    //   Bundskat    12,01 % af (590.528 − 54.100)    =  64.425,0028
    //   Kommuneskat 25,40 % af  536.428              = 136.252,7120
    //   Kirkeskat    0,74 % af  536.428              =   3.969,5672
    //                                                  ───────────
    //                                                  204.647,2820
    input: {
      persons: [
        {
          tax: {
            earnedIncome: 0,
            pensionIncome: 500_000,
            municipalTaxRate: 0.254,
            churchTaxRate: 0.0074,
          },
          shareIncome: 0,
          statePension: { civilStatus: 'Single' },
        },
      ],
    },
    expected: [
      {
        personalIncome: 590_528,
        taxableIncome: 590_528,
        statePension: {
          basicAmount: 90_528,
          pensionSupplement: 0,
          taperBase: 500_000,
        },
        layers: {
          bottomBracketTax: 64_425.0028,
          municipalTax: 136_252.712,
          churchTax: 3_969.5672,
          middleBracketTax: 0,
        },
        total: 204_647.282,
      },
    ],
  },

  {
    name: 'husstand hvor kun den ene er pensionist, 32 % med 54 % bortseelse',
    source: taperSource + verifiedAgainstCalculator,
    verifiedOn: '2026-08-16',
    dependsOnUnconfirmed: [],

    // Første halvdel af parret om § 49-reglens to halvdele. Jesper er
    // folkepensionist, Anne er tolv år yngre og arbejder endnu.
    //
    // Af Annes indkomst tæller kun hendes egen pensionsindkomst, og kun med
    // 46 %: bortseelsen er 54 % og uden maksimumbeløb, jf. PL § 49, stk. 1,
    // nr. 4. Hendes løn på 450.000 kr. indgår slet ikke, jf. § 29, stk. 1,
    // nr. 10.
    //
    //   Jesper egen pensionsindkomst   180.000
    //   46 % af Annes 120.000           55.200
    //                                  ───────
    //   grundlag                       235.200
    //   235.200 − 198.800            =  36.400 over fradragsbeløbet
    //   32 % af 36.400               =  11.648 aftrappet
    //   53.604 − 11.648              =  41.956 tilbage
    //
    // Var Annes løn talt med — helt eller med de 46 % — ville grundlaget være
    // 685.200 eller 442.200 og tillægget nul i begge tilfælde. Det er den
    // fejl, casen står vagt om.
    //
    //   Jespers personlige indkomst 180.000 + 90.528 + 41.956 = 312.484,0000
    //   Bundskat    12,01 % af (312.484 − 54.100)             =  31.031,9184
    //   Kommuneskat 25,40 % af  258.384                       =  65.629,5360
    //   Kirkeskat    0,74 % af  258.384                       =   1.912,0416
    //                                                           ───────────
    //                                                            98.573,4960
    input: {
      persons: [
        {
          tax: {
            earnedIncome: 0,
            pensionIncome: 180_000,
            municipalTaxRate: 0.254,
            churchTaxRate: 0.0074,
          },
          shareIncome: 0,
          statePension: { civilStatus: 'WithNonPensioner' },
        },
        {
          tax: {
            earnedIncome: 450_000,
            pensionIncome: 120_000,
            municipalTaxRate: 0.254,
            churchTaxRate: 0.0074,
          },
          shareIncome: 0,
        },
      ],
    },
    expected: [
      {
        personalIncome: 312_484,
        taxableIncome: 312_484,
        statePension: {
          basicAmount: 90_528,
          pensionSupplement: 41_956,
          taperBase: 235_200,
        },
        layers: {
          bottomBracketTax: 31_031.9184,
          municipalTax: 65_629.536,
          churchTax: 1_912.0416,
        },
        total: 98_573.496,
      },
      {
        // Anne har ingen folkepension endnu. Hendes post bærer intet
        // `statePension`, og fraværet er selve pointen: det prøves af sømmets
        // egen invariant, som kræver, at feltet findes for præcis de personer,
        // inputtet gav en civilstand — et fravær kan ikke stå som et tal.
        //
        //   AM-bidrag 8 % af 450.000             = 36.000
        //   Personlig indkomst 414.000 + 120.000 = 534.000
        personalIncome: 534_000,
      },
    ],
  },

  {
    name: 'samme husstand året efter, hvor ægtefællen selv er blevet pensionist',
    source: taperSource + beyondCalculator,
    verifiedOn: '2026-08-16',
    dependsOnUnconfirmed: [],

    // Anden halvdel af parret, og hele grunden til at de to står ved siden af
    // hinanden. Hvert tal er det samme som i casen ovenfor — Jespers 180.000,
    // Annes 120.000 og hendes 450.000 i løn — og det eneste, der har flyttet
    // sig, er, at Anne selv har nået sin folkepensionsalder. Forskellen
    // mellem de to caser *er* derfor skiftet og ikke andet.
    //
    // Skiftet er dobbelt og sker i ét skridt, jf. PL § 49, stk. 1, nr. 4, som
    // kun gælder, mens ægtefællen ikke selv modtager social pension:
    //   aftrapning   32 %  →  16 %
    //   bortseelse   54 %  →   0 %
    //
    //   grundlag begge veje  180.000 + 120.000 = 300.000
    //   300.000 − 198.800                      = 101.200
    //   16 % af 101.200                        =  16.192
    //   53.604 − 16.192                        =  37.412  for dem begge
    //
    // Parres de to halvdele forkert, er tallet groft galt:
    //   32 % med 0 % bortseelse  → 53.604 − 0,32 × 101.200 = 21.220
    //   16 % med 54 % bortseelse → 53.604 − 0,16 ×  36.400 = 47.780
    // Ingen af de to ligger i nærheden af 37.412, og det er grunden til, at
    // alle fire tal hentes i ét opslag på `Taper`-rækken frem for hver for sig.
    //
    // Annes løn står stadig i inputtet og indgår stadig ikke: nu er hjemlen
    // § 29, stk. 1, nr. 11 — pensionistens egen arbejdsindkomst ved beregning
    // af pensionstillægget — hvor det året før var nr. 10. Hendes grundlag er
    // de 300.000 og ikke 750.000.
    //
    // Folkepensionen indgår ikke i sit eget grundlag, jf. § 29, stk. 4, nr. 1,
    // og de to tillæg findes derfor i ét gennemløb: Jespers grundlag rummer
    // Annes 120.000 og ikke hendes folkepension, og omvendt.
    //
    //   Jespers personlige indkomst 180.000 + 90.528 + 37.412 = 307.940,0000
    //   Bundskat    12,01 % af (307.940 − 54.100)             =  30.486,1840
    //   Kommuneskat 25,40 % af  253.840                       =  64.475,3600
    //   Kirkeskat    0,74 % af  253.840                       =   1.878,4160
    //                                                           ───────────
    //                                                            96.839,9600
    input: {
      persons: [
        {
          tax: {
            earnedIncome: 0,
            pensionIncome: 180_000,
            municipalTaxRate: 0.254,
            churchTaxRate: 0.0074,
          },
          shareIncome: 0,
          statePension: { civilStatus: 'WithPensioner' },
        },
        {
          tax: {
            earnedIncome: 450_000,
            pensionIncome: 120_000,
            municipalTaxRate: 0.254,
            churchTaxRate: 0.0074,
          },
          shareIncome: 0,
          statePension: { civilStatus: 'WithPensioner' },
        },
      ],
    },
    expected: [
      {
        personalIncome: 307_940,
        taxableIncome: 307_940,
        statePension: {
          basicAmount: 90_528,
          pensionSupplement: 37_412,
          taperBase: 300_000,
        },
        layers: {
          bottomBracketTax: 30_486.184,
          municipalTax: 64_475.36,
          churchTax: 1_878.416,
        },
        total: 96_839.96,
      },
      {
        // Annes eget tillæg er det samme som Jespers: grundlaget er
        // symmetrisk, når ingen af dem ser bort fra noget hos den anden.
        //   Personlig indkomst 414.000 + 120.000 + 90.528 + 37.412 = 661.940
        personalIncome: 661_940,
        statePension: {
          basicAmount: 90_528,
          pensionSupplement: 37_412,
          taperBase: 300_000,
        },
      },
    ],
  },
]
