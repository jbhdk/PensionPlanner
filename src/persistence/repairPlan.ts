import { periodBounds, yearAtAge } from '../engine/age'
import { boundValue, periodEndpointBounds } from '../engine/validatePlan'
import type { Bound, Bounds } from '../engine/validatePlan'
import type { Period, Person, Plan, SimulationYear, Transfer } from '../engine/plan'

/** Klemmer en indlæst plans periodeendepunkter ind i de grænser, fladen selv
    ville have klemt dem til — og siger, hvad der blev rettet.

    Trinnet ligger mellem `runMigrations` og `validatePlan`, jf. ADR-0045.
    Uden det ville en plan, der allerede ligger i localStorage fra før
    klemningen kom til fladen, give fejlskærmen ved næste indlæsning, uden at
    brugeren havde rørt noget.

    Det er ikke et led i migrationskæden. En importeret fil kan komme fra hvor
    som helst og bære tilstanden på den nuværende skemaversion, hvor en
    migration kun ville fange planer gemt før sit eget nummer —
    skemaversionen røres derfor ikke.

    Grænserne er `periodEndpointBounds`, de samme, håndtaget og feltet slår
    op i. Det er hele grunden til, at den funktion findes: hver regel, der
    siden lægges dér, bliver både klemt ved fladen og repareret her, uden at
    dette trin skal røres igen.

    Hvervet er klemning og intet andet. En plan, hvis pegere ikke rammer,
    repareres ikke — `periodEndpointBounds` har ingen grænse at svare med, og
    `validatePlan` afviser den bagefter som før. */
export function repairPlan(plan: Plan): { plan: Plan; repairs: string[] } {
  const repairs: string[] = []
  const transfers = plan.transfers.map((transfer) => {
    let repaired = transfer
    // Det andet endepunkt måles mod det første, som det blev, og ikke som
    // det stod: en regel om en omvendt periode ville ellers klemme `to` op
    // mod et `from`, reparationen lige havde flyttet væk fra.
    for (const endpoint of ['from', 'to'] as const) {
      const step = repairedEndpoint(plan, repaired, endpoint)
      if (step === undefined) continue
      repaired = step.transfer
      repairs.push(step.repair)
    }
    return repaired
  })
  return { plan: { ...plan, transfers }, repairs }
}

/** Det ene endepunkt klemt — eller intet, hvis det lå inden for sine
    grænser. Sammenligningen sker i kalenderår, ganske som i `openDoorFor`:
    grænsen står i endepunktets egen enhed, og det gør endepunktet også, men
    et endepunkt kan være åbent eller følge erhvervsophøret, og hverken det
    ene eller det andet er et tal, der kan holdes op mod en alder. */
function repairedEndpoint(
  plan: Plan,
  transfer: Transfer,
  endpoint: 'from' | 'to',
): { transfer: Transfer; repair: string } | undefined {
  const bounds = periodEndpointBounds(plan, transfer, endpoint)
  if (bounds.min === undefined && bounds.max === undefined) return undefined

  const owner = ownerOf(plan, transfer.from)
  if (owner === undefined) return undefined
  const year = standingYear(plan, transfer.period, endpoint, owner)
  if (year === undefined) return undefined

  const broken = brokenBound(bounds, year, (bound) => inYears(transfer.period, owner, bound))
  if (broken === undefined) return undefined

  const value = boundValue(broken)
  return {
    transfer: {
      ...transfer,
      period: { ...transfer.period, [endpoint]: value } as Period,
    },
    repair: repairSentence(transfer, endpoint, value, broken),
  }
}

/** Den af de to grænser, endepunktet ligger uden for — målt i kalenderår i
    begge ender, så en alder og et årstal ikke sammenlignes med hinanden. */
function brokenBound(
  bounds: Bounds,
  year: SimulationYear,
  asYear: (value: number) => SimulationYear,
): Bound | undefined {
  if (bounds.min !== undefined && year < asYear(boundValue(bounds.min))) return bounds.min
  if (bounds.max !== undefined && year > asYear(boundValue(bounds.max))) return bounds.max
  return undefined
}

