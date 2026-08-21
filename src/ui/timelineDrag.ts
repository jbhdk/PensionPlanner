import { withContribution, withEntry, withLifeAnnuity, withPayoutSchedule, withTransfer } from './planEdits'
import { yearAtAge, personLastYear } from '../engine/age'
import { payoutYear } from '../engine/payoutAge'
import { isLifeAnnuity } from '../engine/lifeAnnuity'
import type { LifeAnnuityHolding } from '../engine/lifeAnnuity'
import type { AgeBound, Period, Person, Plan } from '../engine/plan'
import type { TimelineItem } from './timelineLayout'

/** Hvilken del af en tidslinjeboks der trækkes: et af de to endepunkter, hele
    kroppen, eller et punkt uden udstrækning. */
export type TimelineDragEdge = 'from' | 'to' | 'body' | 'point'

/** Anvender et træk på tidslinjen: forskyder det trukne endepunkt med
    `deltaYears` og skriver det tilbage gennem den `with*`-funktion, der
    allerede findes for postens slags, jf. issue #60 — ingen nye
    redigeringsfunktioner. */
export function applyTimelineDrag(
  plan: Plan,
  item: TimelineItem,
  edge: TimelineDragEdge,
  deltaYears: number,
): Plan {
  if (deltaYears === 0) return plan

  switch (item.target.kind) {
    case 'entry':
      return withEntry(plan, item.target.id, (entry) => ({
        ...entry,
        period: shiftPeriod(entry.period, edge, deltaYears),
      }))
    case 'transfer':
      return withTransfer(plan, item.target.id, (transfer) => ({
        ...transfer,
        period: shiftPeriod(transfer.period, edge, deltaYears),
      }))
    case 'contribution':
      return withContribution(plan, item.target.id, (contribution) =>
        contribution.kind === 'HoldingSourced'
          ? { ...contribution, period: shiftPeriod(contribution.period, edge, deltaYears) }
          : contribution,
      )
    case 'holding': {
      // En livrentes eneste håndtag er boksens venstre kant, klemt til de
      // grænser `validatePlan` alligevel ville afvise uden for, jf. ADR-0037;
      // en ratepensions to-håndtag er dens varighed, jf. `to = from + duration
      // − 1` i `timelineLayout.ts` — starten står urørt, når det er den, der
      // trækkes.
      const targetId = item.target.id
      const owner = plan.household.persons.find((person) => person.id === item.owner)!
      const holding = owner.holdings.find((h) => h.id === targetId)
      return holding && isLifeAnnuity(holding)
        ? withLifeAnnuity(plan, targetId, (h) =>
            h.payout
              ? { ...h, payout: { start: clampLifeAnnuityStart(h.payout.start, deltaYears, h, owner) } }
              : h,
          )
        : withPayoutSchedule(plan, targetId, (payout) =>
            edge === 'to'
              ? { ...payout, duration: payout.duration + deltaYears }
              : { ...payout, start: shiftBound(payout.start, deltaYears) },
          )
    }
    default:
      return plan
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

function shiftPeriod(period: Period, edge: TimelineDragEdge, deltaYears: number): Period {
  const shiftFrom = edge === 'from' || edge === 'body' || edge === 'point'
  const shiftTo = edge === 'to' || edge === 'body'
  return {
    ...period,
    from: shiftFrom ? shiftBound(period.from, deltaYears) : period.from,
    to: shiftTo ? shiftBound(period.to, deltaYears) : period.to,
  } as Period
}
