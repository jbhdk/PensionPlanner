import type { Nominal, SimulationYear } from '../plan'
import type { RateYear } from '../rates/rateYear'

/** Det, en persons skat for ét år skal regnes af. Kommune- og
    kirkeskatteprocenten kommer fra planen, ikke fra satsåret. */
export type TaxAssessmentInput = {
  /** Bruttoløn inklusive arbejdsgiverbidrag, jf. ADR-0007. */
  earnedIncome: Nominal
  municipalTaxRate: number
  churchTaxRate: number
  /** Årets indbetaling med `Deductibility`, og hvor langt personen er fra
      folkepensionsalderen. Uden en indbetaling udelades feltet.

      Det er den tax-relevante gruppering og ikke beholdningsmodellen, der
      krydser sømmet: skattereglen hedder ikke "ratepension giver
      fradragsret", men "indbetalinger til ordninger, hvis udbetaling er
      personlig indkomst, giver fradragsret". Hvilke varianter det så er,
      afgøres i `simulate` — opgørelsen her ser aldrig en `HoldingVariant`. */
  contribution?: {
    /** Summen af årets indbetalinger til ordninger med `Deductibility`,
        målt **efter** AM-bidrag — altså det, der landede i beholdningerne, og
        ikke det, der forlod kilden. Både fradragsretten og det ekstra
        pensionsfradrags grundlag måler på den form, jf. LL § 9 L, stk. 1, og
        docs/satser/2026.md.

        Ét tal og ikke to: det ekstra pensionsfradrags grundlag er netop de
        indbetalinger, fradragsretten omfatter. Den juridiske vejledning
        C.A.4.3.9 måler grundlaget som "indbetalinger til pensionsordninger,
        der er fradragsberettigede efter PBL § 18 eller bortseelsesberettigede
        efter PBL § 19", og aldersopsparingen er ingen af delene. En
        indbetaling til en `OldAgeSavings` giver derfor hverken det ene eller
        det andet — se docs/satser/2026.md, som også skriver fælden ud.

        Grundlaget nedsættes efter § 9 L, stk. 2, med årets skattepligtige
        pensionsudbetalinger. Det led er ikke bygget, jf. docs/udskudt.md. */
    withDeductibility: Nominal
    /** Antal indkomstår frem til det indkomstår, hvor personen når
        folkepensionsalderen — nul i selve det år, negativt bagefter. Det er
        den differens, LL § 9 L, stk. 3, tæller på. */
    yearsToStatePensionAge: number
  }
  /** Nettokapitalindkomst, positiv eller negativ. Lægges til skattepligtig
      indkomst, og positiv kapitalindkomst tillægges desuden bundskattens og
      topskattens grundlag, jf. ADR-0010. */
  capitalIncome?: Nominal
  /** Årets personlige indkomst, der ikke er AM-bidragspligtig — udbetalinger
      fra ratepension og livrente, folkepension og ATP. Udelades, når året
      ingen har.

      Den krydser sømmet som sit eget tal og ikke lagt sammen med
      `earnedIncome`, fordi de to opfører sig forskelligt: AM-bidraget,
      beskæftigelsesfradraget og jobfradraget måler på arbejdsindkomsten
      alene. Lagt sammen ville en pensionist få beskæftigelsesfradrag, og
      hele sammenligningen mellem et arbejdsår og et pensionsår ville være
      skæv.

      Det er den skatterelevante gruppering og aldrig beholdningsmodellen,
      der krydser sømmet — ganske som `contribution.withDeductibility`:
      opgørelsen her ser aldrig en `HoldingVariant`. */
  pensionIncome?: Nominal
}

/** Trappen: hvert progressionslag parret med det trin på det skrå skatteloft,
    laget måles imod. Rækkefølgen er stigende og bærende — loftets trin gælder
    den sammenlagte sats til og med laget, ikke lagets egen sats alene. */
const progressionLayers = [
  { layer: 'middleBracketTax', step: 'atMiddleBracket' },
  { layer: 'topBracketTax', step: 'atTopBracket' },
  { layer: 'additionalTopBracketTax', step: 'atAdditionalTopBracket' },
] as const

/** De tre lag under ét. Aldrig `topBracketTax` — det ord betegner udelukkende
    7,5 %-laget over topskattegrænsen. */
export type ProgressionLayer = (typeof progressionLayers)[number]['layer']

/** De ligningsmæssige fradrag, motoren kender. Personfradraget er ikke et af
    dem: det hører til de enkelte lag og nedsætter både bundskattens og
    kommuneskattens grundlag, hvor et ligningsmæssigt fradrag kun rører det
    sidste. */
