import { Fragment, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Plan, SimulationYear } from '../engine/plan'
import { endpointYear, timelineBounds, timelineLayout } from './timelineLayout'
import type { TimelineGroupName, TimelineItem } from './timelineLayout'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'
import { applyTimelineDrag } from './timelineDrag'
import type { TimelineDragEdge } from './timelineDrag'

/** Gruppernes danske titler, samme opdeling som Navigatorens, jf. ADR-0036
    og mock-uppens `GRUPPER_T`. Rent visningsnavn og ikke et glossaropslag —
    `TimelineGroupName` selv er lags-plumbing uden egen CONTEXT.md-post. */
const GROUP_TITLES: Record<TimelineGroupName, string> = {
  IncomeEntries: 'Indtægter',
  ExpenseEntries: 'Udgifter',
  HoldingPayouts: 'Beholdningernes udbetalinger',
  Contributions: 'Indbetalinger',
  Transfers: 'Overførsler',
}

/** Pixel pr. år på tidslinjens egen skala — uafhængig af graf-lagets, jf.
    ADR-0036. Samme værdi som mock-uppens `PXY`. */
const YEAR_WIDTH = 18

/** Højde pr. pakket række, samme værdi som mock-uppens `RAEKKE_H`. */
const ROW_HEIGHT = 24

/** Håndtagets bredde, samme værdi som mock-uppens `.tl-haandtag`. */
const HANDLE_WIDTH = 6

/** Boksens venstre kant, bredde og lodrette plads, udledt af postens opløste
    `from`/`to` og laget allerede tildelte `row` — komponenten afgør ikke selv
    hvilken række en post lander i, jf. `timelineLayout.ts`s pakning. Højre
    kant lægger et helt år til `to`, så sidste års boks dækker hele det år og
    ikke kun dets startpunkt — samme regel som mock-uppens `tlBoks`. */
function boxStyle(from: SimulationYear, to: SimulationYear, start: SimulationYear, row: number) {
  const left = (from - start) * YEAR_WIDTH
  const right = (to - start) * YEAR_WIDTH + YEAR_WIDTH
  return { left: `${left}px`, width: `${right - left}px`, top: `${row * ROW_HEIGHT}px` }
}

/** Punktets venstre kant og lodrette plads. Et punkt har ingen udstrækning —
    det er hverken en kortere boks eller en boks med bredde nul, men en anden
    figur helt, jf. ADR-0036. */
function pointStyle(at: SimulationYear, start: SimulationYear, row: number) {
  return { left: `${(at - start) * YEAR_WIDTH}px`, top: `${row * ROW_HEIGHT}px` }
}

/** Kroppen kan kun trækkes som helhed, når begge endepunkter er lukkede og
    frie — er blot ét låst eller åbent, findes der intet konkret tidspunkt at
    flytte det til, jf. issue #60. */
function canDragBody(item: TimelineItem): boolean {
  return !item.point && item.from.kind === 'Free' && item.to.kind === 'Free'
}

/** Håndtagets venstre kant og lodrette plads. `edge` afgør om det sidder ved
    boksens start eller slut — sidstnævnte trukket ind med sin egen bredde,
    så det ikke rager ud over boksens højre kant. */
function handleStyle(
  edge: 'from' | 'to',
  from: SimulationYear,
  to: SimulationYear,
  start: SimulationYear,
  row: number,
) {
  const left =
    edge === 'from'
      ? (from - start) * YEAR_WIDTH
      : (to - start) * YEAR_WIDTH + YEAR_WIDTH - HANDLE_WIDTH
  return { left: `${left}px`, top: `${row * ROW_HEIGHT}px` }
}

/** Listenøgle for et item. `Target` rummer også `'plan'` og `'person'`, uden
    `id`, men `timelineLayout.ts` sætter aldrig et item's `target` til nogen
    af de to, jf. ADR-0036 — nøglen dækker unionen alligevel frem for at
    antage det med et cast. */
function targetKey(target: Target): string {
  return 'id' in target ? `${target.kind}-${target.id}` : target.kind
}

/** Hvert femte år, plus startåret selv, så aksen aldrig starter blankt. */
function yearMarks(start: SimulationYear, end: SimulationYear): SimulationYear[] {
  const years: SimulationYear[] = []
  for (let year = start; year <= end; year++) {
    if (year === start || year % 5 === 0) years.push(year)
  }
  return years
}

/** Hver femte alder inden for personens egen levetid — aksen er blank uden
    for `[birthYear, birthYear + horizon]`, fordi der bare ikke skrives noget
    mærke der, jf. ADR-0036. */
function ageMarks(person: { birthYear: number; horizon: number }): number[] {
  const ages: number[] = []
  for (let age = 0; age <= person.horizon; age++) {
    if (age % 5 === 0) ages.push(age)
  }
  return ages
}

/** Det trukne håndtags udgangspunkt: posten som den så ud ved `mousedown`, så
    et helt tag beregnes mod planen dér og ikke mod den seneste — ellers ville
    afrundingens rest fra tidligere museflytninger snige sig med ind, jf.
    ADR-0036 og mock-uppens `OVERSTYRING`. */
type Drag = {
  item: TimelineItem
  edge: TimelineDragEdge
  startX: number
  startPlan: Plan
}

