import type { Nominal } from '../plan'
import type { CivilStatus, RateYear, Taper } from '../rates/rateYear'
import { assessTax, totalTax } from './assessTax'
import type {
  LayerAmount,
  MarginalTaxRates,
  TaxAssessment,
  TaxAssessmentInput,
} from './assessTax'

/** Aktieindkomstskattens to lag. Ikke et `TaxLayer`: de lag er en persons, og
    aktieindkomstens skat er husstandens. Sidestykket til `CapitalIncomeLayer`,
    som ligger ved siden af `TaxLayer` af nøjagtig samme grund.

    Navnene er satsnøglerne i satsåret, så laget kan slå sin egen sats op
    med `rates.taxRates[layer]` — samme idiom som `progression`. */
export type ShareIncomeLayer = 'shareIncomeBelowThreshold' | 'shareIncomeAboveThreshold'

const shareIncomeLayers: readonly ShareIncomeLayer[] = [
  'shareIncomeBelowThreshold',
  'shareIncomeAboveThreshold',
]

/** Det, husstandens skat for ét år skal regnes af: hver persons eget
    skattegrundlag, parret med årets aktieindkomst af netop den persons
    beholdninger. Aktieindkomsten står ved siden af `tax` frem for inden i
    den, fordi den personlige opgørelse ikke bruger den — aktieindkomstens
    skat er husstandens, ikke personens, jf. ADR-0010. */
export type HouseholdTaxInput = {
  persons: {
    /** Personens eget skattegrundlag, hvor `pensionIncome` er egne rater,
        livrenteydelser og ATP **uden** folkepensionen. Folkepensionen lægges
        til herinde, efter aftrapningen — den indgår ikke i sit eget
        aftrapningsgrundlag, jf. PL § 29, stk. 4, nr. 1, og et input, der bar
        den, kunne ikke skilles ad igen. */
    tax: TaxAssessmentInput
    shareIncome: Nominal
    /** Personens civilstand i året, når hun har nået sin folkepensionsalder;
        fraværende i årene før. Civilstanden og intet andet: alle fire tal på
        `Taper`-rækken — ydelsen, fradragsbeløbet, procenten og bortseelsen —
        hentes så ét sted og samtidig, og 32 % kan ikke komme til at blive
        parret med 0 % bortseelse. */
    statePension?: { civilStatus: CivilStatus }
  }[]
}

/** Aftrapningsgrundlagets bestanddele for én person. Aldrig ét tal: summen
    udledes af de fire med `totalTaperBase`, af samme grund som `totalTax`
    ikke er et felt — og forklar-året skal kunne vise, hvilken indkomst der
    kostede tillæg, og ikke kun hvor meget.

    Arbejdsindkomst står ikke her, hverken egen eller ægtefællens, og heller
    ikke udbetalinger fra en aldersopsparing eller afkast på en
    aktiesparekonto. Ingen af dem indgår, jf. PL § 29. */
export type TaperBase = {
  /** Egne rater, livrenteydelser og ATP — pensionsindkomsten uden
      folkepensionen selv. */
  pensionIncome: Nominal
  /** Kun den positive: en negativ nettokapitalindkomst lemper ikke
      grundlaget. */
  capitalIncome: Nominal
  shareIncome: Nominal
  /** Ægtefællens egen indkomst efter bortseelsen. Nul i en husstand med én
      person. */
  spouse: Nominal
}

/** Folkepensionens to beløb for ét år, med den aftrapning, tillægget kom
    igennem.

    `pensionSupplement` er det aftrappede — det, der udbetales og beskattes.
    Aftrapningsbeløbet er ikke et felt: det er `taper.fullSupplement` minus
    det, og de to står allerede på linjen, ganske som `CapYear`s råderum er
    de to mellemste trukket fra hinanden. */
