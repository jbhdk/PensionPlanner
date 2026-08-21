import { useState } from 'react'
import type { Plan, SimulationYear } from '../engine/plan'
import { endpointYear, timelineBounds, timelineLayout } from './timelineLayout'
import type { TimelineGroupName } from './timelineLayout'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'

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

/** Tidslinjen: bokse, akse, folding og valg, jf. ADR-0036. Tegner ud fra
    `timelineLayout.ts`s output — ingen egen udledning af hvad der får en
    boks, hvilken gruppe den hører til, eller hvilken farve den får. */
export function Timeline({
  plan,
  selected,
  onSelect,
  onChange: _onChange,
}: {
  plan: Plan
  selected: Selection
  onSelect: (selection: Selection) => void
  /** Ikke brugt i denne skive — kun med i signaturen så #60 kan bygge træk
      oven på uden at ændre komponentens grænseflade, jf. issue #59. */
  onChange: (plan: Plan) => void
}) {
  const groups = timelineLayout(plan)
  const { start, end } = timelineBounds(plan)
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
                  {group.items.map((item) =>
                    item.point ? (
                      <button
                        type="button"
                        key={targetKey(item.target)}
                        className={'tl-punkt' + (sameSelection(selected, item.target) ? ' valgt' : '')}
                        style={pointStyle(endpointYear(item.at, start), start, item.row)}
                        onClick={() => onSelect(item.target)}
                      >
                        <span className="rombe" style={{ background: item.color }} />
                        <span className="navn">{item.name}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        key={targetKey(item.target)}
                        className={'tl-boks' + (sameSelection(selected, item.target) ? ' valgt' : '')}
                        style={{
                          ...boxStyle(
                            endpointYear(item.from, start),
                            endpointYear(item.to, end),
                            start,
                            item.row,
                          ),
                          background: item.color,
                        }}
                        onClick={() => onSelect(item.target)}
                      >
                        {item.name}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
