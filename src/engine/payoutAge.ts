import { yearAtAge } from './age'
import type { OpenedOn, PensionSchemeHolding, Person, SimulationYear } from './plan'
import { statePensionAge } from './statePensionAge'

/** De tre regelsæt, en ordnings pensionsudbetalingsalder kan falde under,
    afgjort af oprettelsestidspunktet alene. */
export type PayoutRegime = 'BeforeMay2007' | 'May2007ToDecember2017' | 'FromJanuary2018'

/** De to lovskel, og hvad regimet på hver sin side gør ved alderen. Sorteret
    ældst til nyest; det sidste skel, oprettelsestidspunktet har passeret,
    vinder — samme form som folkepensionsalderens trin i `statePensionAge`.

    Skellene er lovens egne, jf. docs/satser/pensionsudbetalingsalder.md, og
    hører derfor ikke i satsåret: de rører sig ikke fra år til år, og der er
    ingen § 20-tabel at slå dem op i. Samme sted som aldersopsparingens
    syvårsgrænse hører hjemme, og af samme grund.

    `age` får folkepensionsalderen ind og svarer med ordningens. Det faste
    regime ser bort fra den — det er hele forskellen på det og de to andre. */
const regimes: { from: OpenedOn; regime: PayoutRegime; age: (statePensionAge: number) => number }[] = [
  { from: { year: -Infinity, month: 1 }, regime: 'BeforeMay2007', age: () => 60 },
  { from: { year: 2007, month: 5 }, regime: 'May2007ToDecember2017', age: (age) => age - 5 },
  { from: { year: 2018, month: 1 }, regime: 'FromJanuary2018', age: (age) => age - 3 },
]

function reached(openedOn: OpenedOn, skel: OpenedOn): boolean {
  return openedOn.year !== skel.year ? openedOn.year > skel.year : openedOn.month >= skel.month
}

function ruleFor(openedOn: OpenedOn) {
  return [...regimes].reverse().find((rule) => reached(openedOn, rule.from))!
}

/** Det regime, ordningen faldt i. Måneden afgør begge skel: en ordning
    oprettet i april 2007 er et andet regime end en fra maj samme år. */
export function payoutRegime(openedOn: OpenedOn): PayoutRegime {
  return ruleFor(openedOn).regime
}

/** Ordningens pensionsudbetalingsalder. Ofte en brøkalder, fordi to af de tre
    regimer er folkepensionsalderen minus fem eller tre — og folkepensionsalderen
    er 65,5 for én årgang og 72,5 for en anden.

    Fordi de to relative regimer måler fra ejeren, retter alderen sig af sig
    selv, når skønnet for personens folkepensionsalder ændres. Det faste
    regime rører sig ikke: 60 år er 60 år, uanset hvad Folketinget vedtager.

    Er en lavere alder bevaret gennem en overførsel, vinder den, og regimet
    har intet at skulle have sagt — også hvis folkepensionsalderen senere
    ændres. Den bevarede alder er netop den, ordningen tog med sig fra sin
    egen oprettelse. */
export function payoutAge(holding: PensionSchemeHolding, owner: Person): number {
  if (holding.payoutAgeOverride !== undefined) return holding.payoutAgeOverride
  return ruleFor(holding.openedOn).age(statePensionAge(owner))
}

/** Det kalenderår ordningen tidligst må udbetales. Motorens eneste vej til
    den sammenligning: alderen er ofte en brøk, og året, hvor personen fylder
    62,5, indeholder lovlige udbetalingsmåneder — en plan, der starter dér,
    findes i virkeligheden. Målte to steder hver sin vej, ville denne grænse
    og aldersopsparingens vindue kunne skille sig i det halve år, brøkalderen
    giver. Samme grund som `statePensionYear`s, og samme formel. */
export function payoutYear(holding: PensionSchemeHolding, owner: Person): SimulationYear {
  return yearAtAge(owner, payoutAge(holding, owner))
}