export type StatePensionYear = {
  /** Fladt: aftrapningen efter egen arbejdsindkomst blev afskaffet med
      virkning fra 2023, og hverken arbejdsindkomst eller anden indkomst
      reducerer det. */
  basicAmount: Nominal
  pensionSupplement: Nominal
  /** Hele regnestykket bag tillægget, så linjen kan efterregnes i hånden —
      samme grund som `LayerAmount`s tre tal. */
  taper: {
    /** Tillægget for civilstanden, før aftrapningen skar i det. Kan ikke
        udledes af de øvrige, når aftrapningen har ramt bunden. */
    fullSupplement: Nominal
    base: TaperBase
    /** Fradragsbeløbet: grundlaget aftrapper først over dette. */
    allowance: Nominal
    rate: number
    /** Den andel af ægtefællens indkomst, der blev set bort fra. Står med,
        fordi `base.spouse` er efter bortseelsen: uden satsen kan den ene linje
        ikke føres tilbage til ægtefællens egen indkomst i hånden. Nul i en
        husstand med én person og i et år, hvor ægtefællen selv er
        pensionist. */
    spouseDisregard: number
  }
}

/** Summen af aftrapningsgrundlagets bestanddele. Ikke et felt, jf.
    `TaperBase`. */
export function totalTaperBase(base: TaperBase): Nominal {
  return totalOwnIncome(base) + base.spouse
}

/** Én person, som husstandssømmet ser hende. */
type Person = HouseholdTaxInput['persons'][number]

/** Husstandens samlede skat for ét simuleringsår. Totalen er ikke et felt:
    se `totalHouseholdTax`, af samme grund som `totalTax`. */
export type HouseholdTaxAssessment = {
  persons: {
    tax: TaxAssessment
    marginal: MarginalTaxRates
    /** Folkepensionen, når personen har nået sin folkepensionsalder.
        Fraværende i årene før — feltet siger dermed selv, om personen var
        folkepensionist i året. */
    statePension?: StatePensionYear
  }[]
  /** Aktieindkomstens skat, opgjort for husstanden under ét. */
  shareIncomeTax: Partial<Record<ShareIncomeLayer, LayerAmount>>
}

/** Skatteopgørelsen for ét simuleringsår og én husstand. */
export function assessHousehold(
  input: HouseholdTaxInput,
  rates: RateYear,
): HouseholdTaxAssessment {
  const assessed = assess(input, rates)

  return {
    ...assessed,
    persons: assessed.persons.map((person, index) => ({
      ...person,
      marginal: marginalTaxRates(input, index, rates),
    })),
  }
}

/** Opgørelsen uden marginalsatserne. Den står for sig, fordi satserne måles
    ved at regne netop den om med én krone mere — og en opgørelse, der bar
    sine egne marginalsatser, ville skulle regne sig selv om i ring. */
type HouseholdAssessment = {
  persons: { tax: TaxAssessment; statePension?: StatePensionYear }[]
  shareIncomeTax: Partial<Record<ShareIncomeLayer, LayerAmount>>
}

function assess(input: HouseholdTaxInput, rates: RateYear): HouseholdAssessment {
  return {
    persons: input.persons.map((person) => {
      // Aftrapningen først: det aftrappede tillæg — ikke det fulde — er dét,
      // der er skattepligtigt, jf. diagram 02.
      const statePension = taperedStatePension(person, input.persons, rates)
      const tax = withStatePension(person.tax, statePension)

      return {
        tax: assessTax(tax, rates),
        ...(statePension ? { statePension } : {}),
      }
    }),
    shareIncomeTax: shareIncomeTax(input.persons, rates),
  }
}

/** Personens to marginalsatser, én pr. indkomstart, hver målt ved at regne
    hele husstandens opgørelse om med én krone mere af sin egen art og tage
    differencen — aldrig udledt analytisk af satserne, så de ikke kan komme
    til at sige noget andet end selve opgørelsen ville.

    Det, der måles, er husstandens **byrde** og ikke dens skat alene. En krone
    pensionsindkomst mere koster både sin egen skat og det pensionstillæg, den
    aftrapper væk, og et mistet tillæg er ingen skat. Regnet på skatten alene
    ville satsen sige 47 % om et valg, der koster 57.

    Byrden er husstandens og ikke personens, jf. ADR-0025: uden bortseelse
    indgår den ene persons krone fuldt ud i den andens aftrapningsgrundlag,
    og de to tillæg falder da begge. Det er netop derfor, procenten halveres
    fra 32 til 16, når ægtefællen selv bliver pensionist — kronen tælles to
    gange i stedet for én — og en sats, der kun så personens eget tillæg,
    ville tabe den halvdel, der lander i den andens navn.

    Arbejdsindkomsten rører ingen af tillæggene: den står uden for
    aftrapningsgrundlaget, også ægtefællens. Dens sats er derfor den samme,
    hvad enten den måles på byrden eller på skatten alene. */
