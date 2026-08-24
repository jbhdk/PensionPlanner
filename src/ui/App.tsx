import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Plan } from '../engine/plan'
import { simulate } from '../engine/simulate'
import { validatePlan } from '../engine/validatePlan'
import { exportPlan, importPlan } from '../persistence/planFile'
import { savePlan, storedPlanText } from '../persistence/planStorage'
import { defaultPlan } from './defaultPlan'
import { Inspector } from './Inspector'
import { Navigator } from './Navigator'
import type { AmountUnit } from './real'
import type { MainGraph } from './ResultGraphs'
import { ResultGraphs } from './ResultGraphs'
import { Timeline } from './Timeline'
import { YearExplanation } from './YearExplanation'
import { YearTable } from './YearTable'
import type { Clamp } from './fields'
import { sameSelection } from './selection'
import type { Selection } from './selection'
import './app.css'

/** Lader browseren gemme teksten som en fil. Den samme vej ud for en
    eksporteret plan og for det gemte, fladen ikke kunne læse: der er ingen
    server at hente nogen af delene fra. */
function download(contents: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Resultatspaltens visninger. Planlæggeren er standardfanen, jf. issue #12
    — man justerer i navigatoren og konstaterer visuelt på graf-laget, om
    planen holder; tabellen er laget man går ned i bagefter. Forklar-året er
    ikke en tredje fane, men en visning der overtager resultatspalten helt,
    jf. issue #13 — den har sin egen vej tilbage til Årstabellen. */
type ResultView = 'Planner' | 'YearTable' | 'YearExplanation'

/** Hvor længe en klemningsbesked står, efter den redigering, den forklarer.
    Uret stilles om ved hver ny klemning, så et træk, der bliver ved med at
    støde mod væggen, ikke taber beskeden undervejs — de fem sekunder løber
    fra det sidste stød og altså fra det øjeblik, boksen slippes.

    En besked, der forsvinder af sig selv, er ellers netop det, `loadNotice`
    ikke må være. Forskellen er, hvor øjnene er: den gemte plans besked møder
    en, der lige har åbnet appen og kan kigge et andet sted hen, hvor
    klemningen står i det felt, brugeren netop har rørt, og siger noget om det
    tastetryk, hun lige har lavet. Har hun ikke set den dér og da, siger den
    hende alligevel ikke noget bagefter. */
const CLAMP_LIFETIME_MS = 5_000

/** Fladen: topbjælken, navigatoren til venstre, resultatspalten i midten og
    inspektørskuffen til højre — en fast tredje spalte, der viser planens
    egne felter, når intet andet er valgt, og skifter til det valgte, når
    man klikker en linje i navigatoren.

    Der er ingen beregn-knap. `simulate` er en ren funktion over en håndfuld
    beholdninger og godt tres år, så årsrækken regnes om ved hver ændring —
    resultatspalten er til enhver tid et spejl af navigatoren. */
export function App({
  initialPlan,
  loadError: initialLoadError,
  loadNotice: initialLoadNotice,
}: {
  initialPlan: Plan
  /** Sat, når en gemt plan blev læst, men et menneske skal se på den — en
      migration kan ikke altid gøre arbejdet færdigt, jf. ADR-0040. Planen
      regner, og fladen viser derfor en besked ved siden af den frem for at
      spærre skærmen, som `loadError` gør. */
  loadNotice?: string
  /** Sat når en gemt plan fandtes, men ikke kunne indlæses. Fladen viser da
      en forklarende besked i stedet for en tom navigator og resultatspalte,
      jf. issue #15 — og `initialPlan` er den plan, brugeren starter forfra
      med, hvis de vælger det. Indtil da vises og gemmes intet af den ovenpå
      det fejlede. */
  loadError?: string
}) {
  const [plan, setPlan] = useState(initialPlan)
  const [selected, setSelected] = useState<Selection>(null)
  // Den seneste redigering, en grænse greb ind i, jf. ADR-0045. Den er
  // hverken plandata eller en udledning af planen: efter snappet er planen
  // gyldig, og der findes ikke længere spor af, hvad brugeren prøvede. Den
  // bor her frem for i felterne, fordi et *træk* ellers ville være tavst —
  // feltet ser kun en ny værdi komme ind fra planen og kan ikke skelne et
  // klemt træk fra et skift af valgt figur.
  const [lastClamp, setLastClamp] = useState<Clamp | null>(null)
  const [resultView, setResultView] = useState<ResultView>('Planner')
  // Hvilken af de tre grafer der står som hovedgraf, jf. ADR-0033. Løftet
  // herop af samme grund som `resultView`: en kasseret plan skal nulstille
  // den, ligesom den nulstiller enhver anden af resultatspaltens tilstande.
  const [mainGraph, setMainGraph] = useState<MainGraph>('Wealth')
  const [unit, setUnit] = useState<AmountUnit>('Real')
  const [explainedYear, setExplainedYear] = useState<number | null>(null)
  // Skærmen forklar-året overtog resultatspalten fra, jf. issue #13 — man
  // kan komme dertil både fra en graf og fra årstabellen, og "tilbage" skal
  // føre til det, man faktisk kom fra, ikke til et fast mål. Sat, når man
  // går ind i forklar-året, og ikke rørt ved bladring mellem år undervejs
  // (klik på "forrige"/"næste" kalder samme funktion, men ændrer ikke,
  // hvor man oprindelig kom fra).
  const [returnView, setReturnView] = useState<Exclude<ResultView, 'YearExplanation'>>('Planner')
  const [importError, setImportError] = useState<string | null>(null)
  // Fejlen er en tilstand og ikke en egenskab ved fladen: brugeren skal kunne
  // komme ud af den uden at genindlæse siden.
  const [loadError, setLoadError] = useState(initialLoadError)
  // Beskeden er en tilstand og ikke en egenskab ved fladen: den er læst, når
  // planlæggeren siger, den er, og en ny import kan sætte en ny.
  const [loadNotice, setLoadNotice] = useState(initialLoadNotice)
  // Bekræftelsen er en tilstand og ikke en dialog: fladen har ingen modaler,
  // og spørgsmålet stilles i den samme figur som fejlskærmens — med
  // navigatoren stående ved siden af, så man ser, hvad der forsvinder.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ingen gem-knap: planen gemmes ved hver ændring, jf. issue #15. Er
  // indlæsningen selv fejlet, må vi ikke overskrive det ulæselige gemte data
  // med den tomme `initialPlan`, før brugeren har haft mulighed for at
  // reagere på beskeden.
  useEffect(() => {
    if (loadError) return
    savePlan(plan)
  }, [plan, loadError])

  // Klemningen dør også af sig selv, jf. `CLAMP_LIFETIME_MS`. Uret hænger på
  // beskeden selv og ikke på feltet: en ny klemning er et nyt objekt, og
  // oprydningen stiller derfor uret om frem for at lade den første besked
  // rive den anden med sig.
  useEffect(() => {
    if (lastClamp === null) return
    const timer = setTimeout(() => setLastClamp(null), CLAMP_LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [lastClamp])

  /** Vælger en figur, og lader klemningen dø med det forrige valg. Beskeden
      hører til den redigering, der lige blev rettet, og en ny figur i skuffen
      er ikke den.

      Kun et *skift* slår den ihjel. Den samme figur valgt igen er ikke et nyt
      emne — og et træk i en boks ender med, at browseren fyrer et klik på
      den, fordi trækket både begyndte og endte dér. Ryddede det klikket
      klemningen, ville trækkets besked være væk i samme øjeblik, musen
      slap. */
  function select(next: Selection) {
    setSelected(next)
    if (!sameSelection(selected, next)) setLastClamp(null)
  }

  function explainYear(year: number) {
    if (resultView !== 'YearExplanation') setReturnView(resultView)
    setExplainedYear(year)
    setResultView('YearExplanation')
  }

  /** Kasserer planen og sætter minimumsplanen i stedet — den samme handling
      fra topbjælken og fra fejlskærmen, så ordet betyder det samme begge
      steder.

      Alt, der pegede på den kasserede plan, følger med: en markering på et
      objekt, der ikke længere findes, ville lade skuffen blive stående på et
      objekt, der er væk, i stedet for at falde tilbage på den nye plans egne
      felter, jf. ADR-0035 — og forklar-året ville slå et år op i en plan,
      der er væk — ligger året uden for den nye horisont, er opslaget et
      nedbrud. Enheden bliver stående: den siger, hvordan brugeren læser tal,
      ikke hvad planen indeholder.

      Autogemmet skriver ved næste tegning, så det gemte er væk i samme
      øjeblik. Derfor stilles spørgsmålet før dette kald og ikke her. */
  function handleDelete() {
    setPlan(defaultPlan())
    select(null)
    setExplainedYear(null)
    setResultView('Planner')
    setReturnView('Planner')
    setMainGraph('Wealth')
    setImportError(null)
    setConfirmingDelete(false)
    setLoadError(undefined)
    // Den kasserede plan er væk, og med den det, beskeden handlede om.
    setLoadNotice(undefined)
  }

  function handleExport() {
    download(exportPlan(plan), `${plan.name}.json`)
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const result = importPlan(await file.text())
    if (result.kind === 'Loaded') {
      setPlan(result.plan)
      setImportError(null)
      setLoadNotice(result.notice)
      // En accepteret fil er også vejen ud af fejlskærmen. Planen er tolket og
      // valideret her, så den må gerne gemmes ovenpå det, der ikke kunne
      // læses.
      setLoadError(undefined)
    } else {
      setImportError(result.reason)
    }
  }

  /** Filvælgeren og dens knap. Den samme på begge skærme — kun én af dem er
      monteret ad gangen, så de kan dele reference. */
  const importAction = (
    <>
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
    </>
  )

  if (loadError) {
    const stored = storedPlanText()
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
              {importError && (
                <p role="alert">Filen kan ikke importeres: {importError}</p>
              )}
              <div className="udveje">
                {importAction}
                {stored !== null && (
                  <button
                    type="button"
                    className="knap"
                    onClick={() => download(stored, 'gemt-plan.json')}
                  >
                    Hent det gemte
                  </button>
                )}
                <button type="button" className="knap" onClick={handleDelete}>
                  Slet alt
                </button>
              </div>
              <p className="uddybning">
                Det gemte røres ikke, før du vælger. Importerer du en fil,
                erstatter den det — sletter du alt, kasseres det til fordel for
                en plan med én person og én tom beholdning. Hent det først,
                hvis du vil rette i det og importere det igen.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // En peger, der ikke rammer noget — bufferen, en overførsels ende, en posts
  // ejer — er en inputfejl, ikke et resultat: planen kan ikke simuleres, og
  // resultatspalten skal sige hvorfor frem for at stå tom, jf. ADR-0013.
  const planError = validatePlan(plan)
  const years = planError ? [] : simulate(plan)
  const period = `${plan.startYear}–${years.at(-1)?.year ?? plan.startYear}`

  return (
    <div className="app">
      <header className="topbjaelke">
        <span className="maerke">Pensionsplanner</span>
        <span className="plannavn">{plan.name}</span>
        {/* Planhåndtering og ikke en filhandling: knappen rører ingen fil,
            den kasserer den plan, der står på skærmen. Den sidder derfor i
            venstre gruppe, hvor etape 5 skal bygge planvælgeren, og væk fra
            Eksporter og Importer. Den er etape 1's stedfortræder for den
            håndtering: med kun én plan er "kassér den" alt, hvad der kan
            lade sig gøre. Derfor står den ikke i fladekortet, som tegner det
            færdige system — dér er der et planbibliotek, og den destruktive
            handling fjerner én plan ud af flere. */}
        <button type="button" className="knap" onClick={() => setConfirmingDelete(true)}>
          Slet alt
        </button>
        <span className="filhandlinger">
          {importError && (
            <span className="importfejl" role="alert">
              Filen kan ikke importeres: {importError}
            </span>
          )}
          <button type="button" className="knap" onClick={handleExport}>
            Eksporter
          </button>
          {importAction}
        </span>
      </header>

      {/* Beskeden står under bjælken og over spalterne, hvor den ses uden at
          spærre noget: planen regner, og der er ikke noget galt at rette,
          kun noget et menneske skal se på. Den lukkes af planlæggeren og
          ikke af et klik et andet sted — en besked, der forsvandt af sig
          selv, ville være ulæst hos den, der kiggede væk. */}
      {loadNotice && (
        <div className="planbesked" role="status">
          <p>{loadNotice}</p>
          <button type="button" className="knap" onClick={() => setLoadNotice(undefined)}>
            Forstået
          </button>
        </div>
      )}

      <div className="spalter">
        <div className="spalte navigatorspalte">
          <Navigator
            plan={plan}
            period={period}
            selected={selected}
            onSelect={select}
            onChange={setPlan}
          />
        </div>

        <div className="spalte resultatspalte">
          {/* Bekræftelsen er fejlskærmens figur og ikke en dialog: fladen har
              ingen modaler, og den ene anden gang appen stiller et alvorligt
              spørgsmål, ser det sådan ud. Navigatoren bliver stående ved
              siden af, så man ser, hvad der forsvinder, mens man beslutter
              sig. "Eksporter først" er den vigtigste af de tre udveje — der
              findes ingen fortrydelse, og en gemt fil er den eneste vej
              tilbage til den plan, der står nu. Uden den skulle tvivlen
              løses med et gæt. */}
          {confirmingDelete ? (
            <div className="besked stop">
              <h3>Slet alt?</h3>
              <p>
                Hele planen kasseres, og du begynder forfra med én person og
                én tom beholdning. Der er ingen fortrydelse.
              </p>
              <div className="udveje">
                <button type="button" className="knap" onClick={handleExport}>
                  Eksporter først
                </button>
                <button type="button" className="knap" onClick={handleDelete}>
                  Slet alt
                </button>
                <button
                  type="button"
                  className="knap"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Fortryd
                </button>
              </div>
              <p className="uddybning">
                Eksporter først, hvis du vil kunne komme tilbage. En gemt fil
                er den eneste vej tilbage til den plan, der står nu.
              </p>
            </div>
          ) : resultView === 'YearExplanation' && explainedYear !== null ? (
            <YearExplanation
              year={years.find((y) => y.year === explainedYear)!}
              years={years}
              plan={plan}
              onSelectYear={explainYear}
              onBack={() => setResultView(returnView)}
              backLabel={returnView === 'YearTable' ? 'Tilbage til tabellen' : 'Tilbage til planlæggeren'}
              unit={unit}
              onUnitChange={setUnit}
            />
          ) : (
            <>
              <div className="resultathoved">
                <span className="omskifter">
                  <button
                    aria-pressed={resultView === 'Planner'}
                    onClick={() => setResultView('Planner')}
                  >
                    Planlæggeren
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
                    Nutidskroner
                  </button>
                  <button aria-pressed={unit === 'Nominal'} onClick={() => setUnit('Nominal')}>
                    Fremtidskroner
                  </button>
                </span>
              </div>
              {planError ? (
                <div className="besked stop">
                  <h3>Planen kan ikke simuleres</h3>
                  <p>{planError}</p>
                </div>
              ) : resultView === 'Planner' ? (
                <>
                  <ResultGraphs
                    years={years}
                    plan={plan}
                    unit={unit}
                    onSelectYear={explainYear}
                    mainGraph={mainGraph}
                    onMainGraphChange={setMainGraph}
                  />
                  <Timeline
                    plan={plan}
                    selected={selected}
                    onSelect={select}
                    onClamp={setLastClamp}
                    onChange={setPlan}
                  />
                </>
              ) : (
                <YearTable years={years} plan={plan} unit={unit} onSelectYear={explainYear} />
              )}
            </>
          )}
        </div>

        <aside className="spalte skuffe" aria-label="Inspektør">
          <Inspector
            plan={plan}
            years={years}
            selected={selected}
            clamp={lastClamp}
            onClamp={setLastClamp}
            onChange={setPlan}
            onClose={() => select(null)}
          />
        </aside>
      </div>
    </div>
  )
}