export type Allowance =
  | 'employmentAllowance'
  | 'jobAllowance'
  | 'extraPensionAllowance'

/** De lag, skatten falder i — plus `taxCeilingRelief`, som er det ene lag
    med negativt fortegn. Nedslaget er et lag og ikke et felt ved siden af
    lagene, så totalen bliver ved med at være summen af dem, jf.
    `TaxAssessment`. */
export type TaxLayer =
  | 'labourMarketContribution'
  | 'bottomBracketTax'
  | 'municipalTax'
  | 'churchTax'
  | 'taxCeilingRelief'
  | ProgressionLayer

/** Et lag for sig: grundlaget og satsen, det er regnet af, og beløbet de to
    giver — altid `base * rate`, så et lag kan efterregnes i hånden alene ud
    fra sin egen linje. */
export type LayerAmount = {
  base: Nominal
  rate: number
  amount: Nominal
}

/** De to progressionslag, kapitalindkomsten selv kan udløse, plus dens eget
    loftnedslag. Ikke en del af `TaxLayer`s egne lag — se
    `TaxAssessment.capitalIncomeContribution`. Nedslaget står her og ikke i
    `layers`, fordi kapitalindkomstens loft er sit eget tal med sit eget
    grundlag: de to nedslag kan binde i samme år og kan ikke lægges sammen i
    én linje uden at grundlag × sats holder op med at stemme. */
export type CapitalIncomeLayer = 'bottomBracketTax' | 'topBracketTax' | 'taxCeilingRelief'

/** Hvert lag for sig, aldrig som en total. Lagene står samlet i `layers`,
    så summen ikke kan komme til at mangle et af dem — se `totalTax`. */
export type TaxAssessment = {
  /** Satsåret, opgørelsen er regnet på, jf. ADR-0005. */
  rateYear: SimulationYear
  personalIncome: Nominal
  /** Den del af årets indbetaling, der blev holdt uden for den personlige
      indkomst. Står ved siden af `personalIncome`, så vejen fra bruttolønnen
      dertil kan efterregnes i hånden — bruttoløn − AM-bidrag − denne — frem
      for at fladen skal udlede den som en difference, jf. ADR-0012. Nul i et
      år uden en indbetaling med `Deductibility`. */
  contributionWithDeductibility: Nominal
  /** Den del af den personlige indkomst, der ikke bar AM-bidrag. Står ved
      siden af `personalIncome` af samme grund som
      `contributionWithDeductibility`: vejen dertil skal kunne efterregnes i
      hånden — bruttoløn − AM-bidrag − fradragsret + denne — frem for at
      fladen skal udlede den som en difference, jf. ADR-0012. Nul i et år
      uden pensionsindkomst. */
  pensionIncome: Nominal
  /** Personlig indkomst efter de ligningsmæssige fradrag. Grundlaget for
      kommune- og kirkeskat alene. */
  taxableIncome: Nominal
  /** Hvert fradrag for sig, aldrig som en samlet post. */
  allowances: Record<Allowance, Nominal>
  /** Bundskat og topskat her er den personlige indkomsts andel alene — se
      `capitalIncomeContribution` for kapitalindkomstens. */
  layers: Record<TaxLayer, LayerAmount>
  /** Kapitalindkomstens eget bidrag til bundskat og topskat. Adskilt fra
      `layers`, fordi de to indkomstarter kan have hver sin — evt.
      loftbegrænsede — sats i samme år: lagt sammen i én linje ville
      `base * rate` ikke længere stemme med beløbet. Et lag er udeladt, når
      kapitalindkomsten ikke bidrager til det. */
  capitalIncomeContribution?: Partial<Record<CapitalIncomeLayer, LayerAmount>>
}

