import type { Nominal } from './plan'
import type { HouseholdTaxAssessment } from './tax/assessHousehold'
import { totalHouseholdTax } from './tax/assessHousehold'
import type { HoldingYear } from './yearResult'

/** Årets samlede skat: husstandens egen — personernes lag plus
    aktieindkomstens — plus beholdningernes, plus årets afgifter på
    overførsler ud af en `Chargeable` ordning.

    De fire bærere lægges sammen her og ingen andre steder. `simulate` må
    ikke summere skatter i hånden: det var netop den fejl, ADR-0014 blev
    skrevet om, og den bliver ikke bedre af at blive lavet et niveau længere
    oppe. Et nyt led i en senere etape hører hjemme her, hvor det ikke kan
    glemmes.

    `HoldingTax` er ikke nogen persons skat og passerer ingen indkomst, men
    den er en skat husstanden betaler, og den hører derfor med i
    `YearResult.tax` — ellers går balanceinvarianten ikke op. Afgiften på en
    overførsel er af samme slags: den passerer ingen indkomst og rører intet
    `TaxLayer`, men den forlader husstanden til staten præcis som
    `HoldingTax` gør, og har derfor ikke sit eget led i invarianten, jf.
    ADR-0029. */
export function totalYearTax(
  household: HouseholdTaxAssessment,
  holdings: HoldingYear[],
  transferCharges: Nominal,
): Nominal {
  const fromHoldings = holdings.reduce((total, holding) => total + holding.tax, 0)

  return totalHouseholdTax(household) + fromHoldings + transferCharges
}
