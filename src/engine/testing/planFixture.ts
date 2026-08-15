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
  Timing,
  Transfer,
} from '../plan'
import type { YearResult } from '../yearResult'

type Options = {
  startYear?: number
  inflationAssumption?: number
  section20ProjectionAssumption?: number
  statePensionProjectionAssumption?: number
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
    statePensionProjectionAssumption = 0,
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
    statePensionProjectionAssumption,
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
            aHolding({
              id: 'free-assets',
              name: 'Frie midler',
              variant,
              balance,
              grossReturn,
              annualCostRate,
              openedOn,
            }),
            ...holdings,
          ],
        },
      ],
    },
  }
}

/** En beholdning af den ønskede variant. Opslaget på varianten er det
    eneste, der kan skrive unionen, når varianten først kendes ved kaldet —
    uden et cast, som netop ville skjule det, felternes plads i unionen er
    til for.

    Oprettelsestidspunktet skrives kun for de tre pensionsordninger, og
    livrentens tre omsætningsfelter kun for den. En fixture, der gav dem til
    de øvrige, ville skrive en plan, typen ikke tillader.

    De to oplyste tal står som nul, med mindre testen beder om andet: en
    livrente uden dem har kvotienten nul og dermed ingen ydelse, og en test,
    der handler om omsætningen, siger selv hvad selskabet oplyste. */
export function aHolding(options: {
  id: string
  name: string
  variant: HoldingVariant
  balance: number
  grossReturn?: number
  annualCostRate?: number
  openedOn?: OpenedOn
  quotedReserve?: number
  quotedAnnualBenefit?: number
  bonusRate?: number
}): Holding {
  const {
    variant,
    openedOn = { year: 2018, month: 1 },
    grossReturn = 0,
    annualCostRate = 0,
    quotedReserve = 0,
    quotedAnnualBenefit = 0,
    bonusRate = 0,
    ...rest
  } = options
  const base = { ...rest, grossReturn, annualCostRate }
  switch (variant) {
    case 'LifeAnnuity':
      return { ...base, variant, openedOn, quotedReserve, quotedAnnualBenefit, bonusRate }
    case 'InstalmentPension':
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

/** En overførsel fra en beholdning til husstandens frie midler. Perioden
    løber hele horisonten, med mindre testen angiver noget andet, og kan
    aldersforankres som en posts — alderen måles på afgiverens ejer. */
export function aTransfer(options: {
  id?: string
  from: string
  to: string
  amountInRealKroner: number
  timing?: Timing
  period?: Period
  recurrence?: Recurrence
}): Transfer {
  return {
    id: options.id ?? 'transfer',
    from: options.from,
    to: options.to,
    amountInRealKroner: options.amountInRealKroner,
    timing: options.timing ?? 'Even',
    period: options.period ?? wholeHorizon,
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
