import type { AgeBound, Period, Person, SimulationYear } from './plan'

/** Det kalenderår en person når en alder. Formlen er
    `birthYear + floor(age + (birthMonth − 1) / 12)`: den lægger fødselsdagens
    plads i året til alderen og skærer resten væk, så et halvt år skubber
    årstallet over årsskiftet for de fødselsmåneder, hvor det skal.

    En heltalsalder giver `birthYear + age` for enhver fødselsmåned, fordi
    `(birthMonth − 1) / 12` altid er under 1 — den tidligere adfærd er dermed
    formlens specialtilfælde og ikke en regel ved siden af den. Brøkaldre er
    ikke en kuriositet: den lovfastsatte folkepensionsalder er 65,5, 66,5,
    71,5, 72,5 og 73,5 for hver sin årgang. */
export function yearAtAge(person: Person, age: number): SimulationYear {
  return person.birthYear + Math.floor(age + (person.birthMonth - 1) / 12)
}

/** Periodens to endepunkter oversat til kalenderår. Ved `PersonAge` følger et
    endepunkt sat til `'WorkEndAge'` `owner.workEndAge`, så perioden flytter
    sig, når erhvervsophørsalderen ændres, uden at posten selv redigeres.

    Et udeladt endepunkt bliver ved med at være udeladt — det betyder "fra
    planens start" henholdsvis "til horisontens slut" og er ikke et årstal,
    der kan regnes ud.

    Står her og ikke i motoren, fordi tre steder måler mod den: motoren,
    indgangskontrollen og fladen. En periode opløst hvert sit sted kunne læse
    den samme brøkalder forskelligt, ganske som `payoutYear` og
    `payoutStartYear` står ved siden af hinanden af samme grund.

    Årene her er ikke klippet mod horisonten. Skal fladen vise, hvilke år en
    post faktisk falder i, læser den årsrækken og ikke denne, jf. ADR-0012. */
export function periodBounds(
  period: Period,
  owner: Person,
): { from?: SimulationYear; to?: SimulationYear } {
  if (period.anchor === 'CalendarYear') {
    return { from: period.from, to: period.to }
  }
  return {
    from: resolveAgeBound(period.from, owner),
    to: resolveAgeBound(period.to, owner),
  }
}

function resolveAgeBound(
  bound: AgeBound | undefined,
  owner: Person,
): SimulationYear | undefined {
  if (bound === undefined) return undefined
  const age = bound === 'WorkEndAge' ? owner.workEndAge : bound
  return yearAtAge(owner, age)
}
