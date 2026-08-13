import {
  closeYear,
  fromBalances,
  fromPreviousYear,
  returnOf,
  withFlow,
  withMovement,
} from './holdingYears'
import type { HoldingYears } from './holdingYears'
import type {
  AgeBound,
  Contribution,
  Entry,
  Holding,
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
import { yearAtAge } from './age'
import { hasDeductibility } from './holdingVariant'
import { rateYearFor } from './rates/rates'
import type { RateYear } from './rates/rateYear'
import { statePensionYear } from './statePensionAge'
import { assessHousehold, totalHouseholdTax } from './tax/assessHousehold'
import type { TaxAssessmentInput } from './tax/assessTax'
import { validatePlan } from './validatePlan'
import { totalYearTax } from './yearTax'
import type { BufferState, HoldingYear, RateBasis, YearResult } from './yearResult'

/** En post sammen med dens beløb i årets løbende priser, for de poster der
    rent faktisk falder i det pågældende år. */
type ActiveEntry = { entry: Entry; amount: Nominal }

/** En overførsel sammen med dens beløb i årets løbende priser, for de
    overførsler der rent faktisk falder i det pågældende år. */
type ActiveTransfer = { transfer: Transfer; amount: Nominal }

/** En indbetaling sammen med dens to beløb i årets løbende priser og det
    forfald, den arvede fra sin kilde — for de indbetalinger der rent faktisk
    falder i det pågældende år. */
type ActiveContribution = {
  contribution: Contribution
  fromSource: Nominal
  intoHolding: Nominal
  timing: Timing
}

/** Fremskriver planen år for år i løbende priser. Ren funktion: samme plan
    giver altid samme årsrække, og planen røres ikke.

    En foldning over årene: hvert år åbner sine beholdningsrækker på det
    foregående års ultimosaldi og lukker dem igen i sit årsresultat. Der
    bæres ingen anden tilstand end det. */
export function simulate(plan: Plan): YearResult[] {
  const error = validatePlan(plan)
  if (error) throw new Error(error)

  const holdings = allHoldings(plan)
  const results: YearResult[] = []
  for (let year = plan.startYear; year <= lastYear(plan); year++) {
    const { rates, basis } = rateYearFor(year, plan)
    const previous = results.at(-1)
    const opening =
      previous === undefined
        ? fromBalances(holdings)
        : fromPreviousYear(holdings, previous.holdings)
    results.push(simulateYear(plan, year, opening, rates, basis))
  }
  return results
}

/** Ét simuleringsår: en ren funktion af planen, året og årets primosaldi. */
function simulateYear(
  plan: Plan,
  year: SimulationYear,
  opening: HoldingYears,
  rates: RateYear,
  rateBasis: RateBasis,
): YearResult {
  const entries = entriesInYear(plan, year)
  const transfers = transfersInYear(plan, year)
  const contributions = contributionsInYear(plan, year, entries, rates)

  const income = sumOf(entries, 'Income')
  const expenses = sumOf(entries, 'Expense')

  // Afkastet regnes først, på primosaldi og årets strømme alene efter
  // Modified Dietz, jf. ADR-0006 — det afhænger aldrig af skatten, kun
  // omvendt: aktiedepotets og opsparingskontoens afkast beskattes hos
  // personen som netop dette afkast.
  // Kun bufferen modtager poster; en overførsel vejer ind i afkastgrundlaget
  // i begge ender, jf. ADR-0004.
  const afterEntries = withFlow(opening, plan.buffer, weightedNetFlow(entries))
  const afterTransfers = transfers.reduce((years, { transfer, amount }) => {
    const weighted = amount * returnWeight(transfer.timing)
    return withFlow(withFlow(years, transfer.from, -weighted), transfer.to, weighted)
  }, afterEntries)
  // Indbetalingen vejer ind i begge ender som en overførsel. Bufferen fik
  // hele bruttolønnen vægtet ind med posten, og uden modposten her ville de
  // penge, der gik videre til ordningen, forrente sig to steder på én gang.
  // Det er nettobeløbet, der vejes: AM-delen forlader bufferen som skat, og
  // skat rører aldrig afkastgrundlaget.
  const flowed = contributions.reduce((years, { contribution, intoHolding, timing }) => {
    const weighted = intoHolding * returnWeight(timing)
    return withFlow(withFlow(years, plan.buffer, -weighted), contribution.to, weighted)
  }, afterTransfers)

  const shareIncomeByPerson = incomeByVariant(plan, flowed, 'ShareDepot')
  const capitalIncomeByPerson = incomeByVariant(plan, flowed, 'SavingsAccount')
  const withDeductibilityByPerson = contributionsWithDeductibility(plan, contributions)

  // Hele husstandens skat bag ét søm, jf. ADR-0014. Motoren lægger intet
  // sammen selv: aktieindkomstens skat er husstandens og hører ikke til
  // nogen enkelt person, og totalen er modulets egen sum af sine dele.
  const household = assessHousehold(
    {
      persons: plan.household.persons.map((person) => ({
        tax: taxInput(entries, person, rates, year, {
          capitalIncome: capitalIncomeByPerson.get(person.id)!,
          withDeductibility: withDeductibilityByPerson.get(person.id)!,
        }),
        shareIncome: shareIncomeByPerson.get(person.id)!,
      })),
    },
    rates,
  )
  // Årets restpost lander på bufferen. Den er det ene sted, over- og
  // underskuddet må samle sig, og den må gerne gå negativt — det er modellens
  // måde at sige, at planen ikke holder, jf. ADR-0002.
  //
  // Kun husstandens egen skat trækkes her. Beholdningsskatten er allerede
  // trukket af beholdningen selv ved lukningen og passerer aldrig
  // pengestrømmen; trak bufferen den også, ville den være betalt to gange.
  const settled = withMovement(
    flowed,
    plan.buffer,
    income - totalHouseholdTax(household) - expenses,
  )

  // En overførsel flytter sit fulde beløb mellem afgiver og modtager. Den
  // rammer aldrig skatten eller pengestrømmen, jf. `Transfer`.
  const moved = transfers.reduce(
    (years, { transfer, amount }) =>
      withMovement(withMovement(years, transfer.from, -amount), transfer.to, amount),
    settled,
  )

  // Indbetalingen tilføjer intet led til balanceinvarianten: den er en
  // intern bevægelse ligesom en overførsel. Bufferen belastes nettobeløbet,
  // fordi AM-delen allerede er trukket som en del af årets skat — trak vi
  // bruttobeløbet ud og lagde nettobeløbet ind, ville AM-delen forsvinde to
  // gange, og invarianten knække.
  const contributed = contributions.reduce(
    (years, { contribution, intoHolding }) =>
      withMovement(
        withMovement(years, plan.buffer, -intoHolding),
        contribution.to,
        intoHolding,
      ),
    moved,
  )

  // Lukningen krediterer afkastet og trækker beholdningsskatten, jf. diagram
  // 02. Først dér er alle tre bærere af årets skat kendt, og først dér kan
  // de lægges sammen.
  const holdings = closeYear(contributed, rates)
  const tax = totalYearTax(household, holdings)

  return {
    year,
    rateBasis,
    openingWealth: sumOver(holdings, (holding) => holding.openingBalance),
    closingWealth: sumOver(holdings, (holding) => holding.closingBalance),
    income,
    return: sumOver(holdings, (holding) => holding.return),
    tax,
    expenses,
    conversion: 0,
    holdings,
    entries: entries.map(({ entry, amount }) => ({ entry: entry.id, amount })),
    contributions: contributions.map(({ contribution, fromSource, intoHolding }) => ({
      contribution: contribution.id,
      fromSource,
      intoHolding,
    })),
    persons: plan.household.persons.map((person, index) => ({
      person: person.id,
      shareIncome: shareIncomeByPerson.get(person.id)!,
      capitalIncome: capitalIncomeByPerson.get(person.id)!,
      tax: household.persons[index]!.tax,
      marginalTaxRate: household.persons[index]!.marginalTaxRate,
    })),
    shareIncomeTax: household.shareIncomeTax,
    bufferState: bufferState(plan, holdings),
  }
}

function sumOver(holdings: HoldingYear[], of: (holding: HoldingYear) => Nominal): Nominal {
  return holdings.reduce((sum, holding) => sum + of(holding), 0)
}

/** Hvorfor bufferen er negativ ved årets slutning, jf. ADR-0008: `Incomplete`
    når resten af husstandens beholdninger tilsammen dækker underskuddet —
    der mangler kun en overførsel — og `Unsustainable` når de ikke gør.
    Fraværende, når bufferen ikke er negativ. */
function bufferState(plan: Plan, holdings: HoldingYear[]): BufferState | undefined {
  const buffer = holdings.find((holding) => holding.holding === plan.buffer)!
  if (buffer.closingBalance >= 0) return undefined

  const elsewhere = holdings
    .filter((holding) => holding.holding !== plan.buffer)
    .reduce((sum, holding) => sum + holding.closingBalance, 0)

  return elsewhere >= -buffer.closingBalance ? 'Incomplete' : 'Unsustainable'
}

/** Summen af afkastet på en persons beholdninger af én variant — grundlaget
    for aktie- og kapitalindkomsten pr. person, jf. ADR-0010. */
function incomeByVariant(
  plan: Plan,
  years: HoldingYears,
  variant: HoldingVariant,
): Map<PersonId, Nominal> {
  return new Map(
    plan.household.persons.map((person) => [
      person.id,
      person.holdings
        .filter((holding) => holding.variant === variant)
        .reduce((sum, holding) => sum + returnOf(years, holding.id), 0),
    ]),
  )
}

/** Summen af årets strømme, hver vægtet efter sit forfald — grundlaget der
    lægges til primosaldoen i Modified Dietz. */
function weightedNetFlow(entries: ActiveEntry[]): Nominal {
  return entries.reduce((sum, { entry, amount }) => {
    const signed = entry.direction === 'Income' ? amount : -amount
    return sum + signed * returnWeight(entry.timing)
  }, 0)
}

/** `Even` er det matematisk rigtige for jævnt fordelte strømme, ikke en
    tilnærmelse; måned N vejer strømmen efter, hvor meget af året der er
    tilbage, jf. ADR-0006. Eksporteret så fladen kan vise afkastvægten for en
    post uden at regne den om. */
export function returnWeight(timing: Timing): number {
  return timing === 'Even' ? 0.5 : (12 - timing + 1) / 12
}

/** Summen af det, der landede i hver persons ordninger med `Deductibility`.
    Det er denne gruppering — og aldrig en `HoldingVariant` — der krydser
    skattesømmet: skattereglen hedder ikke "ratepension giver fradragsret",
    men "indbetalinger til ordninger, hvis udbetaling er personlig indkomst,
    giver fradragsret", og hvilke varianter det så er, er varianttabellens
    viden og ikke skattens, jf. ADR-0016 og ADR-0014. Det er det samme greb
    som `capitalIncome`, der også krydser som et tal.

    Det er beløbet, der **landede**, og ikke det, der forlod kilden: både
    fradragsretten og det ekstra pensionsfradrags grundlag måler efter
    AM-bidrag, jf. docs/satser/2026.md. */
function contributionsWithDeductibility(
  plan: Plan,
  contributions: ActiveContribution[],
): Map<PersonId, Nominal> {
  return new Map(
    plan.household.persons.map((person) => [
      person.id,
      person.holdings
        .filter(hasDeductibility)
        .reduce(
          (sum, holding) =>
            sum +
            contributions
              .filter(({ contribution }) => contribution.to === holding.id)
              .reduce((into, { intoHolding }) => into + intoHolding, 0),
          0,
        ),
    ]),
  )
}

/** Det, en persons skat skal regnes af — selve opgørelsen sker bag
    skattesømmet. Kommune- og kirkeskatteprocenten slås op i satsåret efter
    personens bopælskommune. Kirkeskatten slås fra ved at regne med nul, når
    personen ikke er medlem af folkekirken.

    Årets indbetaling med `Deductibility` går med som ét tal og udelades, når
    den er nul — så står året uden indbetaling, og fradraget følger
    indbetalingen frem for personen. Årstællingen frem til
    folkepensionsalderen går gennem `statePensionYear`, motorens eneste vej
    til det årstal, så det ekstra pensionsfradrags 15-årsgrænse og
    folkepensionens egen start ikke kan skille sig i det halve år.

    De to tal, `simulateYear` allerede har regnet pr. person, står i ét
    argument frem for som to `Nominal` ved siden af hinanden: to bare tal i
    træk kan byttes om uden at compileren siger fra, og det er præcis den
    slags fejl, der ikke viser sig som andet end en forkert skat. */
function taxInput(
  entries: ActiveEntry[],
  person: Person,
  rates: RateYear,
  year: SimulationYear,
  ofPerson: { capitalIncome: Nominal; withDeductibility: Nominal },
): TaxAssessmentInput {
  const earnedIncome = entries
    .filter(
      ({ entry }) =>
        entry.direction === 'Income' &&
        entry.owner === person.id &&
        entry.taxTreatment === 'EarnedIncome',
    )
    .reduce((sum, { amount }) => sum + amount, 0)

  const municipalTax = rates.municipalTax.rates[person.municipality]!

  return {
    earnedIncome,
    municipalTaxRate: municipalTax.municipalTaxRate,
    churchTaxRate: person.churchMember ? municipalTax.churchTaxRate : 0,
    capitalIncome: ofPerson.capitalIncome,
    ...(ofPerson.withDeductibility > 0
      ? {
          contribution: {
            withDeductibility: ofPerson.withDeductibility,
            yearsToStatePensionAge: statePensionYear(person) - year,
          },
        }
      : {}),
  }
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
      amount: entry.amountInRealKroner * entryProjection(entry, plan, year),
    }))
}

