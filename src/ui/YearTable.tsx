import type { Plan } from '../engine/plan'
import type { BufferState, YearResult } from '../engine/yearResult'
import { kroner } from './format'
import { inRealKroner } from './real'

/** Danske mærkater for de to fejltilstande fra ADR-0008. En negativ buffer er
    et resultat og markeres derfor i tabellen — aldrig som en valideringsfejl
    ved et inputfelt. */
const bufferStateLabels: Record<BufferState, string> = {
  Incomplete: 'Ufuldstændig',
  Unsustainable: 'Uholdbar',
}

/** Rækkens CSS-klasse følger tilstanden, så ufuldstændig og uholdbar kan
    skelnes uden at læse et tal — se app.css. */
const bufferStateClasses: Record<BufferState, string> = {
  Incomplete: 'ufuldstaendig',
  Unsustainable: 'uholdbar',
}

/** Årstabellen: én række pr. simuleringsår. Alle beløb deflateres til dagens
    kroner her — motoren leverer dem i løbende priser. */
export function YearTable({ years, plan }: { years: YearResult[]; plan: Plan }) {
  const persons = plan.household.persons

  return (
    <div className="tabelramme">
      <table className="aar">
        <thead>
          <tr>
            <th scope="col">År</th>
            {persons.map((person) => (
              <th scope="col" key={person.id}>
                {person.name}
              </th>
            ))}
            <th scope="col">Indtægter</th>
            <th scope="col">Afkast</th>
            <th scope="col">Skat</th>
            <th scope="col">Udgifter</th>
            <th scope="col">Nettoresultat</th>
            <th scope="col">Buffer</th>
            <th scope="col">Formue</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const real = (amount: number) => inRealKroner(amount, year.year, plan)
            const result =
              year.income + year.return - year.tax - year.expenses
            const bufferBalance = year.holdings.find(
              (holding) => holding.holding === plan.buffer,
            )!.closingBalance
            const state = year.bufferState

            return (
              <tr key={year.year} className={state ? bufferStateClasses[state] : undefined}>
                <td>{year.year}</td>
                {persons.map((person) => (
                  <td key={person.id}>{year.year - person.birthYear}</td>
                ))}
                <td>{kroner(real(year.income))}</td>
                <td>{kroner(real(year.return))}</td>
                <td>{kroner(real(-year.tax))}</td>
                <td>{kroner(real(-year.expenses))}</td>
                <td>{kroner(real(result))}</td>
                <td className="buffer">
                  {kroner(real(bufferBalance))}
                  {state && <span className="tilstand">{bufferStateLabels[state]}</span>}
                </td>
                <td className="formue">{kroner(real(year.closingWealth))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
