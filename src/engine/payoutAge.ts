import { yearAtAge } from './age'
import { isPensionScheme, payoutTaxation } from './holdingVariant'
import type { AgeBound, Holding, Person, SimulationYear } from './plan'

/** Det kalenderår ordningen tidligst må udbetales. Motorens eneste vej til
    den sammenligning: `holding.payoutAge` er ofte en brøk, og året, hvor
    personen fylder 62,5, indeholder lovlige udbetalingsmåneder — en plan,
    der starter dér, findes i virkeligheden. Målte to steder hver sin vej,
    ville denne grænse og aldersopsparingens vindue kunne skille sig i det
    halve år, brøkalderen giver. Samme grund som `statePensionYear`s, og
    samme formel. */
export function payoutYear(holding: { payoutAge: number }, owner: Person): SimulationYear {
  return yearAtAge(owner, holding.payoutAge)
}

/** Det kalenderår, en udbetalingsplan begynder i. Et startpunkt sat til
    erhvervsophør følger `Person.workEndAge`, ganske som en posts
    periodeendepunkt gør, så hele forløbet flytter sig, når ét tal ændres.

    Står her ved siden af `payoutYear`, fordi de to måles mod hinanden: den
    ene er den tidligste, loven tillader, den anden den, planen beder om.
    Regnet hver sit sted kunne de komme til at læse den samme brøkalder
    forskelligt. */
export function payoutStartYear(start: AgeBound, owner: Person): SimulationYear {
  return yearAtAge(owner, start === 'WorkEndAge' ? owner.workEndAge : start)
}

/** Om en `Transfer` må hente fra beholdningen i året — de to betingelser, der
    tilsammen er "de beholdninger, en overførsel kan nå".

    Den første er variantens: en overførsel må hente fra enhver variant,
    hvis `PayoutTaxation` ikke er `PersonalIncome` — både en `TaxFree` og en
    `Chargeable`. Skellet er ikke, om flytningen koster noget, men om loven
    binder både start, varighed og årligt beløb: gør den det, skal pengene
    gennem en `PayoutSchedule` i stedet, og en overførsel ville påstå en
    lovregel, der ikke findes. Den anden er årets: en pensionsordnings dør er
    låst indtil dens `PayoutAge`. Aktiesparekontoen og de frie varianter har
    ingen dør, og reglen rører dem ikke. Begge dele står i ADR-0022 og
    ADR-0029.

    Ét spørgsmål med ét svar, fordi tre steder spørger om det samme:
    `validatePlan` afviser en plan, der beder om det umulige,
    `transferEndOptions` tilbyder kun det, fladen selv ville acceptere, og
    `BufferState` afgør `Incomplete` mod `Unsustainable` på præcis de
    beholdninger, en manglende overførsel kunne have nået. Regnet hvert sit
    sted kunne de komme til at læse den samme brøkalder forskelligt. */
export function transferAllowedFrom(
  holding: Holding,
  owner: Person,
  year: SimulationYear,
): boolean {
  if (payoutTaxation(holding) === 'PersonalIncome') return false
  return !isPensionScheme(holding) || year >= payoutYear(holding, owner)
}
