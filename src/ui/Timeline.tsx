import { Fragment, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Plan, SimulationYear } from '../engine/plan'
import { endpointYear, timelineBounds, timelineLayout } from './timelineLayout'
import type { TimelineGroupName, TimelineItem } from './timelineLayout'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'
import { applyTimelineDrag } from './timelineDrag'
import type { TimelineDragEdge } from './timelineDrag'
import type { Clamp } from './fields'
import { withPerson } from './planEdits'

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

/** Gulvet for pixel pr. år på tidslinjens egen skala — uafhængig af graf-
    lagets, jf. ADR-0036. Den faktiske bredde regnes af komponenten selv ud
    fra `.tidslinje-rul`s målte plads og vokser derover, så tidslinjen fylder
    sin boks — men går aldrig under gulvet, for en tyndere boks end dette kan
    ikke rammes og trækkes præcist, den samme begrundelse ADR-0036 selv giver
    for tidslinjens uafhængige skala. Samme værdi som mock-uppens `PXY`. */
const MIN_YEAR_WIDTH = 18

/** Højde pr. pakket række, samme værdi som mock-uppens `RAEKKE_H`. */
const ROW_HEIGHT = 24

/** En rækkes eget indryk fra sin top, matcher CSS-fallbacken `top: 3px` i
    `.tl-boks`/`.tl-punkt`/`.tl-haandtag`. Uden det indryk sidder øverste
    række flugtende med gruppens overskrift, som så skjuler en valgt boks'
    omrids — rækkerne under har altid haft samme luft, fordi boksens 18px
    højde selv giver 6px slap inden for de 24px, men den slap havde ingen
    virkning for allerøverste række, som ikke har en tidligere række at låne
    den fra. */
const ROW_TOP_INSET = 3

/** Højde pr. akserække (kalenderår og hver persons alder), matcher
    `.tl-akse-raekke`s faste CSS-højde. */
const AXIS_ROW_HEIGHT = 18

/** Højde af en gruppes overskrift, matcher `.tl-gruppe-hoved`s faste
    CSS-højde, samme værdi som mock-uppens `GRUPPE_HOVED_H`. Erhvervsophørs-
    linjens fulde udstrækning regnes ud fra denne og `ROW_HEIGHT`, ligesom
    mock-uppens `tlIndhold` regner sin `samlet`-højde. */
const GROUP_HEADER_HEIGHT = 25

/** Håndtagets bredde, samme værdi som mock-uppens `.tl-haandtag`. */
const HANDLE_WIDTH = 6

/** Boksens venstre kant, bredde og lodrette plads, udledt af postens opløste
    `from`/`to` og laget allerede tildelte `row` — komponenten afgør ikke selv
    hvilken række en post lander i, jf. `timelineLayout.ts`s pakning. Højre
    kant lægger et helt år til `to`, så sidste års boks dækker hele det år og
    ikke kun dets startpunkt — samme regel som mock-uppens `tlBoks`. */
function boxStyle(
  from: SimulationYear,
  to: SimulationYear,
  start: SimulationYear,
  row: number,
  yearWidth: number,
) {
  const left = (from - start) * yearWidth
  const right = (to - start) * yearWidth + yearWidth
  return { left: `${left}px`, width: `${right - left}px`, top: `${row * ROW_HEIGHT + ROW_TOP_INSET}px` }
}

/** Punktets venstre kant og lodrette plads. Et punkt har ingen udstrækning —
    det er hverken en kortere boks eller en boks med bredde nul, men en anden
    figur helt, jf. ADR-0036. Placeret midt i sit år og ikke ved dets start,
    for punktet står for hele året og ikke et præcist tidspunkt i det —
    samme princip for engangspostens punkt som for et gentagelsesmærke. */
