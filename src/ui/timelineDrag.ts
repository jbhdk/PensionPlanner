import {
  findTransferOrContribution,
  withContribution,
  withEntry,
  withLifeAnnuity,
  withPayoutSchedule,
  withTransfer,
} from './planEdits'
import { yearAtAge, personLastYear } from '../engine/age'
import { bearsPayoutSchedule } from '../engine/holdingVariant'
import {
  boundValue,
  payoutDurationBounds,
  payoutStartBounds,
  periodEndpointBounds,
} from '../engine/validatePlan'
import type { Bound, Bounds, PeriodicFigure } from '../engine/validatePlan'
import { clampBy } from './fields'
import type { Clamp } from './fields'
import type { FieldHelpKey } from './fieldHelp'
import { isLifeAnnuity } from '../engine/lifeAnnuity'
import type { AgeBound, PayoutScheduleHolding, Period, PersonAgeBound, Person, Plan } from '../engine/plan'
import type { TimelineItem } from './timelineLayout'

/** Hvilken del af en tidslinjeboks der trækkes: et af de to endepunkter, hele
    kroppen, eller et punkt uden udstrækning. */
export type TimelineDragEdge = 'from' | 'to' | 'body' | 'point'

/** Det, et træk efterlod: planen som den blev, og beskeden om den grænse, der
    greb ind undervejs — hvis en gjorde.

    Beskeden kan ikke udledes bagefter. Efter klemningen er planen gyldig, og
    der findes ikke længere spor af, hvad trækket bad om; den må derfor følge
    med ud herfra og huskes af `App`, jf. ADR-0045. Et træk har intet felt at
    stå rødt i, og det er netop derfor, klemningen skal kunne tale. */
export type TimelineDrag = { plan: Plan; clamp: Clamp | null }

/** Anvender et træk på tidslinjen: forskyder det trukne endepunkt med
    `deltaYears` og skriver det tilbage gennem den `with*`-funktion, der
    allerede findes for postens slags, jf. issue #60 — ingen nye
    redigeringsfunktioner. */
