import type {
  AgeBound,
  Entry,
  Holding,
  HoldingId,
  HoldingVariant,
  Nominal,
  Period,
  Person,
  PersonId,
  Plan,
  Recurrence,
  SimulationYear,
  Timing,
  Transfer,
} from './plan'
import { latestRateYear } from './rates/rates'
import type { RateYear } from './rates/rateYear'
import { assessTax, totalTax } from './tax/assessTax'
import type { TaxAssessment } from './tax/assessTax'
import type { BufferState, HoldingYear, YearResult } from './yearResult'

type Balances = Map<HoldingId, Nominal>

/** En post sammen med dens beløb i årets løbende priser, for de poster der
    rent faktisk falder i det pågældende år. */
type ActiveEntry = { entry: Entry; amount: Nominal }

/** En overførsel sammen med dens beløb i årets løbende priser, for de
    overførsler der rent faktisk falder i det pågældende år. */
type ActiveTransfer = { transfer: Transfer; amount: Nominal }

/** Fremskriver planen år for år i løbende priser. Ren funktion: samme plan
    giver altid samme årsrække, og planen røres ikke. */
export function simulate(plan: Plan): YearResult[] {
  const bufferError = validateBuffer(plan)
  if (bufferError) throw new Error(bufferError)

  const balances = openingBalances(plan)

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
  const entries = entriesInYear(plan, year)
  const transfers = transfersInYear(plan, year)

  const income = sumOf(entries, 'Income')
  const expenses = sumOf(entries, 'Expense')

  // Afkastet regnes først, på primosaldi og årets strømme alene efter
  // Modified Dietz, jf. ADR-0006 — det afhænger aldrig af skatten, kun
  // omvendt: ShareIncome og CapitalIncome beskattes af netop dette afkast.
  // Kun bufferen modtager poster; en overførsel vejer ind i afkastgrundlaget
  // i begge ender, jf. ADR-0004.
  const bufferFlow = weightedNetFlow(entries)
  const flows = new Map<HoldingId, Nominal>()
  const returns = new Map<HoldingId, Nominal>()
  for (const holding of allHoldings(plan)) {
    const flow =
      (holding.id === plan.buffer ? bufferFlow : 0) +
      weightedTransferFlow(transfers, holding.id)
    flows.set(holding.id, flow)
    const base = opening.get(holding.id)! + flow
    returns.set(holding.id, netReturn(holding) * base)
  }
  const totalReturn = [...returns.values()].reduce((sum, r) => sum + r, 0)

  const shareIncomeByPerson = incomeByVariant(plan, returns, 'ShareIncome')
  const capitalIncomeByPerson = incomeByVariant(plan, returns, 'CapitalIncome')

  const assessments = plan.household.persons.map((person) =>
    assess(plan, entries, person, rates, capitalIncomeByPerson.get(person.id)!),
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
  // En overførsel flytter sit fulde beløb mellem afgiver og modtager. Den
  // rammer aldrig skatten eller pengestrømmen, jf. `Transfer`.
  for (const { transfer, amount } of transfers) {
    balances.set(transfer.from, balances.get(transfer.from)! - amount)
    balances.set(transfer.to, balances.get(transfer.to)! + amount)
  }
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
    holdings: holdingYears(opening, balances, returns, flows),
    persons: assessments.map(({ person, tax }) => ({
      person,
      shareIncome: shareIncomeByPerson.get(person)!,
      capitalIncome: capitalIncomeByPerson.get(person)!,
      tax,
    })),
    bufferState: bufferState(plan, balances),
  }
}

/** Hvorfor bufferen er negativ ved årets slutning, jf. ADR-0008: `Incomplete`
    når resten af husstandens beholdninger tilsammen dækker underskuddet —
    der mangler kun en overførsel — og `Unsustainable` når de ikke gør.
    Fraværende, når bufferen ikke er negativ. */
