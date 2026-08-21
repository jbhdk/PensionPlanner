import { withContribution, withEntry, withLifeAnnuity, withPayoutSchedule, withTransfer } from './planEdits'
import type { AgeBound, Period, Plan } from '../engine/plan'
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
    case 'holding':
      // En livrentes eneste håndtag er dens omsætningspunkt; en ratepensions
      // to-håndtag er dens varighed, jf. `to = from + duration − 1` i
      // `timelineLayout.ts` — starten står urørt, når det er den, der trækkes.
      return item.point
        ? withLifeAnnuity(plan, item.target.id, (holding) =>
            holding.payout
              ? { ...holding, payout: { start: shiftBound(holding.payout.start, deltaYears) } }
              : holding,
          )
        : withPayoutSchedule(plan, item.target.id, (payout) =>
            edge === 'to'
              ? { ...payout, duration: payout.duration + deltaYears }
              : { ...payout, start: shiftBound(payout.start, deltaYears) },
          )
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

function shiftPeriod(period: Period, edge: TimelineDragEdge, deltaYears: number): Period {
  const shiftFrom = edge === 'from' || edge === 'body' || edge === 'point'
  const shiftTo = edge === 'to' || edge === 'body'
  return {
    ...period,
    from: shiftFrom ? shiftBound(period.from, deltaYears) : period.from,
    to: shiftTo ? shiftBound(period.to, deltaYears) : period.to,
  } as Period
}