export function applyTimelineDrag(
  plan: Plan,
  item: TimelineItem,
  edge: TimelineDragEdge,
  deltaYears: number,
): TimelineDrag {
  if (deltaYears === 0) return { plan, clamp: null }

  switch (item.target.kind) {
    // De tre figurer med udstrækning går den samme vej. Grænserne er
    // `periodEndpointBounds`', og de regnes ikke her — det er hele grunden
    // til, at den funktion findes, jf. `clampPayoutDuration`.
    case 'entry': {
      const targetId = item.target.id
      const entry = plan.entries.find((e) => e.id === targetId)
      if (!entry) return { plan, clamp: null }
      const moved = movedPeriod(plan, entry, edge, deltaYears)
      return {
        plan: withEntry(plan, targetId, (e) => ({ ...e, period: moved.period })),
        clamp: moved.clamp,
      }
    }
    case 'transfer': {
      // Målet er 'transfer' for hele den sammenlagte Overførsel-sektion,
      // også når figuren er et beholdningskildet bidrag under motorhjelmen,
      // jf. ADR-0047 og Navigator.tsx — opslaget dækker derfor begge arrays.
      const targetId = item.target.id
      const figure = findTransferOrContribution(plan, targetId)
      if (!figure) return { plan, clamp: null }
      const moved = movedPeriod(plan, figure, edge, deltaYears)
      return {
        plan:
          'kind' in figure
            ? withContribution(plan, targetId, (c) =>
                c.kind === 'HoldingSourced' ? { ...c, period: moved.period } : c,
              )
            : withTransfer(plan, targetId, (t) => ({ ...t, period: moved.period })),
        clamp: moved.clamp,
      }
    }
    case 'contribution': {
      // Rammes ikke af tidslinjen: den lønkildede form har ingen periode at
      // trække i og bærer intet item, og den beholdningskildede tegnes nu
      // under målet 'transfer' ovenfor.
      return { plan, clamp: null }
    }
    case 'holding': {
      // En livrentes eneste håndtag er boksens venstre kant: højre kant er
      // ejerens horisont og har intet håndtag, for ydelsen er livsvarig, jf.
      // ADR-0037.
      //
      // En ratepensions boks er tegnet af planens to tal — `to = from +
      // duration − 1` i `timelineLayout.ts` — og dens tre greb skriver hver
      // sit:
      //
      //   `to`     ændrer varigheden og lader starten stå.
      //   `from`   lader den sidste rate stå og lader varigheden vige, så
      //            perioden bliver kortere eller længere. Kanten opfører sig
      //            dermed som enhver anden boks' kant på tidslinjen, og
      //            kroppen er ikke længere det samme greb en gang til.
      //   `body`   flytter hele planen med varigheden i behold.
      //
      // De to sidste flytter begge starten, men holder hver sit fast, og
      // deres øvre grænse er derfor ikke den samme væg — se `keeping` i
      // `payoutStartBounds`. Den nedre er: døren er den samme uanset
      // gestussen. Alle tre klemmes, og til de samme grænser som skuffens
      // egne felter, for et håndtag, der kunne skrive en plan,
      // indgangskontrollen afviser, ville lade hele resultatspalten forsvinde
      // midt i et træk.
      const targetId = item.target.id
      const owner = plan.household.persons.find((person) => person.id === item.owner)!
      const holding = owner.holdings.find((h) => h.id === targetId)
      if (!holding) return { plan, clamp: null }

      if (isLifeAnnuity(holding)) {
        // Boksen findes kun, fordi livrenten har en omsætningsstart. Uden en
        // er der intet håndtag at have trukket i, og typen ved det ikke.
        const start = holding.payout?.start
        if (start === undefined) return { plan, clamp: null }
        const moved = clampPayoutStart(
          start,
          deltaYears,
          {
            ...payoutStartBounds(holding, owner, start),
            max: lastLifeAnnuityStart(start, owner),
          },
          'LifeAnnuity.payoutStart',
        )
        return {
          plan: withLifeAnnuity(plan, targetId, (h) => ({
            ...h,
            payout: { start: moved.start },
          })),
          clamp: moved.clamp,
        }
      }

      // Varianten skal være kendt, før grænserne kan slås op på den —
      // `withPayoutSchedule` beskytter sig selv mod resten, men
      // `payoutStartBounds` og `payoutDurationBounds` har brug for ordningens
      // egen pensionsudbetalingsalder at måle med.
      if (!bearsPayoutSchedule(holding)) return { plan, clamp: null }
      const scheme = holding
      // Boksen findes kun, fordi ordningen har en plan — og dens to håndtag
      // er planens to tal.
      const schedule = scheme.payout
      if (schedule === undefined) return { plan, clamp: null }
      if (edge === 'to') {
        const stretched = clampPayoutDuration(
          schedule.duration + deltaYears,
          scheme,
          owner,
          schedule.start,
        )
        return {
          plan: withPayoutSchedule(plan, targetId, (payout) => ({
            ...payout,
            duration: stretched.duration,
          })),
          clamp: stretched.clamp,
        }
      }
      if (edge === 'from') {
        // Venstre kant flytter sig, og højre står stille: perioden bliver
        // kortere eller længere, og varigheden følger med. Er starten låst til
        // erhvervsophør, har kanten slet intet håndtag, jf. `resolveStart` —
        // og så er der intet at have trukket i.
        if (typeof schedule.start !== 'number') return { plan, clamp: null }
        const moved = clampedTo(
          schedule.start + deltaYears,
          payoutStartBounds(scheme, owner, schedule.start, 'LastInstalment'),
          'PayoutSchedule.start',
        )
        const shift = moved.value - schedule.start
        return {
          plan: withPayoutSchedule(plan, targetId, (payout) => ({
            ...payout,
            start: moved.value,
            duration: payout.duration - shift,
          })),
          clamp: moved.clamp,
        }
      }
      const moved = clampPayoutStart(
        schedule.start,
        deltaYears,
        payoutStartBounds(scheme, owner, schedule.start),
        'PayoutSchedule.start',
      )
      return {
        plan: withPayoutSchedule(plan, targetId, (payout) => ({ ...payout, start: moved.start })),
        clamp: moved.clamp,
      }
    }
    default:
      return { plan, clamp: null }
  }
}

/** Forskyder et frit endepunkts rå værdi med `deltaYears` — et kalenderår, en
    fast alder, eller et fast alderstal der eksplicit navngiver en person, jf.
    ADR-0051. Aldrig en henvisning uden alderstal, for så følger endepunktet
    en navngiven persons erhvervsophør, var låst, og ville ikke have et
    håndtag at trække i. En hel-tals aldersforskydning giver samme
    kalenderårsforskydning, uanset ejerens fødselsmåned: se `yearAtAge` i
    `engine/age.ts`. */
