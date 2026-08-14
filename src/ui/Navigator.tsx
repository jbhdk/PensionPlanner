import { useState } from 'react'
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
} from './planEdits'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'

type Row = { name: string; value: string; target: Target }
type Group = {
  id: string
  title: string
  count: string
  summary: string
  rows: Row[]
  /** Vises som en knap under rækkerne, matcher fladekortets "+ X"-mønster.
      Udeladt betyder, at gruppen ikke kan udvides herfra. */
  addLabel?: string
  onAdd?: () => void
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
  onChange,
}: {
  plan: Plan
  period: string
  selected: Selection
  onSelect: (selection: Selection) => void
  onChange: (plan: Plan) => void
}) {
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const groups = groupsOf(plan, period, onChange)

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

function groupsOf(plan: Plan, period: string, onChange: (plan: Plan) => void): Group[] {
  const persons = plan.household.persons
  const holdings = persons.flatMap((person) => person.holdings)
  const holdingSum = holdings.reduce((sum, h) => sum + h.balance, 0)
  const income = plan.entries.filter((entry) => entry.direction === 'Income')
  const expenses = plan.entries.filter((entry) => entry.direction === 'Expense')
  const holdingName = (id: string) => holdings.find((h) => h.id === id)?.name ?? id
  const entryName = (id: string) => plan.entries.find((entry) => entry.id === id)?.name ?? id

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
      // Husstanden er højst to personer, jf. domænemodellen.
      addLabel: persons.length < 2 ? '+ Person' : undefined,
      onAdd: () => onChange(addPerson(plan)),
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
      addLabel: '+ Beholdning',
      onAdd: () => onChange(addHolding(plan)),
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
      addLabel: '+ Indtægt',
      onAdd: () => onChange(addEntry(plan, 'Income')),
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
      addLabel: '+ Udgift',
      onAdd: () => onChange(addEntry(plan, 'Expense')),
    },
    {
      // Ingen sum her heller. En procent af en lønpost har intet kronebeløb,
      // før året er regnet, og et samlet tal ville være et årsafhængigt
      // resultat i en spalte, der kun viser planen. Antallet er nok.
      id: 'indbetalinger',
      title: 'Indbetalinger',
      count: String(plan.contributions.length),
      summary: '',
      rows: plan.contributions.map((contribution) => ({
        // Kilde → destination i begge udgaver, så de læses som ét slags
        // objekt i listen — og kilden siger selv, hvilken udgave rækken er:
        // et postnavn i den ene, et beholdningsnavn i den anden.
        name: `${
          contribution.kind === 'EntrySourced'
            ? entryName(contribution.source)
            : holdingName(contribution.source)
        } → ${holdingName(contribution.to)}`,
        value:
          'percentageOfEntry' in contribution
            ? procent(contribution.percentageOfEntry)
            : kroner(contribution.amountInRealKroner),
        target: { kind: 'contribution', id: contribution.id },
      })),
      // Et bidrag kræver en lønpost at komme fra og en af samme persons
      // ordninger at gå til. Er der intet sådant par, er der ikke noget at
      // tilføje, jf. ADR-0016.
      addLabel: firstContributionPair(plan) ? '+ Indbetaling' : undefined,
      onAdd: () => onChange(addContribution(plan)),
    },
    {
      id: 'overfoersler',
      title: 'Overførsler',
      count: String(plan.transfers.length),
      summary: '',
      rows: plan.transfers.map((transfer) => ({
        name: `${holdingName(transfer.from)} → ${holdingName(transfer.to)}`,
        value: kroner(transfer.amountInRealKroner),
        target: { kind: 'transfer', id: transfer.id },
      })),
      // En overførsel flytter penge mellem to beholdninger med frie midler —
      // der skal være to at vælge mellem, før knappen giver mening, jf.
      // ADR-0016.
      addLabel: firstTransferPair(plan) ? '+ Overførsel' : undefined,
      onAdd: () => onChange(addTransfer(plan)),
    },
  ]
}
