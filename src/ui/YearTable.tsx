import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import { kroner } from './format'
import { inRealKroner } from './real'

/** Årstabellen: én række pr. simuleringsår. Alle beløb deflateres til dagens
    kroner her — motoren leverer dem i løbende priser. */
export function YearTable({ years, plan }: { years: YearResult[]; plan: Plan }) {
  return (
    <div className="tabelramme">
      <table className="aar">
        <thead>
          <tr>
            <th scope="col">År</th>
            <th scope="col">Indtægter</th>
            <th scope="col">Afkast</th>
            <th scope="col">Skat</th>
            <th scope="col">Udgifter</th>
            <th scope="col">Nettoresultat</th>
            <th scope="col">Formue</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const real = (amount: number) => inRealKroner(amount, year.year, plan)
            const result =
              year.income + year.return - year.tax - year.expenses

            return (
              <tr key={year.year}>
                <td>{year.year}</td>
                <td>{kroner(real(year.income))}</td>
                <td>{kroner(real(year.return))}</td>
                <td>{kroner(real(-year.tax))}</td>
                <td>{kroner(real(-year.expenses))}</td>
                <td>{kroner(real(result))}</td>
                <td className="formue">{kroner(real(year.closingWealth))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
