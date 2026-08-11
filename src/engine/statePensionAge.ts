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

import type { Person } from './plan'

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

/** Personens folkepensionsalder: overstyringen, hvis sat, ellers den
    udledte. En overstyring kender ikke til `enacted` — den er brugerens
    eget ansvar, jf. CONTEXT.md. */
export function statePensionAge(person: Person): number {
  return (
    person.statePensionAgeOverride ??
    deriveStatePensionAge(person.birthYear, person.birthMonth).age
  )
}
