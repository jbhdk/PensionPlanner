import type { Holding, Person, Plan } from '../engine/plan'
import { returnWeight } from '../engine/simulate'
import type { LayerAmount, TaxLayer } from '../engine/tax/assessTax'
import { totalTax } from '../engine/tax/assessTax'
import type { HoldingYear, PersonYear, YearResult } from '../engine/yearResult'
import { kroner, procent } from './format'
import { danishTiming } from './Inspector'
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
  'municipalTax',
  'churchTax',
]

const TAX_LAYER_LABELS: Record<TaxLayer, string> = {
  labourMarketContribution: 'AM-bidrag',
  bottomBracketTax: 'Bundskat',
  middleBracketTax: 'Mellemskat',
  topBracketTax: 'Topskat',
  additionalTopBracketTax: 'Top-topskat',
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
          <span>Satsår {year.rateYear}</span>
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

      <HoldingsBlock plan={plan} year={year} display={display} />
      <EntriesBlock plan={plan} year={year} display={display} />
    </div>
  )
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
            <th>Post</th>
            <th>Beløb</th>
            <th>Forfald</th>
            <th>Afkastvægt</th>
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

/** Afkastet pr. beholdning: primosaldo og vægtet strøm er grundlaget,
    nettoafkastsatsen er beholdningens egen — udledt af brutto minus ÅOP,
    aldrig et gemt felt, jf. CONTEXT.md — og de tre ganget/lagt sammen giver
    afkastet, så en række kan efterregnes i hånden alene ud fra sig selv. */
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
            <th>Beholdning</th>
            <th>Primosaldo</th>
            <th>Vægtet strøm</th>
            <th>Nettoafkastsats</th>
            <th>Afkast</th>
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
                <td>{kroner(display(h.weightedFlow))}</td>
                <td>{procent(holding.grossReturn - holding.annualCostRate)}</td>
                <td>{kroner(display(h.return))}</td>
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
  }

  return (
    <div className="blok">
      <h3>{person.name}</h3>
      <StripePost label="Aktieindkomst" amount={display(year.shareIncome)} />
      <StripePost label="Kapitalindkomst" amount={display(year.capitalIncome)} />
      <table className="lagtabel">
        <thead>
          <tr>
            <th>Lag</th>
            <th>Grundlag</th>
            <th>Sats</th>
            <th>Beløb</th>
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
