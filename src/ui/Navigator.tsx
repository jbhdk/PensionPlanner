import { useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import type { Plan } from '../engine/plan'
import { kroner, procent } from './format'
import {
  addContribution,
  addEntry,
  addHolding,
  addPerson,
  addTransfer,
  firstContributionPair,
  firstTransferPair,
  moveContribution,
  moveEntry,
  moveHolding,
  movePerson,
  moveTransfer,
} from './planEdits'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'

type Row = { id: string; name: string; value: string; target: Target }

/** En liste, der kan omordnes for sig. De fleste kasser rummer én; kun
    beholdningerne har flere, fordi de er delt op efter ejer. */
type Block = {
  id: string
  /** Ejerens navn over beholdningerne. Udeladt betyder ingen overskrift —
      resten af kasserne rummer kun én liste, og den er allerede navngivet af
      kassen selv. */
  heading?: string
  rows: Row[]
  /** Udeladt betyder en liste, rækkefølgen ikke kan flyttes i: Planen er én
      række og har intet at bytte plads med. */
  onMove?: (id: string, to: number) => void
}

type Group = {
  id: string
  title: string
  count: string
  summary: string
  blocks: Block[]
  /** Vises som en knap under rækkerne, matcher fladekortets "+ X"-mønster.
      Udeladt betyder, at gruppen ikke kan udvides herfra. */
  addLabel?: string
  onAdd?: () => void
}

/** Rækken, der bæres lige nu, og den den svæver over. Blokken følger med, så
    et slip i en anden liste kan afvises: en beholdning hører til sin ejer og
    kan ikke trækkes over til den andens. */
type Drag = { block: string; id: string; over: string | null }

/** Navigatoren viser planen, den redigerer den ikke — felterne står i skuffen.
    Rækkefølgen er undtagelsen, og den er ingen visningsdetalje: den afgør,
    hvem der får råderummet først, jf. `moveContribution` og ADR-0019. Derfor
    flyttes den her, hvor listen står, og ikke i skuffen.

    De fleste foldede grupper er ikke tavse: resuméet træder i stedet for
    listen. Indtægter og Udgifter er undtagelsen — et samlet kronetal ville
    love en regelmæssighed, poster med periode eller gentagelse ikke har, så
    de viser kun deres antal, jf. antallet allerede synligt i badge'en. */
export function Navigator({
  plan,
  period,
  selected,
  onSelect,
  onChange,
}: {
  plan: Plan
  period: string
  selected: Selection
  onSelect: (selection: Selection) => void
  onChange: (plan: Plan) => void
}) {
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  // Grebet er det eneste, der starter et træk, men det er hele rækken, der
  // bæres — ellers ville browseren tegne de seks prikker som skyggebillede.
  // Et ref og ikke en tilstand: `dragstart` følger umiddelbart efter
  // `mousedown`, og en gentegning imellem dem er ikke lovet.
  const grabbed = useRef<string | null>(null)

  const release = () => {
    setDrag(null)
    grabbed.current = null
  }

  return (
    <>
      <div className="spaltehoved">Planen</div>
      {groupsOf(plan, period, onChange).map((group) => (
        <section
          key={group.id}
          className={'nav-gruppe' + (folded[group.id] ? ' foldet' : '')}
        >
          <h3>
            <button
              type="button"
              className="foldknap"
              aria-expanded={!folded[group.id]}
              onClick={() =>
                setFolded((f) => ({ ...f, [group.id]: !f[group.id] }))
              }
            >
              <span className="vip" aria-hidden="true">
                ›
              </span>
              {group.title}
              {group.count && <span className="antal">{group.count}</span>}
              <span className="resume">{group.summary}</span>
            </button>
          </h3>
          {!folded[group.id] && (
            <div className="nav-krop">
              {group.blocks.map((block) => (
                <div key={block.id}>
                  {block.heading && (
                    <div className="nav-underoverskrift">{block.heading}</div>
                  )}
                  {block.rows.map((row, index) => {
                    // Én række har ingen plads at bytte med, og et greb, der
                    // ikke kan flytte noget, er værre end intet greb.
                    const movable = block.onMove !== undefined && block.rows.length > 1
                    const carried = drag !== null && drag.block === block.id && drag.id === row.id

                    return (
                      <button
                        type="button"
                        key={row.id}
                        className={
                          'nav-rk' +
                          (sameSelection(selected, row.target) ? ' valgt' : '') +
                          (carried ? ' baaret' : '') +
                          dropEdge(block, drag, row, index)
                        }
                        draggable={movable}
                        onDragStart={(event) => {
                          if (grabbed.current !== row.id) {
                            event.preventDefault()
                            return
                          }
                          // Firefox starter ikke et træk uden data på det.
                          // jsdom har slet ingen `dataTransfer`.
                          event.dataTransfer?.setData?.('text/plain', row.id)
                          setDrag({ block: block.id, id: row.id, over: null })
                        }}
                        onDragOver={(event) => allowDrop(event, block, drag, row, setDrag)}
                        onDrop={(event) => {
                          event.preventDefault()
                          if (drag !== null && drag.block === block.id) {
                            block.onMove?.(drag.id, index)
                          }
                          release()
                        }}
                        onDragEnd={release}
                        onKeyDown={(event) =>
                          moveByKey(event, movable ? block : undefined, row, index)
                        }
                        onClick={() => onSelect(row.target)}
                      >
                        {/* Pladsen holdes åben i hver række, også hvor der
                            intet er at flytte, jf. `.greb` i app.css. */}
                        <span
                          className="greb"
                          aria-hidden="true"
                          onMouseDown={() => {
                            grabbed.current = row.id
                          }}
                        >
                          {movable && <Greb />}
                        </span>
                        <span className="navn">{row.name}</span>
                        <span className="tal">{row.value}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
              {group.addLabel && (
                <div className="nav-bund">
                  <button type="button" className="nav-tilfoej" onClick={group.onAdd}>
                    {group.addLabel}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      ))}
    </>
  )
}

/** Stregen, der viser hvor rækken lander: over den række, der peges på, når
    den bæres opad, og under den, når den bæres nedad. Ingen streg på rækken,
    der bæres selv — den er allerede mærket. */
function dropEdge(block: Block, drag: Drag | null, row: Row, index: number): string {
  if (drag === null || drag.block !== block.id) return ''
  if (drag.over !== row.id || drag.id === row.id) return ''

  const from = block.rows.findIndex((other) => other.id === drag.id)
  return from > index ? ' slip-over' : ' slip-under'
}

/** Et slip er kun lovligt i den liste, trækket startede i. Uden for den
    siger browseren nej af sig selv, fordi `preventDefault` udebliver, og
    rækken falder tilbage på plads. */
function allowDrop(
  event: DragEvent,
  block: Block,
  drag: Drag | null,
  row: Row,
  setDrag: (drag: Drag) => void,
) {
  if (drag === null || drag.block !== block.id) return
  event.preventDefault()
  if (drag.over !== row.id) setDrag({ ...drag, over: row.id })
}

/** Tastaturets vej til det samme. Alt lagt til pilene, så de bliver ved med
    at være frie til det, piletaster plejer at gøre. */
function moveByKey(
  event: KeyboardEvent,
  block: Block | undefined,
  row: Row,
  index: number,
) {
  if (block === undefined || !event.altKey) return
  const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null
  if (to === null || to < 0 || to >= block.rows.length) return

  event.preventDefault()
  block.onMove?.(row.id, to)
}

/** Seks prikker — grebets sædvanlige form. Tegnet frem for skrevet, så den
    ikke afhænger af, om skrifttypen kender tegnet. */
function Greb() {
  return (
    <svg viewBox="0 0 6 10" width="6" height="10">
      {[1, 5, 9].map((y) =>
        [1, 5].map((x) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />
        )),
      )}
    </svg>
  )
}

function groupsOf(plan: Plan, period: string, onChange: (plan: Plan) => void): Group[] {
  const persons = plan.household.persons
  const holdings = persons.flatMap((person) => person.holdings)
  const holdingSum = holdings.reduce((sum, h) => sum + h.balance, 0)
  const income = plan.entries.filter((entry) => entry.direction === 'Income')
  const expenses = plan.entries.filter((entry) => entry.direction === 'Expense')

  return [
    {
      id: 'plan',
      title: 'Planen',
      count: '',
      summary: period,
      blocks: [
        {
          id: 'plan',
          rows: [{ id: 'plan', name: plan.name, value: period, target: { kind: 'plan' } }],
        },
      ],
    },
    {
      id: 'husstand',
      title: 'Husstanden',
      count: String(persons.length),
      summary: persons.map((person) => person.name).join(' · '),
      blocks: [
        {
          id: 'personer',
          rows: persons.map((person) => ({
            id: person.id,
            name: person.name,
            value: `f. ${person.birthYear}`,
            target: { kind: 'person', id: person.id },
          })),
          onMove: (id, to) => onChange(movePerson(plan, id, to)),
        },
      ],
      // Husstanden er højst to personer, jf. domænemodellen.
      addLabel: persons.length < 2 ? '+ Person' : undefined,
      onAdd: () => onChange(addPerson(plan)),
    },
    {
      id: 'indtaegter',
      title: 'Indtægter',
      count: String(income.length),
      // Ingen sum her: poster kan have begrænset periode eller gentagelse,
      // så et samlet kronetal ville love en regelmæssighed, planen ikke har.
      // De nøjagtige tal står i årstabellen.
      summary: '',
      blocks: [
        {
          id: 'indtaegter',
          rows: income.map((entry) => ({
            id: entry.id,
            name: entry.name,
            value: kroner(entry.amountInRealKroner),
            target: { kind: 'entry', id: entry.id },
          })),
          onMove: (id, to) => onChange(moveEntry(plan, id, to)),
        },
      ],
      addLabel: '+ Indtægt',
      onAdd: () => onChange(addEntry(plan, 'Income')),
    },
    {
      id: 'udgifter',
      title: 'Udgifter',
      count: String(expenses.length),
      summary: '',
      blocks: [
        {
          id: 'udgifter',
          rows: expenses.map((entry) => ({
            id: entry.id,
            name: entry.name,
            // Posten selv er altid positiv; det er først på skærmen, en
            // udgift bliver til et minus, jf. Indtægter-grenen ovenfor.
            value: kroner(-entry.amountInRealKroner),
            target: { kind: 'entry', id: entry.id },
          })),
          onMove: (id, to) => onChange(moveEntry(plan, id, to)),
        },
      ],
      addLabel: '+ Udgift',
      onAdd: () => onChange(addEntry(plan, 'Expense')),
    },
    {
      id: 'beholdninger',
      title: 'Beholdninger',
      count: String(holdings.length),
      summary: `${kroner(holdingSum)} kr.`,
      // Én liste pr. person med ejerens navn over. Kassen har altid vist
      // begge personers beholdninger efter hinanden, men uden skellet var det
      // ikke til at se, hvem der ejede hvad — og rækkefølgen kan kun flyttes
      // inden for den ene ejers egne, jf. `moveHolding`.
      blocks: persons.map((person) => ({
        id: `beholdninger-${person.id}`,
        heading: person.name,
        rows: person.holdings.map((holding) => ({
          id: holding.id,
          name: holding.name,
          value: kroner(holding.balance),
          target: { kind: 'holding', id: holding.id },
        })),
        onMove: (id, to) => onChange(moveHolding(plan, id, to)),
      })),
      addLabel: '+ Beholdning',
      onAdd: () => onChange(addHolding(plan)),
    },
    {
      // Ingen sum her heller. En procent af en lønpost har intet kronebeløb,
      // før året er regnet, og et samlet tal ville være et årsafhængigt
      // resultat i en spalte, der kun viser planen. Antallet er nok.
      id: 'indbetalinger',
      title: 'Indbetalinger',
      count: String(plan.contributions.length),
      summary: '',
      blocks: [
        {
          id: 'indbetalinger',
          rows: plan.contributions.map((contribution) => ({
            id: contribution.id,
            name: contribution.name,
            value:
              'percentageOfEntry' in contribution
                ? procent(contribution.percentageOfEntry)
                : kroner(contribution.amountInRealKroner),
            target: { kind: 'contribution', id: contribution.id },
          })),
          onMove: (id, to) => onChange(moveContribution(plan, id, to)),
        },
      ],
      // Et bidrag kræver en kilde at komme fra og en ordning at gå til. Er
      // der intet sådant par, er der ikke noget at tilføje, jf. ADR-0016.
      addLabel: firstContributionPair(plan) ? '+ Indbetaling' : undefined,
      onAdd: () => onChange(addContribution(plan)),
    },
    {
      id: 'overfoersler',
      title: 'Overførsler',
      count: String(plan.transfers.length),
      summary: '',
      blocks: [
        {
          id: 'overfoersler',
          rows: plan.transfers.map((transfer) => ({
            id: transfer.id,
            name: transfer.name,
            value: kroner(transfer.amountInRealKroner),
            target: { kind: 'transfer', id: transfer.id },
          })),
          onMove: (id, to) => onChange(moveTransfer(plan, id, to)),
        },
      ],
      // En overførsel flytter penge mellem to beholdninger med frie midler —
      // der skal være to at vælge mellem, før knappen giver mening, jf.
      // ADR-0016.
      addLabel: firstTransferPair(plan) ? '+ Overførsel' : undefined,
      onAdd: () => onChange(addTransfer(plan)),
    },
  ]
}
