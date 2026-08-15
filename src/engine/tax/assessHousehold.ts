import type { Nominal } from '../plan'
import type { RateYear } from '../rates/rateYear'
import { assessTax, marginalTaxRates, totalTax } from './assessTax'
import type {
  LayerAmount,
  MarginalTaxRates,
  TaxAssessment,
  TaxAssessmentInput,
} from './assessTax'

/** Aktieindkomstskattens to lag. Ikke et `TaxLayer`: de lag er en persons, og
    aktieindkomstens skat er husstandens. Sidestykket til `CapitalIncomeLayer`,
    som ligger ved siden af `TaxLayer` af nøjagtig samme grund.

    Navnene er satsnøglerne i satsåret, så laget kan slå sin egen sats op
    med `rates.taxRates[layer]` — samme idiom som `progression`. */
export type ShareIncomeLayer = 'shareIncomeBelowThreshold' | 'shareIncomeAboveThreshold'

const shareIncomeLayers: readonly ShareIncomeLayer[] = [
  'shareIncomeBelowThreshold',
  'shareIncomeAboveThreshold',
]

/** Det, husstandens skat for ét år skal regnes af: hver persons eget
    skattegrundlag, parret med årets aktieindkomst af netop den persons
    beholdninger. Aktieindkomsten står ved siden af `tax` frem for inden i
    den, fordi den personlige opgørelse ikke bruger den — aktieindkomstens
    skat er husstandens, ikke personens, jf. ADR-0010. */
export type HouseholdTaxInput = {
  persons: { tax: TaxAssessmentInput; shareIncome: Nominal }[]
}

/** Husstandens samlede skat for ét simuleringsår. Totalen er ikke et felt:
    se `totalHouseholdTax`, af samme grund som `totalTax`. */
export type HouseholdTaxAssessment = {
  persons: { tax: TaxAssessment; marginal: MarginalTaxRates }[]
  /** Aktieindkomstens skat, opgjort for husstanden under ét. */
  shareIncomeTax: Partial<Record<ShareIncomeLayer, LayerAmount>>
}

/** Skatteopgørelsen for ét simuleringsår og én husstand. */
export function assessHousehold(
  input: HouseholdTaxInput,
  rates: RateYear,
): HouseholdTaxAssessment {
  return {
    persons: input.persons.map((person) => ({
      tax: assessTax(person.tax, rates),
      marginal: marginalTaxRates(person.tax, rates),
    })),
    shareIncomeTax: shareIncomeTax(input.persons, rates),
  }
}

/** Aktieindkomstens progressionsgrænse er fælles og overførbar mellem
    ægtefæller, så skatten regnes af husstandens samlede aktieindkomst mod
    husstandens samlede grænse — aldrig person for person, jf. ADR-0010 og
    docs/satser/2026.md. Summen lagres ikke; den findes kun her.

    Et lag er udeladt, når dets eget grundlag er nul, så en linje uden
    indhold ikke skal vises frem — som i `capitalIncomeLayers`. */
function shareIncomeTax(
  persons: HouseholdTaxInput['persons'],
  rates: RateYear,
): Partial<Record<ShareIncomeLayer, LayerAmount>> {
  const total = Math.max(
    0,
    persons.reduce((sum, { shareIncome }) => sum + shareIncome, 0),
  )
  const threshold = rates.thresholds.shareIncome * persons.length
  const bases: Record<ShareIncomeLayer, Nominal> = {
    shareIncomeBelowThreshold: Math.min(total, threshold),
    shareIncomeAboveThreshold: total - Math.min(total, threshold),
  }

  const layers: Partial<Record<ShareIncomeLayer, LayerAmount>> = {}
  for (const layer of shareIncomeLayers) {
    const base = bases[layer]
    if (base <= 0) continue
    const rate = rates.taxRates[layer]
    layers[layer] = { base, rate, amount: base * rate }
  }
  return layers
}

/** Summen af husstandens skat: hver persons egne lag, plus aktieindkomstens.
    Ikke et felt på opgørelsen, af samme grund som `totalTax` ikke er det —
    gemt ved siden af delene kunne den komme til at sige noget andet end dem,
    og et nyt led i en senere etape ville kunne blive glemt i summen. Det er
    netop den fejl, `simulate` lavede, da den lagde personskatten og
    aktieskatten sammen i hånden. */
export function totalHouseholdTax(assessment: HouseholdTaxAssessment): Nominal {
  const fromPersons = assessment.persons.reduce((total, { tax }) => total + totalTax(tax), 0)
  const fromShareIncome = Object.values(assessment.shareIncomeTax).reduce(
    (total, layer) => total + layer.amount,
    0,
  )

  return fromPersons + fromShareIncome
}