/** Skatteopgørelsen for ét simuleringsår og én person. */
export function assessTax(
  input: TaxAssessmentInput,
  rates: RateYear,
): TaxAssessment {
  const labourMarketContribution =
    input.earnedIncome * rates.taxRates.labourMarketContribution
  // Fradragsretten er ikke et `Allowance`: den holder indbetalingen uden for
  // den **personlige** indkomst og virker dermed på alle lag ovenpå, hvor et
  // ligningsmæssigt fradrag kun rører den skattepligtige. AM-bidraget er
  // allerede regnet af hele bruttolønnen ovenfor og rører sig ikke — det er
  // sådan loven måler, og det er derfor de to tal ikke er det samme.
  const contributionWithDeductibility = input.contribution?.withDeductibility ?? 0
  // Pensionsindkomsten lægges til efter AM-bidraget og efter fradragsretten:
  // ingen af de to måler på den. Bidraget er betalt på vejen ind i
  // ordningen, og en indbetaling nedsætter kun det, den blev holdt uden for.
  const pensionIncome = input.pensionIncome ?? 0
  const personalIncome =
    input.earnedIncome -
    labourMarketContribution -
    contributionWithDeductibility +
    pensionIncome

  const allowances = {
    employmentAllowance: employmentAllowance(input, rates),
    jobAllowance: jobAllowance(input, rates),
    extraPensionAllowance: extraPensionAllowance(input, rates),
  }

  const capitalIncome = input.capitalIncome ?? 0
  const taxableIncome = personalIncome - sum(allowances) + capitalIncome
  const capitalIncomeContribution = capitalIncomeLayers(
    capitalIncome,
    input.municipalTaxRate,
    rates,
  )

  const bottomBase = afterPersonalAllowance(personalIncome, rates)
  const taxableBase = afterPersonalAllowance(taxableIncome, rates)

  return {
    rateYear: rates.year,
    personalIncome,
    contributionWithDeductibility,
    pensionIncome,
    taxableIncome,
    allowances,
    layers: {
      labourMarketContribution: layerAmount(
        input.earnedIncome,
        rates.taxRates.labourMarketContribution,
      ),
      bottomBracketTax: layerAmount(bottomBase, rates.bracketTaxRates.bottomBracketTax),
      municipalTax: layerAmount(taxableBase, input.municipalTaxRate),
      churchTax: layerAmount(taxableBase, input.churchTaxRate),
      ...progression(personalIncome, rates),
      taxCeilingRelief: taxCeilingRelief(personalIncome, input.municipalTaxRate, rates),
    },
    ...(Object.keys(capitalIncomeContribution).length > 0
      ? { capitalIncomeContribution }
      : {}),
  }
}

/** Et lag: grundlag og sats ganget sammen til beløbet, jf. `LayerAmount`. */
function layerAmount(base: Nominal, rate: number): LayerAmount {
  return { base, rate, amount: base * rate }
}

/** Beskæftigelsesfradraget, LL § 9 J: en procent af grundlaget for
    arbejdsmarkedsbidrag — altså arbejdsindkomsten *før* AM-bidrag, og ikke den
    form progressionsgrænserne læses i. */
function employmentAllowance(
  input: TaxAssessmentInput,
  rates: RateYear,
): Nominal {
  return Math.min(
    input.earnedIncome * rates.allowanceRates.employmentAllowance,
    rates.thresholds.employmentAllowanceMax,
  )
}

/** Jobfradraget, LL § 9 K: samme grundlag som beskæftigelsesfradraget, men
    kun af det, der ligger over bundgrænsen. */
function jobAllowance(input: TaxAssessmentInput, rates: RateYear): Nominal {
  const aboveFloor = Math.max(
    0,
    input.earnedIncome - rates.thresholds.jobAllowanceFloor,
  )

  return Math.min(
    aboveFloor * rates.allowanceRates.jobAllowance,
    rates.thresholds.jobAllowanceMax,
  )
}

/** Det år, hvor den høje sats begynder: fra og med det 15. indkomstår før
    det år, personen når folkepensionsalderen, jf. LL § 9 L, stk. 3. Grænsen
    står i loven og ikke i § 20-tabellen, og den hører derfor ikke i satsåret.
    Den har ingen øvre ende — satsen bliver ved med at være den høje efter
    folkepensionsalderen, og sammenligningen er derfor `<=` og ikke et
    interval. */
const extraPensionAllowanceLateFrom = 15

/** Det ekstra pensionsfradrag, LL § 9 L: en procent af årets indbetaling. */
function extraPensionAllowance(
  input: TaxAssessmentInput,
  rates: RateYear,
): Nominal {
  if (!input.contribution) return 0

  const rate =
    input.contribution.yearsToStatePensionAge <= extraPensionAllowanceLateFrom
      ? rates.allowanceRates.extraPensionAllowanceLate
      : rates.allowanceRates.extraPensionAllowanceEarly

  const base = Math.min(
    input.contribution.withDeductibility,
    rates.thresholds.extraPensionAllowanceBaseMax,
  )

  return base * rate
}

/** Summen af skatten: hvert lag i `layers`, plus kapitalindkomstens eget
    bidrag, når det er der. Ikke et felt på opgørelsen: gemt ved siden af
    lagene kunne den komme til at sige noget andet end dem, og et nyt lag i en
    senere skive ville kunne blive glemt i summen. */
