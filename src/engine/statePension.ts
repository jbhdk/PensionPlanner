import type { Household, Person, PersonId, SimulationYear } from './plan'
import type { CivilStatus, RateYear, Taper } from './rates/rateYear'
import { statePensionYear } from './statePensionAge'
import type { StatePensionYear } from './yearResult'

/** Én persons folkepension i ét simuleringsår, med den person, der modtager
    den. Modtageren står på linjen af samme grund som på en rate og en
    livrenteydelse: pengene lander på bufferen uanset hvem det er, men skatten
    gør ikke — folkepensionen er `PensionIncome` hos den, der får den. */
export type ActiveStatePension = { owner: PersonId } & StatePensionYear

/** Årets folkepension, én linje pr. person der har nået sin
    folkepensionsalder. Tom i årene før.

    Der oprettes intet folkepensionsobjekt i planen, jf. ADR-0023: begge
    kronebeløb læses af satsåret, og året, de begynder i, udledes af
    fødselsdatoen gennem `statePensionYear` — motorens eneste vej til det
    årstal, så folkepensionens start og aldersopsparingens vindue ikke kan
    skille sig i det halve år.

    Grundbeløbet er fladt. Aftrapningen efter egen arbejdsindkomst blev
    afskaffet med virkning fra 2023, og hverken arbejdsindkomst eller anden
    indkomst reducerer det.

    Pensionstillægget udbetales fuldt. Aftrapningen efter `TaperBase` er ikke
    bygget endnu — det, satsåret bruges til her, er alene det fulde tillæg for
    personens civilstand. */
export function statePensionsInYear(
  household: Household,
  year: SimulationYear,
  rates: RateYear,
): ActiveStatePension[] {
  return household.persons
    .filter((person) => year >= statePensionYear(person))
    .map((person) => ({
      owner: person.id,
      basicAmount: rates.statePension.basicAmount,
      pensionSupplement: taperFor(civilStatusOf(person, household, year), rates)
        .pensionSupplement,
    }))
}

/** Personens civilstand i året, udledt frem for tastet. Husstanden er én
    eller to personer, der er gift eller samlevende, jf. `Household` — er der
    kun én, er den ene enlig, og er der to, er ingen af dem det.

    Skellet mellem de to gifte er, om den anden selv modtager social pension,
    jf. PL § 49, stk. 1, nr. 4. I denne model er social pension folkepensionen,
    og spørgsmålet stilles derfor gennem `statePensionYear` — samme opslag som
    personens egen start, så de to ikke kan svare hver sit om det samme år.

    De to gifte deler `pensionSupplement` og skilles først, når aftrapningen
    bygges: satserne er 32 % mod 16 %. Skellet står her alligevel, fordi det er
    civilstanden, der er begrebet — et opslag, der kun kendte "gift", ville
    hedde noget, det ikke kunne stå inde for. */
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

function taperFor(civilStatus: CivilStatus, rates: RateYear): Taper {
  return rates.statePension.taper.find((taper) => taper.civilStatus === civilStatus)!
}
