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

/** De lag, skatten falder i. */
export type TaxLayer =
  | 'labourMarketContribution'
  | 'bottomBracketTax'
  | 'municipalTax'
  | 'churchTax'
  | ProgressionLayer

/** Et lag for sig: grundlaget og satsen, det er regnet af, og beløbet de to
    giver — altid `base * rate`, så et lag kan efterregnes i hånden alene ud
    fra sin egen linje. */
export type LayerAmount = {
  base: Nominal
  rate: number
  amount: Nominal
}

/** De to progressionslag, kapitalindkomsten selv kan udløse. Ikke en del af
    `TaxLayer`s egne `bottomBracketTax`/`topBracketTax` — se
    `TaxAssessment.capitalIncomeContribution`. */
export type CapitalIncomeLayer = 'bottomBracketTax' | 'topBracketTax'

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
  const personalIncome =
    input.earnedIncome - labourMarketContribution - contributionWithDeductibility

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
      ...progression(personalIncome, input.municipalTaxRate, rates),
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

/** Den sammensatte marginalskat af den næste krone lønindkomst: hvad en
    ekstra krone koster netop denne person i netop dette år. Regnet ved at
    gentage skatteopgørelsen med `earnedIncome + 1` og tage differencen fra
    den oprindelige — aldrig ved at udlede den analytisk af satserne, så den
    ikke kan komme til at sige noget andet end selve opgørelsen ville. Kun
    lønindkomstens marginal: aktie- og kapitalindkomst beskattes med flade
    satser, der ikke har en marginal at vise. */
export function marginalTaxRate(
  input: TaxAssessmentInput,
  rates: RateYear,
): number {
  const at = totalTax(assessTax(input, rates))
  const atNextKrone = totalTax(
    assessTax({ ...input, earnedIncome: input.earnedIncome + 1 }, rates),
  )
  return atNextKrone - at
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

    Binder det skrå skatteloft, er det lagets sats der sættes ned, ikke et
    nedslag ved siden af lagene. Loftet er dermed usynligt i opgørelsen og
    synligt i beløbet, hvilket er den vej rundt, der holder totalen lig summen
    af lagene. */
function progression(
  personalIncome: Nominal,
  municipalTaxRate: number,
  rates: RateYear,
): Record<ProgressionLayer, LayerAmount> {
  const layers = {} as Record<ProgressionLayer, LayerAmount>

  // Hverken AM-bidraget eller kirkeskatten indgår i den sats, loftet måles
  // på — ingen af trinene omfatter dem.
  let combinedRate = rates.bracketTaxRates.bottomBracketTax + municipalTaxRate

  for (const { layer, step } of progressionLayers) {
    combinedRate += rates.bracketTaxRates[layer]
    const aboveCeiling = Math.max(0, combinedRate - rates.taxCeiling[step])
    const rate = rates.bracketTaxRates[layer] - aboveCeiling
    const base = Math.max(0, personalIncome - rates.thresholds[layer])

    layers[layer] = { base, rate, amount: base * rate }
  }

  return layers
}

/** Kapitalindkomstens eget bidrag til bundskat og topskat — hver sit
    grundlag og sin egen, evt. loftbegrænsede sats. Positiv nettokapital-
    indkomst tillægges bundskattens grundlag helt uden bundfradrag, og
    topskattens grundlag kun for den del, der ligger over kapitalindkomstens
    egen bundfradragsgrænse — aldrig mellem- eller top-topskattens, jf.
    docs/satser/2026.md. Den kombinerede sats har sit eget loft på 42 %,
    uafhængigt af det skrå skatteloftets tre trin, og negativ kapitalindkomst
    rammer hverken laget her eller personfradraget: den nedsætter kun
    skattepligtig indkomst. Et lag er udeladt, når dets eget grundlag er nul,
    så en linje uden indhold ikke skal vises frem. */
function capitalIncomeLayers(
  capitalIncome: Nominal,
  municipalTaxRate: number,
  rates: RateYear,
): Partial<Record<CapitalIncomeLayer, LayerAmount>> {
  const positive = Math.max(0, capitalIncome)
  const aboveThreshold = Math.max(0, positive - rates.thresholds.capitalIncomeInTopBracket)

  let combinedRate = rates.bracketTaxRates.bottomBracketTax + municipalTaxRate
  const bottomRate =
    rates.bracketTaxRates.bottomBracketTax - Math.max(0, combinedRate - rates.taxCeiling.capitalIncome)

  combinedRate += rates.bracketTaxRates.topBracketTax
  const topRate =
    rates.bracketTaxRates.topBracketTax - Math.max(0, combinedRate - rates.taxCeiling.capitalIncome)

  const contribution: Partial<Record<CapitalIncomeLayer, LayerAmount>> = {}
  if (positive > 0) {
    contribution.bottomBracketTax = { base: positive, rate: bottomRate, amount: positive * bottomRate }
  }
  if (aboveThreshold > 0) {
    contribution.topBracketTax = { base: aboveThreshold, rate: topRate, amount: aboveThreshold * topRate }
  }
  return contribution
}

/** Personfradraget anvendes i det enkelte lag frem for som en samlet
    skatteværdi, der trækkes fra til sidst. Det er ikke et ligningsmæssigt
    fradrag: det nedsætter også bundskattens grundlag. Forskellen viser sig
    kun ved lave indkomster, hvor et lag ellers kunne bidrage med negativ
    skat. */
function afterPersonalAllowance(base: Nominal, rates: RateYear): Nominal {
  return Math.max(0, base - rates.thresholds.personalAllowance)
}
