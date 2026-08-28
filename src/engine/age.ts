import type { Household, Period, Person, PersonAgeBound, SimulationYear } from './plan'

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

/** Det sidste år, personens egen indkomst tælles med — jf. ADR-0030. Efter
    det fortsætter husstandens udgifter og personens beholdninger uændret,
    men hendes indtægtsposter, folkepension og livrenteydelse gør ikke:
    horisonten er et loft på hendes egne strømme og ikke en fri grænse, en
    post kan række forbi. */
export function personLastYear(person: Person): SimulationYear {
  return yearAtAge(person, person.horizon)
}

/** Det sidste år, husstanden regnes i: den seneste af personernes egne. En
    aldersforankret grænse måles mod det og ikke mod ejerens egen horisont —
    en udgiftspost er husstandens og fortsætter til det fælles sidste år, selv
    om dens periode er forankret til ejerens alder, jf. ADR-0030. Klemtes der
    til ejerens horisont, ville en fuldt lovlig post være uskrivelig.

    Står her ved siden af `personLastYear` af samme grund som `periodBounds`:
    motoren, indgangskontrollen og fladen måler alle tre mod den, og et
    horisontår regnet hvert sit sted kunne før eller siden svare hver sit. */
export function householdLastYear(household: Household): SimulationYear {
  return Math.max(...household.persons.map((person) => personLastYear(person)))
}

/** Periodens to endepunkter oversat til kalenderår. Ved `PersonAge` følger et
    endepunkt sat til en navngiven person dennes `workEndAge`, jf.
    `PersonAgeBound` og ADR-0050, og et endepunkt sat til en navngiven person
    og en alder måler den alder på hende i stedet for på `owner`, jf.
    ADR-0051 — `owner` bruges dermed kun til det bare tal. Personen slås op i
    `household` og ikke i et enkelt `Person`, for hun er ikke nødvendigvis
    `owner`.

    Et endepunkt, der følger nogen, løses forskelligt som `from` og som `to`:
    erhvervsophørsåret er det første år uden arbejde, aldrig det sidste med.
    Som `from` regnes året med — en udbetalingsplan, der følger erhvervsophør,
    betaler sin første rate det år. Som `to` regnes året *ikke* med — en løn
    eller en overførsel, der følger erhvervsophør, falder sidste gang året
    før. Uden skellet ville samme år bære en fuld årsløn og en fuld
    pensionsrate på én gang. En fast alder eller et kalenderår er brugerens
    eget tal og læses ens i begge roller.

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
  household: Household,
): { from?: SimulationYear; to?: SimulationYear } {
  if (period.anchor === 'CalendarYear') {
    return { from: period.from, to: period.to }
  }
  return {
    from: resolvePersonAgeBound(period.from, owner, household, 'from'),
    to: resolvePersonAgeBound(period.to, owner, household, 'to'),
  }
}

function resolvePersonAgeBound(
  bound: PersonAgeBound | undefined,
  owner: Person,
  household: Household,
  role: 'from' | 'to',
): SimulationYear | undefined {
  if (bound === undefined) return undefined
  if (typeof bound === 'number') return yearAtAge(owner, bound)
  const followed = household.persons.find((person) => person.id === bound.person)
  if (followed === undefined) return undefined
  return 'age' in bound ? yearAtAge(followed, bound.age) : yearAtAge(followed, workEndBoundAge(followed, role))
}

/** Den alder, et endepunkt sat til erhvervsophør svarer til i sin rolle:
    erhvervsophørsalderen selv som `from`, året før som `to`, jf. ADR-0031.

    Oversættelsen er eksakt og ikke en tilnærmelse. `yearAtAge` lægger
    fødselsdagens plads i året til alderen og skærer resten væk, og et helt år
    trukket fra alderen giver derfor altid ét kalenderår tilbage — også for en
    brøkalder som 62,5.

    Findes, fordi fladen har brug for fluebenets alder og ikke kun dets år:
    et flueben, hvis alder ligger uden for feltets grænser, kan ikke klemmes
    og skal afvises, jf. ADR-0045. */
export function workEndBoundAge(owner: Person, role: 'from' | 'to'): number {
  return role === 'to' ? owner.workEndAge - 1 : owner.workEndAge
}
