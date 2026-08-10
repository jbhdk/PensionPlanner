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

/** De lag, skatten falder i. Denne skive har de flade; progressionslagene
    kommer i #5. */
export type TaxLayer =
  | 'labourMarketContribution'
  | 'bottomBracketTax'
  | 'municipalTax'
  | 'churchTax'

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
    },
  }
}

/** Summen af lagene. Totalen er ikke et felt på opgørelsen: gemt ved siden af
    lagene kunne den komme til at sige noget andet end dem, og et nyt lag i en
    senere skive ville kunne blive glemt i summen. */
export function totalTax(assessment: TaxAssessment): Nominal {
  return Object.values(assessment.layers).reduce((sum, layer) => sum + layer, 0)
}

/** Personfradraget anvendes i det enkelte lag frem for som en samlet
    skatteværdi, der trækkes fra til sidst. Forskellen viser sig kun ved lave
    indkomster, hvor et lag ellers kunne bidrage med negativ skat. */
function afterAllowance(base: Nominal, rates: RateYear): Nominal {
  return Math.max(0, base - rates.thresholds.personalAllowance)
}