function shiftBound<T extends number | AgeBound | PersonAgeBound | undefined>(
  bound: T,
  deltaYears: number,
): T {
  if (typeof bound === 'number') return (bound + deltaYears) as T
  if (typeof bound === 'object' && bound !== null && 'age' in bound) {
    return { ...bound, age: bound.age + deltaYears } as T
  }
  return bound
}

/** Klemmer en trukken udbetalingsstart til de grænser, skuffens eget felt
    bruger — og melder den grænse, der greb ind. Samme greb som `clampTo` og
    `clampedBy` i `fields.tsx`, fordi håndtaget og feltet møder den samme væg:
    ratepensionens `Start` og livrentens `Udbetalingsstart` deler lovreglen,
    jf. `validatePlan`s `payoutSchedules`, og de skal ikke kunne komme til at
    sige hver sit om den.

    Regnet i aldre, selv om grænsen er et kalenderår. Den er allerede
    oversat: `payoutStartBounds` svarer i endepunktets egen enhed gennem sin
    delta. Og en hel-tals aldersforskydning giver samme
    kalenderårsforskydning uanset fødselsmåned, jf. `shiftBound`, så et træk
    målt i aldre rammer det samme som et træk målt i år.

    `'WorkEndAge'` har intet håndtag at trække i og står derfor urørt. */
function clampPayoutStart(
  start: AgeBound,
  deltaYears: number,
  bounds: Bounds,
  field: FieldHelpKey,
): { start: AgeBound; clamp: Clamp | null } {
  if (typeof start !== 'number') return { start, clamp: null }
  const clamped = clampedTo(start + deltaYears, bounds, field)
  return { start: clamped.value, clamp: clamped.clamp }
}

/** Klemmer et trukket tal ind i sine grænser og melder den, der greb ind.
    Det samme greb som `clampTo` og `clampedBy` i `fields.tsx` — og det er
    hele pointen: håndtaget og feltet møder de samme vægge og skal ikke kunne
    komme til at sige hver sit om dem.

    En grænse uden begrundelse melder intet, jf. `Bound`. De vægge kan ses i
    forvejen, og en besked om noget synligt er støj. */
function clampedTo(
  value: number,
  bounds: Bounds,
  field: FieldHelpKey,
): { value: number; clamp: Clamp | null } {
  if (bounds.min !== undefined && value < boundValue(bounds.min)) {
    return { value: boundValue(bounds.min), clamp: clampBy(field, bounds.min) }
  }
  if (bounds.max !== undefined && value > boundValue(bounds.max)) {
    return { value: boundValue(bounds.max), clamp: clampBy(field, bounds.max) }
  }
  return { value, clamp: null }
}

/** Livrentens øvre grænse, som ratepensionen ikke har: ét år før ejerens
    horisont — ikke horisontens eget sidste år, for boksens låste højre kant
    i `timelineLayout.ts` sidder dér allerede, og et træk helt derop ville
    vende boksen om.

    Den bærer ingen begrundelse. Væggen er boksens egen anden kant og kan ses
    i forvejen, hvor døren i den anden ende er usynlig, jf. `Bound` — og den
    hører derfor i trækket og ikke i `payoutStartBounds`, som beskriver
    lovreglen og ikke tegningen.

    Svaret er i alder som grænsen i den anden ende, oversat gennem den samme
    delta. */
function lastLifeAnnuityStart(start: AgeBound, owner: Person): number {
  const standing = typeof start === 'number' ? start : owner.workEndAge
  return standing + (personLastYear(owner) - 1 - yearAtAge(owner, standing))
}

/** Klemmer en ratepensions trukne varighed til de samme to grænser, skuffens
    varighedsfelt bruger: mindst ti år, og aldrig så mange at den sidste rate
    falder senere end tredive år efter pensionsudbetalingsalderen.

    Grænserne regnes af `payoutDurationBounds` og ikke her. Det er hele
    grunden til, at den funktion findes: en grænse regnet to steder er en
    grænse, der før eller siden siger to ting — og her ville de to være
    håndtaget og feltet, der beskriver den samme ordning.

    Begge vægge taler. Boksens højre kant standser i den blå luft, ganske som
    dens venstre gør ved døren: aksen har hverken et mærke for tiårsreglen
    eller for det år, den sidste rate senest må falde i. */
function clampPayoutDuration(
  duration: number,
  holding: PayoutScheduleHolding,
  owner: Person,
  start: AgeBound,
): { duration: number; clamp: Clamp | null } {
  const clamped = clampedTo(
    duration,
    payoutDurationBounds(holding, owner, start),
    'PayoutSchedule.duration',
  )
  return { duration: clamped.value, clamp: clamped.clamp }
}