export function totalTax(assessment: TaxAssessment): Nominal {
  const fromLayers = Object.values(assessment.layers).reduce(
    (total, { amount }) => total + amount,
    0,
  )
  const fromCapitalIncome = assessment.capitalIncomeContribution
    ? Object.values(assessment.capitalIncomeContribution).reduce(
        (total, layer) => total + (layer?.amount ?? 0),
        0,
      )
    : 0

  return fromLayers + fromCapitalIncome
}

/** Personens to marginalskatter, én pr. indkomstart. De svarer på hvert sit
    spørgsmål — hvad koster den næste lønkrone, og hvad koster den næste
    krone pensionsindkomst — og de to er sjældent ens: lønkronen bærer
    AM-bidrag og kan flytte et af arbejdsfradragene, hvor pensionskronen gør
    ingen af delene.

    Aktie- og kapitalindkomst har ingen sats her: de beskattes fladt og har
    ikke en marginal at vise. */
export type MarginalTaxRates = {
  earnedIncome: number
  pensionIncome: number
}

/** De to satser, hver regnet ved at gentage skatteopgørelsen med én krone
    mere af sin egen indkomstart og tage differencen fra den oprindelige —
    aldrig ved at udlede dem analytisk af satserne, så de ikke kan komme til
    at sige noget andet end selve opgørelsen ville. */
export function marginalTaxRates(
  input: TaxAssessmentInput,
  rates: RateYear,
): MarginalTaxRates {
  const at = totalTax(assessTax(input, rates))
  const withOneMore = (of: Partial<TaxAssessmentInput>) =>
    totalTax(assessTax({ ...input, ...of }, rates)) - at

  return {
    earnedIncome: withOneMore({ earnedIncome: input.earnedIncome + 1 }),
    pensionIncome: withOneMore({ pensionIncome: (input.pensionIncome ?? 0) + 1 }),
  }
}

/** Summen af en række beløb, der står hver for sig — brugt til fradragene,
    som (i modsætning til lagene) stadig er rene tal. */
function sum(amounts: Record<string, Nominal>): Nominal {
  return Object.values(amounts).reduce((total, amount) => total + amount, 0)
}

/** De tre progressionslag, hvert af den del af den personlige indkomst der
    ligger over lagets egen grænse. Grænserne er målt efter AM-bidrag, fordi
    det er den form § 20 regulerer.

    Lagene har intet personfradrag — det hører til bundskatten, kommuneskatten
    og kirkeskatten.

    Satserne er lovens og flytter sig ikke med kommunen. Binder det skrå
    skatteloft, står det i sit eget lag, jf. `taxCeilingRelief`. */
function progression(
  personalIncome: Nominal,
  rates: RateYear,
): Record<ProgressionLayer, LayerAmount> {
  const layers = {} as Record<ProgressionLayer, LayerAmount>

  for (const { layer } of progressionLayers) {
    const base = Math.max(0, personalIncome - rates.thresholds[layer])
    layers[layer] = layerAmount(base, rates.bracketTaxRates[layer])
  }

  return layers
}

/** Loftnedslaget: de procentpoint, den sammenlagte sats ligger over det trin,
    indkomsten når op i, ganget med grundlaget for det lag, der bærer dem.
    Satsen er negativ, og det er staten der giver afkald — kommunen får sit
    fulde.

    Hverken AM-bidraget eller kirkeskatten indgår i den sats, trinene måles
    på; ingen af trinene omfatter dem.

    Nedslaget tages i det første trin, der binder, og kun dér. Trinene ligger
    præcis lagenes egne satser fra hinanden (44,57 + 7,50 = 52,07 + 5,00 =
    57,07), så er første trin bragt ned på loftet, rammer de næste præcis
    deres eget — højst ét trin kan binde. Den relation er satsårets og ikke
    kodens, og den er testet som sådan i `rateYear.test.ts`. Toges nedslaget i
    hvert trin for sig, ville det blive givet én gang pr. lag, og
    marginalskatten landede *under* loftet; invarianten er, at den lander
    præcis på det.

    Grundlaget er progressionslagets eget, så nedslaget vokser med
    indkomsten på samme måde som den skat, det tager af. Er indkomsten under
    lagets grænse, er grundlaget nul — satsen står stadig og siger, hvor
    meget loftet ville binde. */
