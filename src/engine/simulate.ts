import type {
  Direction,
  Entry,
  Holding,
  HoldingId,
  Nominal,
  Plan,
  SimulationYear,
} from './plan'
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

  const results: YearResult[] = []
  for (let year = plan.startYear; year <= lastYear(plan); year++) {
    results.push(simulateYear(plan, year, balances))
  }
  return results
}

/** Ét simuleringsår. `balances` går ind med primosaldi og kommer ud med
    ultimosaldi — det er den ene tilstand, der bæres fra år til år. */
function simulateYear(
  plan: Plan,
  year: SimulationYear,
  balances: Balances,
): YearResult {
  const opening = new Map(balances)
  const projection = inflation(plan, year)

  // Indtægtsposter findes som retning, men bogføres først i #4 sammen med
  // deres skattebehandling — de kan ikke oprettes i fladen endnu.
  const expenses = sumOf(plan.entries, 'Expense', projection)

  // Årets restpost lander på bufferen. Den er det ene sted, over- og
  // underskuddet må samle sig, og den må gerne gå negativt — det er modellens
  // måde at sige, at planen ikke holder, jf. ADR-0002.
  balances.set(plan.buffer, balances.get(plan.buffer)! - expenses)

  return {
    year,
    openingWealth: total(opening),
    closingWealth: total(balances),
    income: 0,
    return: 0,
    tax: 0,
    expenses,
    conversion: 0,
    holdings: holdingYears(opening, balances),
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
  direction: Direction,
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
