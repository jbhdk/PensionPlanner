import type { Direction, Entry, Holding, Person, Plan } from '../engine/plan'

/** Redigeringerne er rene: de bygger en ny plan frem for at rette i den
    gamle. Motoren er en ren funktion, og en muteret plan ville gøre det
    umuligt at se, hvad der faktisk ændrede sig. */

export function withPerson(
  plan: Plan,
  id: string,
  change: (person: Person) => Person,
): Plan {
  return {
    ...plan,
    household: {
      persons: plan.household.persons.map((person) =>
        person.id === id ? change(person) : person,
      ),
    },
  }
}

export function withHolding(
  plan: Plan,
  id: string,
  change: (holding: Holding) => Holding,
): Plan {
  return {
    ...plan,
    household: {
      persons: plan.household.persons.map((person) => ({
        ...person,
        holdings: person.holdings.map((holding) =>
          holding.id === id ? change(holding) : holding,
        ),
      })),
    },
  }
}

export function withEntry(
  plan: Plan,
  id: string,
  change: (entry: Entry) => Entry,
): Plan {
  return {
    ...plan,
    entries: plan.entries.map((entry) =>
      entry.id === id ? change(entry) : entry,
    ),
  }
}

/** Den tyndeste person, der kan tilføjes: fødselsåret gættes fyrre år før
    startåret, resten er de samme standarder som fixturens. Brugeren retter
    dem i skuffen bagefter. */
export function addPerson(plan: Plan): Plan {
  const id = freshPersonId(plan)
  const name = `Person ${plan.household.persons.length + 1}`

  return {
    ...plan,
    household: {
      persons: [
        ...plan.household.persons,
        {
          id,
          name,
          birthYear: plan.startYear - 40,
          birthMonth: 1,
          workEndAge: 65,
          horizon: 90,
          holdings: [],
        },
      ],
    },
  }
}

/** Fjerner personen, dennes beholdninger med (de er nestet under personen),
    og posterne der peger på personen som ejer — ellers ville motoren støde
    på en ejer, der ikke findes. Var personens beholdning bufferen, arver den
    første tilbageværende beholdning rollen, så planen forbliver regnbar. */
export function removePerson(plan: Plan, id: string): Plan {
  const persons = plan.household.persons.filter((person) => person.id !== id)
  const remainingHoldingIds = persons.flatMap((person) =>
    person.holdings.map((holding) => holding.id),
  )
  const buffer = remainingHoldingIds.includes(plan.buffer)
    ? plan.buffer
    : (remainingHoldingIds[0] ?? plan.buffer)

  return {
    ...plan,
    buffer,
    household: { persons },
    entries: plan.entries.filter((entry) => entry.owner !== id),
  }
}

function freshPersonId(plan: Plan): string {
  const existing = new Set(plan.household.persons.map((person) => person.id))
  let n = 1
  while (existing.has(`person-${n}`)) n++
  return `person-${n}`
}

export function findPerson(plan: Plan, id: string): Person | undefined {
  return plan.household.persons.find((person) => person.id === id)
}

export function findHolding(plan: Plan, id: string): Holding | undefined {
  return plan.household.persons
    .flatMap((person) => person.holdings)
    .find((holding) => holding.id === id)
}

/** Personen, hvis `holdings` netop nu rummer beholdningen. Ejerskab er
    nesting, ikke et felt på `Holding` — se domænemodellen. */
export function findHoldingOwner(plan: Plan, holdingId: string): Person | undefined {
  return plan.household.persons.find((person) =>
    person.holdings.some((holding) => holding.id === holdingId),
  )
}

/** Flytter en beholdning til en anden person: ud af den gamle ejers
    `holdings`, ind i den nyes. Beholdningen selv rører sig ikke. */
export function withHoldingOwner(plan: Plan, holdingId: string, newOwnerId: string): Plan {
  const holding = findHolding(plan, holdingId)
  if (!holding) return plan

  return {
    ...plan,
    household: {
      persons: plan.household.persons.map((person) =>
        person.id === newOwnerId
          ? { ...person, holdings: [...person.holdings, holding] }
          : { ...person, holdings: person.holdings.filter((h) => h.id !== holdingId) },
      ),
    },
  }
}

export function findEntry(plan: Plan, id: string): Entry | undefined {
  return plan.entries.find((entry) => entry.id === id)
}

/** Læser et tal, brugeren har tastet. Tusindtalspunktummer tåles, og komma
    er decimaltegn — det er sådan, tal skrives på dansk. */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/\s|\.(?=\d{3}\b)/g, '').replace(',', '.')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}

/** Skifter en posts retning. En indtægtspost bærer en skattebehandling, en
    udgiftspost har ikke feltet — så retningsskiftet bygger en ny post frem
    for at sætte et felt. Behandlingen huskes ikke hen over en tur forbi
    udgift: den findes ikke at huske på. */
export function withDirection(entry: Entry, direction: Direction): Entry {
  const { id, name, amountInRealKroner, owner, timing, period, recurrence, regulationRate } =
    entry

  if (direction === 'Expense') {
    return {
      id,
      name,
      amountInRealKroner,
      owner,
      timing,
      period,
      recurrence,
      regulationRate,
      direction: 'Expense',
    }
  }
  return {
    id,
    name,
    amountInRealKroner,
    owner,
    timing,
    period,
    recurrence,
    regulationRate,
    direction: 'Income',
    taxTreatment: entry.direction === 'Income' ? entry.taxTreatment : 'EarnedIncome',
  }
}
