import type { Person, Plan } from '../engine/plan'
import type { LayerAmount, TaxLayer } from '../engine/tax/assessTax'
import { totalTax } from '../engine/tax/assessTax'
import type { PersonYear, YearResult } from '../engine/yearResult'
import { kroner, procent } from './format'
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
  plan,
  onBack,
}: {
  year: YearResult
  plan: Plan
  onBack: () => void
}) {
  const display = (amount: number) => inRealKroner(amount, year.year, plan)

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
        <button type="button" className="knap primaer" onClick={onBack}>
          Tilbage til tabellen
        </button>
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
