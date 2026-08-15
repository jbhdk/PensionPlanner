import type {
  Contribution,
  Entry,
  Holding,
  HoldingVariant,
  OpenedOn,
  Municipality,
  Period,
  Plan,
  Recurrence,
  SimulationYear,
  Timing,
  Transfer,
} from '../plan'
import type { YearResult } from '../yearResult'

type Options = {
  startYear?: number
  inflationAssumption?: number
  section20ProjectionAssumption?: number
  benefitProjectionAssumption?: number
  birthYear?: number
  birthMonth?: number
  workEndAge?: number
  horizon?: number
  balance?: number
  variant?: HoldingVariant
  /** Beholdninger ved siden af bufferen, i den rækkefølge de skal stå.
      Bufferen er altid den første — testene skruer på det, de handler om. */
  holdings?: Holding[]
  grossReturn?: number
  annualCostRate?: number
  /** Bufferbeholdningens oprettelsestidspunkt. Bruges kun, når `variant` er
      en pensionsordning — de tre øvrige varianter har ikke feltet. */
  openedOn?: OpenedOn
  entries?: Entry[]
  transfers?: Transfer[]
  contributions?: Contribution[]
  municipality?: Municipality
  churchMember?: boolean
}

/** Hele horisonten, hvert år — sådan en post løber, med mindre testen
    angiver noget andet. */
const wholeHorizon: Period = { anchor: 'CalendarYear' }
const annually: Recurrence = { kind: 'Annual' }

/** Den tyndeste gyldige plan: én person, én beholdning der er buffer, ingen
    poster. Testene skruer på det, de handler om, og lader resten stå.

    Bopælskommunen er Hvidovre, den samme kommuneskat som i skattemodulets
    facitcase, så en lønpost her og en opgørelse dér kan sammenlignes — jf.
    docs/satser/2026.md. */
export function aPlan(options: Options = {}): Plan {
  const {
    startYear = 2026,
    inflationAssumption = 0,
    section20ProjectionAssumption = 0,
    benefitProjectionAssumption = 0,
    birthYear = 1973,
    birthMonth = 6,
    workEndAge = 58,
    horizon = 90,
    balance = 1_000_000,
    variant = 'SavingsAccount',
    openedOn = { year: 2018, month: 1 },
    holdings = [],
    grossReturn = 0,
    annualCostRate = 0,
    entries = [],
    transfers = [],
    contributions = [],
    municipality = 'Hvidovre',
    churchMember = true,
  } = options

  return {
    name: 'Ophør som 58',
    startYear,
    inflationAssumption,
    section20ProjectionAssumption,
    benefitProjectionAssumption,
    buffer: 'free-assets',
    entries,
    transfers,
    contributions,
    household: {
      persons: [
        {
          id: 'jesper',
          name: 'Jesper',
          birthYear,
          birthMonth,
          workEndAge,
          horizon,
          municipality,
          churchMember,
          holdings: [
            bufferHolding({ variant, balance, grossReturn, annualCostRate, openedOn }),
            ...holdings,
          ],
        },
      ],
    },
  }
}

/** Fixturens første beholdning. Oprettelsestidspunktet skrives kun, når
    varianten er en pensionsordning: de tre øvrige varianter har ikke feltet,
    og en fixture, der gav dem det alligevel, ville skrive en plan, typen
    ikke tillader — og dermed skjule netop det, felternes plads i unionen er
    til for. */
function bufferHolding(options: {
  variant: HoldingVariant
  balance: number
  grossReturn: number
  annualCostRate: number
  openedOn: OpenedOn
}): Holding {
  const { variant, openedOn, ...rest } = options
  const base = { id: 'free-assets', name: 'Frie midler', ...rest }
  switch (variant) {
    case 'InstalmentPension':
    case 'LifeAnnuity':
    case 'OldAgeSavings':
      return { ...base, variant, openedOn }
    default:
      return { ...base, variant }
  }
}

/** En udgiftspost. Forankring og gentagelse er låst i denne skive: posten
    løber hele horisonten, hvert år. Forfald er jævnt fordelt, med mindre
    andet angives. */
export function anExpense(options: {
  amountInRealKroner: number
  timing?: Timing
  period?: Period
  recurrence?: Recurrence
}): Entry {
  return {
    id: 'living-costs',
    name: 'Faste udgifter',
    amountInRealKroner: options.amountInRealKroner,
    owner: 'jesper',
    direction: 'Expense',
    timing: options.timing ?? 'Even',
    period: options.period ?? wholeHorizon,
    recurrence: options.recurrence ?? annually,
  }
}

