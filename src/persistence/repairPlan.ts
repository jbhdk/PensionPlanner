import { periodBounds, yearAtAge } from '../engine/age'
import { boundValue, figureSubject, periodEndpointBounds, periodOwner } from '../engine/validatePlan'
import type { Bound, Bounds, PeriodicFigure } from '../engine/validatePlan'
import type { Period, Person, Plan, SimulationYear } from '../engine/plan'

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
  const repaired = <T extends PeriodicFigure>(figure: T): T => {
    let stepped = figure
    // Det andet endepunkt måles mod det første, som det blev, og ikke som
    // det stod: reglen om den omvendte periode ville ellers klemme `to` op
    // mod et `from`, reparationen lige havde flyttet væk fra.
    for (const endpoint of ['from', 'to'] as const) {
      const step = repairedEndpoint(plan, stepped, endpoint)
      if (step === undefined) continue
      stepped = step.figure
      repairs.push(step.repair)
    }
    return stepped
  }

  return {
    plan: {
      ...plan,
      entries: plan.entries.map(repaired),
      transfers: plan.transfers.map(repaired),
      // Den lønkildede indbetaling har ingen periode at reparere — den arver
      // lønpostens, og posten er allerede gået igennem ovenfor.
      contributions: plan.contributions.map((contribution) =>
        contribution.kind === 'HoldingSourced' ? repaired(contribution) : contribution,
      ),
    },
    repairs,
  }
}

/** Det ene endepunkt klemt — eller intet, hvis det lå inden for sine
    grænser. Sammenligningen sker i kalenderår, ganske som i `openDoorFor`:
    grænsen står i endepunktets egen enhed, og det gør endepunktet også, men
    et endepunkt kan være åbent eller følge erhvervsophøret, og hverken det
    ene eller det andet er et tal, der kan holdes op mod en alder. */
function repairedEndpoint<T extends PeriodicFigure>(
  plan: Plan,
  figure: T,
  endpoint: 'from' | 'to',
): { figure: T; repair: string } | undefined {
  const bounds = periodEndpointBounds(plan, figure, endpoint)
  if (bounds.min === undefined && bounds.max === undefined) return undefined

  // Står endepunktet tomt, og siger grænsen selv, at tomt er et svar, er der
  // intet at reparere: "fra planens start" er en betydning og ikke en værdi,
  // en væg kan klemme, jf. `mayBeEmpty`. Kun ordningens dør gør tomt til et
  // ikke-svar — dér ville overførslen hente, før den må.
  if (figure.period[endpoint] === undefined && bounds.mayBeEmpty) return undefined

  const owner = periodOwner(plan, figure)
  if (owner === undefined) return undefined
  const year = standingYear(plan, figure.period, endpoint, owner)
  if (year === undefined) return undefined

  const broken = brokenBound(bounds, year, (bound) => inYears(figure.period, owner, bound))
  if (broken === undefined) return undefined

  const value = boundValue(broken)
  return {
    figure: {
      ...figure,
      period: { ...figure.period, [endpoint]: value } as Period,
    },
    repair: repairSentence(figure, endpoint, value, broken),
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
  const resolved = periodBounds(period, owner, plan.household)[endpoint]
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
  figure: PeriodicFigure,
  endpoint: 'from' | 'to',
  value: number,
  bound: Bound,
): string {
  const sentence =
    `${figureSubject(figure)} ${stoodAt(figure.period, endpoint)} ` +
    `og er rettet til ${inUnit(figure.period, value)}.`
  return typeof bound === 'number' ? sentence : `${sentence} ${bound.reason}`
}

/** Det, endepunktet stod på, som brugeren læste det i skuffen — verbet med,
    fordi et flueben ikke begynder noget, det følger noget. Forholdsordet
    følger forankringen: man begynder *i* et år og *ved* en alder. */
function stoodAt(period: Period, endpoint: 'from' | 'to'): string {
  const standing = period[endpoint]
  if (typeof standing === 'object') return 'fulgte erhvervsophøret'
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

/** Fastfryser en anden figurs "Følger erhvervsophør" til et fast alderstal,
    når den fulgte person er ved at blive fjernet. Kaldes af `removePerson`,
    på planen som den endnu står — før personen selv forsvinder fra
    husstanden. Bagefter er oplysningen tabt: `periodBounds` kan ikke længere
    slå hendes fødselsår og erhvervsophørsalder op, og referencen ville
    hænge i luften uden at kunne repareres, jf. #86.

    Kun "følger"-formen rammes — et fast alderstal, der selv navngiver
    personen (`{ person, age }`, jf. ADR-0051), er ikke en autopilot, der kan
    fastfryses på samme måde, og efterlades til `validatePlan`s afvisning.

    Tallet fastfryses til den alder, figurens egen `periodOwner` (den
    strukturelt udledte ejer) ville have haft i det kalenderår, endepunktet
    rammer nu — ikke til en reference, der fremover følger `periodOwner`. Det
    ville genindføre netop den autopilot, ADR-0050 lukkede. */
export function repairFollowedPersonRemoval(plan: Plan, removedId: string): Plan {
  const frozen = <T extends PeriodicFigure>(figure: T): T => {
    let stepped = figure
    for (const endpoint of ['from', 'to'] as const) {
      stepped = frozenEndpoint(plan, stepped, endpoint, removedId) ?? stepped
    }
    return stepped
  }

  return {
    ...plan,
    entries: plan.entries.map(frozen),
    transfers: plan.transfers.map(frozen),
    contributions: plan.contributions.map((contribution) =>
      contribution.kind === 'HoldingSourced' ? frozen(contribution) : contribution,
    ),
  }
}

/** Det ene endepunkt fastfrosset — eller intet, hvis det ikke følger den
    person, der fjernes. */
function frozenEndpoint<T extends PeriodicFigure>(
  plan: Plan,
  figure: T,
  endpoint: 'from' | 'to',
  removedId: string,
): T | undefined {
  const period = figure.period
  if (period.anchor !== 'PersonAge') return undefined
  const bound = period[endpoint]
  if (typeof bound !== 'object' || 'age' in bound || bound.person !== removedId) return undefined

  const owner = periodOwner(plan, figure)
  if (owner === undefined) return undefined
  const year = periodBounds(period, owner, plan.household)[endpoint]
  if (year === undefined) return undefined

  return {
    ...figure,
    period: { ...period, [endpoint]: year - owner.birthYear } as Period,
  }
}

