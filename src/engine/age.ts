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

/** Det sidste år, personens egen indkomst tælles med — jf. ADR-0030. Efter
    det fortsætter husstandens udgifter og personens beholdninger uændret,
    men hendes indtægtsposter, folkepension og livrenteydelse gør ikke:
    horisonten er et loft på hendes egne strømme og ikke en fri grænse, en
    post kan række forbi. */
export function personLastYear(person: Person): SimulationYear {
  return yearAtAge(person, person.horizon)
}

/** Periodens to endepunkter oversat til kalenderår. Ved `PersonAge` følger et
    endepunkt sat til `'WorkEndAge'` `owner.workEndAge`, så perioden flytter
    sig, når erhvervsophørsalderen ændres, uden at posten selv redigeres.

    `'WorkEndAge'` løses forskelligt som `from` og som `to`: erhvervsophørsåret
    er det første år uden arbejde, aldrig det sidste med. Som `from` regnes
    året med — en udbetalingsplan, der følger erhvervsophør, betaler sin
    første rate det år. Som `to` regnes året *ikke* med — en løn eller en
    overførsel, der følger erhvervsophør, falder sidste gang året før. Uden
    skellet ville samme år bære en fuld årsløn og en fuld pensionsrate på én
    gang. En fast alder eller et kalenderår er brugerens eget tal og læses
    ens i begge roller.

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
    from: resolveAgeBound(period.from, owner, 'from'),
    to: resolveAgeBound(period.to, owner, 'to'),
  }
}

function resolveAgeBound(
  bound: AgeBound | undefined,
  owner: Person,
  role: 'from' | 'to',
): SimulationYear | undefined {
  if (bound === undefined) return undefined
  if (bound !== 'WorkEndAge') return yearAtAge(owner, bound)
  const year = yearAtAge(owner, owner.workEndAge)
  return role === 'to' ? year - 1 : year
}
