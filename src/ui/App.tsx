import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Plan } from '../engine/plan'
import { simulate } from '../engine/simulate'
import { validatePlan } from '../engine/validatePlan'
import { exampleName, loadExamplePlan } from '../persistence/examplePlan'
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

/** Mærket i topbjælken: ikonet og navnet, samlet ét sted så de to
    fejlvisninger og den almindelige visning ikke tegner hver sit. */
function Maerke() {
  return (
    <span className="maerke">
      <svg className="maerke-ikon" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
        <rect x="20" y="62" width="12" height="22" rx="2" />
        <rect x="44" y="48" width="12" height="36" rx="2" />
        <rect x="68" y="30" width="12" height="54" rx="2" />
        <path
          d="M16 52 C 34 56, 52 50, 76 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
      Min Pensionsformue
    </span>
  )
}

/** Bunden af skærmen: ophavsret og en påmindelse om, at tallene er et skøn.
    Egen funktion af samme grund som `Maerke` — fejlskærmen og den
    almindelige visning har hver sin `<footer>`, og de to skal sige det
    samme. */
function Fod() {
  return (
    <footer className="fodnote">
      <span>© {new Date().getFullYear()} Jesper Baagøe Hansen</span>
      <span>
        Beregningerne er vejledende og bygger på forenklede antagelser om
        skat, afkast og fremtidige satser. De er ikke en anbefaling og
        erstatter ikke rådgivning fra en revisor eller pensionsrådgiver.
      </span>
    </footer>
  )
}

/** Resultatspaltens visninger. Planlæggeren er standardfanen, jf. issue #12
    — man justerer i navigatoren og konstaterer visuelt på graf-laget, om
    planen holder; tabellen er laget man går ned i bagefter. Forklar-året er
    ikke en tredje fane, men en visning der overtager resultatspalten helt,
    jf. issue #13 — den har sin egen vej tilbage til Årstabellen. */
type ResultView = 'Planner' | 'YearTable' | 'YearExplanation'

/** De tre destruktive handlinger topbjælken kan spørge om, før den udfører
    dem: sletning, import af en fil, og indlæsning af den bundlede eksempel.
    De tre deler én bekræftelsesfigur, fordi de deler samme spørgsmål — den
    nuværende plan forsvinder, og der er ingen fortrydelse. */
