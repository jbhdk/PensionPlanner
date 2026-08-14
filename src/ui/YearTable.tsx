import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import { bufferStateClasses, bufferStateLabels } from './bufferState'
import { capBreachClasses, capBreachLabels } from './capBreach'
import { kroner } from './format'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'

/** Årstabellen: én række pr. simuleringsår. Alle beløb deflateres til dagens
    kroner her — motoren leverer dem i løbende priser. */
export function YearTable({
  years,
  plan,
  unit,
  onSelectYear,
}: {
  years: YearResult[]
  plan: Plan
  unit: AmountUnit
  onSelectYear: (year: number) => void
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
            {/* Det, der landede i ordningerne — altså hvad året lagde til
                side. Bruttobeløbet ved kilden og AM-delen imellem dem står i
                forklar-året; her er der plads til ét tal. Indbetalingen er en
                bevægelse og indgår derfor ikke i nettoresultatet, som står
                længere til højre. */}
            <th scope="col">Indbetalinger</th>
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
            const breach = year.capBreach
            // To markeringer, der skal kunne skelnes, og som kan falde i
            // samme år. Rækken bærer begge klasser, og hver af de to ord
            // står i den kolonne, det handler om — bufferens ved saldoen,
            // loftets ved indbetalingerne.
            const rowClass = [
              state ? bufferStateClasses[state] : undefined,
              breach ? capBreachClasses[breach] : undefined,
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <tr
                key={year.year}
                className={rowClass === '' ? undefined : rowClass}
                onClick={() => onSelectYear(year.year)}
              >
                <td>
                  {year.year}
                  {year.rateBasis.projected && (
                    <span
                      className="fremskrevet"
                      title={`Fremskrevet fra satsår ${year.rateBasis.knownYear}`}
                    >
                      *
                    </span>
                  )}
                </td>
                {persons.map((person) => (
                  <td key={person.id}>{year.year - person.birthYear}</td>
                ))}
                <td>{kroner(display(year.income))}</td>
                <td className="indbetaling">
                  {kroner(
                    display(
                      year.contributions.reduce(
                        (sum, contribution) => sum + contribution.intoHolding,
                        0,
                      ),
                    ),
                  )}
                  {/* Markeringen læses af motorens ene felt. Fladen
                      sammenligner ikke selv indbetalt med loft — hvilket
                      loft der bandt, og med hvor meget, står i
                      forklar-året, jf. ADR-0012. */}
                  {breach && <span className="tilstand">{capBreachLabels[breach]}</span>}
                </td>
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
