import { useState } from 'react'
import type { Plan } from '../engine/plan'
import { simulate, validateBuffer } from '../engine/simulate'
import { Inspector } from './Inspector'
import { Navigator } from './Navigator'
import type { AmountUnit } from './real'
import { WealthChart } from './WealthChart'
import { YearExplanation } from './YearExplanation'
import { YearTable } from './YearTable'
import type { Selection } from './selection'
import './app.css'

/** Resultatspaltens visninger. Formuen er standardfanen, jf. issue #12 —
    man justerer i navigatoren og konstaterer visuelt på grafen, om planen
    holder; tabellen er laget man går ned i bagefter. Forklar-året er ikke en
    tredje fane, men en visning der overtager resultatspalten helt, jf.
    issue #13 — den har sin egen vej tilbage til Årstabellen. */
type ResultView = 'Wealth' | 'YearTable' | 'YearExplanation'

/** Fladen: topbjælken, navigatoren til venstre, resultatspalten til højre og
    inspektørskuffen, der glider ind over resultatet, når en linje vælges.

    Der er ingen beregn-knap. `simulate` er en ren funktion over en håndfuld
    beholdninger og godt tres år, så årsrækken regnes om ved hver ændring —
    resultatspalten er til enhver tid et spejl af navigatoren. */
export function App({ initialPlan }: { initialPlan: Plan }) {
  const [plan, setPlan] = useState(initialPlan)
  const [selected, setSelected] = useState<Selection>(null)
  const [resultView, setResultView] = useState<ResultView>('Wealth')
  const [unit, setUnit] = useState<AmountUnit>('Real')
  const [explainedYear, setExplainedYear] = useState<number | null>(null)

  function explainYear(year: number) {
    setExplainedYear(year)
    setResultView('YearExplanation')
  }

  // Nul eller to buffere er en inputfejl, ikke et resultat: planen kan ikke
  // simuleres, og resultatspalten skal sige hvorfor frem for at stå tom.
  const bufferError = validateBuffer(plan)
  const years = bufferError ? [] : simulate(plan)
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
            onChange={setPlan}
          />
        </div>

        <div className="spalte resultatspalte">
          {resultView === 'YearExplanation' && explainedYear !== null ? (
            <YearExplanation
              year={years.find((y) => y.year === explainedYear)!}
              years={years}
              plan={plan}
              onSelectYear={explainYear}
              onBack={() => setResultView('YearTable')}
            />
          ) : (
            <>
              <div className="resultathoved">
                <span className="omskifter">
                  <button
                    aria-pressed={resultView === 'Wealth'}
                    onClick={() => setResultView('Wealth')}
                  >
                    Formuen
                  </button>
                  <button
                    aria-pressed={resultView === 'YearTable'}
                    onClick={() => setResultView('YearTable')}
                  >
                    Årstabellen
                  </button>
                </span>
                <span className="omskifter hoejre">
                  <button aria-pressed={unit === 'Real'} onClick={() => setUnit('Real')}>
                    Dagens kroner
                  </button>
                  <button aria-pressed={unit === 'Nominal'} onClick={() => setUnit('Nominal')}>
                    Løbende priser
                  </button>
                </span>
              </div>
              {bufferError ? (
                <div className="besked stop">
                  <h3>Planen kan ikke simuleres</h3>
                  <p>{bufferError}</p>
                </div>
              ) : resultView === 'Wealth' ? (
                <WealthChart
                  years={years}
                  plan={plan}
                  unit={unit}
                  selected={selected}
                  onSelect={setSelected}
                />
              ) : (
                <YearTable years={years} plan={plan} unit={unit} onSelectYear={explainYear} />
              )}
            </>
          )}
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