function ownerOf(plan: Plan, entry: Entry): Person {
  return plan.household.persons.find((person) => person.id === entry.owner)!
}

/** Faktoren der løfter dagens kroner op i årets egne. En indtægt følger sin
    egen reguleringssats, uafhængig af planens inflationsantagelse; en udgift
    har ingen egen sats og følger inflationen, som en overførsel gør.
    Startåret er prisniveauet, så faktoren er 1 dér.

    Intern: fladen viser postens beløb ved at slå året op i motorens egen
    årsrække frem for at regne fremskrivningen om, jf. ADR-0012. */
function entryProjection(entry: Entry, plan: Plan, year: SimulationYear): number {
  const rate =
    entry.direction === 'Income' ? entry.regulationRate : plan.inflationAssumption
  return (1 + rate) ** (year - plan.startYear)
}

/** Om en post falder i det pågældende år: dens periode skal dække året, og
    dens gentagelse skal ramme netop det år. */
function appliesInYear(entry: Entry, year: SimulationYear, owner: Person): boolean {
  const { from, to } = periodBounds(entry.period, owner)
  return withinPeriod(from, to, year) && matchesRecurrence(entry.recurrence, year, from, to)
}

/** Årets indbetalinger med deres to beløb. Et lønkildet bidrag har ingen
    periode at prøve: det falder præcis de år, dets lønpost falder, og
    ophører derfor af sig selv, når lønnen gør — det er hele pointen med at
    lade det pege på posten frem for at give det en periode, der kan komme ud
    af trit, jf. ADR-0016.

    Det, der forlader kilden, er brutto. AM-behandlingen følger kilden: er
    lønposten AM-pligtig, er AM-bidraget af de penge allerede betalt i
    personens eget skattelag, og der lander 92 % i beholdningen. */
