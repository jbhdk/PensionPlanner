import { isFreeAssets } from '../engine/holdingVariant'
import type {
  Contribution,
  Direction,
  Entry,
  Holding,
  Person,
  Plan,
  Transfer,
} from '../engine/plan'

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
          municipality: 'Hvidovre',
          churchMember: true,
          holdings: [],
        },
      ],
    },
  }
}

/** Fjerner personen, dennes beholdninger med (de er nestet under personen),
    posterne der peger på personen som ejer, og overførslerne der peger på
    personens beholdninger, og indbetalingerne i begge ender — ellers ville
    motoren støde på en peger, der ikke rammer noget, jf. ADR-0013. Var personens beholdning bufferen, arver den
    første tilbageværende beholdning rollen, så planen forbliver regnbar. */
export function removePerson(plan: Plan, id: string): Plan {
  const persons = plan.household.persons.filter((person) => person.id !== id)
  const buffer = inheritedBuffer(plan, persons)

  const gone = new Set(
    (plan.household.persons.find((person) => person.id === id)?.holdings ?? []).map(
      (holding) => holding.id,
    ),
  )
  const goneEntries = new Set(
    plan.entries.filter((entry) => entry.owner === id).map((entry) => entry.id),
  )

  return {
    ...plan,
    buffer,
    household: { persons },
    entries: plan.entries.filter((entry) => entry.owner !== id),
    transfers: plan.transfers.filter(
      (transfer) => !gone.has(transfer.from) && !gone.has(transfer.to),
    ),
    contributions: plan.contributions.filter(
      (contribution) =>
        !gone.has(contribution.to) && !goneEntries.has(contribution.source),
    ),
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

/** Den tyndeste beholdning, der kan tilføjes: nul saldo og nul afkast, så den
    ikke lover en investeringsantagelse, brugeren ikke har tastet. Lander hos
    husstandens første person — "Ejer"-vælgeren i skuffen flytter den siden. */
export function addHolding(plan: Plan): Plan {
  const owner = plan.household.persons[0]
  if (!owner) return plan

  const count = plan.household.persons.flatMap((person) => person.holdings).length
  const holding: Holding = {
    id: freshHoldingId(plan),
    name: `Beholdning ${count + 1}`,
    variant: 'SavingsAccount',
    balance: 0,
    grossReturn: 0,
    annualCostRate: 0,
  }

  return withPerson(plan, owner.id, (person) => ({
    ...person,
    holdings: [...person.holdings, holding],
  }))
}

/** Fjerner beholdningen, overførslerne der peger på den (en overførsel uden
    begge ender ville flytte penge fra eller til et ingenting), og
    indbetalingerne der havde den som destination. Var
    beholdningen bufferen, arver den første tilbageværende beholdning rollen,
    ligesom ved `removePerson` — findes ingen, peger bufferen videre på et
    tomrum, og resultatspalten viser det som en simuleringsfejl frem for at
    styrte. */
export function removeHolding(plan: Plan, id: string): Plan {
  const persons = plan.household.persons.map((person) => ({
    ...person,
    holdings: person.holdings.filter((holding) => holding.id !== id),
  }))
  const buffer = inheritedBuffer(plan, persons)

  return {
    ...plan,
    buffer,
    household: { persons },
    transfers: plan.transfers.filter((transfer) => transfer.from !== id && transfer.to !== id),
    contributions: plan.contributions.filter((contribution) => contribution.to !== id),
  }
}

/** Bufferpegeren efter en sletning: den samme, hvis beholdningen stadig
    findes, ellers de første tilbageværende frie midler. En pensionsbeholdning
    kan ikke arve rollen — bufferen bærer årets restpost, og penge ind i en
    ordning er en indbetaling, jf. ADR-0016. Findes ingen frie midler, peger
    bufferen videre på et tomrum, og resultatspalten viser det som en
    simuleringsfejl frem for at styrte. */
function inheritedBuffer(plan: Plan, persons: Person[]): string {
  const remaining = persons.flatMap((person) => person.holdings)
  if (remaining.some((holding) => holding.id === plan.buffer)) return plan.buffer
  return remaining.find(isFreeAssets)?.id ?? plan.buffer
}

function freshHoldingId(plan: Plan): string {
  const existing = new Set(
    plan.household.persons.flatMap((person) => person.holdings.map((holding) => holding.id)),
  )
  let n = 1
  while (existing.has(`holding-${n}`)) n++
  return `holding-${n}`
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

/** Den tyndeste post, der kan tilføjes: nul beløb, hele horisonten, hvert år,
    hos husstandens første person. En indtægt får skattebehandlingen
    lønindkomst; en udgift har ikke feltet, jf. `Direction` i domænemodellen. */
export function addEntry(plan: Plan, direction: Direction): Plan {
  const owner = plan.household.persons[0]
  if (!owner) return plan

  const count = plan.entries.filter((entry) => entry.direction === direction).length
  const base = {
    id: freshEntryId(plan),
    name: direction === 'Income' ? `Indtægt ${count + 1}` : `Udgift ${count + 1}`,
    amountInRealKroner: 0,
    owner: owner.id,
    timing: 'Even' as const,
    period: { anchor: 'CalendarYear' as const },
    recurrence: { kind: 'Annual' as const },
  }
  const entry: Entry =
    direction === 'Income'
      ? { ...base, direction: 'Income', taxTreatment: 'EarnedIncome', regulationRate: 0 }
      : { ...base, direction: 'Expense' }

  return { ...plan, entries: [...plan.entries, entry] }
}

function freshEntryId(plan: Plan): string {
  const existing = new Set(plan.entries.map((entry) => entry.id))
  let n = 1
  while (existing.has(`entry-${n}`)) n++
  return `entry-${n}`
}

export function findEntry(plan: Plan, id: string): Entry | undefined {
  return plan.entries.find((entry) => entry.id === id)
}

/** Fjerner posten og indbetalingerne, der havde den som kilde. Et lønkildet
    bidrag uden sin post ville ikke bare udeblive — planen kunne slet ikke
    regnes, og resultatspalten ville gå i stå, jf. ADR-0013. */
export function removeEntry(plan: Plan, id: string): Plan {
  return {
    ...plan,
    entries: plan.entries.filter((entry) => entry.id !== id),
    contributions: plan.contributions.filter((contribution) => contribution.source !== id),
  }
}

export function findTransfer(plan: Plan, id: string): Transfer | undefined {
  return plan.transfers.find((transfer) => transfer.id === id)
}

export function removeTransfer(plan: Plan, id: string): Plan {
  return { ...plan, transfers: plan.transfers.filter((transfer) => transfer.id !== id) }
}

export function withTransfer(
  plan: Plan,
  id: string,
  change: (transfer: Transfer) => Transfer,
): Plan {
  return {
    ...plan,
    transfers: plan.transfers.map((transfer) =>
      transfer.id === id ? change(transfer) : transfer,
    ),
  }
}

/** Den tyndeste overførsel, der kan tilføjes: fra og til de to første
    beholdninger, hele horisonten, hvert år. Brugeren retter dem i skuffen
    bagefter. Kræver to beholdninger at flytte penge mellem — knappen der
    kalder den, er selv skjult ellers. */
export function addTransfer(plan: Plan): Plan {
  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  if (holdings.length < 2) return plan

  return {
    ...plan,
    transfers: [
      ...plan.transfers,
      {
        id: freshTransferId(plan),
        from: holdings[0]!.id,
        to: holdings[1]!.id,
        amountInRealKroner: 0,
        timing: 'Even',
        period: {},
        recurrence: { kind: 'Annual' },
      },
    ],
  }
}

function freshTransferId(plan: Plan): string {
  const existing = new Set(plan.transfers.map((transfer) => transfer.id))
  let n = 1
  while (existing.has(`transfer-${n}`)) n++
  return `transfer-${n}`
}

/** Læser et tal, brugeren har tastet. Tusindtalspunktummer tåles, og komma
    er decimaltegn — det er sådan, tal skrives på dansk. */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/\s|\.(?=\d{3}\b)/g, '').replace(',', '.')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}

/** Skriver et tal, som brugeren ville have tastet det: komma som decimaltegn.
    Den nøjagtige modsatte vej af `parseNumber` — `parseNumber(formatNumber(x))`
    er `x` — og det er den egenskab, talfeltet hviler på, når det afgør, om en
    værdi er kommet udefra eller fra tastaturet. Uden tusindtalsseparator:
    feltet skal kunne redigeres, ikke kun læses. */
export function formatNumber(value: number): string {
  return String(value).replace('.', ',')
}

/** Skifter en posts retning. En indtægtspost bærer en skattebehandling og en
    egen reguleringssats, en udgiftspost har ingen af felterne — så
    retningsskiftet bygger en ny post frem for at sætte et felt. Hverken
    behandlingen eller satsen huskes hen over en tur forbi udgift: de findes
    ikke at huske på, og udgiften følger imens planens inflationsantagelse. */
export function withDirection(entry: Entry, direction: Direction): Entry {
  const { id, name, amountInRealKroner, owner, timing, period, recurrence } = entry

  if (direction === 'Expense') {
    return {
      id,
      name,
      amountInRealKroner,
      owner,
      timing,
      period,
      recurrence,
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
    direction: 'Income',
    taxTreatment: entry.direction === 'Income' ? entry.taxTreatment : 'EarnedIncome',
    regulationRate: entry.direction === 'Income' ? entry.regulationRate : 0,
  }
}

/** Den tyndeste indbetaling, der kan tilføjes: nul kroner eller nul procent,
    fra den første lovlige kilde til den første af ejerens ordninger. Kilde og
    destination skal tilhøre samme person, og destinationen må ikke være frie
    midler, jf. ADR-0016 — findes intet sådant par, er der ingenting at
    tilføje, og knappen der kalder her, er selv skjult.

    Er kilden en lønpost, er formen procent frem for et fast beløb: det er
    den, der følger lønnen op af sig selv, og den brugeren skal skulle vælge
    sig væk fra. Et beholdningskildet bidrag har ingen post at måle en procent
    af og kan kun være et kronebeløb. */
export function addContribution(plan: Plan): Plan {
  const pair = firstContributionPair(plan)
  if (!pair) return plan

  const id = freshContributionId(plan)
  return {
    ...plan,
    contributions: [
      ...plan.contributions,
      pair.kind === 'EntrySourced'
        ? { id, kind: pair.kind, source: pair.source, to: pair.to, percentageOfEntry: 0 }
        : {
            id,
            kind: pair.kind,
            source: pair.source,
            to: pair.to,
            amountInRealKroner: 0,
            timing: 'Even',
            period: { anchor: 'CalendarYear' },
            recurrence: { kind: 'Annual' },
          },
    ],
  }
}

/** Det første lovlige par af kilde og ordning — og dermed også svaret på, om
    en indbetaling overhovedet kan tilføjes.

    Lønposten kommer først: de fleste bidrag er en procent af en løn. Har
    husstanden ingen indtægtspost, er der stadig en indbetaling at skrive fra
    de frie midler — det er hele grunden til, at den beholdningskildede form
    findes, og var knappen skjult her, kunne aldersopsparingens vindue efter
    erhvervsophør ikke tastes. */
export function firstContributionPair(
  plan: Plan,
): { kind: Contribution['kind']; source: string; to: string } | undefined {
  for (const entry of plan.entries) {
    if (entry.direction !== 'Income') continue
    const owner = plan.household.persons.find((person) => person.id === entry.owner)
    const to = (owner?.holdings ?? []).find((holding) => !isFreeAssets(holding))
    if (to) return { kind: 'EntrySourced', source: entry.id, to: to.id }
  }
  for (const person of plan.household.persons) {
    const source = person.holdings.find(isFreeAssets)
    const to = person.holdings.find((holding) => !isFreeAssets(holding))
    if (source && to) return { kind: 'HoldingSourced', source: source.id, to: to.id }
  }
  return undefined
}

function freshContributionId(plan: Plan): string {
  const existing = new Set(plan.contributions.map((contribution) => contribution.id))
  let n = 1
  while (existing.has(`contribution-${n}`)) n++
  return `contribution-${n}`
}

export function findContribution(plan: Plan, id: string): Contribution | undefined {
  return plan.contributions.find((contribution) => contribution.id === id)
}

export function withContribution(
  plan: Plan,
  id: string,
  change: (contribution: Contribution) => Contribution,
): Plan {
  return {
    ...plan,
    contributions: plan.contributions.map((contribution) =>
      contribution.id === id ? change(contribution) : contribution,
    ),
  }
}

export function removeContribution(plan: Plan, id: string): Plan {
  return {
    ...plan,
    contributions: plan.contributions.filter((contribution) => contribution.id !== id),
  }
}
