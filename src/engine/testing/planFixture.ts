import type {
  Entry,
  Holding,
  HoldingVariant,
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
  entries?: Entry[]
  transfers?: Transfer[]
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
    variant = 'CapitalIncome',
    holdings = [],
    grossReturn = 0,
    annualCostRate = 0,
    entries = [],
    transfers = [],
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
            {
              id: 'free-assets',
              name: 'Frie midler',
              variant,
              balance,
              grossReturn,
              annualCostRate,
            },
            ...holdings,
          ],
        },
      ],
    },
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
