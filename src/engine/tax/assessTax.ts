import type { Nominal, SimulationYear } from '../plan'
import type { RateYear } from '../rates/rateYear'

/** Det, en persons skat for ét år skal regnes af. Kommune- og
    kirkeskatteprocenten kommer fra planen, ikke fra satsåret. */
export type TaxAssessmentInput = {
  /** Bruttoløn inklusive arbejdsgiverbidrag, jf. ADR-0007. */
  earnedIncome: Nominal
  municipalTaxRate: number
  churchTaxRate: number
  /** Årets fradragsberettigede indbetaling til pension, og hvor langt
      personen er fra folkepensionsalderen — de to tal, det ekstra
      pensionsfradrag kræver. Uden en indbetaling er der intet fradrag, og
      feltet udelades. */
  contribution?: {
    amount: Nominal
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

/** Hvert lag for sig, aldrig som en total. Lagene står samlet i `layers`,
    så summen ikke kan komme til at mangle et af dem — se `totalTax`. */
export type TaxAssessment = {
  /** Satsåret, opgørelsen er regnet på, jf. ADR-0005. */
  rateYear: SimulationYear
  personalIncome: Nominal
  /** Personlig indkomst efter de ligningsmæssige fradrag. Grundlaget for
      kommune- og kirkeskat alene. */
  taxableIncome: Nominal
  /** Hvert fradrag for sig, aldrig som en samlet post. */
  allowances: Record<Allowance, Nominal>
  layers: Record<TaxLayer, Nominal>
}

/** Skatteopgørelsen for ét simuleringsår og én person. */
export function assessTax(
  input: TaxAssessmentInput,
  rates: RateYear,
): TaxAssessment {
  const labourMarketContribution =
    input.earnedIncome * rates.taxRates.labourMarketContribution
  const personalIncome = input.earnedIncome - labourMarketContribution

  const allowances = {
    employmentAllowance: employmentAllowance(input, rates),
    jobAllowance: jobAllowance(input, rates),
    extraPensionAllowance: extraPensionAllowance(input, rates),
  }

  const capitalIncome = input.capitalIncome ?? 0
  const taxableIncome = personalIncome - sum(allowances) + capitalIncome
  const capitalIncomeContribution = capitalIncomeTax(
    capitalIncome,
    input.municipalTaxRate,
    rates,
  )

  return {
    rateYear: rates.year,
    personalIncome,
    taxableIncome,
    allowances,
    layers: {
      labourMarketContribution,
      bottomBracketTax:
        afterPersonalAllowance(personalIncome, rates) *
          rates.bracketTaxRates.bottomBracketTax +
        capitalIncomeContribution.bottomBracketTax,
      municipalTax:
        afterPersonalAllowance(taxableIncome, rates) * input.municipalTaxRate,
      churchTax:
        afterPersonalAllowance(taxableIncome, rates) * input.churchTaxRate,
      ...addCapitalIncomeToTopBracket(
        progression(personalIncome, input.municipalTaxRate, rates),
        capitalIncomeContribution.topBracketTax,
      ),
    },
  }
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
    står i loven og ikke i § 20-tabellen, og den hører derfor ikke i satsåret. */
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
    input.contribution.amount,
    rates.thresholds.extraPensionAllowanceBaseMax,
  )

  return base * rate
}

/** Summen af lagene. Totalen er ikke et felt på opgørelsen: gemt ved siden af
    lagene kunne den komme til at sige noget andet end dem, og et nyt lag i en
    senere skive ville kunne blive glemt i summen. */
export function totalTax(assessment: TaxAssessment): Nominal {
  return sum(assessment.layers)
}

/** Summen af en række beløb, der står hver for sig. Både lagene og fradragene
    opgøres enkeltvis, og begge skal kunne lægges sammen uden at nogen af dem
    kan blive glemt. */
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
): Record<ProgressionLayer, Nominal> {
  const layers = {} as Record<ProgressionLayer, Nominal>

  // Hverken AM-bidraget eller kirkeskatten indgår i den sats, loftet måles
  // på — ingen af trinene omfatter dem.
  let combinedRate = rates.bracketTaxRates.bottomBracketTax + municipalTaxRate

  for (const { layer, step } of progressionLayers) {
    combinedRate += rates.bracketTaxRates[layer]
    const aboveCeiling = Math.max(0, combinedRate - rates.taxCeiling[step])

    layers[layer] =
      Math.max(0, personalIncome - rates.thresholds[layer]) *
      (rates.bracketTaxRates[layer] - aboveCeiling)
  }

  return layers
}

/** Positiv nettokapitalindkomst tillægges bundskattens grundlag helt uden
    bundfradrag, og topskattens grundlag kun for den del, der ligger over
    kapitalindkomstens egen bundfradragsgrænse — aldrig mellem- eller
    top-topskattens, jf. docs/satser/2026.md. Den kombinerede sats har sit
    eget loft på 42 %, uafhængigt af det skrå skatteloftets tre trin, og
    negativ kapitalindkomst rammer hverken laget her eller personfradraget:
    den nedsætter kun skattepligtig indkomst. */
function capitalIncomeTax(
  capitalIncome: Nominal,
  municipalTaxRate: number,
  rates: RateYear,
): { bottomBracketTax: Nominal; topBracketTax: Nominal } {
  const positive = Math.max(0, capitalIncome)
  const aboveThreshold = Math.max(0, positive - rates.thresholds.capitalIncomeInTopBracket)

  let combinedRate = rates.bracketTaxRates.bottomBracketTax + municipalTaxRate
  const bottomRate =
    rates.bracketTaxRates.bottomBracketTax - Math.max(0, combinedRate - rates.taxCeiling.capitalIncome)

  combinedRate += rates.bracketTaxRates.topBracketTax
  const topRate =
    rates.bracketTaxRates.topBracketTax - Math.max(0, combinedRate - rates.taxCeiling.capitalIncome)

  return {
    bottomBracketTax: positive * bottomRate,
    topBracketTax: aboveThreshold * topRate,
  }
}

/** Kapitalindkomstens topskattebidrag lægges oven i det almindelige
    topskattelag — de to måles på hver sin grænse og hvert sit loft, men
    opgørelsen viser kun ét `topBracketTax`, jf. "hvert lag for sig". */
function addCapitalIncomeToTopBracket(
  layers: Record<ProgressionLayer, Nominal>,
  fromCapitalIncome: Nominal,
): Record<ProgressionLayer, Nominal> {
  return { ...layers, topBracketTax: layers.topBracketTax + fromCapitalIncome }
}

/** Personfradraget anvendes i det enkelte lag frem for som en samlet
    skatteværdi, der trækkes fra til sidst. Det er ikke et ligningsmæssigt
    fradrag: det nedsætter også bundskattens grundlag. Forskellen viser sig
    kun ved lave indkomster, hvor et lag ellers kunne bidrage med negativ
    skat. */
function afterPersonalAllowance(base: Nominal, rates: RateYear): Nominal {
  return Math.max(0, base - rates.thresholds.personalAllowance)
}
