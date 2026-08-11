import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import { bufferStateClasses, bufferStateLabels } from './bufferState'
import { kroner } from './format'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'

/** Årstabellen: én række pr. simuleringsår. Alle beløb deflateres til dagens
    kroner her — motoren leverer dem i løbende priser. */
export function YearTable({
  years,
  plan,
  unit,
}: {
  years: YearResult[]
  plan: Plan
  unit: AmountUnit
}) {
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
            const display = (amount: number) => toDisplayKroner(amount, year.year, plan, unit)
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
                <td>{kroner(display(year.income))}</td>
                <td>{kroner(display(year.return))}</td>
                <td>{kroner(display(-year.tax))}</td>
                <td>{kroner(display(-year.expenses))}</td>
                <td>{kroner(display(result))}</td>
                <td className="buffer">
                  {kroner(display(bufferBalance))}
                  {state && <span className="tilstand">{bufferStateLabels[state]}</span>}
                </td>
                <td className="formue">{kroner(display(year.closingWealth))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