function marginalTaxRates(
  input: HouseholdTaxInput,
  index: number,
  rates: RateYear,
): MarginalTaxRates {
  const at = burden(assess(input, rates))
  const withOneMore = (of: Partial<TaxAssessmentInput>) => {
    const person = input.persons[index]!
    const persons = input.persons.map((other, at) =>
      at === index ? { ...person, tax: { ...person.tax, ...of } } : other,
    )
    return burden(assess({ ...input, persons }, rates)) - at
  }

  const { tax } = input.persons[index]!
  return {
    earnedIncome: withOneMore({ earnedIncome: tax.earnedIncome + 1 }),
    pensionIncome: withOneMore({ pensionIncome: (tax.pensionIncome ?? 0) + 1 }),
  }
}

/** Husstandens byrde: al dens skat minus de ydelser, den får udefra, og som
    en indkomst kan skære i. Grundbeløbet er fladt og flytter sig ikke, men
    det står med alligevel — byrden er hele folkepensionen fratrukket, og et
    led, der udelades, fordi det tilfældigvis er konstant i dag, er et led,
    der bliver glemt den dag det ikke er. */
function burden(assessed: HouseholdAssessment): Nominal {
  const benefits = assessed.persons.reduce(
    (total, { statePension }) =>
      total +
      (statePension ? statePension.basicAmount + statePension.pensionSupplement : 0),
    0,
  )

  return totalHouseholdTax(assessed) - benefits
}

/** Personens folkepension med tillægget aftrappet, eller intet i årene før
    hendes folkepensionsalder.

    Grundlaget behøver ingen nye ingredienser: det er præcis den
    pensionsindkomst, der allerede krydser sømmet — uden folkepensionen —
    plus egen positiv kapitalindkomst og egen aktieindkomst, og det samme
    igen for ægtefællen, efter bortseelsen. */
function taperedStatePension(
  person: Person,
  persons: readonly Person[],
  rates: RateYear,
): StatePensionYear | undefined {
  if (!person.statePension) return undefined

  const taper = taperFor(person.statePension.civilStatus, rates)
  const base: TaperBase = {
    ...ownIncome(person),
    spouse: spouseIncome(person, persons, taper),
  }

  // Tillægget kan skæres helt væk, men aldrig til under nul: over
  // bortfaldsgrænsen er der ikke mere at tage af.
  const above = Math.max(0, totalTaperBase(base) - taper.allowance)
  const pensionSupplement = Math.max(0, taper.pensionSupplement - above * taper.rate)

  return {
    basicAmount: rates.statePension.basicAmount,
    pensionSupplement,
    taper: {
      fullSupplement: taper.pensionSupplement,
      base,
      allowance: taper.allowance,
      rate: taper.rate,
      spouseDisregard: taper.spouseDisregard,
    },
  }
}

/** Den ene persons egen indkomst i grundlaget. Ikke folkepensionen: den
    indgår ikke i sit eget indtægtsgrundlag, jf. PL § 29, stk. 4, nr. 1, og
    `tax.pensionIncome` krydser sømmet netop uden den. Det er dén regel, der
    gør husstandskoblingen til ét gennemløb frem for en fikspunktsiteration —
    den ene persons tillæg afhænger aldrig af den andens tillæg, kun af den
    andens øvrige indkomst.

    Arbejdsindkomsten står udenfor og er derfor ikke med. */
function ownIncome(person: Person): Omit<TaperBase, 'spouse'> {
  return {
    pensionIncome: person.tax.pensionIncome ?? 0,
    capitalIncome: Math.max(0, person.tax.capitalIncome ?? 0),
    shareIncome: person.shareIncome,
  }
}

