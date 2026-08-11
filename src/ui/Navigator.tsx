import { useState } from 'react'
import type { Plan } from '../engine/plan'
import { kroner } from './format'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'

type Row = { name: string; value: string; target: Target }
type Group = {
  id: string
  title: string
  count: string
  summary: string
  rows: Row[]
}

/** Navigatoren viser planen, den redigerer den ikke — felterne står i skuffen.
    De fleste foldede grupper er ikke tavse: resuméet træder i stedet for
    listen. Indtægter og Udgifter er undtagelsen — et samlet kronetal ville
    love en regelmæssighed, poster med periode eller gentagelse ikke har, så
    de viser kun deres antal, jf. antallet allerede synligt i badge'en. */
export function Navigator({
  plan,
  period,
  selected,
  onSelect,
}: {
  plan: Plan
  period: string
  selected: Selection
  onSelect: (selection: Selection) => void
}) {
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const groups = groupsOf(plan, period)

  return (
    <>
      <div className="spaltehoved">Planen</div>
      {groups.map((group) => (
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
              {group.rows.map((row) => (
                <button
                  type="button"
                  key={row.name}
                  className={
                    'nav-rk' +
                    (sameSelection(selected, row.target) ? ' valgt' : '')
                  }
                  onClick={() => onSelect(row.target)}
                >
                  <span className="navn">{row.name}</span>
                  <span className="tal">{row.value}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  )
}

function groupsOf(plan: Plan, period: string): Group[] {
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
      rows: [{ name: plan.name, value: period, target: { kind: 'plan' } }],
    },
    {
      id: 'husstand',
      title: 'Husstanden',
      count: String(persons.length),
      summary: persons.map((person) => person.name).join(' · '),
      rows: persons.map((person) => ({
        name: person.name,
        value: `f. ${person.birthYear}`,
        target: { kind: 'person', id: person.id },
      })),
    },
    {
      id: 'beholdninger',
      title: 'Beholdninger',
      count: String(holdings.length),
      summary: `${kroner(holdingSum)} kr.`,
      rows: holdings.map((holding) => ({
        name: holding.name,
        value: kroner(holding.balance),
        target: { kind: 'holding', id: holding.id },
      })),
    },
    {
      id: 'indtaegter',
      title: 'Indtægter',
      count: String(income.length),
      // Ingen sum her: poster kan have begrænset periode eller gentagelse,
      // så et samlet kronetal ville love en regelmæssighed, planen ikke har.
      // De nøjagtige tal står i årstabellen.
      summary: '',
      rows: income.map((entry) => ({
        name: entry.name,
        value: kroner(entry.amountInRealKroner),
        target: { kind: 'entry', id: entry.id },
      })),
    },
    {
      id: 'udgifter',
      title: 'Udgifter',
      count: String(expenses.length),
      summary: '',
      rows: expenses.map((entry) => ({
        name: entry.name,
        // Posten selv er altid positiv; det er først på skærmen, en udgift
        // bliver til et minus, jf. Indtægter-grenen ovenfor.
        value: kroner(-entry.amountInRealKroner),
        target: { kind: 'entry', id: entry.id },
      })),
    },
  ]
}