function bufferState(plan: Plan, closing: Balances): BufferState | undefined {
  const bufferBalance = closing.get(plan.buffer)!
  if (bufferBalance >= 0) return undefined

  const elsewhere = allHoldings(plan)
    .filter((holding) => holding.id !== plan.buffer)
    .reduce((sum, holding) => sum + closing.get(holding.id)!, 0)

  return elsewhere >= -bufferBalance ? 'Incomplete' : 'Unsustainable'
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
function weightedNetFlow(entries: ActiveEntry[]): Nominal {
  return entries.reduce((sum, { entry, amount }) => {
    const signed = entry.direction === 'Income' ? amount : -amount
    return sum + signed * returnWeight(entry.timing)
  }, 0)
}

/** Overførslens vægtede nettostrøm for netop denne beholdning: positiv som
    modtager, negativ som afgiver, nul ellers. Tæller med i afkastgrundlaget
    i begge ender, jf. ADR-0004. */
function weightedTransferFlow(transfers: ActiveTransfer[], holding: HoldingId): Nominal {
  return transfers.reduce((sum, { transfer, amount }) => {
    const weighted = amount * returnWeight(transfer.timing)
    if (transfer.to === holding) return sum + weighted
    if (transfer.from === holding) return sum - weighted
    return sum
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
  entries: ActiveEntry[],
  person: Person,
  rates: RateYear,
  capitalIncome: Nominal,
): { person: string; tax: TaxAssessment } {
  const earnedIncome = entries
    .filter(
      ({ entry }) =>
        entry.direction === 'Income' &&
        entry.owner === person.id &&
        entry.taxTreatment === 'EarnedIncome',
    )
    .reduce((sum, { amount }) => sum + amount, 0)

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
  flows: Map<HoldingId, Nominal>,
): HoldingYear[] {
  return [...closing].map(([holding, closingBalance]) => ({
    holding,
    openingBalance: opening.get(holding) ?? 0,
    closingBalance,
    return: returns.get(holding) ?? 0,
    weightedFlow: flows.get(holding) ?? 0,
  }))
}

function sumOf(entries: ActiveEntry[], direction: Entry['direction']): Nominal {
  return entries
    .filter(({ entry }) => entry.direction === direction)
    .reduce((sum, { amount }) => sum + amount, 0)
}

function entriesInYear(plan: Plan, year: SimulationYear): ActiveEntry[] {
  return plan.entries
    .filter((entry) => appliesInYear(entry, year, ownerOf(plan, entry)))
    .map((entry) => ({
      entry,
      amount: entry.amountInRealKroner * entryProjection(entry, plan.startYear, year),
    }))
}

function ownerOf(plan: Plan, entry: Entry): Person {
  return plan.household.persons.find((person) => person.id === entry.owner)!
}

/** Faktoren der løfter dagens kroner op i årets egne, efter postens egen
    reguleringssats — uafhængig af planens inflationsantagelse. Startåret er
    prisniveauet, så faktoren er 1 dér. */
function entryProjection(entry: Entry, startYear: SimulationYear, year: SimulationYear): number {
  return (1 + entry.regulationRate) ** (year - startYear)
}

/** Om en post falder i det pågældende år: dens periode skal dække året, og
    dens gentagelse skal ramme netop det år. */
function appliesInYear(entry: Entry, year: SimulationYear, owner: Person): boolean {
  const { from, to } = periodBounds(entry.period, owner)
  return withinPeriod(from, to, year) && matchesRecurrence(entry.recurrence, year, from, to)
}

/** En overførsel har ingen ejer at binde en alder til, så dens periode er
    altid rene kalenderår — ingen `periodBounds`-udledning nødvendig. */
function transfersInYear(plan: Plan, year: SimulationYear): ActiveTransfer[] {
  return plan.transfers
    .filter((transfer) => transferAppliesInYear(transfer, year))
    .map((transfer) => ({
      transfer,
      amount: transfer.amountInRealKroner * transferProjection(plan, year),
    }))
}

/** Overførsler har ingen egen reguleringssats — de følger planens generelle
    inflationsantagelse, som enhver anden ureguleret størrelse i planen. */
function transferProjection(plan: Plan, year: SimulationYear): number {
  return (1 + plan.inflationAssumption) ** (year - plan.startYear)
}

function transferAppliesInYear(transfer: Transfer, year: SimulationYear): boolean {
  const { from, to } = transfer.period
  return withinPeriod(from, to, year) && matchesRecurrence(transfer.recurrence, year, from, to)
}

function withinPeriod(
  from: SimulationYear | undefined,
  to: SimulationYear | undefined,
  year: SimulationYear,
): boolean {
  if (from !== undefined && year < from) return false
  if (to !== undefined && year > to) return false
  return true
}

function matchesRecurrence(
  recurrence: Recurrence,
  year: SimulationYear,
  from: SimulationYear | undefined,
  to: SimulationYear | undefined,
): boolean {
  switch (recurrence.kind) {
    case 'Annual':
      return true
    case 'Once':
      return year === (from ?? to)
    case 'EveryNYears':
      return from !== undefined && (year - from) % recurrence.n === 0
  }
}

/** Periodens endepunkter oversat til kalenderår. Ved `PersonAge` følger et
    endepunkt sat til `'WorkEndAge'` `owner.workEndAge`, så perioden flytter
    sig, når erhvervsophørsalderen ændres, uden at posten selv redigeres.

    Eksporteret så fladen kan vise en aldersforankret periode som de årstal,
    den faktisk falder i, med samme udledning som motoren selv bruger. */
export function periodBounds(
  period: Period,
  owner: Person,
): { from?: SimulationYear; to?: SimulationYear } {
  if (period.anchor === 'CalendarYear') {
    return { from: period.from, to: period.to }
  }
  return {
    from: resolveAgeBound(period.from, owner),
    to: resolveAgeBound(period.to, owner),
  }
}

function resolveAgeBound(bound: AgeBound | undefined, owner: Person): SimulationYear | undefined {
  if (bound === undefined) return undefined
  const age = bound === 'WorkEndAge' ? owner.workEndAge : bound
  return owner.birthYear + age
}

function openingBalances(plan: Plan): Balances {
  return new Map(
    allHoldings(plan).map((holding) => [holding.id, holding.balance]),
  )
}

/** Præcis én beholdning skal være bufferen, jf. ADR-0004. Returnerer en
    forklarende dansk fejlbesked, hvis planen har nul eller to — ellers intet.
    Brugt både af `simulate` og af fladen, der viser beskeden i
    resultatspalten frem for at lade planen fejle tavst. */
export function validateBuffer(plan: Plan): string | undefined {
  const matches = allHoldings(plan).filter((holding) => holding.id === plan.buffer)
  if (matches.length === 0) {
    return `Planens buffer peger på beholdningen ${plan.buffer}, som ikke findes.`
  }
  if (matches.length > 1) {
    return `Flere beholdninger er udpeget som buffer.`
  }
  return undefined
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
