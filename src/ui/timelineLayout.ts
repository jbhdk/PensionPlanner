import { periodBounds } from '../engine/age'
import { payoutStartYear } from '../engine/payoutAge'
import type { AgeBound, Period, Person, PersonId, Plan, Recurrence, SimulationYear } from '../engine/plan'
import { CATEGORICAL_PALETTE, holdingColor, orderedHoldings } from './palette'
import type { Target } from './selection'

/** De fem grupper tidslinjen pakker poster i — samme opdeling som
    Navigatorens, minus Planen og Husstanden, som ikke har en boks, jf.
    ADR-0036. Rent lags-plumbing i stil med Navigator.tsx's `Group`, ikke et
    domænebegreb — derfor intet opslag i CONTEXT.md. */
export type TimelineGroupName =
  | 'IncomeEntries'
  | 'ExpenseEntries'
  | 'HoldingPayouts'
  | 'Contributions'
  | 'Transfers'

export const timelineGroupOrder: TimelineGroupName[] = [
  'IncomeEntries',
  'ExpenseEntries',
  'HoldingPayouts',
  'Contributions',
  'Transfers',
]

/** Et periodeendepunkts status: låst følger `Person.workEndAge` og kan ikke
    trækkes, åbent har ingen grænse, frit er et fast årstal, der kan trækkes. */
export type TimelineEndpoint =
  | { kind: 'Locked'; year: SimulationYear }
  | { kind: 'Open' }
  | { kind: 'Free'; year: SimulationYear }

type TimelineItemBase = {
  target: Target
  group: TimelineGroupName
  name: string
  owner: PersonId
  color: string
  row: number
}

export type TimelineItem = TimelineItemBase &
  ({ point: true; at: TimelineEndpoint } | { point: false; from: TimelineEndpoint; to: TimelineEndpoint })

export type TimelineGroup = {
  name: TimelineGroupName
  items: TimelineItem[]
  rowCount: number
}

/** De fire ikke-beholdningsgruppers faste farver — samme indekser i den
    validerede palette, som mock-uppens `--kat-*`-variabler allerede bruger,
    jf. ADR-0036 og `docs/mockup/tidslinje.css`. Ikke nye farver: kun
    beholdningsboksene, som genbruger `holdingColor()`, mangler i mock-uppen. */
type PeriodGroupName = Exclude<TimelineGroupName, 'HoldingPayouts'>

const CATEGORY_COLOR: Record<PeriodGroupName, string> = {
  IncomeEntries: CATEGORICAL_PALETTE[2]!,
  ExpenseEntries: CATEGORICAL_PALETTE[7]!,
  Contributions: CATEGORICAL_PALETTE[0]!,
  Transfers: CATEGORICAL_PALETTE[6]!,
}

/** Periodens endepunkt oversat til tidslinjens tre statusser. Kalenderåret
    kommer fra `periodBounds`, som allerede kender `WorkEndAge`s forskellige
    rolle som `from` og som `to`, jf. ADR-0031 — den regel gentages ikke her.
    Låsning afgøres af den urørte grænse, fordi `periodBounds` selv oversætter
    `'WorkEndAge'` til et rent årstal og dermed sletter den information. */
function resolvePeriodEndpoint(period: Period, key: 'from' | 'to', owner: Person): TimelineEndpoint {
  const year = periodBounds(period, owner)[key]
  if (year === undefined) return { kind: 'Open' }
  const raw = period.anchor === 'PersonAge' ? period[key] : undefined
  return raw === 'WorkEndAge' ? { kind: 'Locked', year } : { kind: 'Free', year }
}

/** En udbetalingsplans eller livrentes startpunkt. `start` er et
    `AgeBound` for sig og aldrig en del af en `Period` — låsning afgøres
    derfor direkte af den urørte værdi, ligesom i `resolvePeriodEndpoint`. */
function resolveStart(start: AgeBound, owner: Person): { kind: 'Locked' | 'Free'; year: SimulationYear } {
  const year = payoutStartYear(start, owner)
  return start === 'WorkEndAge' ? { kind: 'Locked', year } : { kind: 'Free', year }
}

/** Fælles opbygning for `Entry`, `Transfer` og et beholdningskildet
    `Contribution` — de tre bærer hver sin periode og gentagelse på samme
    form. En engangspost (`recurrence.kind === 'Once'`) er et punkt uden
    udstrækning, jf. ADR-0036, og bruger periodens `from` som sit tidspunkt. */
function periodItem(
  base: Omit<TimelineItemBase, 'color' | 'row' | 'group'> & { group: PeriodGroupName },
  period: Period,
  recurrence: Recurrence,
  owner: Person,
): TimelineItem {
  const shared = { ...base, color: CATEGORY_COLOR[base.group], row: 0 }
  if (recurrence.kind === 'Once') {
    return { ...shared, point: true, at: resolvePeriodEndpoint(period, 'from', owner) }
  }
  return {
    ...shared,
    point: false,
    from: resolvePeriodEndpoint(period, 'from', owner),
    to: resolvePeriodEndpoint(period, 'to', owner),
  }
}

