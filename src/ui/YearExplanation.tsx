import { payoutScheduleOf } from '../engine/holdingVariant'
import type { Holding, Person, Plan } from '../engine/plan'
import { returnWeight } from '../engine/simulate'
import type { ShareIncomeLayer } from '../engine/tax/assessHousehold'
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
          closingWealth − openingWealth = income + return − tax − expenses. */}
      <div className="balancestribe">
        <StripePost label="Formue primo" amount={display(year.openingWealth)} />
        <StripePost label="Indtægter" amount={display(year.income)} />
        <StripePost label="Afkast" amount={display(year.return)} />
        <StripePost label="Skat" amount={display(-year.tax)} />
        <StripePost label="Udgifter" amount={display(-year.expenses)} />
        <StripePost label="Formue ultimo" amount={display(year.closingWealth)} />
      </div>

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

      <HoldingsBlock plan={plan} year={year} display={display} />
      <EntriesBlock plan={plan} year={year} display={display} />
      <ContributionsBlock plan={plan} year={year} display={display} />
    </div>
  )
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
function EntriesBlock({
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
      <h3>Posterne</h3>
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
            if (!entry) return null
            const signed = entry.direction === 'Expense' ? -entryYear.amount : entryYear.amount
            return (
              <tr key={entryYear.entry}>
                <td>{entry.name}</td>
                <td>{kroner(display(signed))}</td>
                <td>{danishTiming(entry.timing)}</td>
                <td>{procent(returnWeight(entry.timing))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Årets indbetalinger med begge deres beløb: hvad der forlod kilden, og hvad
    der landede i beholdningen. Forskellen er AM-bidraget, og den står ikke i
    en tredje kolonne — den er allerede personens eget AM-lag ovenfor, og to
    steder kunne komme til at sige hver sit.

    Blokken udebliver, når året ingen indbetalinger har. */
function ContributionsBlock({
  plan,
  year,
  display,
}: {
  plan: Plan
  year: YearResult
  display: (amount: number) => number
}) {
  if (year.contributions.length === 0) return null

  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const name = (contributionId: string) => {
    const contribution = plan.contributions.find((c) => c.id === contributionId)
    if (!contribution) return contributionId
    // Kilden slås op i den bog, dens udgave peger ind i: et lønkildet bidrag
    // kommer fra en post, et beholdningskildet fra en beholdning.
    const source =
      contribution.kind === 'EntrySourced'
        ? plan.entries.find((entry) => entry.id === contribution.source)
        : holdings.find((holding) => holding.id === contribution.source)
    const to = holdings.find((holding) => holding.id === contribution.to)
    return `${source?.name ?? contribution.source} → ${to?.name ?? contribution.to}`
  }

  return (
    <div className="blok bred">
      <h3>Indbetalingerne</h3>
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
      <CapsBlock plan={plan} year={year} display={display} />
    </div>
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
    havde til en loftbelagt ordning. */
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
    <>
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
    </>
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
    løbende priser ved siden af et tal i dagens kroner er den fælde,
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

function StripePost({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="stribepost">
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
        label="Løn og skattepligtige poster"
        amount={display(labourMarketContribution.base)}
      />
      <StripePost
        label={`AM-bidrag, ${procent(labourMarketContribution.rate)}`}
        amount={display(-labourMarketContribution.amount)}
      />
      {year.tax.contributionWithDeductibility > 0 && (
        <StripePost
          label="Indbetaling med fradragsret"
          amount={display(-year.tax.contributionWithDeductibility)}
        />
      )}
      {/* Pensionsindkomsten lægges til efter AM-bidraget og efter
          fradragsretten — ingen af de to måler på den. Linjen udebliver i et
          år uden pensionsindkomst, som linjen om fradragsret gør: en linje
          på nul ville påstå en udbetaling, der ikke var. */}
      {year.tax.pensionIncome > 0 && (
        <StripePost label="Pensionsindkomst" amount={display(year.tax.pensionIncome)} />
      )}
      <StripePost label="Personlig indkomst" amount={display(year.tax.personalIncome)} />
      <StripePost label="Aktieindkomst" amount={display(year.shareIncome)} />
      <StripePost label="Kapitalindkomst" amount={display(year.capitalIncome)} />
      {/* Begge satser står altid, også i et rent arbejdsår. Spørgsmålet om,
          hvad den næste krone pensionsindkomst koster, er netop det, der
          stilles, mens der stadig er noget at lægge til side. */}
      <div className="stribepost">
        <span className="m">Marginalskat, arbejdsindkomst</span>
        <span className="v">{procent(year.marginal.earnedIncome)}</span>
      </div>
      <div className="stribepost">
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
