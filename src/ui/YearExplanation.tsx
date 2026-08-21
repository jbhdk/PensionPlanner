import { payoutScheduleOf } from '../engine/holdingVariant'
import type { Direction, Holding, Person, Plan, Transfer } from '../engine/plan'
import { weightAt } from '../engine/simulate'
import type { ShareIncomeLayer } from '../engine/tax/assessHousehold'
import { totalTaperBase } from '../engine/tax/assessHousehold'
import type { LayerAmount, TaxLayer } from '../engine/tax/assessTax'
import { totalTax } from '../engine/tax/assessTax'
import type {
  CapYear,
  HoldingYear,
  PersonYear,
  RateBasis,
  YearResult,
} from '../engine/yearResult'
import { fieldHelp } from './fieldHelp'
import { kroner, procent } from './format'
import { danish, danishTiming, variants } from './danish'
import { inRealKroner } from './real'
import { returnTax } from './returnTax'
import { surplus } from './surplus'
import type { SurplusBand, SurplusBandName } from './surplusBands'
import { surplusBands } from './surplusBands'

/** Rækkefølgen skattelagene vises i: samme rækkefølge som mockuppens
    `tegnForklarAaret` — AM-bidrag og bundskat først, progressionslagene
    derefter, kommune- og kirkeskat til sidst. */
const TAX_LAYER_ORDER: TaxLayer[] = [
  'labourMarketContribution',
  'bottomBracketTax',
  'middleBracketTax',
  'topBracketTax',
  'additionalTopBracketTax',
  // Nedslaget står efter de lag, det tager af, og før kommuneskatten: det er
  // statens afkald, og kommunen får sit fulde.
  'taxCeilingRelief',
  'municipalTax',
  'churchTax',
]

/** Aktieindkomstskattens to lag. Rækkefølgen er stigende som lagenes egen,
    og etiketterne nævner ikke satsen — den står i sin egen kolonne. */
const SHARE_INCOME_LAYER_ORDER: ShareIncomeLayer[] = [
  'shareIncomeBelowThreshold',
  'shareIncomeAboveThreshold',
]

const SHARE_INCOME_LAYER_LABELS: Record<ShareIncomeLayer, string> = {
  shareIncomeBelowThreshold: 'Til progressionsgrænsen',
  shareIncomeAboveThreshold: 'Over progressionsgrænsen',
}

const TAX_LAYER_LABELS: Record<TaxLayer, string> = {
  labourMarketContribution: 'AM-bidrag',
  bottomBracketTax: 'Bundskat',
  middleBracketTax: 'Mellemskat',
  topBracketTax: 'Topskat',
  additionalTopBracketTax: 'Top-topskat',
  taxCeilingRelief: 'Loftnedslag',
  municipalTax: 'Kommuneskat',
  churchTax: 'Kirkeskat',
}

/** Forklar-året overtager resultatspalten, jf. issue #13 — den har sit eget
    spaltehoved med en vej tilbage frem for Formuen/Årstabellen-fanerne. */
export function YearExplanation({
  year,
  years,
  plan,
  onSelectYear,
  onBack,
}: {
  year: YearResult
  years: YearResult[]
  plan: Plan
  onSelectYear: (year: number) => void
  onBack: () => void
}) {
  const display = (amount: number) => inRealKroner(amount, year.year, plan)
  const index = years.findIndex((y) => y.year === year.year)
  const previous = years[index - 1]
  const next = years[index + 1]

  return (
    <div className="forklar">
      <div className="forklarhoved">
        <h2>{year.year}</h2>
        <span className="kontekst">
          {plan.household.persons.map((person) => (
            <span key={person.id}>
              {person.name} {year.year - person.birthYear} år
            </span>
          ))}
          <span>Satsår {satsaarLabel(year.rateBasis)}</span>
        </span>
        <span className="hoejre">
          {previous && (
            <button type="button" className="knap" onClick={() => onSelectYear(previous.year)}>
              ‹ {previous.year}
            </button>
          )}
          {next && (
            <button type="button" className="knap" onClick={() => onSelectYear(next.year)}>
              {next.year} ›
            </button>
          )}
          <button type="button" className="knap primaer" onClick={onBack}>
            Tilbage til tabellen
          </button>
        </span>
      </div>

      {/* Balanceinvarianten som synlig stribe, jf. CLAUDE.md:
          closingWealth − openingWealth
            = income + return − tax − expenses − conversion.

          Omsætningsleddet står kun i det ene år, det er noget: en post på
          nul i alle andre år ville lade striben påstå, at der var noget at
          se hvert år. */}
      <div className="balancestribe">
        <StripePost
          help="YearResult.openingWealth"
          label="Formue primo"
          amount={display(year.openingWealth)}
        />
        <StripePost help="YearResult.income" label="Indtægter" amount={display(year.income)} />
        <StripePost help="YearResult.return" label="Afkast" amount={display(year.return)} />
        <StripePost help="YearResult.tax" label="Skat" amount={display(-year.tax)} />
        <StripePost
          help="YearResult.expenses"
          label="Udgifter"
          amount={display(-year.expenses)}
        />
        {year.conversion !== 0 && (
          <StripePost
            help="YearResult.conversion"
            label="Omsat livrentedepot"
            amount={display(-year.conversion)}
          />
        )}
        <StripePost
          help="YearResult.closingWealth"
          label="Formue ultimo"
          amount={display(year.closingWealth)}
        />
      </div>
      {year.conversion !== 0 && (
        <p className="hint stribenote">
          Livrentens depot forlader formuen i {year.year} og bliver til en
          garanteret livsvarig ydelse. Pengene er hverken brugt eller betalt i
          skat — de er byttet til en indtægt, der ikke kan løbe tør, og som
          derfor ikke længere står nogen steder som en saldo.
        </p>
      )}

      <SurplusBlock plan={plan} year={year} display={display} />

      <div className="blokke">
        {plan.household.persons.map((person) => {
          const personYear = year.persons.find((p) => p.person === person.id)
          if (!personYear) return null
          return (
            <PersonTaxBlock key={person.id} person={person} year={personYear} display={display} />
          )
        })}
      </div>

      <ShareIncomeTaxBlock year={year} display={display} />

      <StatePensionBlock plan={plan} year={year} display={display} />
      <HoldingsBlock plan={plan} year={year} display={display} />
      <CapsBlock plan={plan} year={year} display={display} />
      <OtherTransfersBlock plan={plan} year={year} display={display} />
    </div>
  )
}

