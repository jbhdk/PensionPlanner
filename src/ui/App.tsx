import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Plan } from '../engine/plan'
import { simulate, validateBuffer } from '../engine/simulate'
import { exportPlan, importPlan } from '../persistence/planFile'
import { savePlan } from '../persistence/planStorage'
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
export function App({
  initialPlan,
  loadError,
}: {
  initialPlan: Plan
  /** Sat når en gemt plan fandtes, men ikke kunne indlæses. Fladen viser da
      en forklarende besked i stedet for en tom navigator og resultatspalte,
      jf. issue #15 — `initialPlan` er i det tilfælde blot en tom plan uden
      betydning, siden intet af den vises eller gemmes ovenpå den fejlede. */
  loadError?: string
}) {
  const [plan, setPlan] = useState(initialPlan)
  const [selected, setSelected] = useState<Selection>(null)
  const [resultView, setResultView] = useState<ResultView>('Wealth')
  const [unit, setUnit] = useState<AmountUnit>('Real')
  const [explainedYear, setExplainedYear] = useState<number | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ingen gem-knap: planen gemmes ved hver ændring, jf. issue #15. Er
  // indlæsningen selv fejlet, må vi ikke overskrive det ulæselige gemte data
  // med den tomme `initialPlan`, før brugeren har haft mulighed for at
  // reagere på beskeden.
  useEffect(() => {
    if (loadError) return
    savePlan(plan)
  }, [plan, loadError])

  function explainYear(year: number) {
    setExplainedYear(year)
    setResultView('YearExplanation')
  }

  function handleExport() {
    const blob = new Blob([exportPlan(plan)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${plan.name}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const result = importPlan(await file.text())
    if (result.kind === 'Loaded') {
      setPlan(result.plan)
      setImportError(null)
    } else {
      setImportError(result.reason)
    }
  }

  if (loadError) {
    return (
      <div className="app">
        <header className="topbjaelke">
          <span className="maerke">Pensionsplanner</span>
        </header>
        <div className="spalter">
          <div className="spalte resultatspalte">
            <div className="besked stop">
              <h3>Planen kunne ikke indlæses</h3>
              <p>{loadError}</p>
            </div>
          </div>
        </div>
      </div>
    )
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
        <span className="filhandlinger">
          {importError && (
            <span className="importfejl" role="alert">
              Filen kan ikke importeres: {importError}
            </span>
          )}
          <button type="button" className="knap" onClick={handleExport}>
            Eksporter
          </button>
          <button type="button" className="knap" onClick={() => fileInputRef.current?.click()}>
            Importer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="skjult-filvaelger"
            aria-label="Importer"
            onChange={handleFileChosen}
          />
        </span>
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
            years={years}
            selected={selected}
            onChange={setPlan}
            onClose={() => setSelected(null)}
          />
        </aside>
      )}
    </div>
  )
}
