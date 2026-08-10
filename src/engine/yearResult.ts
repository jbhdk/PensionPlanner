import type { HoldingId, Nominal, PersonId, SimulationYear } from './plan'
import type { TaxAssessment } from './tax/assessTax'

export type HoldingYear = {
  holding: HoldingId
  openingBalance: Nominal
  closingBalance: Nominal
}

/** Årets skatteopgørelse for én person. Indkomsten føres pr. person og aldrig
    som husstandssum, jf. ADR-0010: skatten summerer over husstanden, men
    aftrapningen bruger persongrundlaget, og en gemt sum kan ikke splittes. */
export type PersonYear = {
  person: PersonId
  tax: TaxAssessment
}

/** Motorens fulde output for ét simuleringsår — alle mellemregninger, ikke
    kun totaler. De syv strømme er balanceinvariantens led:

      closingWealth − openingWealth = income + return − tax − expenses − conversion

    Felter, som denne skive ikke fylder, står som nul frem for at mangle. */
export type YearResult = {
  year: SimulationYear
  /** Satsgrundlaget, året er regnet på, jf. ADR-0005. */
  rateYear: SimulationYear
  openingWealth: Nominal
  closingWealth: Nominal
  income: Nominal
  return: Nominal
  tax: Nominal
  expenses: Nominal
  conversion: Nominal
  holdings: HoldingYear[]
  persons: PersonYear[]
}