/** Hvert bånd sin forklaring. Etiketterne er `surplusBandOrder`s og dermed
    grafens egne — ét navn pr. bånd hele vejen igennem — mens teksten hører
    til her, hvor forklaringerne bor. */
const SURPLUS_BAND_HELP: Record<SurplusBandName, keyof typeof fieldHelp> = {
  IncomeEntries: 'SurplusBand.IncomeEntries',
  Benefits: 'SurplusBand.Benefits',
  Payouts: 'SurplusBand.Payouts',
  TransfersIn: 'SurplusBand.TransfersIn',
  Tax: 'SurplusBand.Tax',
  ExpenseEntries: 'SurplusBand.ExpenseEntries',
  Contributions: 'SurplusBand.Contributions',
  TransfersOut: 'SurplusBand.TransfersOut',
}

/** Årets overskud og det, det består af — forklar-årets rygrad.

    Blokken står øverst, fordi den er det, klikket i grafen og i tabellen
    fører hertil for: står der −248.000 i 2050, er det dét tal, året skal
    kunne forklare. Tallet er `surplus` og ikke en anden udledning, så
    skærmen og tabellen aldrig kan blive uenige. */
function SurplusBlock({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  return (
    <div className="blok bred">
      <h3>Årets overskud</h3>
      {/* Et bånd på nul står ikke. Otte linjer, hvoraf de fleste er nul,
          ville påstå bevægelser, året ikke havde, og lade den ene det havde
          drukne — samme grund som omsætningsposten i balancestriben. Grafen
          gør det modsatte og beholder alle otte hele horisonten igennem: dér
          er den faste plads det, der lader et bånd følges med øjnene fra år
          til år. */}
      {surplusBands(year, plan)
        .filter((band) => band.amount !== 0)
        .map((band) => (
          <SurplusBandRow key={band.name} band={band} display={display}>
            {bandDetail(band.name, plan, year, display)}
          </SurplusBandRow>
        ))}
      <StripePost
        help="Surplus"
        label="Årets overskud"
        amount={display(surplus(year, plan.buffer))}
        step="total"
      />
    </div>
  )
}

/** Ét bånd i striben, med sine egne linjer foldet ind under sig. Foldet er
    en `details`, så året kan læses som otte tal først og pakkes ud dér, hvor
    læseren undrer sig — og så en fold kan åbnes uden at der skal holdes
    styr på tilstand nogen steder.

    Et bånd uden linjer at folde ud står som en almindelig stribelinje.
    Skatten er sådan et: dens bestanddele hører til personernes egne blokke
    og ikke i en tabel her. */
function SurplusBandRow({
  band,
  display,
  children,
}: {
  band: SurplusBand
  display: (amount: number) => number
  children: React.ReactNode
}) {
  const stripe = (
    <StripePost
      help={SURPLUS_BAND_HELP[band.name]}
      label={band.label}
      amount={display(band.direction === 'Expense' ? -band.amount : band.amount)}
    />
  )

  if (children === null) return stripe

  return (
    <details className="baand">
      <summary>{stripe}</summary>
      {children}
    </details>
  )
}

/** Linjerne under ét bånd: de poster, rater, ydelser, overførsler og
    indbetalinger, året faktisk indeholdt. Opslaget står ét sted, så et bånd
    og dets linjer ikke kan komme fra hver sin ende af filen. */
function bandDetail(
  name: SurplusBandName,
  plan: Plan,
  year: YearResult,
  display: (amount: number) => number,
): React.ReactNode {
  switch (name) {
    case 'IncomeEntries':
      return <EntriesTable plan={plan} year={year} display={display} direction="Income" />
    case 'ExpenseEntries':
      return <EntriesTable plan={plan} year={year} display={display} direction="Expense" />
    case 'Benefits':
      return <BenefitsTable plan={plan} year={year} display={display} />
    case 'Tax':
      return <TaxDetail plan={plan} year={year} display={display} />
    case 'Payouts':
      return <PayoutsTable plan={plan} year={year} display={display} />
    case 'Contributions':
      return <ContributionsTable plan={plan} year={year} display={display} />
    case 'TransfersIn':
      return (
        <TransfersTable
          plan={plan}
          year={year}
          display={display}
          counts={({ to }) => to === plan.buffer}
        />
      )
    case 'TransfersOut':
      return (
        <TransfersTable
          plan={plan}
          year={year}
          display={display}
          counts={({ from }) => from === plan.buffer}
        />
      )
    default:
      return null
  }
}

/** Aktieindkomstens skat står for sig og ikke i en persons blok: den regnes
    af husstandens samlede aktieindkomst mod en fælles, overførbar
    progressionsgrænse, og der findes ingen hjemmel til at fordele den på
    personer, jf. ADR-0014. Blokken udebliver, når ingen har aktieindkomst. */
function ShareIncomeTaxBlock({
  year,
  display,
}: {
  year: YearResult
  display: (amount: number) => number
}) {
  const layers = SHARE_INCOME_LAYER_ORDER.flatMap((layer) => {
    const amount = year.shareIncomeTax[layer]
    return amount === undefined ? [] : [{ label: SHARE_INCOME_LAYER_LABELS[layer], layer: amount }]
  })
  if (layers.length === 0) return null

  return (
    <div className="blok">
      <h3>Husstandens aktieindkomstskat</h3>
      <table className="lagtabel">
        <thead>
          {/* Husstandens aktieindkomstskat og personens egen skat er den
              samme fire kolonner over den samme slags linje, og de deler
              derfor forklaring — jf. nøglereglen i `fieldHelp.ts`. */}
          <tr>
            <th title={fieldHelp['LayerAmount.layer']}>Lag</th>
            <th title={fieldHelp['LayerAmount.base']}>Grundlag</th>
            <th title={fieldHelp['LayerAmount.rate']}>Sats</th>
            <th title={fieldHelp['LayerAmount.amount']}>Beløb</th>
          </tr>
        </thead>
        <tbody>
          {layers.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{kroner(display(row.layer.base))}</td>
              <td>{procent(row.layer.rate)}</td>
              <td>{kroner(display(row.layer.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** "2026" for et kendt satsår, "2026 (fremskrevet)" for et fremskrevet — så
    det ses, hvor tallene holder op med at være officielle, jf. `RateBasis`. */
function satsaarLabel(basis: RateBasis): string {
  return basis.projected ? `${basis.knownYear} (fremskrevet)` : String(basis.knownYear)
}

/** Årets poster med forfald og afkastvægt, så det tal Modified Dietz lagde
    til beholdningens primosaldo kan efterregnes i hånden. Forfaldet læses
    fra `Plan.entries` i stedet for at gentages her — det er en egenskab ved
    posten selv, ligesom en beholdnings navn. */
function EntriesTable({
  plan,
  year,
  display,
  direction,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
  direction: Direction
}) {
  return (
      <table className="postertabel">
        <thead>
          <tr>
            <th title={fieldHelp['EntryYear.entry']}>Post</th>
            <th title={fieldHelp['EntryYear.amount']}>Beløb</th>
            <th title={fieldHelp.Timing}>Forfald</th>
            <th title={fieldHelp['EntryYear.returnWeight']}>Afkastvægt</th>
          </tr>
        </thead>
        <tbody>
          {year.entries.map((entryYear) => {
            const entry = plan.entries.find((e) => e.id === entryYear.entry)
            if (!entry || entry.direction !== direction) return null
            const signed = entry.direction === 'Expense' ? -entryYear.amount : entryYear.amount
            return (
              <tr key={entryYear.entry}>
                <td>{entry.name}</td>
                <td>{kroner(display(signed))}</td>
                <td>{danishTiming(entry.timing)}</td>
                {/* Posterne lander alle på bufferen, og vægten spørges
                    derfor i dens ende — en jævn post vejer nul. */}
                <td>{procent(weightAt(plan.buffer, entry.timing, plan.buffer))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
  )
}

/** Årets indbetalinger med begge deres beløb: hvad der forlod kilden, og hvad
    der landede i beholdningen. Forskellen er AM-bidraget, og den står ikke i
    en tredje kolonne — den er allerede personens eget AM-lag ovenfor, og to
    steder kunne komme til at sige hver sit.

    Loftlinjen følger ikke med herind, selv om den handler om det samme.
    Den findes, når året **bad om** noget, og et indskud kan afkortes helt —
    så er båndet nul, folden væk, og afkortningen usynlig. Det er præcis den
    tavse fejl, ADR-0019 og ADR-0022 er skrevet imod, og loftet står derfor i
    sin egen blok. */
function ContributionsTable({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  // Samme navn som i navigatoren og i skuffens hoved.
  const name = (contributionId: string) =>
    plan.contributions.find((c) => c.id === contributionId)?.name ?? contributionId

  return (
    <>
      <table className="indbetalingstabel">
        <thead>
          <tr>
            <th title={fieldHelp['ContributionYear.contribution']}>Indbetaling</th>
            <th title={fieldHelp['ContributionYear.fromSource']}>Forlod kilden</th>
            <th title={fieldHelp['ContributionYear.intoHolding']}>Landede</th>
          </tr>
        </thead>
        <tbody>
          {year.contributions.map((contribution) => (
            <tr key={contribution.contribution}>
              <td>{name(contribution.contribution)}</td>
              <td>{kroner(display(contribution.fromSource))}</td>
              <td>{kroner(display(contribution.intoHolding))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** De overførsler, der ikke rører bufferbeholdningen i nogen ende.

    De flytter penge mellem to andre beholdninger, og årets overskud er det
    samme med og uden dem — de har derfor intet bånd at ligge under. Uden en
    blok for sig ville de falde helt ud af skærmen, og en afkortning af dem
    ville være tavs, jf. ADR-0022.

    Blokken udebliver, når året ingen af dem har, hvad de fleste år ikke. */
function OtherTransfersBlock({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  const counts = ({ from, to }: Transfer) => from !== plan.buffer && to !== plan.buffer
  const any = year.transfers.some((transfer) =>
    counts(plan.transfers.find((t) => t.id === transfer.transfer)!),
  )
  if (!any) return null

  return (
    <div className="blok bred">
      <h3>Overførsler uden om bufferen</h3>
      <TransfersTable plan={plan} year={year} display={display} counts={counts} />
    </div>
  )
}

/** Årets overførsler: hvad planen bad om, hvad der faktisk forlod
    afgiveren, hvad staten tog undervejs, og hvad der landede hos
    modtageren.

    De fire tal kan alle være forskellige. Afgiverens saldo ved årets
    begyndelse er alt, der er at give af, og et fast kronebeløb, der
    overstiger den, afkortes — en tavs afkortning er den slags fejl, der
    aldrig viser sig, jf. ADR-0022. Afgiften rammer kun en hævning fra en
    `Chargeable` ordning og er cellen tom for enhver anden afgiver, jf.
    ADR-0029. I de fleste år er de to sidste tal ens med det hævede, og
    linjen siger da blot, hvad der blev flyttet.

    Rækken hedder de to ender ved navn, som indbetalingens gør. Hvilke
    overførsler tabellen fører, afgøres af `counts`: bufferbeholdningen står
    i den ene ende af en overførsel ind og i den anden af en overførsel ud,
    og de to gør det modsatte ved året. */
function TransfersTable({
  plan,
  year,
  display,
  counts,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
  counts: (transfer: Transfer) => boolean
}) {
  const name = (transferId: string) =>
    plan.transfers.find((t) => t.id === transferId)?.name ?? transferId

  return (
    <>
      <table className="overfoerselstabel">
        <thead>
          <tr>
            <th title={fieldHelp['TransferYear.transfer']}>Overførsel</th>
            <th title={fieldHelp['TransferYear.requested']}>Bedt om</th>
            <th title={fieldHelp['TransferYear.moved']}>Hævet</th>
            <th title={fieldHelp['TransferYear.charge']}>Afgift</th>
            <th title={fieldHelp['TransferYear.landed']}>Ind på kontoen</th>
          </tr>
        </thead>
        <tbody>
          {year.transfers
            .filter((transfer) =>
              counts(plan.transfers.find((t) => t.id === transfer.transfer)!),
            )
            .map((transfer) => (
            <tr key={transfer.transfer}>
              <td>{name(transfer.transfer)}</td>
              <td>{kroner(display(transfer.requested))}</td>
              <td>{kroner(display(transfer.moved))}</td>
              <td>
                {transfer.payoutTaxation === 'Chargeable'
                  ? kroner(display(transfer.moved - transfer.landed))
                  : ''}
              </td>
              <td>
                {kroner(
                  display(
                    transfer.payoutTaxation === 'Chargeable' ? transfer.landed : transfer.moved,
                  ),
                )}
              </td>
            </tr>
            ))}
        </tbody>
      </table>
      {/* Ingen farve her, ganske som i lofttabellen: rød er bufferens alene.
          Sætningen står altid, så de to kolonner kan læses uden at gætte,
          hvorfor de nogle år er forskellige. */}
      <p className="hint">
        En overførsel kan aldrig flytte mere, end afgiveren havde ved årets
        begyndelse. Beder planen om mere, afkortes den, og beholdningen lukker på
        nul frem for at gå i minus.
      </p>
    </>
  )
}

/** Loftlinjerne: hvad året bad om, loftet det blev målt mod, og den del der
    beholdt sin fradragsret. Tallene på samme linje, så den kan efterregnes
    uden at finde tal andre steder på siden — som et skattelag kan det fra
    sin egen række.

    De to former deler tabel og ikke betydning. `PerYear` fylder de tre
    talkolonner, og pengene landede. `OnBalance` måler noget andet — saldoen
    ved årets begyndelse — og bærer sine to øvrige tal og det faktisk
    indskudte i noten, jf. ADR-0019.

    Linjen står i forklar-året og kun der. Om et loft bandt, afhænger af
    årets fremskrevne beløb målt mod årets satsår, og det er dermed en
    egenskab ved året og ikke ved indbetalingen; inspektørskuffen viser
    planen og aldrig et årsafhængigt resultat.

    Loftet er personens og måles over årets samlede indbetaling til den slags
    ordning — rækken hedder derfor varianten og ejeren, ikke den enkelte
    beholdning, jf. ADR-0018. Blokken udebliver, når året ingen indbetaling
    havde til en loftbelagt ordning.

    Den står for sig og ikke under indbetalingsbåndet. Linjen findes, når
    året bad om noget, og ikke når noget landede: blev hele indskuddet
    afkortet, er båndet nul og folden væk, og afkortningen ville forsvinde
    med den. */
function CapsBlock({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  const lines = plan.household.persons.flatMap((person) => {
    const personYear = year.persons.find((p) => p.person === person.id)
    return (personYear?.caps ?? []).map((cap) => ({ person: person.name, cap }))
  })
  if (lines.length === 0) return null

  return (
    <div className="blok bred">
      <h3>Lofterne</h3>
      <table className="lofttabel">
        <thead>
          <tr>
            <th title={fieldHelp['CapYear.variant']}>Ordning</th>
            <th title={fieldHelp['CapYear.paid']}>Indbetalt</th>
            <th title={fieldHelp['CapYear.cap']}>Loft</th>
            <th title={fieldHelp['CapYear.withDeductibility']}>Med fradragsret</th>
            {/* Noten er prosa og venstrestillet — hovedet følger sin kolonne. */}
            <th className="note" title={fieldHelp['CapYear.note']}>
              Note
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ person, cap }) => (
            <tr key={`${person}-${cap.variant}`}>
              <td>
                {danish(variants, cap.variant)} <span className="enhed">({person})</span>
              </td>
              <td>{kroner(display(cap.form === 'PerYear' ? cap.paid : cap.requested))}</td>
              <td>{kroner(display(cap.cap))}</td>
              {/* Aktiesparekontoen har ingen fradragsret at måle mod loftet,
                  og en nul ville se ud som et beløb, der blev til nul. */}
              <td>{cap.form === 'PerYear' ? kroner(display(cap.withDeductibility)) : '–'}</td>
              <td className="note">{capNote(cap, display)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Ingen farve her: rød er bufferens, og markeringen af året står i
          årstabellen. Her står tallene, der forklarer den. */}
      <p className="hint">
        Loftet er personens og måles over årets samlede indbetaling til den slags ordning
        efter AM-bidrag — to ratepensioner deler ét loft. Det, der ligger over, bliver
        liggende i ordningen: ratepensionens overskydende mister sin fradragsret, og
        aldersopsparingens er afgiftspligtigt. Aktiesparekontoens loft måler i stedet
        saldoen ved årets begyndelse, og indskuddet afkortes til råderummet — det
        uindskudte blev liggende i kilden, og året er ikke markeret, for der er ikke sket
        noget brud.
      </p>
    </div>
  )
}

/** Noten bærer det, de fælles kolonner ikke kan sige.

    En `OnBalance`-linje måler ikke det samme som de tre talkolonner:
    råderummet er loftet minus saldoen ved årets begyndelse, og
    indbetalingen blev afkortet til det. Noten giver de to tal, kolonnerne
    ikke har, og det faktisk indskudte, som ikke er det, der står under
    "Indbetalt" — med dem kan alle fem efterregnes af hinanden, jf.
    ADR-0019. Subtraktionen er fladens egen og ikke en gentagen udledning i
    ADR-0012's forstand: begge tal står på den linje, den viser.

    Beløbene i noten går gennem `display` som beløbene selv. En note i
    fremtidskroner ved siden af et tal i nutidskroner er den fælde,
    fladekortet fandt, jf. ADR-0001.

    `PerYear` har ingen note: dens tre tal står i deres egne kolonner, og
    hvad loftet dér måler, står i afsnittets hint. */
function capNote(cap: CapYear, display: (amount: number) => number): string {
  if (cap.form === 'PerYear') return ''
  return [
    `primo ${kroner(display(cap.openingBalance))} kr.`,
    `råderum ${kroner(display(cap.cap - cap.openingBalance))} kr.`,
    `indskudt ${kroner(display(cap.deposited))} kr.`,
  ].join(' · ')
}

/** Afkastet pr. beholdning: primosaldo og vægtet strøm er grundlaget,
    nettoafkastsatsen er beholdningens egen — udledt af brutto minus ÅOP,
    aldrig et gemt felt, jf. CONTEXT.md — og de tre ganget/lagt sammen giver
    afkastet, så en række kan efterregnes i hånden alene ud fra sig selv.

    Beholdningsskatten står i sin egen kolonne ved siden af afkastet, og
    afkastet står brutto: kan de to kun ses som ét nettotal, kan brugeren
    ikke se, om en afvigelse ligger i afkastsatsen eller i skatten. Satsen
    vises ikke og vælges ingen steder — den følger varianten. */
function HoldingsBlock({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const holdingYear = (holding: Holding): HoldingYear | undefined =>
    year.holdings.find((h) => h.holding === holding.id)

  return (
    <div className="blok bred">
      <h3>Beholdningerne</h3>
      <table className="beholdningstabel">
        <thead>
          <tr>
            <th title={fieldHelp['HoldingYear.holding']}>Beholdning</th>
            <th title={fieldHelp['HoldingYear.openingBalance']}>Primosaldo</th>
            {/* Raten står ved siden af den primosaldo, den er regnet af:
                den relation er lovens egen, og læseren skal kunne se den
                uden at lede. En beholdning uden udbetalingsplan får en
                tankestreg og ikke et nul — der er ingen plan, ikke en plan
                der gav nul. */}
            <th title={fieldHelp['HoldingYear.payout']}>Udbetaling</th>
            <th title={fieldHelp['HoldingYear.weightedFlow']}>Vægtet strøm</th>
            {/* Samme sats som skuffens *Nettoafkast* og derfor samme
                forklaring — ét tal, ét opslag. */}
            <th title={fieldHelp['Holding.netReturn']}>Nettoafkastsats</th>
            <th title={fieldHelp['HoldingYear.return']}>Afkast</th>
            <th title={fieldHelp['HoldingYear.tax']}>Beholdningsskat</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
            const h = holdingYear(holding)
            if (!h) return null
            return (
              <tr key={holding.id}>
                <td>{holding.name}</td>
                <td>{kroner(display(h.openingBalance))}</td>
                <td>
                  {payoutScheduleOf(holding) === undefined
                    ? '—'
                    : kroner(display(h.payout))}
                </td>
                <td>{kroner(display(h.weightedFlow))}</td>
                <td>{procent(holding.grossReturn - holding.annualCostRate)}</td>
                <td>{kroner(display(h.return))}</td>
                {/* Negativ: skatten er trukket af beholdningens egen saldo,
                    som udgiften er det i balancestriben. */}
                <td>{kroner(display(-h.tax))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Folkepensionen og aftrapningen af pensionstillægget, for de af husstandens
    personer der har nået folkepensionsalderen.

    Blokken findes af samme grund som ydelseslinjerne: beløbene står ingen
    andre steder. Brugeren har hverken tastet dem eller året, de begynder i — de
    første læses af satsåret, det sidste udledes af fødselsdatoen — og uden
    blokken kunne indtægten i striben ikke føres tilbage til noget.

    Den er en regnestribe og ikke en tabel, ganske som mock-uppens, fordi det
    er en fratrækning der skal vises: hver bestanddel af aftrapningsgrundlaget
    for sig, grundlaget som deres sum, fradragsbeløbet trukket fra og
    aftrapningen taget af det fulde tillæg. Lagt sammen til færre linjer kunne
    hverken grundlaget eller tillægget efterregnes, og det er netop det tal i
    hele fremskrivningen, der er sværest at tro på. */
function StatePensionBlock({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  const rows = year.persons.flatMap((personYear) => {
    const line = personYear.statePension
    if (line === undefined) return []
    const owner = plan.household.persons.find((person) => person.id === personYear.person)
    const spouse = plan.household.persons.find((person) => person.id !== personYear.person)
    return [{ line, owner, spouse }]
  })
  if (rows.length === 0) return null

  return (
    <div className="blok">
      <h3>Folkepension og aftrapning af pensionstillæg</h3>
      {rows.map(({ line, owner, spouse }) => {
        const { taper } = line
        // Aftrapningen er ikke et felt på linjen: den er de to tillæg trukket
        // fra hinanden, og begge står allerede her — ganske som loftlinjens
        // råderum, jf. `CapYear`.
        const reduction = taper.fullSupplement - line.pensionSupplement

        return (
          <div className="regnestribe" key={owner?.id ?? ''}>
            <StripePost
              help="StatePensionYear.basicAmount"
              label={`${owner?.name ?? ''}: grundbeløb`}
              amount={display(line.basicAmount)}
            />
            <StripePost
              help="Taper.fullSupplement"
              label="Pensionstillæg, fuldt"
              amount={display(taper.fullSupplement)}
            />
            <StripePost
              help="TaperBase.pensionIncome"
              label="Aftrapningsgrundlag — udbetalinger og ATP"
              amount={display(taper.base.pensionIncome)}
              step="step"
            />
            <StripePost
              help="TaperBase.capitalIncome"
              label="Positiv kapitalindkomst"
              amount={display(taper.base.capitalIncome)}
              step="step"
            />
            <StripePost
              help="TaperBase.shareIncome"
              label="Aktieindkomst"
              amount={display(taper.base.shareIncome)}
              step="step"
            />
            {/* Linjen udebliver i en husstand med én person: en post om en
                ægtefælles indkomst ville påstå en ægtefælle, der ikke er. */}
            {spouse !== undefined && (
              <StripePost
                help="TaperBase.spouse"
                label={`${spouse.name}s indkomst efter ${procent(taper.spouseDisregard)} bortseelse`}
                amount={display(taper.base.spouse)}
                step="step"
              />
            )}
            <StripePost
              help="TaperBase.total"
              label="Aftrapningsgrundlag i alt"
              amount={display(totalTaperBase(taper.base))}
              step="subtotal"
            />
            <StripePost
              help="Taper.allowance"
              label="Fradragsbeløb"
              amount={display(-taper.allowance)}
              step="step"
            />
            <StripePost
              help="Taper.reduction"
              label={`Aftrapning, ${procent(taper.rate)} af det overskydende`}
              amount={display(-reduction)}
            />
            <StripePost
              help="StatePensionYear.pensionSupplement"
              label="Pensionstillæg efter aftrapning"
              amount={display(line.pensionSupplement)}
            />
            <StripePost
              help="StatePensionYear.total"
              label="Folkepension i alt"
              amount={display(line.basicAmount + line.pensionSupplement)}
              step="total"
            />
          </div>
        )
      })}
      <p className="hint">
        Folkepensionen står ikke i planen. Beløbene kommer fra årets officielle
        satser, og året, de begynder i, følger af fødselsdatoen — den er hverken
        tastet eller til at skrue på. Arbejdsindkomst, udbetaling fra en
        aldersopsparing og afkast på en aktiesparekonto indgår ikke i
        grundlaget
        {rows[0]?.spouse ? `, og ${rows[0].spouse.name}s arbejdsindkomst indgår slet ikke` : ''}.
      </p>
    </div>
  )
}

/** Skattebåndet foldet ud: hver persons egen skat, husstandens
    aktieindkomstskat, og hvor meget af det hele der er skat af afkast.

    Den sidste linje er hele grunden til, at folden findes. Årets overskud
    tæller afkastet ude og skatten af det med, jf. ADR-0026, og skattebåndet
    bliver derfor større, end de synlige indtægter kan forklare. Uden linjen
    ville forskellen være noget, brugeren selv skulle regne ud af tal spredt
    over tre blokke — den er dét, `returnTax` er til for.

    Linjen er ikke et led i summen ovenover: den er en del af den, ikke et
    beløb ved siden af. Derfor "heraf", og derfor står den under stregen. */
function TaxDetail({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  const shareIncomeTax = Object.values(year.shareIncomeTax).reduce(
    (total, layer) => total + layer.amount,
    0,
  )

  return (
    <div className="regnestribe">
      {plan.household.persons.map((person) => {
        const personYear = year.persons.find((p) => p.person === person.id)
        if (!personYear) return null
        return (
          <StripePost
            key={person.id}
            help="TaxAssessment.total"
            label={person.name}
            amount={display(-totalTax(personYear.tax))}
          />
        )
      })}
      {shareIncomeTax !== 0 && (
        <StripePost
          help="HouseholdTaxAssessment.shareIncomeTax"
          label="Aktieindkomstskat"
          amount={display(-shareIncomeTax)}
        />
      )}
      <StripePost
        help="ReturnTax"
        label="Heraf skat af afkast"
        amount={display(-returnTax(year))}
        step="subtotal"
      />
      <p className="hint">
        Skatten er større, end årets synlige indtægter kan forklare. Forskellen
        er skatten af det, formuen gav uden for ordningerne: afkastet bliver
        stående på beholdningerne og tælles ikke med i overskuddet, mens
        regningen for det forlader bufferen som enhver anden.
      </p>
    </div>
  )
}

/** Årets udbetalinger, én linje pr. beholdning der tømte sig. Båndets tal er
    deres sum, og med to ordninger bag ét tal kunne året ikke efterregnes.

    Kun beholdninger med en udbetaling i året står her; en beholdning uden en
    udbetalingsplan har ingen linje frem for en på nul. Beholdningstabellen
    nedenfor fører den samme rate en gang til, og med vilje: dér står den ved
    siden af den primosaldo, den er regnet af, og den relation er lovens
    egen. */
function PayoutsTable({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  const holdings = plan.household.persons.flatMap((person) => person.holdings)

  return (
    <table className="udbetalingstabel">
      <thead>
        <tr>
          <th title={fieldHelp['HoldingYear.holding']}>Beholdning</th>
          <th title={fieldHelp['HoldingYear.payout']}>Udbetaling</th>
        </tr>
      </thead>
      <tbody>
        {year.holdings
          .filter((holdingYear) => holdingYear.payout !== 0)
          .map((holdingYear) => (
            <tr key={holdingYear.holding}>
              <td>
                {holdings.find((holding) => holding.id === holdingYear.holding)?.name ??
                  holdingYear.holding}
              </td>
              <td>{kroner(display(holdingYear.payout))}</td>
            </tr>
          ))}
      </tbody>
    </table>
  )
}

/** De ydelser uden saldo, husstanden modtog i året: folkepensionen og hver
    omsat livrentes årlige beløb.

    Linjerne findes, fordi ydelsen ikke står nogen andre steder. Den er
    indkomst udefra og indgår i årets indtægter, men den er ingen post i
    planen og ingen udbetaling fra en beholdning: efter omsætningen har
    livrenten ingen saldo at forlade, og folkepensionen har aldrig haft en.

    De to har intet med hinanden at gøre i planen — den ene læses af
    satsåret, den anden af en omsætning — men de gør det samme ved året, og
    båndet er netop den lighed. Folkepensionen står med ét beløb; hvordan
    grundbeløb og pensionstillæg blev til det, er aftrapningens egen blok.

    Modtageren står på linjen, fordi skatten er personens: pengene lander på
    bufferen uanset ejer, men beskatningen gør ikke. */
function BenefitsTable({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const rows = year.persons.flatMap((personYear) => {
    const owner = plan.household.persons.find((person) => person.id === personYear.person)
    const statePension = personYear.statePension
    return [
      ...(statePension
        ? [
            {
              key: `${personYear.person}-statspension`,
              name: 'Folkepension',
              owner,
              amount: statePension.basicAmount + statePension.pensionSupplement,
            },
          ]
        : []),
      ...personYear.lifeAnnuityBenefits.map((benefit) => ({
        key: benefit.holding,
        name: holdings.find((holding) => holding.id === benefit.holding)?.name ?? benefit.holding,
        owner,
        amount: benefit.amount,
      })),
    ]
  })

  return (
    <>
      <table className="ydelsestabel">
        <thead>
          <tr>
            <th title={fieldHelp['LifeAnnuityBenefit.holding']}>Ydelse</th>
            <th title={fieldHelp['LifeAnnuityBenefit.owner']}>Modtager</th>
            <th title={fieldHelp['LifeAnnuityBenefit.amount']}>Beløb</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.name}</td>
              <td>{row.owner?.name ?? ''}</td>
              <td>{kroner(display(row.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        En ydelse har ingen saldo bag sig. Den kommer udefra og indgår derfor i
        årets indtægter, hvor en udbetaling fra en ordning blot flytter penge
        fra beholdningen over på bufferen.
      </p>
    </>
  )
}

/** En linje i en regnestribe: etiket til venstre, beløb til højre.

    `help` er påkrævet af samme grund som feltkomponenternes nøgle er det.
    Dækningen er lovet total og bærer ingen markering på skærmen, og en
    stribe, brugeren peger forgæves på, er præcis det, løftet ikke kan bære —
    jf. `fieldHelp.ts`. Typen holder løftet: en ny stribe uden forklaring
    oversætter ikke.

    `step` rykker linjen ind som et led i en mellemregning, `subtotal` og
    `total` streger den op som henholdsvis en mellemsum og en slutsum. */
function StripePost({
  help,
  label,
  amount,
  step,
}: {
  help: keyof typeof fieldHelp
  label: string
  amount: number
  step?: 'step' | 'subtotal' | 'total'
}) {
  return (
    <div className={step ? `stribepost ${step}` : 'stribepost'} title={fieldHelp[help]}>
      <span className="m">{label}</span>
      <span className="v">{kroner(amount)}</span>
    </div>
  )
}

/** Skatteopgørelsen for én person: aktie- og kapitalindkomst, og hvert
    skattelag som sin egen linje med grundlag, sats og beløb — så et helt
    lag kan efterregnes i hånden alene ud fra sin egen række, jf. issue #13. */
function PersonTaxBlock({
  person,
  year,
  display,
}: {
  person: Person
  year: PersonYear
  display: (amount: number) => number
}) {
  const rows: { label: string; layer: LayerAmount }[] = []
  for (const layer of TAX_LAYER_ORDER) {
    rows.push({ label: TAX_LAYER_LABELS[layer], layer: year.tax.layers[layer] })
    if (layer === 'bottomBracketTax' && year.tax.capitalIncomeContribution?.bottomBracketTax) {
      rows.push({
        label: 'Bundskat af kapitalindkomst',
        layer: year.tax.capitalIncomeContribution.bottomBracketTax,
      })
    }
    if (layer === 'topBracketTax' && year.tax.capitalIncomeContribution?.topBracketTax) {
      rows.push({
        label: 'Topskat af kapitalindkomst',
        layer: year.tax.capitalIncomeContribution.topBracketTax,
      })
    }
    // Kapitalindkomsten har sit eget loft på 42 % og dermed sit eget
    // nedslag. Det står ved siden af den personlige indkomsts, fordi de to
    // har hvert sit grundlag og kan binde i samme år.
    if (layer === 'taxCeilingRelief' && year.tax.capitalIncomeContribution?.taxCeilingRelief) {
      rows.push({
        label: 'Loftnedslag af kapitalindkomst',
        layer: year.tax.capitalIncomeContribution.taxCeilingRelief,
      })
    }
  }

  const { labourMarketContribution } = year.tax.layers

  return (
    <div className="blok">
      <h3>{person.name}</h3>
      {/* Vejen fra bruttolønnen til den personlige indkomst, som den er
          tegnet i docs/mockup/flade.js. Fradragsretten står her og ikke nede
          blandt de ligningsmæssige fradrag, fordi den nedsætter den
          personlige indkomst og dermed hvert lag ovenpå — og fordi et år,
          hvor indbetalingen virkede, ellers ville se ud som et, hvor den
          ikke gjorde. Linjen udebliver, når året ingen indbetaling har med
          `Deductibility`: en linje på nul ville påstå det modsatte. */}
      <StripePost
        help="TaxAssessment.earnedIncome"
        label="Løn og skattepligtige poster"
        amount={display(labourMarketContribution.base)}
      />
      <StripePost
        help="TaxAssessment.labourMarketContribution"
        label={`AM-bidrag, ${procent(labourMarketContribution.rate)}`}
        amount={display(-labourMarketContribution.amount)}
      />
      {year.tax.contributionWithDeductibility > 0 && (
        <StripePost
          help="TaxAssessment.contributionWithDeductibility"
          label="Indbetaling med fradragsret"
          amount={display(-year.tax.contributionWithDeductibility)}
        />
      )}
      {/* Pensionsindkomsten lægges til efter AM-bidraget og efter
          fradragsretten — ingen af de to måler på den. Linjen udebliver i et
          år uden pensionsindkomst, som linjen om fradragsret gør: en linje
          på nul ville påstå en udbetaling, der ikke var. */}
      {year.tax.pensionIncome > 0 && (
        <StripePost
          help="TaxAssessment.pensionIncome"
          label="Pensionsindkomst"
          amount={display(year.tax.pensionIncome)}
        />
      )}
      <StripePost
        help="TaxAssessment.personalIncome"
        label="Personlig indkomst"
        amount={display(year.tax.personalIncome)}
        step="subtotal"
      />
      <StripePost
        help="PersonYear.shareIncome"
        label="Aktieindkomst"
        amount={display(year.shareIncome)}
      />
      <StripePost
        help="PersonYear.capitalIncome"
        label="Kapitalindkomst"
        amount={display(year.capitalIncome)}
      />
      {/* Begge satser står altid, også i et rent arbejdsår. Spørgsmålet om,
          hvad den næste krone pensionsindkomst koster, er netop det, der
          stilles, mens der stadig er noget at lægge til side. */}
      <div className="stribepost" title={fieldHelp['MarginalTaxRates.earnedIncome']}>
        <span className="m">Marginalskat, arbejdsindkomst</span>
        <span className="v">{procent(year.marginal.earnedIncome)}</span>
      </div>
      <div className="stribepost" title={fieldHelp['MarginalTaxRates.pensionIncome']}>
        <span className="m">Marginalskat, pensionsindkomst</span>
        <span className="v">{procent(year.marginal.pensionIncome)}</span>
      </div>
      <table className="lagtabel">
        <thead>
          {/* Husstandens aktieindkomstskat og personens egen skat er den
              samme fire kolonner over den samme slags linje, og de deler
              derfor forklaring — jf. nøglereglen i `fieldHelp.ts`. */}
          <tr>
            <th title={fieldHelp['LayerAmount.layer']}>Lag</th>
            <th title={fieldHelp['LayerAmount.base']}>Grundlag</th>
            <th title={fieldHelp['LayerAmount.rate']}>Sats</th>
            <th title={fieldHelp['LayerAmount.amount']}>Beløb</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{kroner(display(row.layer.base))}</td>
              <td>{procent(row.layer.rate)}</td>
              <td>{kroner(display(row.layer.amount))}</td>
            </tr>
          ))}
          <tr className="sum">
            <td>Skat i alt</td>
            <td></td>
            <td></td>
            <td>{kroner(display(totalTax(year.tax)))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
