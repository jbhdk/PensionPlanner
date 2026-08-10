import type { Nominal, SimulationYear } from '../plan'
import type { RateYear } from '../rates/rateYear'

/** Det, en persons skat for ét år skal regnes af. Kommune- og
    kirkeskatteprocenten kommer fra planen, ikke fra satsåret. */
export type TaxAssessmentInput = {
  /** Bruttoløn inklusive arbejdsgiverbidrag, jf. ADR-0007. */
  earnedIncome: Nominal
  municipalTaxRate: number
  churchTaxRate: number
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

  // Skattepligtig indkomst er endnu lig den personlige indkomst. Fradragene
  // (#6) og kapitalindkomsten (#8) skiller de to ad.
  const taxableIncome = personalIncome

  return {
    rateYear: rates.year,
    personalIncome,
    layers: {
      labourMarketContribution,
      bottomBracketTax:
        afterAllowance(personalIncome, rates) * rates.bracketTaxRates.bottomBracketTax,
      municipalTax: afterAllowance(taxableIncome, rates) * input.municipalTaxRate,
      churchTax: afterAllowance(taxableIncome, rates) * input.churchTaxRate,
      ...progression(personalIncome, input.municipalTaxRate, rates),
    },
  }
}

/** Summen af lagene. Totalen er ikke et felt på opgørelsen: gemt ved siden af
    lagene kunne den komme til at sige noget andet end dem, og et nyt lag i en
    senere skive ville kunne blive glemt i summen. */
export function totalTax(assessment: TaxAssessment): Nominal {
  return Object.values(assessment.layers).reduce((sum, layer) => sum + layer, 0)
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

/** Personfradraget anvendes i det enkelte lag frem for som en samlet
    skatteværdi, der trækkes fra til sidst. Forskellen viser sig kun ved lave
    indkomster, hvor et lag ellers kunne bidrage med negativ skat. */
function afterAllowance(base: Nominal, rates: RateYear): Nominal {
  return Math.max(0, base - rates.thresholds.personalAllowance)
}