/** Den forskudte periode, klemt af figurens egne grænser — og beskeden om den
    væg, der greb ind. */
function movedPeriod(
  plan: Plan,
  figure: PeriodicFigure,
  edge: TimelineDragEdge,
  deltaYears: number,
): { period: Period; clamp: Clamp | null } {
  const allowed = allowedShift(plan, figure, edge, deltaYears)
  return {
    period: shiftPeriod(figure.period, edge, allowed.deltaYears),
    clamp: allowed.clamp,
  }
}

/** Det træk, grænserne tillader — og beskeden om den grænse, der greb ind.

    Klemningen rammer *bevægelsen* og ikke endepunktet. Et træk i kroppen
    flytter posten og ændrer den ikke: klemtes kun `from`, ville boksen skrumpe
    af en bevægelse, og trækkes der langt nok, ville den vende om og beskrive
    en periode, der slutter, før den begynder. Standses bevægelsen i stedet,
    står boksen stille ved væggen med sin egen længde i behold. For et håndtag
    er de to det samme: dér flytter trækket kun det ene endepunkt, og det er
    netop det, brugeren tog fat i, jf. ADR-0045.

    Grænserne slås op på den **forskudte** figur og ikke på den stående. De to
    endepunkter binder hinanden, og et træk i kroppen ville ellers blive
    standset af sin egen anden kant — den, det lige selv har flyttet lige så
    langt.

    Kun de endepunkter, trækket rører, måles. Er et af dem hverken et tal
    eller et navngivet fast alderstal — åbent eller sat til erhvervsophør —
    er der intet at måle, og der er heller intet håndtag at have trukket i.

    Feltnøglen er endepunktets egen, den samme som skuffen tegner feltet med,
    så beskeden kan finde vej hen til det felt, væggen står ved. */
function allowedShift(
  plan: Plan,
  figure: PeriodicFigure,
  edge: TimelineDragEdge,
  deltaYears: number,
): { deltaYears: number; clamp: Clamp | null } {
  let allowed = deltaYears
  let clamp: Clamp | null = null

  for (const endpoint of shiftedEndpoints(edge)) {
    // Regnet forfra hver gang: har det ene endepunkt allerede kortet trækket
    // af, er det dét træk, det andet skal måles på.
    const period = shiftPeriod(figure.period, edge, allowed)
    const standingValue = standingAge(period[endpoint])
    if (standingValue === undefined) continue

    const bounds = periodEndpointBounds(plan, { ...figure, period }, endpoint)
    const broken = brokenBound(bounds, standingValue)
    if (broken === undefined) continue

    allowed += boundValue(broken) - standingValue
    clamp = clampBy(endpoint === 'from' ? 'Period.from' : 'Period.to', broken)
  }
  return { deltaYears: allowed, clamp }
}

/** Alderen, et endepunkt måler et træk mod — det bare tal eller et navngivet
    fast alderstals `age`, jf. `shiftBound`. Intet svar for et åbent
    endepunkt eller en henvisning uden alderstal: begge er låst og har intet
    håndtag. */
function standingAge(standing: number | AgeBound | PersonAgeBound | undefined): number | undefined {
  if (typeof standing === 'number') return standing
  if (typeof standing === 'object' && standing !== null && 'age' in standing) return standing.age
  return undefined
}

/** De endepunkter, trækket flytter. Et træk i kroppen flytter begge, et
    håndtag sit eget, og et punkt uden udstrækning sit ene. */
function shiftedEndpoints(edge: TimelineDragEdge): ('from' | 'to')[] {
  if (edge === 'body') return ['from', 'to']
  return edge === 'to' ? ['to'] : ['from']
}

/** Den af de to grænser, en værdi ligger uden for — eller intet. Begge sider
    er i endepunktets egen enhed: grænsen svarer i den, og værdien står i
    den. */
function brokenBound(bounds: Bounds, value: number): Bound | undefined {
  if (bounds.min !== undefined && value < boundValue(bounds.min)) return bounds.min
  if (bounds.max !== undefined && value > boundValue(bounds.max)) return bounds.max
  return undefined
}

function shiftPeriod(period: Period, edge: TimelineDragEdge, deltaYears: number): Period {
  const shiftFrom = edge === 'from' || edge === 'body' || edge === 'point'
  const shiftTo = edge === 'to' || edge === 'body'
  return {
    ...period,
    from: shiftFrom ? shiftBound(period.from, deltaYears) : period.from,
    to: shiftTo ? shiftBound(period.to, deltaYears) : period.to,
  } as Period
}
