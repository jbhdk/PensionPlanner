import type { Nominal } from '../engine/plan'
import type { PersonYear, YearResult } from '../engine/yearResult'

/** Skatten af afkastet: den del af husstandens egen skat, der måler på
    afkastet af de frie beholdninger, jf. ADR-0027.

    Den findes, fordi årets overskud tæller afkastet ude og skatten af det
    med, jf. ADR-0026. Skattebåndet bliver derved større, end de synlige
    indtægter kan forklare, og forskellen er netop dette tal — det skal kunne
    læses frem for regnes ud i hånden.

    Henført og ikke kontrafaktisk: de lag, der måler på afkastet, lægges
    sammen, frem for at året regnes om uden afkastet. Hvert led står som sin
    egen linje andre steder i forklar-året og kan efterregnes; en difference
    mellem to opgørelser, hvoraf den ene aldrig vises, kan kun tros.

    Udledt af felter på det samme årsresultat, ganske som `surplus` — ikke et
    nyt felt på `YearResult` og ingen ny beregning i motoren. */
export function returnTax(year: YearResult): Nominal {
  const shareIncomeTax = sum(Object.values(year.shareIncomeTax), (layer) => layer.amount)

  return shareIncomeTax + sum(year.persons, capitalIncomeTax)
}

/** Kapitalindkomstens skat hos én person: dens eget bidrag til bund- og
    topskat med sit loftnedslag, plus dens andel af kommune- og kirkeskatten.
 
    De to sidste måler af den skattepligtige indkomst under ét, hvor
    kapitalindkomsten indgår sammen med alt andet. Andelen er derfor
    kapitalindkomsten som indkomstens **øverste skive**: har personfradraget
    ædt grundlaget ned under den, er det grundlaget og ikke kapitalindkomsten,
    der er tilbage at måle på. Placeringen er den samme, motoren allerede har
    givet kapitalindkomsten i bund- og topskatten, jf. ADR-0027. */
function capitalIncomeTax(person: PersonYear): Nominal {
  const { municipalTax, churchTax } = person.tax.layers
  const ownLayers = sum(
    Object.values(person.tax.capitalIncomeContribution ?? {}),
    (layer) => layer?.amount ?? 0,
  )
  const topSlice = Math.max(0, Math.min(person.capitalIncome, municipalTax.base))

  return ownLayers + topSlice * (municipalTax.rate + churchTax.rate)
}

function sum<T>(items: T[], of: (item: T) => Nominal): Nominal {
  return items.reduce((total, item) => total + of(item), 0)
}