type PendingAction = 'Delete' | 'Import' | 'Example'

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
  // Adskilt fra importError: fejler den bundlede fil, er det en fejl i
  // værktøjet selv og ikke i noget, brugeren har gjort — de to fortjener
  // hver sin ordlyd, jf. issue #2. `examplePlan.test.ts` er bagstopperen,
  // der skal gøre denne tilstand praktisk umulig at nå.
  const [exampleError, setExampleError] = useState<string | null>(null)
  // Fejlen er en tilstand og ikke en egenskab ved fladen: brugeren skal kunne
  // komme ud af den uden at genindlæse siden.
  const [loadError, setLoadError] = useState(initialLoadError)
  // Beskeden er en tilstand og ikke en egenskab ved fladen: den er læst, når
  // planlæggeren siger, den er, og en ny import kan sætte en ny.
  const [loadNotice, setLoadNotice] = useState(initialLoadNotice)
  // Bekræftelsen er en tilstand og ikke en dialog: fladen har ingen modaler,
  // og spørgsmålet stilles i den samme figur som fejlskærmens — med
  // navigatoren stående ved siden af, så man ser, hvad der forsvinder. Én
  // tilstand for alle tre handlinger, fordi kun én kan afventes ad gangen.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
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
    setExampleError(null)
    setPendingAction(null)
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

  /** Åbner filvælgeren efter en bekræftet import. Selve importen sker først,
      når `handleFileChosen` får en fil ind — annullerer brugeren
      filvælgeren, sker der intet, og den overskrevne plan er derfor kun den,
      der rent faktisk blev valgt. */
  function handleImportConfirmed() {
    setPendingAction(null)
    fileInputRef.current?.click()
  }

  /** Erstatter planen med den bundlede eksempelplan — samme vej ind som en
      importeret fil, jf. `examplePlan.ts`. Fejler den (kun teoretisk muligt,
      jf. `examplePlan.test.ts`), får brugeren en ærlig besked om, at det er
      værktøjets fejl og ikke deres egen, i stedet for importfejlens tekst om
      en fil, de aldrig valgte. */
  function handleLoadExample() {
    const result = loadExamplePlan()
    if (result.kind === 'Loaded') {
      setPlan(result.plan)
      setExampleError(null)
      setLoadNotice(result.notice)
      setLoadError(undefined)
    } else {
      setExampleError(result.reason)
    }
    setPendingAction(null)
  }

  /** Filvælgeren, skjult og delt mellem fejlskærmens direkte "Importer" og
      den bekræftede import i den almindelige visning — kun én af de to er
      monteret ad gangen, så de kan dele reference. */
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="application/json,.json"
      className="skjult-filvaelger"
      aria-label="Importer"
      onChange={handleFileChosen}
    />
  )

  /** Fejlskærmens "Importer": ingen bekræftelse, fordi skærmen selv allerede
      er sin egen bekræftelse — der er ingen fungerende plan at overskrive,
      kun ulæst data man allerede har fået tilbudt at redde med "Hent det
      gemte". */
  const importAction = (
    <>
      <button type="button" className="knap" onClick={() => fileInputRef.current?.click()}>
        Importer
      </button>
      {fileInput}
    </>
  )

  if (loadError) {
    const stored = storedPlanText()
    return (
      <div className="app">
        <header className="topbjaelke">
          <Maerke />
        </header>
        <div className="spalter">
          <div className="spalte resultatspalte">
            <div className="besked stop">
              <h3>Planen kunne ikke indlæses</h3>
              <p>{loadError}</p>
              {importError && (
                <p role="alert">Filen kan ikke importeres: {importError}</p>
              )}
              {exampleError && <p role="alert">Eksemplet kunne ikke indlæses: {exampleError}</p>}
              <div className="udveje">
                {importAction}
                <button type="button" className="knap" onClick={handleLoadExample}>
                  Indlæs eksempel
                </button>
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
                Det gemte røres ikke, før du vælger. Importerer du en fil eller
                indlæser eksemplet, erstatter det det gemte — sletter du alt,
                kasseres det til fordel for en plan med én person og én tom
                beholdning. Hent det først, hvis du vil rette i det og
                importere det igen.
              </p>
            </div>
          </div>
        </div>
        <Fod />
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
        <Maerke />
        <span className="plannavn">{plan.name}</span>
        {/* Planhåndtering og ikke en filhandling: knappen rører ingen fil,
            den kasserer den plan, der står på skærmen. Den sidder derfor i
            venstre gruppe, hvor etape 5 skal bygge planvælgeren, og væk fra
            Eksporter og Importer. Den er etape 1's stedfortræder for den
            håndtering: med kun én plan er "kassér den" alt, hvad der kan
            lade sig gøre. Derfor står den ikke i fladekortet, som tegner det
            færdige system — dér er der et planbibliotek, og den destruktive
            handling fjerner én plan ud af flere. */}
        <button type="button" className="knap" onClick={() => setPendingAction('Delete')}>
          Slet alt
        </button>
        <span className="filhandlinger">
          {importError && (
            <span className="importfejl" role="alert">
              Filen kan ikke importeres: {importError}
            </span>
          )}
          {exampleError && (
            <span className="importfejl" role="alert">
              Eksemplet kunne ikke indlæses: {exampleError}
            </span>
          )}
          <button type="button" className="knap" onClick={handleExport}>
            Eksporter
          </button>
          <button type="button" className="knap" onClick={() => setPendingAction('Import')}>
            Importer
          </button>
          <button type="button" className="knap" onClick={() => setPendingAction('Example')}>
            Indlæs eksempel
          </button>
          {fileInput}
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
              ingen modaler, og de tre gange appen stiller et alvorligt
              spørgsmål, ser det sådan ud. Navigatoren bliver stående ved
              siden af, så man ser, hvad der forsvinder, mens man beslutter
              sig. "Eksporter først" er den vigtigste af udvejene — der
              findes ingen fortrydelse, og en gemt fil er den eneste vej
              tilbage til den plan, der står nu. Uden den skulle tvivlen
              løses med et gæt. Importens bekræftelse kommer bevidst *før*
              filvælgeren og ikke efter: at vælge en fil først for bagefter
              at opdage, man har glemt at eksportere, ville spilde brugerens
              tid to gange. */}
          {pendingAction ? (
            <div className="besked stop">
              {pendingAction === 'Delete' && (
                <>
                  <h3>Slet alt?</h3>
                  <p>
                    Hele planen kasseres, og du begynder forfra med én person
                    og én tom beholdning. Der er ingen fortrydelse.
                  </p>
                </>
              )}
              {pendingAction === 'Import' && (
                <>
                  <h3>Importer fra fil?</h3>
                  <p>
                    Den nuværende plan "{plan.name}" bliver overskrevet med
                    den fil, du vælger. Der er ingen fortrydelse.
                  </p>
                </>
              )}
              {pendingAction === 'Example' && (
                <>
                  <h3>Indlæs eksempel?</h3>
                  <p>
                    Den nuværende plan "{plan.name}" erstattes af eksemplet "
                    {exampleName}". Der er ingen fortrydelse.
                  </p>
                </>
              )}
              <div className="udveje">
                <button type="button" className="knap" onClick={handleExport}>
                  Eksporter først
                </button>
                {pendingAction === 'Delete' && (
                  <button type="button" className="knap" onClick={handleDelete}>
                    Slet alt
                  </button>
                )}
                {pendingAction === 'Import' && (
                  <button type="button" className="knap" onClick={handleImportConfirmed}>
                    Vælg fil
                  </button>
                )}
                {pendingAction === 'Example' && (
                  <button type="button" className="knap" onClick={handleLoadExample}>
                    Indlæs eksempel
                  </button>
                )}
                <button type="button" className="knap" onClick={() => setPendingAction(null)}>
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
      <Fod />
    </div>
  )
}
