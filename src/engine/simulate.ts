import type {
  Entry,
  Holding,
  HoldingId,
  HoldingVariant,
  Nominal,
  Person,
  PersonId,
  Plan,
  SimulationYear,
  Timing,
} from './plan'
import { latestRateYear } from './rates/rates'
import type { RateYear } from './rates/rateYear'
import { assessTax, totalTax } from './tax/assessTax'
import type { TaxAssessment } from './tax/assessTax'
import type { HoldingYear, YearResult } from './yearResult'

type Balances = Map<HoldingId, Nominal>

/** Fremskriver planen år for år i løbende priser. Ren funktion: samme plan
    giver altid samme årsrække, og planen røres ikke. */
export function simulate(plan: Plan): YearResult[] {
  const balances = openingBalances(plan)
  if (!balances.has(plan.buffer)) {
    throw new Error(
      `Planens buffer peger på beholdningen ${plan.buffer}, som ikke findes.`,
    )
  }

  const rates = latestRateYear()
  const results: YearResult[] = []
  for (let year = plan.startYear; year <= lastYear(plan); year++) {
    results.push(simulateYear(plan, year, balances, rates))
  }
  return results
}

/** Ét simuleringsår. `balances` går ind med primosaldi og kommer ud med
    ultimosaldi — det er den ene tilstand, der bæres fra år til år. */
function simulateYear(
  plan: Plan,
  year: SimulationYear,
  balances: Balances,
  rates: RateYear,
): YearResult {
  const opening = new Map(balances)
  const projection = inflation(plan, year)

  const income = sumOf(plan.entries, 'Income', projection)
  const expenses = sumOf(plan.entries, 'Expense', projection)

  // Afkastet regnes først, på primosaldi og årets strømme alene efter
  // Modified Dietz, jf. ADR-0006 — det afhænger aldrig af skatten, kun
  // omvendt: ShareIncome og CapitalIncome beskattes af netop dette afkast.
  // Kun bufferen modtager poster i denne skive — indbetalinger og
  // overførsler rammer andre beholdninger i senere etaper.
  const bufferFlow = weightedNetFlow(plan.entries, projection)
  const returns = new Map<HoldingId, Nominal>()
  for (const holding of allHoldings(plan)) {
    const base =
      opening.get(holding.id)! + (holding.id === plan.buffer ? bufferFlow : 0)
    returns.set(holding.id, netReturn(holding) * base)
  }
  const totalReturn = [...returns.values()].reduce((sum, r) => sum + r, 0)

  const shareIncomeByPerson = incomeByVariant(plan, returns, 'ShareIncome')
  const capitalIncomeByPerson = incomeByVariant(plan, returns, 'CapitalIncome')

  const assessments = plan.household.persons.map((person) =>
    assess(plan, person, projection, rates, capitalIncomeByPerson.get(person.id)!),
  )
  const personalTax = assessments.reduce((sum, { tax }) => sum + totalTax(tax), 0)
  const shareTax = shareIncomeTax(
    plan.household.persons.map((person) => shareIncomeByPerson.get(person.id)!),
    rates,
  )
  const tax = personalTax + shareTax

  // Årets restpost lander på bufferen. Den er det ene sted, over- og
  // underskuddet må samle sig, og den må gerne gå negativt — det er modellens
  // måde at sige, at planen ikke holder, jf. ADR-0002.
  balances.set(plan.buffer, balances.get(plan.buffer)! + income - tax - expenses)
  for (const [holding, credited] of returns) {
    balances.set(holding, balances.get(holding)! + credited)
  }

  return {
    year,
    rateYear: rates.year,
    openingWealth: total(opening),
    closingWealth: total(balances),
    income,
    return: totalReturn,
    tax,
    expenses,
    conversion: 0,
    holdings: holdingYears(opening, balances, returns),
    persons: assessments.map(({ person, tax }) => ({
      person,
      shareIncome: shareIncomeByPerson.get(person)!,
      capitalIncome: capitalIncomeByPerson.get(person)!,
      tax,
    })),
  }
}

/** Summen af afkastet på en persons beholdninger af én variant — grundlaget
    for aktie- og kapitalindkomsten pr. person, jf. ADR-0010. */
function incomeByVariant(
  plan: Plan,
  returns: Map<HoldingId, Nominal>,
  variant: HoldingVariant,
): Map<PersonId, Nominal> {
  return new Map(
    plan.household.persons.map((person) => [
      person.id,
      person.holdings
        .filter((holding) => holding.variant === variant)
        .reduce((sum, holding) => sum + returns.get(holding.id)!, 0),
    ]),
  )
}

