import { householdLastYear, periodBounds, personLastYear } from '../engine/age'
import { payoutStartYear } from '../engine/payoutAge'
import type {
  AgeBound,
  Household,
  Period,
  Person,
  PersonId,
  Plan,
  Recurrence,
  SimulationYear,
} from '../engine/plan'
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
  (
    | { point: true; at: TimelineEndpoint }
    /** `marks` er de kalenderår, en `EveryNYears`-post rammer inden for sin
        periode — tom for enhver anden gentagelse. Regnet her og ikke i
        `Timeline.tsx`, som kun omsætter årstal til pixels, jf. samme
        arbejdsdeling som resten af laget. */
    | { point: false; from: TimelineEndpoint; to: TimelineEndpoint; marks: SimulationYear[] }
  )

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
    endepunktet til et rent årstal og dermed sletter den information. Et
    `PersonAgeBound`, der følger nogen, er et objekt uanset hvem — hvilken
    person, der følges, ændrer intet ved, om håndtaget er låst. */
function resolvePeriodEndpoint(
  period: Period,
  key: 'from' | 'to',
  owner: Person,
  household: Household,
): TimelineEndpoint {
  const year = periodBounds(period, owner, household)[key]
  if (year === undefined) return { kind: 'Open' }
  const raw = period.anchor === 'PersonAge' ? period[key] : undefined
  return typeof raw === 'object' ? { kind: 'Locked', year } : { kind: 'Free', year }
}

/** En udbetalingsplans eller livrentes startpunkt. `start` er et
    `AgeBound` for sig og aldrig en del af en `Period` — låsning afgøres
    derfor direkte af den urørte værdi, ligesom i `resolvePeriodEndpoint`. */
function resolveStart(start: AgeBound, owner: Person): { kind: 'Locked' | 'Free'; year: SimulationYear } {
  const year = payoutStartYear(start, owner)
  return start === 'WorkEndAge' ? { kind: 'Locked', year } : { kind: 'Free', year }
}

/** En `EveryNYears`-posts egne gentagelsesår, fra dens opløste `from` med
    skridt `n` til og med dens opløste `to` — samme formel som motorens
    `matchesRecurrence` i `simulate.ts`, så tidslinjen aldrig kan vise en
    anden gentagelse end den, motoren faktisk regner på. Et åbent endepunkt
    er allerede løst til plan-startåret hhv. horisontens slut her, ligesom
    motoren selv falder tilbage til plan-startåret ved et udeladt `from`. */
function everyNYearMarks(from: SimulationYear, to: SimulationYear, n: number): SimulationYear[] {
  const marks: SimulationYear[] = []
  for (let year = from; year <= to; year += n) marks.push(year)
  return marks
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
  household: Household,
  openStart: SimulationYear,
  openEnd: SimulationYear,
): TimelineItem {
  const shared = { ...base, color: CATEGORY_COLOR[base.group], row: 0 }
  if (recurrence.kind === 'Once') {
    return { ...shared, point: true, at: resolvePeriodEndpoint(period, 'from', owner, household) }
  }
  const from = resolvePeriodEndpoint(period, 'from', owner, household)
  const to = resolvePeriodEndpoint(period, 'to', owner, household)
  return {
    ...shared,
    point: false,
    from,
    to,
    marks:
      recurrence.kind === 'EveryNYears'
        ? everyNYearMarks(endpointYear(from, openStart), endpointYear(to, openEnd), recurrence.n)
        : [],
  }
}

/** Tidslinjens fem grupper, afledt af planen, jf. ADR-0036. Ingen egen
    tilstand — kaldes om ved hver ændring, ganske som `surplusBands`. */
export function timelineLayout(plan: Plan): TimelineGroup[] {
  const { openStart, openEnd } = openBounds(plan)
  const items = buildItems(plan, openStart, openEnd)

  return timelineGroupOrder.map((name) => {
    const packed = pack(
      items.filter((item) => item.group === name),
      openStart,
      openEnd,
    )
    return { name, items: packed.items, rowCount: packed.rowCount }
  })
}

/** Planens poster som tidslinjens items, upakkede — hver med sine endepunkter
    allerede opløst til kalenderår. Både `timelineLayout` og `timelineBounds`
    bygger på den: kanten kan ikke findes uden at kende posterne, og de to må
    aldrig komme til at læse den samme periode forskelligt. */