/** Tidslinjens fem grupper, afledt af planen, jf. ADR-0036. Ingen egen
    tilstand — kaldes om ved hver ændring, ganske som `surplusBands`. */
export function timelineLayout(plan: Plan): TimelineGroup[] {
  const personById = new Map(plan.household.persons.map((person) => [person.id, person]))
  const holdingOwner = new Map(
    plan.household.persons.flatMap((person) => person.holdings.map((holding) => [holding.id, person])),
  )
  const holdingIndex = new Map(orderedHoldings(plan.household).map((holding, index) => [holding.id, index]))

  const items: TimelineItem[] = [
    ...plan.entries.map((entry) =>
      periodItem(
        {
          target: { kind: 'entry', id: entry.id },
          group: entry.direction === 'Income' ? 'IncomeEntries' : 'ExpenseEntries',
          name: entry.name,
          owner: entry.owner,
        },
        entry.period,
        entry.recurrence,
        personById.get(entry.owner)!,
      ),
    ),
    ...plan.contributions
      .filter((contribution) => contribution.kind === 'HoldingSourced')
      .map((contribution) => {
        // Destinationens ejer, ikke kildens — den kan krydse ejerskellet,
        // jf. ADR-0028, og det er destinationen, alderen måles på.
        const owner = holdingOwner.get(contribution.to)!
        return periodItem(
          {
            target: { kind: 'contribution', id: contribution.id },
            group: 'Contributions',
            name: contribution.name,
            owner: owner.id,
          },
          contribution.period,
          contribution.recurrence,
          owner,
        )
      }),
    ...plan.transfers.map((transfer) => {
      // Afgiverbeholdningens ejer, jf. `Transfer`s egen dokumentation i plan.ts.
      const owner = holdingOwner.get(transfer.from)!
      return periodItem(
        {
          target: { kind: 'transfer', id: transfer.id },
          group: 'Transfers',
          name: transfer.name,
          owner: owner.id,
        },
        transfer.period,
        transfer.recurrence,
        owner,
      )
    }),
    ...plan.household.persons.flatMap((person) =>
      person.holdings.flatMap((holding): TimelineItem[] => {
        if (holding.variant !== 'InstalmentPension' && holding.variant !== 'LifeAnnuity') return []
        if (!holding.payout) return []
        const base = {
          target: { kind: 'holding', id: holding.id } as const,
          group: 'HoldingPayouts' as const,
          name: holding.name,
          owner: person.id,
          color: holdingColor(holdingIndex.get(holding.id)!),
          row: 0,
        }
        if (holding.variant === 'LifeAnnuity') {
          return [{ ...base, point: true, at: resolveStart(holding.payout.start, person) }]
        }
        const from = resolveStart(holding.payout.start, person)
        return [
          {
            ...base,
            point: false,
            from,
            to: { kind: 'Free', year: from.year + holding.payout.duration - 1 },
          },
        ]
      }),
    ),
  ]

  // Bruges som start-/sluttidspunkt for et åbent endepunkt, alene til
  // pakningens sortering — planens start henholdsvis den seneste horisont
  // nogen af husstandens personer når.
  const openStart = plan.startYear
  const openEnd = Math.max(...plan.household.persons.map((person) => person.birthYear + person.horizon))

  return timelineGroupOrder.map((name) => {
    const packed = pack(
      items.filter((item) => item.group === name),
      openStart,
      openEnd,
    )
    return { name, items: packed.items, rowCount: packed.rowCount }
  })
}

function endpointYear(endpoint: TimelineEndpoint, fallback: SimulationYear): SimulationYear {
  return endpoint.kind === 'Open' ? fallback : endpoint.year
}

/** Grådig kanttildeling: poster sorteres efter startår, og hver lægges i den
    første række, hvis sidste post ikke overlapper — samme princip som
    intervalskemalægning, jf. ADR-0036. Et punkt uden udstrækning har samme
    år som start og slut, så det kan dele række med enhver post, der ikke
    selv rammer det år. */
function pack(
  groupItems: TimelineItem[],
  openStart: SimulationYear,
  openEnd: SimulationYear,
): { items: TimelineItem[]; rowCount: number } {
  const withSpan = groupItems
    .map((item) => {
      const [start, end] = item.point
        ? [endpointYear(item.at, openStart), endpointYear(item.at, openStart)]
        : [endpointYear(item.from, openStart), endpointYear(item.to, openEnd)]
      return { item, start, end }
    })
    .sort((a, b) => a.start - b.start)

  const rowEnds: SimulationYear[] = []
  const items = withSpan.map(({ item, start, end }) => {
    const row = rowEnds.findIndex((lastEnd) => lastEnd < start)
    if (row === -1) {
      rowEnds.push(end)
      return { ...item, row: rowEnds.length - 1 }
    }
    rowEnds[row] = end
    return { ...item, row }
  })

  return { items, rowCount: Math.max(1, rowEnds.length) }
}