/** En lønpost. Beløbet er brutto inklusive arbejdsgiverbidrag, jf. ADR-0007. */
export function aSalary(options: {
  amountInRealKroner: number
  owner?: string
  timing?: Timing
  period?: Period
  recurrence?: Recurrence
  regulationRate?: number
}): Entry {
  return {
    id: 'salary',
    name: 'Løn',
    amountInRealKroner: options.amountInRealKroner,
    owner: options.owner ?? 'jesper',
    direction: 'Income',
    taxTreatment: 'EarnedIncome',
    timing: options.timing ?? 'Even',
    period: options.period ?? wholeHorizon,
    recurrence: options.recurrence ?? annually,
    regulationRate: options.regulationRate ?? 0,
  }
}

/** En overførsel mellem to beholdninger. Perioden er altid kalenderårsforankret. */
export function aTransfer(options: {
  from: string
  to: string
  amountInRealKroner: number
  timing?: Timing
  period?: { from?: SimulationYear; to?: SimulationYear }
  recurrence?: Recurrence
}): Transfer {
  return {
    id: 'transfer',
    from: options.from,
    to: options.to,
    amountInRealKroner: options.amountInRealKroner,
    timing: options.timing ?? 'Even',
    period: options.period ?? {},
    recurrence: options.recurrence ?? annually,
  }
}

/** Saldoen på den beholdning, fixturen udpeger som buffer. */
export function bufferBalance(year: YearResult): number {
  return year.holdings.find((holding) => holding.holding === 'free-assets')!
    .closingBalance
}

/** En skattefri indtægtspost — en arv, for eksempel. */
export function aTaxFreeIncome(options: {
  amountInRealKroner: number
  timing?: Timing
  period?: Period
  recurrence?: Recurrence
  regulationRate?: number
}): Entry {
  return {
    id: 'inheritance',
    name: 'Arv',
    amountInRealKroner: options.amountInRealKroner,
    owner: 'jesper',
    direction: 'Income',
    taxTreatment: 'TaxFree',
    timing: options.timing ?? 'Even',
    period: options.period ?? wholeHorizon,
    recurrence: options.recurrence ?? annually,
    regulationRate: options.regulationRate ?? 0,
  }
}

/** En pensionsindkomstpost — ATP, for eksempel. Den beskattes som personlig
    indkomst uden AM-bidrag og giver hverken beskæftigelses- eller
    jobfradrag. Der findes ingen `Benefit`-figur at skrive den som, jf.
    ADR-0023. */
export function aPensionIncome(options: {
  amountInRealKroner: number
  name?: string
  owner?: string
  timing?: Timing
  period?: Period
  recurrence?: Recurrence
  regulationRate?: number
}): Entry {
  return {
    id: 'atp',
    name: options.name ?? 'ATP',
    amountInRealKroner: options.amountInRealKroner,
    owner: options.owner ?? 'jesper',
    direction: 'Income',
    taxTreatment: 'PensionIncome',
    timing: options.timing ?? 'Even',
    period: options.period ?? wholeHorizon,
    recurrence: options.recurrence ?? annually,
    regulationRate: options.regulationRate ?? 0,
  }
}

/** Et lønkildet bidrag. Det bærer hverken periode, forankring, gentagelse
    eller forfald — dem arver det fra sin lønpost, jf. ADR-0016. */
export function aContribution(
  options: { source: string; to: string } & (
    | { percentageOfEntry: number }
    | { amountInRealKroner: number }
  ),
): Contribution {
  return { id: 'contribution', kind: 'EntrySourced', ...options }
}

/** Et beholdningskildet bidrag. Det har ingen post at arve fra og bærer
    derfor periode, forankring, gentagelse og forfald selv, som en `Transfer`
    gør. Beløbet er altid et fast kronebeløb: en procent skal have en post at
    måle af, og den har det her ikke. */
export function aHoldingContribution(options: {
  source: string
  to: string
  amountInRealKroner: number
  timing?: Timing
  period?: Period
  recurrence?: Recurrence
}): Contribution {
  return {
    id: 'contribution',
    kind: 'HoldingSourced',
    source: options.source,
    to: options.to,
    amountInRealKroner: options.amountInRealKroner,
    timing: options.timing ?? 'Even',
    period: options.period ?? wholeHorizon,
    recurrence: options.recurrence ?? annually,
  }
}