/** Tidslinjen: bokse, akse, folding, valg og træk, jf. ADR-0036. Tegner ud fra
    `timelineLayout.ts`s output — ingen egen udledning af hvad der får en
    boks, hvilken gruppe den hører til, eller hvilken farve den får. */
export function Timeline({
  plan,
  selected,
  onSelect,
  onChange,
}: {
  plan: Plan
  selected: Selection
  onSelect: (selection: Selection) => void
  onChange: (plan: Plan) => void
}) {
  const groups = timelineLayout(plan)
  const { start, end } = timelineBounds(plan)
  const [drag, setDrag] = useState<Drag | null>(null)
  // Sidst committede tag — et ref og ikke tilstand, for `mousemove` skal
  // kunne sammenligne mod den uden at vente på en gentegning, jf.
  // Navigator.tsx's `grabbed`.
  const lastDelta = useRef(0)

  useEffect(() => {
    if (!drag) return
    const onMouseMove = (event: MouseEvent) => {
      const deltaYears = Math.round((event.clientX - drag.startX) / YEAR_WIDTH)
      if (deltaYears === lastDelta.current) return
      lastDelta.current = deltaYears
      onChange(applyTimelineDrag(drag.startPlan, drag.item, drag.edge, deltaYears))
    }
    const onMouseUp = () => setDrag(null)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [drag, onChange])

  function startDrag(item: TimelineItem, edge: TimelineDragEdge) {
    return (event: ReactMouseEvent) => {
      event.stopPropagation()
      lastDelta.current = 0
      setDrag({ item, edge, startX: event.clientX, startPlan: plan })
    }
  }
  // Foldning er tidslinjens egen tilstand, uafhængig af Navigatorens
  // tilsvarende foldning af de samme fem grupper, jf. ADR-0036.
  const [folded, setFolded] = useState<Partial<Record<TimelineGroupName, boolean>>>({})

  const contentWidth = `${(end - start + 1) * YEAR_WIDTH}px`

  return (
    <div className="tidslinje-lag">
      <div className="tidslinje-hoved">
        Tidslinjen
        <span className="note">
          Egen vandret rulning, uafhængig af Formuegrafens skala · lodret rulning for grupperne
        </span>
      </div>
      <div className="tidslinje-rul">
        <div className="tl-indhold" style={{ width: contentWidth }}>
          <div className="tl-akse">
            <div className="tl-akse-raekke aar">
              {yearMarks(start, end).map((year) => (
                <span
                  key={year}
                  className="tl-akse-maerke"
                  style={{ left: `${(year - start) * YEAR_WIDTH}px` }}
                >
                  {year}
                </span>
              ))}
            </div>
            {plan.household.persons.map((person) => (
              <div key={person.id} className="tl-akse-raekke" data-person={person.id}>
                {ageMarks(person).map((age) => (
                  <span
                    key={age}
                    className="tl-akse-maerke"
                    style={{ left: `${(person.birthYear + age - start) * YEAR_WIDTH}px` }}
                  >
                    {age}
                  </span>
                ))}
                <span className="tl-akse-navn">{person.name.slice(0, 1)}</span>
              </div>
            ))}
          </div>
          {groups.map((group) => (
            <div key={group.name} className={'tl-gruppe' + (folded[group.name] ? ' foldet' : '')}>
              <button
                type="button"
                className="tl-gruppe-hoved"
                aria-expanded={!folded[group.name]}
                onClick={() => setFolded((f) => ({ ...f, [group.name]: !f[group.name] }))}
              >
                {GROUP_TITLES[group.name]}
                <span className="antal">{group.items.length}</span>
              </button>
              {!folded[group.name] && (
                <div className="tl-krop" style={{ height: `${group.rowCount * ROW_HEIGHT}px` }}>
                  {group.items.map((item) => {
                    if (item.point) {
                      return (
                        <button
                          type="button"
                          key={targetKey(item.target)}
                          className={'tl-punkt' + (sameSelection(selected, item.target) ? ' valgt' : '')}
                          style={pointStyle(endpointYear(item.at, start), start, item.row)}
                          onMouseDown={item.at.kind === 'Free' ? startDrag(item, 'point') : undefined}
                          onClick={() => onSelect(item.target)}
                        >
                          <span className="rombe" style={{ background: item.color }} />
                          <span className="navn">{item.name}</span>
                        </button>
                      )
                    }

                    const fromYear = endpointYear(item.from, start)
                    const toYear = endpointYear(item.to, end)
                    return (
                      <Fragment key={targetKey(item.target)}>
                        <button
                          type="button"
                          className={
                            'tl-boks' +
                            (sameSelection(selected, item.target) ? ' valgt' : '') +
                            (canDragBody(item) ? ' krop-fri' : '')
                          }
                          style={{ ...boxStyle(fromYear, toYear, start, item.row), background: item.color }}
                          onMouseDown={canDragBody(item) ? startDrag(item, 'body') : undefined}
                          onClick={() => onSelect(item.target)}
                        >
                          {item.name}
                        </button>
                        {item.from.kind === 'Free' && (
                          <div
                            className="tl-haandtag fra"
                            style={handleStyle('from', fromYear, toYear, start, item.row)}
                            onMouseDown={startDrag(item, 'from')}
                          />
                        )}
                        {item.to.kind === 'Free' && (
                          <div
                            className="tl-haandtag til"
                            style={handleStyle('to', fromYear, toYear, start, item.row)}
                            onMouseDown={startDrag(item, 'to')}
                          />
                        )}
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
