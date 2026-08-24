import { withContribution, withEntry, withLifeAnnuity, withPayoutSchedule, withTransfer } from './planEdits'
import { yearAtAge, personLastYear } from '../engine/age'
import { payoutYear } from '../engine/payoutAge'
import { bearsPayoutSchedule } from '../engine/holdingVariant'
import { boundValue, payoutDurationBounds, periodEndpointBounds } from '../engine/validatePlan'
import type { Bounds } from '../engine/validatePlan'
import { clampBy } from './fields'
import type { Clamp } from './fields'
import { isLifeAnnuity } from '../engine/lifeAnnuity'
import type { LifeAnnuityHolding } from '../engine/lifeAnnuity'
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
      // midt i et træk.
      const targetId = item.target.id
      const owner = plan.household.persons.find((person) => person.id === item.owner)!
      const holding = owner.holdings.find((h) => h.id === targetId)
      if (holding && isLifeAnnuity(holding)) {
        return {
          plan: withLifeAnnuity(plan, targetId, (h) =>
            h.payout
              ? { ...h, payout: { start: clampLifeAnnuityStart(h.payout.start, deltaYears, h, owner) } }
              : h,
          ),
          clamp: null,
        }
      }
      // Varianten skal være kendt, før grænserne kan slås op på den —
      // `withPayoutSchedule` beskytter sig selv mod resten, men
      // `payoutDurationBounds` har brug for ordningens egen
      // pensionsudbetalingsalder at måle med.
      if (!holding || !bearsPayoutSchedule(holding)) return { plan, clamp: null }
      const scheme = holding
      return {
        plan: withPayoutSchedule(plan, targetId, (payout) =>
          edge === 'to'
            ? {
                ...payout,
                duration: clampPayoutDuration(payout.duration + deltaYears, scheme, owner, payout.start),
              }
            : { ...payout, start: clampPayoutStart(payout.start, deltaYears, scheme, owner) },
        ),
        clamp: null,
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

/** Klemmer en livrentes trukne omsætningsstart til det interval, boksen selv
    kan vise: tidligst ordningens pensionsudbetalingsalder, jf.
    `validatePlan`s `payoutSchedules`-regel, som et træk ellers kunne sætte
    planen i strid med. Senest ét år før ejerens horisont — ikke horisontens
    eget sidste år, for boksens låste højre kant i `timelineLayout.ts` sidder
    dér allerede, og et træk helt derop ville vende boksen om. Klemt i
    kalenderår og oversat tilbage til alder, fordi grænserne selv er årstal;
    en hel-tals aldersforskydning giver samme kalenderårsforskydning uanset
    fødselsmåned, jf. `shiftBound`, så oversættelsen frem og tilbage mister
    intet. `'WorkEndAge'` har intet håndtag at trække i og står derfor
    urørt. */
function clampLifeAnnuityStart(
  start: AgeBound,
  deltaYears: number,
  holding: LifeAnnuityHolding,
  owner: Person,
): AgeBound {
  if (typeof start !== 'number') return start
  const currentYear = yearAtAge(owner, start)
  const proposedYear = currentYear + deltaYears
  const clampedYear = Math.min(
    Math.max(proposedYear, payoutYear(holding, owner)),
    personLastYear(owner) - 1,
  )
  return start + (clampedYear - currentYear)
}

/** Klemmer en ratepensions trukne udbetalingsstart til den samme nedre grænse,
    skuffens eget startfelt bruger: ordningens pensionsudbetalingsalder, jf.
    `validatePlan`s `payoutSchedules`-regel og PBL § 11 A, stk. 1. Samme greb
    som livrentens `clampLifeAnnuityStart` og af samme grund — de to ordninger
    deler den lovregel, og håndtaget skal møde den begge steder.

    Uden et øvre loft, ganske som feltet. Trediveårsgrænsen for sidste rate
    bindes af varigheden og ikke af starten, jf. `payoutDurationBounds`, og et
    loft her ville lægge den regel to steder.

    Klemt i kalenderår og oversat tilbage til alder af samme grund som hos
    livrenten: grænserne selv er årstal, og en hel-tals aldersforskydning giver
    samme kalenderårsforskydning uanset fødselsmåned. `'WorkEndAge'` har intet
    håndtag at trække i og står derfor urørt. */
function clampPayoutStart(
  start: AgeBound,
  deltaYears: number,
  holding: PayoutScheduleHolding,
  owner: Person,
): AgeBound {
  if (typeof start !== 'number') return start
  const currentYear = yearAtAge(owner, start)
  const clampedYear = Math.max(currentYear + deltaYears, payoutYear(holding, owner))
  return start + (clampedYear - currentYear)
}

/** Klemmer en ratepensions trukne varighed til de samme to grænser, skuffens
    varighedsfelt bruger: mindst ti år, og aldrig så mange at den sidste rate
    falder senere end tredive år efter pensionsudbetalingsalderen.

    Grænserne regnes af `payoutDurationBounds` og ikke her. Det er hele
    grunden til, at den funktion findes: en grænse regnet to steder er en
    grænse, der før eller siden siger to ting — og her ville de to være
    håndtaget og feltet, der beskriver den samme ordning. */
function clampPayoutDuration(
  duration: number,
  holding: PayoutScheduleHolding,
  owner: Person,
  start: AgeBound,
): number {
  const { min, max } = payoutDurationBounds(holding, owner, start)
  return Math.min(Math.max(duration, min), max)
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