/** Det år, endepunktet står på nu. Et åbent `from` betyder planens start,
    ganske som i `transferEnds`.

    Et åbent `to` betyder horisontens slut, og det år svares der ikke på her:
    ingen grænse har endnu haft brug for at måle mod det, og en horisont
    gættet i forbifarten ville være et tal, ingen regel havde bedt om. Den
    dag en gør, er det her, den skal svares. */
function standingYear(
  plan: Plan,
  period: Period,
  endpoint: 'from' | 'to',
  owner: Person,
): SimulationYear | undefined {
  const resolved = periodBounds(period, owner)[endpoint]
  if (resolved !== undefined) return resolved
  return endpoint === 'from' ? plan.startYear : undefined
}

/** En grænses tal oversat til kalenderår. Grænsen står i endepunktets egen
    enhed og er altid et tal — en fast alder eller et årstal, aldrig et
    flueben — og de to roller læser den ens, jf. `periodBounds`. */
function inYears(period: Period, owner: Person, value: number): SimulationYear {
  return period.anchor === 'CalendarYear' ? value : yearAtAge(owner, value)
}

/** Sætningen om den ene rettelse: figuren ved det navn, planen giver den,
    hvad endepunktet stod på, og hvad det blev rettet til — efterfulgt af
    grænsens egen begrundelse, hvor den bærer en.

    Begrundelsen genbruges frem for at blive skrevet om. Feltet, håndtaget og
    indlæsningen møder den samme væg og skal ikke kunne komme til at sige
    hver sit om den, jf. `Bound`. */
function repairSentence(
  transfer: Transfer,
  endpoint: 'from' | 'to',
  value: number,
  bound: Bound,
): string {
  const sentence =
    `Overførslen ${transfer.name} ${stoodAt(transfer.period, endpoint)} ` +
    `og er rettet til ${inUnit(transfer.period, value)}.`
  return typeof bound === 'number' ? sentence : `${sentence} ${bound.reason}`
}

/** Det, endepunktet stod på, som brugeren læste det i skuffen — verbet med,
    fordi et flueben ikke begynder noget, det følger noget. Forholdsordet
    følger forankringen: man begynder *i* et år og *ved* en alder. */
function stoodAt(period: Period, endpoint: 'from' | 'to'): string {
  const standing = period[endpoint]
  if (standing === 'WorkEndAge') return 'fulgte erhvervsophøret'
  const verb = endpoint === 'from' ? 'begyndte' : 'sluttede'
  // Et udeladt endepunkt er ikke et tal, men det, brugeren så i skuffen: et
  // tomt felt, der betyder "fra planens start" henholdsvis "til horisontens
  // slut", jf. `Period`.
  if (standing === undefined) {
    return `${verb} ved ${endpoint === 'from' ? 'planens start' : 'horisontens slut'}`
  }
  const preposition = period.anchor === 'CalendarYear' ? 'i' : 'ved'
  return `${verb} ${preposition} ${inUnit(period, standing)}`
}

/** Et tal i periodens egen enhed: et årstal ved kalenderårsforankring, en
    alder ved aldersforankring. Enheden skal med — 67 er både et årstal og en
    alder, og en besked, der ikke sagde hvilken, ville lade brugeren gætte. */
function inUnit(period: Period, value: number): string {
  const written = danishNumber(value)
  return period.anchor === 'CalendarYear' ? written : `alder ${written}`
}

function danishNumber(value: number): string {
  return String(value).replace('.', ',')
}

/** Ejeren af den beholdning, overførslen henter fra. Alderen i en
    aldersforankret periode måles på hende — en beholdning har præcis én, jf.
    `Transfer`. */
function ownerOf(plan: Plan, holdingId: string): Person | undefined {
  return plan.household.persons.find((person) =>
    person.holdings.some((holding) => holding.id === holdingId),
  )
}
