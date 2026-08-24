import { withContribution, withEntry, withLifeAnnuity, withPayoutSchedule, withTransfer } from './planEdits'
import { yearAtAge, personLastYear } from '../engine/age'
import { bearsPayoutSchedule } from '../engine/holdingVariant'
import {
  boundValue,
  payoutDurationBounds,
  payoutStartBounds,
  periodEndpointBounds,
} from '../engine/validatePlan'
import type { Bounds } from '../engine/validatePlan'
import { clampBy } from './fields'
import type { Clamp } from './fields'
import type { FieldHelpKey } from './fieldHelp'
import { isLifeAnnuity } from '../engine/lifeAnnuity'
import type { AgeBound, PayoutScheduleHolding, Period, Person, Plan } from '../engine/plan'
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
    case 'entry':
      return {
        plan: withEntry(plan, item.target.id, (entry) => ({
          ...entry,
          period: shiftPeriod(entry.period, edge, deltaYears),
        })),
        clamp: null,
      }
    case 'transfer': {
      // Overførslens ene grænse: den må ikke hente fra en ordning før dens
      // pensionsudbetalingsalder. Grænsen regnes af `periodEndpointBounds` og
      // ikke her — det er hele grunden til, at den funktion findes, jf.
      // `clampPayoutDuration`.
      const targetId = item.target.id
      const transfer = plan.transfers.find((t) => t.id === targetId)
      if (!transfer) return { plan, clamp: null }
      const allowed = allowedShift(
        transfer.period,
        edge,
        deltaYears,
        periodEndpointBounds(plan, transfer, 'from'),
      )
      return {
        plan: withTransfer(plan, transfer.id, (t) => ({
          ...t,
          period: shiftPeriod(t.period, edge, allowed.deltaYears),
        })),
        clamp: allowed.clamp,
      }
    }
    case 'contribution':
      return {
        plan: withContribution(plan, item.target.id, (contribution) =>
          contribution.kind === 'HoldingSourced'
            ? { ...contribution, period: shiftPeriod(contribution.period, edge, deltaYears) }
            : contribution,
        ),
        clamp: null,
      }
    case 'holding': {
      // En livrentes eneste håndtag er boksens venstre kant, klemt til de
      // grænser `validatePlan` alligevel ville afvise uden for, jf. ADR-0037;
      // en ratepensions to-håndtag er dens varighed, jf. `to = from + duration
      // − 1` i `timelineLayout.ts` — starten står urørt, når det er den, der
      // trækkes. Begge ordningers håndtag klemmes, og til de samme grænser
      // som skuffens egne felter: et håndtag, der kunne skrive en plan,
      // indgangskontrollen afviser, ville lade hele resultatspalten forsvinde
      // midt i et træk. De to starte deler lovreglen og dermed grænsen —
      // `payoutStartBounds` — og siger derfor også det samme, når den greb
      // ind.
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

/** Forskyder et frit endepunkts rå værdi med `deltaYears` — et kalenderår
    eller en fast alder, aldrig `'WorkEndAge'`, for så var endepunktet låst og
    ville ikke have et håndtag at trække i. En hel-tals aldersforskydning
    giver samme kalenderårsforskydning, uanset ejerens fødselsmåned: se
    `yearAtAge` i `engine/age.ts`. */
function shiftBound<T extends number | AgeBound | undefined>(bound: T, deltaYears: number): T {
  return typeof bound === 'number' ? ((bound + deltaYears) as T) : bound
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

/** Det træk, grænserne tillader — og beskeden om den grænse, der greb ind.

    Klemningen rammer *bevægelsen* og ikke endepunktet. Et træk i kroppen
    flytter posten og ændrer den ikke: klemtes kun `from`, ville boksen skrumpe
    af en bevægelse, og trækkes der langt nok, ville den vende om og beskrive
    en periode, der slutter, før den begynder. Standses bevægelsen i stedet,
    står boksen stille ved væggen med sin egen længde i behold. For et håndtag
    er de to det samme: dér flytter trækket kun det ene endepunkt, og det er
    netop det, brugeren tog fat i, jf. ADR-0045.

    Målt på `from` efter trækket. Er det endepunkt ikke et tal — åbent eller
    sat til erhvervsophør — er der intet at måle, og der er heller intet
    håndtag at have trukket i. Trækkes `to`, står `from` stille, og grænsen kan
    ikke være brudt af trækket.

    Feltnøglen er `from`s egen, den samme som skuffen tegner feltet med, så
    beskeden kan finde vej hen til det felt, væggen står ved. */
function allowedShift(
  period: Period,
  edge: TimelineDragEdge,
  deltaYears: number,
  bounds: Bounds,
): { deltaYears: number; clamp: Clamp | null } {
  const shifted = shiftPeriod(period, edge, deltaYears).from
  if (typeof shifted !== 'number' || bounds.min === undefined) return { deltaYears, clamp: null }

  const floor = boundValue(bounds.min)
  if (shifted >= floor) return { deltaYears, clamp: null }
  return { deltaYears: deltaYears + (floor - shifted), clamp: clampBy('Period.from', bounds.min) }
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
