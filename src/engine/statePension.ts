import type { Household, Person, PersonId, SimulationYear } from './plan'
import type { CivilStatus } from './rates/rateYear'
import { statePensionYear } from './statePensionAge'

/** Én persons folkepension i ét simuleringsår: modtageren og hendes
    civilstand.

    Ingen kronebeløb. Både grundbeløbet og pensionstillægget hentes i
    husstandssømmet, hvor aftrapningen sker — og alle fire tal på
    `Taper`-rækken skal komme fra ét opslag på netop denne civilstand, jf.
    ADR-0014. Modtageren står på linjen af samme grund som på en rate og en
    livrenteydelse: pengene lander på bufferen uanset hvem det er, men skatten
    gør ikke. */
export type ActiveStatePension = { owner: PersonId; civilStatus: CivilStatus }

/** Årets folkepension, én linje pr. person der har nået sin
    folkepensionsalder. Tom i årene før.

    Der oprettes intet folkepensionsobjekt i planen, jf. ADR-0023: beløbene
    læses af satsåret, og året, de begynder i, udledes af fødselsdatoen
    gennem `statePensionYear` — motorens eneste vej til det årstal, så
    folkepensionens start og aldersopsparingens vindue ikke kan skille sig i
    det halve år. */
export function statePensionsInYear(
  household: Household,
  year: SimulationYear,
): ActiveStatePension[] {
  return household.persons
    .filter((person) => year >= statePensionYear(person))
    .map((person) => ({
      owner: person.id,
      civilStatus: civilStatusOf(person, household, year),
    }))
}

/** Personens civilstand i året, udledt frem for tastet og aldrig gemt.
    Husstanden er én eller to personer, der er gift eller samlevende, jf.
    `Household` — er der kun én, er den ene enlig, og er der to, er ingen af
    dem det.

    Skellet mellem de to gifte er, om den anden selv modtager social pension,
    jf. PL § 49, stk. 1, nr. 4. I denne model er social pension folkepensionen,
    og spørgsmålet stilles derfor gennem `statePensionYear` — samme opslag som
    personens egen start, så de to ikke kan svare hver sit om det samme år.

    Det er ét skel og ikke to: i det år ægtefællen selv bliver pensionist,
    skifter både aftrapningsprocenten og bortseelsen, og de sidder på den
    `Taper`-række, denne værdi slår op. */
function civilStatusOf(
  person: Person,
  household: Household,
  year: SimulationYear,
): CivilStatus {
  const others = household.persons.filter((other) => other.id !== person.id)
  if (others.length === 0) return 'Single'
  return others.some((other) => year >= statePensionYear(other))
    ? 'WithPensioner'
    : 'WithNonPensioner'
}
