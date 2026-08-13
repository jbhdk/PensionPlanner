/** Trinene i pensionslovens § 1 a, jf. docs/satser/folkepensionsalder.md.
    Sorteret ældst til nyest; det sidste trin, hvis fødselsdato er nået,
    vinder. */
type StatePensionAgeStep = {
  fromYear: number
  fromMonth: number
  age: number
  enacted: boolean
}

const steps: StatePensionAgeStep[] = [
  { fromYear: -Infinity, fromMonth: 1, age: 65, enacted: true },
  { fromYear: 1954, fromMonth: 1, age: 65.5, enacted: true },
  { fromYear: 1954, fromMonth: 7, age: 66, enacted: true },
  { fromYear: 1955, fromMonth: 1, age: 66.5, enacted: true },
  { fromYear: 1955, fromMonth: 7, age: 67, enacted: true },
  { fromYear: 1963, fromMonth: 1, age: 68, enacted: true },
  { fromYear: 1967, fromMonth: 1, age: 69, enacted: true },
  { fromYear: 1971, fromMonth: 1, age: 70, enacted: true },
  { fromYear: 1975, fromMonth: 1, age: 71, enacted: false },
  { fromYear: 1979, fromMonth: 1, age: 71.5, enacted: false },
  { fromYear: 1983, fromMonth: 1, age: 72.5, enacted: false },
  { fromYear: 1987, fromMonth: 7, age: 73, enacted: false },
  { fromYear: 1992, fromMonth: 1, age: 73.5, enacted: false },
  { fromYear: 1996, fromMonth: 7, age: 74, enacted: false },
]

import { yearAtAge } from './age'
import type { Person, SimulationYear } from './plan'

export type StatePensionAgeInfo = { age: number; enacted: boolean }

/** Folkepensionsalderen udledt af fødselsdato, jf.
    docs/satser/folkepensionsalder.md. `enacted` er falsk for de fødselsår,
    hvor Folketinget endnu ikke har vedtaget alderen — kun fremskrevet den. */
export function deriveStatePensionAge(
  birthYear: number,
  birthMonth: number,
): StatePensionAgeInfo {
  const step = [...steps]
    .reverse()
    .find(
      (s) =>
        birthYear > s.fromYear ||
        (birthYear === s.fromYear && birthMonth >= s.fromMonth),
    )!
  return { age: step.age, enacted: step.enacted }
}

/** Personens folkepensionsalder. Tabellen er eneste kilde, også for de
    årgange hvor trinnet kun er fremskrevet: det tal er det bedste, der
    findes, og bruges som det er. Vedtager Folketinget noget andet, rettes
    docs/satser/folkepensionsalder.md, og enhver plan følger med — `enacted`
    siger imens på skærmen, at tallet er et skøn. */
export function statePensionAge(person: Person): number {
  return deriveStatePensionAge(person.birthYear, person.birthMonth).age
}

/** Det kalenderår personen når folkepensionsalderen. Motorens eneste vej til
    det tal: aldersopsparingens vindue, det ekstra pensionsfradrags
    15-årsgrænse og folkepensionens egen start skal ramme det samme år, og
    alderen er en brøk for de fleste årgange — regnede hvert sted det selv,
    ville de tre kunne skille sig i det halve år. */
export function statePensionYear(person: Person): SimulationYear {
  return yearAtAge(person, statePensionAge(person))
}