function taxCeilingRelief(
  personalIncome: Nominal,
  municipalTaxRate: number,
  rates: RateYear,
): LayerAmount {
  let combinedRate = rates.bracketTaxRates.bottomBracketTax + municipalTaxRate

  for (const { layer, step } of progressionLayers) {
    combinedRate += rates.bracketTaxRates[layer]
    const aboveCeiling = Math.max(0, combinedRate - rates.taxCeiling[step])
    if (aboveCeiling > 0) {
      const base = Math.max(0, personalIncome - rates.thresholds[layer])
      // Beløbet skrives ud frem for at komme fra `layerAmount`: et nul
      // grundlag gange en negativ sats er minus nul, og det ville stå som
      // "−0 kr." i forklar-året.
      return { base, rate: -aboveCeiling, amount: base === 0 ? 0 : -(base * aboveCeiling) }
    }
  }

  return layerAmount(0, 0)
}

/** Kapitalindkomstens eget bidrag til bundskat og topskat — hver sit
    grundlag, begge med lovens sats. Positiv nettokapitalindkomst tillægges
    bundskattens grundlag helt uden bundfradrag, og topskattens grundlag kun
    for den del, der ligger over kapitalindkomstens egen bundfradragsgrænse —
    aldrig mellem- eller top-topskattens, jf. docs/satser/2026.md. Negativ
    kapitalindkomst rammer hverken laget her eller personfradraget: den
    nedsætter kun skattepligtig indkomst. Et lag er udeladt, når dets eget
    grundlag er nul, så en linje uden indhold ikke skal vises frem — også
    nedslaget, som her er et lag på lige fod med de to andre og ikke det lag,
    der altid står, som det er blandt de personlige. */
function capitalIncomeLayers(
  capitalIncome: Nominal,
  municipalTaxRate: number,
  rates: RateYear,
): Partial<Record<CapitalIncomeLayer, LayerAmount>> {
  const positive = Math.max(0, capitalIncome)
  const aboveThreshold = Math.max(0, positive - rates.thresholds.capitalIncomeInTopBracket)

  const contribution: Partial<Record<CapitalIncomeLayer, LayerAmount>> = {}
  if (positive > 0) {
    contribution.bottomBracketTax = layerAmount(positive, rates.bracketTaxRates.bottomBracketTax)
  }
  if (aboveThreshold > 0) {
    contribution.topBracketTax = layerAmount(aboveThreshold, rates.bracketTaxRates.topBracketTax)
  }

  const relief = capitalIncomeCeilingRelief(positive, aboveThreshold, municipalTaxRate, rates)
  if (relief) contribution.taxCeilingRelief = relief

  return contribution
}

/** Kapitalindkomstens eget loftnedslag: de procentpoint, kommuneskatten plus
    bund- og topskat ligger over de 42 %, ganget med grundlaget for det lag,
    der bryder loftet.

    Loftet er kapitalindkomstens eget og har intet med det skrå skatteloftets
    tre trin at gøre — de to kan binde i samme år, hver med sit grundlag.
    Til gengæld er dette ét tal og ikke en trappe: bryder bundskattelaget
    loftet, bryder topskattelaget det også, og de to har hvert sit grundlag.
    Det kan ikke ske med nogen dansk kommunesats — bundskat plus den højeste
    er 38,31 % — og `rateYear.test.ts` holder satsåret op mod netop det. */
function capitalIncomeCeilingRelief(
  positive: Nominal,
  aboveThreshold: Nominal,
  municipalTaxRate: number,
  rates: RateYear,
): LayerAmount | undefined {
  const steps = [
    { base: positive, rate: rates.bracketTaxRates.bottomBracketTax },
    { base: aboveThreshold, rate: rates.bracketTaxRates.topBracketTax },
  ]

  let combinedRate = municipalTaxRate
  for (const step of steps) {
    combinedRate += step.rate
    const aboveCeiling = Math.max(0, combinedRate - rates.taxCeiling.capitalIncome)
    if (aboveCeiling > 0) {
      return step.base > 0 ? layerAmount(step.base, -aboveCeiling) : undefined
    }
  }

  return undefined
}

/** Personfradraget anvendes i det enkelte lag frem for som en samlet
    skatteværdi, der trækkes fra til sidst. Det er ikke et ligningsmæssigt
    fradrag: det nedsætter også bundskattens grundlag. Forskellen viser sig
    kun ved lave indkomster, hvor et lag ellers kunne bidrage med negativ
    skat. */
function afterPersonalAllowance(base: Nominal, rates: RateYear): Nominal {
  return Math.max(0, base - rates.thresholds.personalAllowance)
}