/** Ægtefællens bidrag til grundlaget: hendes egen indkomst efter
    bortseelsen. Nul i en husstand med én person — der er ingen at se bort
    fra noget hos.

    Bortseelsen kommer fra den samme `Taper`-række som procenten, så de to
    ikke kan komme fra hver sin civilstand. Hendes arbejdsindkomst indgår
    slet ikke, og `ownIncome` er netop den sum, der lader den ude. */
function spouseIncome(person: Person, persons: readonly Person[], taper: Taper): Nominal {
  return persons
    .filter((other) => other !== person)
    .reduce((sum, other) => sum + totalOwnIncome(ownIncome(other)), 0) *
    (1 - taper.spouseDisregard)
}

/** Summen af de tre egne led. Ægtefællens andel står udenfor: den er
    resultatet af netop denne sum hos den anden. */
function totalOwnIncome(own: Omit<TaperBase, 'spouse'>): Nominal {
  return own.pensionIncome + own.capitalIncome + own.shareIncome
}

/** Folkepensionen lagt til den personlige indkomst. Begge beløb er
    `PensionIncome`: de bærer intet AM-bidrag og giver ingen af de to
    arbejdsfradrag. */
function withStatePension(
  tax: TaxAssessmentInput,
  statePension: StatePensionYear | undefined,
): TaxAssessmentInput {
  if (!statePension) return tax

  const pensionIncome =
    (tax.pensionIncome ?? 0) + statePension.basicAmount + statePension.pensionSupplement

  return { ...tax, pensionIncome }
}

/** Satsårets aftrapningsrække for civilstanden. Rækken er hel: ydelsen,
    fradragsbeløbet, procenten og bortseelsen hentes i ét opslag, så to af
    dem ikke kan komme fra hver sin civilstand. */
function taperFor(civilStatus: CivilStatus, rates: RateYear): Taper {
  return rates.statePension.taper.find((taper) => taper.civilStatus === civilStatus)!
}

/** Aktieindkomstens progressionsgrænse er fælles og overførbar mellem
    ægtefæller, så skatten regnes af husstandens samlede aktieindkomst mod
    husstandens samlede grænse — aldrig person for person, jf. ADR-0010 og
    docs/satser/2026.md. Summen lagres ikke; den findes kun her.

    Et lag er udeladt, når dets eget grundlag er nul, så en linje uden
    indhold ikke skal vises frem — som i `capitalIncomeLayers`. */
function shareIncomeTax(
  persons: HouseholdTaxInput['persons'],
  rates: RateYear,
): Partial<Record<ShareIncomeLayer, LayerAmount>> {
  const total = Math.max(
    0,
    persons.reduce((sum, { shareIncome }) => sum + shareIncome, 0),
  )
  const threshold = rates.thresholds.shareIncome * persons.length
  const bases: Record<ShareIncomeLayer, Nominal> = {
    shareIncomeBelowThreshold: Math.min(total, threshold),
    shareIncomeAboveThreshold: total - Math.min(total, threshold),
  }

  const layers: Partial<Record<ShareIncomeLayer, LayerAmount>> = {}
  for (const layer of shareIncomeLayers) {
    const base = bases[layer]
    if (base <= 0) continue
    const rate = rates.taxRates[layer]
    layers[layer] = { base, rate, amount: base * rate }
  }
  return layers
}

/** Summen af husstandens skat: hver persons egne lag, plus aktieindkomstens.
    Ikke et felt på opgørelsen, af samme grund som `totalTax` ikke er det —
    gemt ved siden af delene kunne den komme til at sige noget andet end dem,
    og et nyt led i en senere etape ville kunne blive glemt i summen. Det er
    netop den fejl, `simulate` lavede, da den lagde personskatten og
    aktieskatten sammen i hånden. */
export function totalHouseholdTax(assessment: HouseholdAssessment): Nominal {
  const fromPersons = assessment.persons.reduce((total, { tax }) => total + totalTax(tax), 0)
  const fromShareIncome = Object.values(assessment.shareIncomeTax).reduce(
    (total, layer) => total + layer.amount,
    0,
  )

  return fromPersons + fromShareIncome
}
