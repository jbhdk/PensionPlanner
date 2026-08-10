import { useState } from 'react'
import type { Plan } from '../engine/plan'
import { simulate } from '../engine/simulate'
import { Inspector } from './Inspector'
import { Navigator } from './Navigator'
import { YearTable } from './YearTable'
import type { Selection } from './selection'
import './app.css'

/** Fladen: topbjælken, navigatoren til venstre, resultatspalten til højre og
    inspektørskuffen, der glider ind over resultatet, når en linje vælges.

    Der er ingen beregn-knap. `simulate` er en ren funktion over en håndfuld
    beholdninger og godt tres år, så årsrækken regnes om ved hver ændring —
    resultatspalten er til enhver tid et spejl af navigatoren. */
export function App({ initialPlan }: { initialPlan: Plan }) {
  const [plan, setPlan] = useState(initialPlan)
  const [selected, setSelected] = useState<Selection>(null)

  const years = simulate(plan)
  const period = `${plan.startYear}–${years.at(-1)?.year ?? plan.startYear}`

  return (
    <div className="app">
      <header className="topbjaelke">
        <span className="maerke">Pensionsplanner</span>
        <span className="plannavn">{plan.name}</span>
      </header>

      <div className={'spalter' + (selected ? ' med-skuffe' : '')}>
        <div className="spalte navigatorspalte">
          <Navigator
            plan={plan}
            period={period}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <div className="spalte resultatspalte">
          <div className="resultathoved">
            <span className="titel">Resultatet</span>
            <span className="enhedsmaerke">dagens kroner</span>
          </div>
          <YearTable years={years} plan={plan} />
        </div>
      </div>

      {selected && (
        <aside className="skuffe" aria-label="Inspektør">
          <Inspector
            plan={plan}
            selected={selected}
            onChange={setPlan}
            onClose={() => setSelected(null)}
          />
        </aside>
      )}
    </div>
  )
}
