import type {
  Entry,
  Holding,
  HoldingId,
  Nominal,
  Person,
  Plan,
  SimulationYear,
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
  const assessments = plan.household.persons.map((person) =>
    assess(plan, person, projection, rates),
  )
  const tax = assessments.reduce((sum, { tax }) => sum + totalTax(tax), 0)

  // Årets restpost lander på bufferen. Den er det ene sted, over- og
  // underskuddet må samle sig, og den må gerne gå negativt — det er modellens
  // måde at sige, at planen ikke holder, jf. ADR-0002.
  balances.set(plan.buffer, balances.get(plan.buffer)! + income - tax - expenses)

  return {
    year,
    rateYear: rates.year,
    openingWealth: total(opening),
    closingWealth: total(balances),
    income,
    return: 0,
    tax,
    expenses,
    conversion: 0,
    holdings: holdingYears(opening, balances),
    persons: assessments,
  }
}

/** Skatteopgørelsen for én person i ét år. Kirkeskatten slås fra ved at regne
    med nul — satsen på planen står urørt, så den er der igen, hvis den slås
    til. */
function assess(
  plan: Plan,
  person: Person,
  projection: number,
  rates: RateYear,
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
      },
      rates,
    ),
  }
}

function holdingYears(opening: Balances, closing: Balances): HoldingYear[] {
  return [...closing].map(([holding, closingBalance]) => ({
    holding,
    openingBalance: opening.get(holding) ?? 0,
    closingBalance,
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