/** Aktieindkomstens progressionsgrænse er fælles og overførbar mellem
    ægtefæller, så skatten regnes af husstandens samlede aktieindkomst mod
    husstandens samlede grænse — aldrig person for person, jf. ADR-0010 og
    docs/satser/2026.md. Summen lagres ikke; den findes kun her. */
function shareIncomeTax(shareIncomes: Nominal[], rates: RateYear): Nominal {
  const total = Math.max(0, shareIncomes.reduce((sum, income) => sum + income, 0))
  const threshold = rates.thresholds.shareIncome * shareIncomes.length
  const belowThreshold = Math.min(total, threshold)
  const aboveThreshold = total - belowThreshold

  return (
    belowThreshold * rates.taxRates.shareIncomeBelowThreshold +
    aboveThreshold * rates.taxRates.shareIncomeAboveThreshold
  )
}

/** Nettoafkastsatsen er bruttoafkast minus ÅOP — udledt og aldrig et gemt
    felt, jf. CONTEXT.md. */
function netReturn(holding: Holding): number {
  return holding.grossReturn - holding.annualCostRate
}

/** Summen af årets strømme, hver vægtet efter sit forfald — grundlaget der
    lægges til primosaldoen i Modified Dietz. */
function weightedNetFlow(entries: Entry[], projection: number): Nominal {
  return entries.reduce((sum, entry) => {
    const signed =
      entry.direction === 'Income' ? entry.amountInRealKroner : -entry.amountInRealKroner
    return sum + signed * projection * returnWeight(entry.timing)
  }, 0)
}

/** `Even` er det matematisk rigtige for jævnt fordelte strømme, ikke en
    tilnærmelse; måned N vejer strømmen efter, hvor meget af året der er
    tilbage, jf. ADR-0006. */
function returnWeight(timing: Timing): number {
  return timing === 'Even' ? 0.5 : (12 - timing + 1) / 12
}

/** Skatteopgørelsen for én person i ét år. Kirkeskatten slås fra ved at regne
    med nul — satsen på planen står urørt, så den er der igen, hvis den slås
    til. */
function assess(
  plan: Plan,
  person: Person,
  projection: number,
  rates: RateYear,
  capitalIncome: Nominal,
): { person: string; tax: TaxAssessment } {
  const earnedIncome = plan.entries
    .filter(
      (entry) =>
        entry.direction === 'Income' &&
        entry.owner === person.id &&
        entry.taxTreatment === 'EarnedIncome',
    )
    .reduce((sum, entry) => sum + entry.amountInRealKroner * projection, 0)

  return {
    person: person.id,
    tax: assessTax(
      {
        earnedIncome,
        municipalTaxRate: plan.municipalTaxRate,
        churchTaxRate: plan.churchTax ? plan.churchTaxRate : 0,
        capitalIncome,
      },
      rates,
    ),
  }
}

function holdingYears(
  opening: Balances,
  closing: Balances,
  returns: Map<HoldingId, Nominal>,
): HoldingYear[] {
  return [...closing].map(([holding, closingBalance]) => ({
    holding,
    openingBalance: opening.get(holding) ?? 0,
    closingBalance,
    return: returns.get(holding) ?? 0,
  }))
}

function sumOf(
  entries: Entry[],
  direction: Entry['direction'],
  projection: number,
): Nominal {
  return entries
    .filter((entry) => entry.direction === direction)
    .reduce((sum, entry) => sum + entry.amountInRealKroner * projection, 0)
}

/** Faktoren der løfter dagens kroner op i årets egne. Startåret er
    prisniveauet, så faktoren er 1 dér. */
function inflation(plan: Plan, year: SimulationYear): number {
  return (1 + plan.inflationAssumption) ** (year - plan.startYear)
}

function openingBalances(plan: Plan): Balances {
  return new Map(
    allHoldings(plan).map((holding) => [holding.id, holding.balance]),
  )
}

function allHoldings(plan: Plan): Holding[] {
  return plan.household.persons.flatMap((person) => person.holdings)
}

function total(balances: Balances): Nominal {
  return [...balances.values()].reduce((sum, balance) => sum + balance, 0)
}

function lastYear(plan: Plan): SimulationYear {
  const horizons = plan.household.persons.map(
    (person) => person.birthYear + person.horizon,
  )
  return Math.max(...horizons)
}