function pointStyle(at: SimulationYear, start: SimulationYear, row: number, yearWidth: number) {
  return {
    left: `${(at - start + 0.5) * yearWidth}px`,
    top: `${row * ROW_HEIGHT + ROW_TOP_INSET}px`,
  }
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
  yearWidth: number,
) {
  const left =
    edge === 'from'
      ? (from - start) * yearWidth
      : (to - start) * yearWidth + yearWidth - HANDLE_WIDTH
  return { left: `${left}px`, top: `${row * ROW_HEIGHT + ROW_TOP_INSET}px` }
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
type Drag =
  | { kind: 'item'; item: TimelineItem; edge: TimelineDragEdge; startX: number; startPlan: Plan }
  | { kind: 'person'; personId: string; startX: number; startPlan: Plan }

/** Klemmer erhvervsophøret til samme grænser som Inspektørens `NumberField`
    for `Person.workEndAge` (`bounds={{ min: 0, max: person.horizon }}`) —
    håndtaget skal opføre sig præcis som det felt, jf. issue #61. */
function clampWorkEndAge(age: number, horizon: number): number {
  return Math.min(Math.max(age, 0), horizon)
}

/** Tidslinjen: bokse, akse, folding, valg og træk, jf. ADR-0036. Tegner ud fra
    `timelineLayout.ts`s output — ingen egen udledning af hvad der får en
    boks, hvilken gruppe den hører til, eller hvilken farve den får. */
export function Timeline({
  plan,
  selected,
  onSelect,
  onClamp,
  onChange,
}: {
  plan: Plan
  selected: Selection
  onSelect: (selection: Selection) => void
  /** Meldes ved hvert træk: klemningen, hvis en grænse greb ind undervejs,
      ellers intet. Et træk har intet felt at stå rødt i, og beskeden vises
      derfor i skuffen ved det felt, den peger på — hvilket virker, fordi et
      greb i en figur også vælger den. */
  onClamp: (clamp: Clamp | null) => void
  onChange: (plan: Plan) => void
}) {
  const groups = timelineLayout(plan)
  const { start, end } = timelineBounds(plan)
  const [drag, setDrag] = useState<Drag | null>(null)
  // Den musefølgende årsmarkør, jf. ADR-0038 — samme sprog som hovedgrafens
  // `YearCursor`, men tegnet i almindeligt HTML/CSS som resten af
  // tidslinjen, og med mærkatet stående i den faste akse foroven i stedet
  // for forneden.
  const [hoveredYear, setHoveredYear] = useState<SimulationYear | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // Sidst committede tag — et ref og ikke tilstand, for `mousemove` skal
  // kunne sammenligne mod den uden at vente på en gentegning, jf.
  // Navigator.tsx's `grabbed`.
  const lastDelta = useRef(0)

  // Rullelagets målte bredde, så tidslinjens skala kan følge sin boks —
  // samme ResizeObserver-mønster som chartFrame.tsx's `useMeasuredPlot`.
  // Ubrugt (0) i test-miljø uden en rigtig layoutmotor, hvor `yearWidth`
  // derfor blot lander på sit gulv, `MIN_YEAR_WIDTH`.
  const railRef = useRef<HTMLDivElement>(null)
  const [railWidth, setRailWidth] = useState(0)

  useEffect(() => {
    const rail = railRef.current
    if (!rail || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setRailWidth(width)
    })
    observer.observe(rail)
    return () => observer.disconnect()
  }, [])

  const yearsCount = end - start + 1
  const yearWidth = Math.max(MIN_YEAR_WIDTH, railWidth / yearsCount)

  useEffect(() => {
    if (!drag) return
    const onMouseMove = (event: MouseEvent) => {
      const rawDelta = Math.round((event.clientX - drag.startX) / yearWidth)
      if (drag.kind === 'item') {
        if (rawDelta === lastDelta.current) return
        lastDelta.current = rawDelta
        const dragged = applyTimelineDrag(drag.startPlan, drag.item, drag.edge, rawDelta)
        onChange(dragged.plan)
        onClamp(dragged.clamp)
        return
      }
      const person = drag.startPlan.household.persons.find((p) => p.id === drag.personId)!
      const workEndAge = clampWorkEndAge(person.workEndAge + rawDelta, person.horizon)
      // Klemningen kan gøre flere `rawDelta`-værdier i træk til samme
      // resultat — sammenlignes derfor mod den faktiske aldersforskydning og
      // ikke mod `rawDelta` selv, så commit-kun-ved-værdiskifte holder også
      // ved horisontens grænse.
      const effectiveDelta = workEndAge - person.workEndAge
      if (effectiveDelta === lastDelta.current) return
      lastDelta.current = effectiveDelta
      onChange(withPerson(drag.startPlan, drag.personId, (p) => ({ ...p, workEndAge })))
    }
    const onMouseUp = () => setDrag(null)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [drag, onChange, onClamp])

  function startDrag(item: TimelineItem, edge: TimelineDragEdge) {
    return (event: ReactMouseEvent) => {
      event.stopPropagation()
      // Browserens standardhandling for `mousedown` er at begynde en
      // tekstmarkering, som trækket ellers slæber med sig hen over fladen —
      // også uden for tidslinjen, når musen løber ud af dens boks. Det koster
      // knappens fokusflytning ved klik, men ikke `onClick` og dermed ikke
      // valget af posten.
      event.preventDefault()
      // Grebet vælger figuren, ganske som et klik på boksen gør. Håndtagene
      // er boksens søskende og ikke dens børn, så et træk i et af dem ville
      // ellers ikke udløse boksens `onClick` — og en klemning, trækket melder,
      // ville stå i en skuffe, der viser noget andet.
      onSelect(item.target)
      lastDelta.current = 0
      setDrag({ kind: 'item', item, edge, startX: event.clientX, startPlan: plan })
    }
  }

  function startPersonDrag(personId: string) {
    return (event: ReactMouseEvent) => {
      event.stopPropagation()
      // Samme grund som i `startDrag`.
      event.preventDefault()
      lastDelta.current = 0
      setDrag({ kind: 'person', personId, startX: event.clientX, startPlan: plan })
    }
  }

  // Musen snapper til det nærmeste årsmærke — samme princip som graf-lagets
  // `useYearCursor`, blot regnet af pixel-position i stedet for et allerede
  // kendt indeks, for tidslinjens rækker har intet årsfelt at hoveres.
  // Rundet og ikke gulvet, så markøren ligger om musens midtpunkt: den
  // skifter år, når musen har passeret det halve mellemrum til nabomærket,
  // ikke i det øjeblik musen krydser årets egen kolonnegrænse.
  function updateHoveredYear(event: ReactMouseEvent) {
    const rect = contentRef.current?.getBoundingClientRect()
    if (!rect) return
    const year = start + Math.round((event.clientX - rect.left) / yearWidth)
    setHoveredYear(Math.min(end, Math.max(start, year)))
  }
  // Foldning er tidslinjens egen tilstand, uafhængig af Navigatorens
  // tilsvarende foldning af de samme fem grupper, jf. ADR-0036.
  const [folded, setFolded] = useState<Partial<Record<TimelineGroupName, boolean>>>({})

  const contentWidth = `${yearsCount * yearWidth}px`
  // Erhvervsophørslinjens fulde udstrækning: aksens højde (kalenderåret plus
  // én række pr. person) og summen af de synlige gruppers højde, en foldet
  // gruppe bidrager kun sin overskrift, jf. mock-uppens `tlIndhold`.
  const axisHeight = AXIS_ROW_HEIGHT * (1 + plan.household.persons.length)
  const groupsHeight = groups.reduce(
    (sum, group) =>
      sum + GROUP_HEADER_HEIGHT + (folded[group.name] ? 0 : group.rowCount * ROW_HEIGHT),
    0,
  )
  // Samme kant som de statiske årsmærker og boksenes venstre kant, jf.
  // `boxStyle`/`.tl-akse-maerke` — ikke årets midte, som `pointStyle` bruger
  // til punkter uden udstrækning. Markøren skal kunne aflæses mod de samme
  // mærker, den selv lægger sig oven på.
  const markerLeft = hoveredYear === null ? null : (hoveredYear - start) * yearWidth

  return (
    <div className="tidslinje-lag">
      <div className="tidslinje-hoved">Tidslinjen</div>
      <div className="tidslinje-rul" ref={railRef}>
        <div
          className="tl-indhold"
          ref={contentRef}
          style={{ width: contentWidth }}
          onMouseMove={updateHoveredYear}
          onMouseLeave={() => setHoveredYear(null)}
        >
          <div className="tl-akse">
            <div className="tl-akse-raekke aar">
              {yearMarks(start, end).map((year) => (
                <span
                  key={year}
                  className="tl-akse-maerke"
                  style={{ left: `${(year - start) * yearWidth}px` }}
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
                    style={{ left: `${(person.birthYear + age - start) * yearWidth}px` }}
                  >
                    {age}
                  </span>
                ))}
                <span className="tl-akse-navn">{person.name.slice(0, 1)}</span>
                <div
                  className="tl-ophoer-greb"
                  data-person={person.id}
                  style={{ left: `${(person.birthYear + person.workEndAge - start) * yearWidth}px` }}
                  onMouseDown={startPersonDrag(person.id)}
                >
                  {person.name} · {person.workEndAge}
                </div>
              </div>
            ))}
            {markerLeft !== null && (
              <div className="tl-aarsmarkoer-etiket" style={{ left: `${markerLeft}px` }}>
                {hoveredYear}
              </div>
            )}
          </div>
          <div
            className="tl-ophoer-linjer"
            style={{ top: `${axisHeight}px`, height: `${groupsHeight}px` }}
          >
            {plan.household.persons.map((person) => (
              <div
                key={person.id}
                className="tl-ophoer"
                data-person={person.id}
                style={{ left: `${(person.birthYear + person.workEndAge - start) * yearWidth}px` }}
              />
            ))}
          </div>
          {markerLeft !== null && (
            <div
              className="tl-aarsmarkoer-linjer"
              style={{ top: `${axisHeight}px`, height: `${groupsHeight}px` }}
            >
              <div className="tl-aarsmarkoer" style={{ left: `${markerLeft}px` }} />
            </div>
          )}
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
                          style={pointStyle(endpointYear(item.at, start), start, item.row, yearWidth)}
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
                    const repeated = item.marks.length > 0
                    return (
                      <Fragment key={targetKey(item.target)}>
                        <button
                          type="button"
                          className={
                            'tl-boks' +
                            (sameSelection(selected, item.target) ? ' valgt' : '') +
                            (canDragBody(item) ? ' krop-fri' : '') +
                            (repeated ? ' gentaget' : '')
                          }
                          style={{
                            ...boxStyle(fromYear, toYear, start, item.row, yearWidth),
                            ...(repeated
                              ? { background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${item.color}` }
                              : { background: item.color }),
                          }}
                          onMouseDown={canDragBody(item) ? startDrag(item, 'body') : undefined}
                          onClick={() => onSelect(item.target)}
                        >
                          <span className="navn">{item.name}</span>
                        </button>
                        {item.marks.map((year) => (
                          <span
                            key={year}
                            className="tl-maerke"
                            style={{
                              ...pointStyle(year, start, item.row, yearWidth),
                              background: item.color,
                            }}
                          />
                        ))}
                        {item.from.kind === 'Free' && (
                          <div
                            className="tl-haandtag fra"
                            style={handleStyle('from', fromYear, toYear, start, item.row, yearWidth)}
                            onMouseDown={startDrag(item, 'from')}
                          />
                        )}
                        {item.to.kind === 'Free' && (
                          <div
                            className="tl-haandtag til"
                            style={handleStyle('to', fromYear, toYear, start, item.row, yearWidth)}
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