function contributionsInYear(
  plan: Plan,
  year: SimulationYear,
  entries: ActiveEntry[],
  rates: RateYear,
): ActiveContribution[] {
  return plan.contributions.flatMap((contribution) => {
    const source = entries.find(({ entry }) => entry.id === contribution.source)
    if (source === undefined) return []

    const fromSource =
      'percentageOfEntry' in contribution
        ? source.amount * contribution.percentageOfEntry
        : contribution.amountInRealKroner * entryProjection(source.entry, plan, year)

    // AM-behandlingen følger kilden. En AM-pligtig lønpost har allerede
    // betalt bidraget af hele sit bruttobeløb i personens eget skattelag, og
    // der lander derfor 92 %; en skattefri indtægt har aldrig båret AM, og
    // hele beløbet går ind.
    const labourMarketContribution =
      source.entry.direction === 'Income' && source.entry.taxTreatment === 'EarnedIncome'
        ? rates.taxRates.labourMarketContribution
        : 0

    return [
      {
        contribution,
        fromSource,
        intoHolding: fromSource * (1 - labourMarketContribution),
        timing: source.entry.timing,
      },
    ]
  })
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

    Intern: fladen læser de årstal, posten faktisk falder i, af årsrækken —
    som desuden er klippet mod horisonten, hvilket denne ikke er, jf.
    ADR-0012. */
function periodBounds(
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
  return yearAtAge(owner, age)
}

function allHoldings(plan: Plan): Holding[] {
  return plan.household.persons.flatMap((person) => person.holdings)
}

function lastYear(plan: Plan): SimulationYear {
  const horizons = plan.household.persons.map(
    (person) => person.birthYear + person.horizon,
  )
  return Math.max(...horizons)
}