function buildItems(
  plan: Plan,
  openStart: SimulationYear,
  openEnd: SimulationYear,
): TimelineItem[] {
  const personById = new Map(plan.household.persons.map((person) => [person.id, person]))
  const holdingOwner = new Map(
    plan.household.persons.flatMap((person) => person.holdings.map((holding) => [holding.id, person])),
  )
  const holdingIndex = new Map(orderedHoldings(plan.household).map((holding, index) => [holding.id, index]))

  return [
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
        plan.household,
        openStart,
        openEnd,
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
            // 'transfer' og ikke 'contribution': målet følger den
            // sammenlagte Overførsel-sektion i skuffen og ikke motorens
            // array, jf. ADR-0047 og Navigator.tsx.
            target: { kind: 'transfer', id: contribution.id },
            group: 'Contributions',
            name: contribution.name,
            owner: owner.id,
          },
          contribution.period,
          contribution.recurrence,
          owner,
          plan.household,
          openStart,
          openEnd,
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
        plan.household,
        openStart,
        openEnd,
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
        // Livrentens boks viser ydelsen, ikke omsætningen, jf. ADR-0037: venstre
        // kant er omsætningstidspunktet, højre kant er ejerens egen horisont —
        // låst uden håndtag, for det er ikke noget brugeren trækker. `to` er
        // sidste inkluderede år, og `boxStyle` lægger selv ét helt år til for
        // at dække det, ligesom for en `to`, der følger erhvervsophør — derfor
        // trækkes ét år fra her, så boksens højre kant lander præcis på
        // horisontens eget mærke på aksen og ikke ét år forbi det.
        if (holding.variant === 'LifeAnnuity') {
          return [
            {
              ...base,
              point: false,
              from: resolveStart(holding.payout.start, person),
              to: { kind: 'Locked', year: personLastYear(person) - 1 },
              marks: [],
            },
          ]
        }
        const from = resolveStart(holding.payout.start, person)
        return [
          {
            ...base,
            point: false,
            from,
            to: { kind: 'Free', year: from.year + holding.payout.duration - 1 },
            marks: [],
          },
        ]
      }),
    ),
  ]
}

/** De to år, et *åbent* endepunkt opløses til: planens start og husstandens
    sidste år. Et udeladt endepunkt betyder "fra planens start" og ikke "fra
    tidslinjens venstre kant", jf. `Period` i plan.ts — de to er ikke længere
    det samme tal. */
function openBounds(plan: Plan): { openStart: SimulationYear; openEnd: SimulationYear } {
  return {
    openStart: plan.startYear,
    openEnd: householdLastYear(plan.household),
  }
}

/** Tidslinjens vandrette udstrækning, plus det år et åbent `from` betyder.
    `start` er den tidligste af planens startår og posternes egne endepunkter:
    en post trukket ud til venstre for planens start ville ellers få en negativ
    `left`, som `.tidslinje-rul`s `overflow: auto` klipper væk uden at kunne
    rulle derhen — og posten kunne ikke længere fanges på tidslinjen. Kanten
    flytter sig frem for at klemme posten, fordi en klemning ville ændre
    planens betydning: `from` bærer en `EveryNYears`-posts fase, jf. ADR-0045.
    `openStart` er derfor skilt ud og bliver ved med at være planens startår.

    Samme grænser som `Timeline.tsx` tegner x-aksen ud fra, så aksen og
    pakningen aldrig kan komme til at regne på hver sin udstrækning. */
export function timelineBounds(plan: Plan): {
  start: SimulationYear
  openStart: SimulationYear
  end: SimulationYear
} {
  const { openStart, openEnd } = openBounds(plan)
  const items = buildItems(plan, openStart, openEnd)
  const earliest = items.map((item) => earliestYear(item, openStart, openEnd))
  return { start: Math.min(openStart, ...earliest), openStart, end: openEnd }
}

/** Postens tidligste endepunkt. Begge ender måles, og ikke kun `from`: en
    omvendt periode har sit tidligste år i `to`, og kanten skal også nå den —
    ellers ville boksens venstre kant lande uden for fladen igen. */
function earliestYear(
  item: TimelineItem,
  openStart: SimulationYear,
  openEnd: SimulationYear,
): SimulationYear {
  return item.point
    ? endpointYear(item.at, openStart)
    : Math.min(endpointYear(item.from, openStart), endpointYear(item.to, openEnd))
}

export function endpointYear(endpoint: TimelineEndpoint, fallback: SimulationYear): SimulationYear {
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
