import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import { kroner } from './format'
import { inRealKroner } from './real'

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
