/** Ét kalenderår. Den mindste tidsenhed motoren regner i. */
export type SimulationYear = number

/** Beløb i det pågældende simuleringsårs egne kroner. Motoren regner i disse. */
export type Nominal = number

/** Beløb i startårets prisniveau. Alt brugeren taster, er i disse. */
export type Real = number

export type HoldingId = string
export type PersonId = string
export type TransferId = string
export type EntryId = string

/** Beskatningsformen er beholdningens akse. Etape 1 kender kun de to frie. */
export type HoldingVariant = 'ShareIncome' | 'CapitalIncome'

export type Holding = {
  id: HoldingId
  name: string
  variant: HoldingVariant
  /** Saldoen ved planens startår, hvor dagens kroner og løbende priser er ét. */
  balance: Real
  /** Andel pr. år, ikke procent: 0,07 er 7 %. Nettoafkastsatsen er
      bruttoafkast minus ÅOP og udledes, hvor den vises, jf. ADR-0003. */
  grossReturn: number
  annualCostRate: number
}

export type Person = {
  id: PersonId
  name: string
  birthYear: number
  birthMonth: number
  /** Det år personen holder op med at arbejde. En fri beslutning, ikke en
      lovbestemt alder — se `AgeBound`, som aldersforankrede perioder kan
      binde sig til. */
  workEndAge: number
  /** Overstyrer den udledte folkepensionsalder, når sat. Udeladt betyder
      "brug tabellen" — se `deriveStatePensionAge` og
      docs/satser/folkepensionsalder.md. */
  statePensionAgeOverride?: number
  /** Alderen simuleringen løber til og med. */
  horizon: number
  holdings: Holding[]
}

export type Household = {
  persons: Person[]
}

/** Om en post lægger til eller trækker fra husstandens pengestrøm. */
export type Direction = 'Income' | 'Expense'

/** Det skattemæssige spor en indtægtspost lander i. `EarnedIncome` er
    AM-pligtig og indgår i den personlige indkomst; `TaxFree` beskattes ikke. */
export type TaxTreatment = 'EarnedIncome' | 'TaxFree'

/** Hvornår inden for året en strøm falder. Oversættes til en vægt på årets
    afkast, aldrig til et tidsskridt: `'Even'` giver ½, måned N giver
    `(12 − N + 1) / 12`, jf. ADR-0006. */
export type Timing = 'Even' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/** Om en posts periode er bundet til kalenderår eller til en persons alder. */
export type Anchor = 'CalendarYear' | 'PersonAge'

/** Et periodeendepunkt for en aldersforankret post: enten en fast alder,
    eller en henvisning til personens erhvervsophør. Et endepunkt sat til
    `'WorkEndAge'` følger `Person.workEndAge`, så posten flytter sig, når
    erhvervsophørsalderen ændres, uden at posten selv redigeres. */
export type AgeBound = number | 'WorkEndAge'

/** Postens periode. Et udeladt endepunkt betyder "fra planens start"
    henholdsvis "til horisontens slut" — sådan skrives en post, der løber
    hele forløbet. Formen på `from`/`to` følger `anchor`. */
export type Period =
  | { anchor: 'CalendarYear'; from?: SimulationYear; to?: SimulationYear }
  | { anchor: 'PersonAge'; from?: AgeBound; to?: AgeBound }

/** Hvor ofte en post falder inden for sin periode. `n` findes kun ved
    `EveryNYears`, så det ikke kan sættes ved et valg, der ikke bruger det. */
export type Recurrence =
  | { kind: 'Annual' }
  | { kind: 'Once' }
  | { kind: 'EveryNYears'; n: number }

type EntryBase = {
  id: EntryId
  name: string
  /** Positivt i begge retninger — fortegnet er retningens arbejde. */
  amountInRealKroner: Real
  owner: PersonId
  timing: Timing
  period: Period
  recurrence: Recurrence
  /** Andel pr. år, ikke procent. Postens egen fremskrivning — uafhængig af
      `Plan.inflationAssumption`. */
  regulationRate: number
}

/** Kun indtægtsposter bærer en skattebehandling. Retningen er diskriminanten
    frem for et felt ved siden af den: en udgiftspost med en skattebehandling
    er ikke noget, motoren skal validere sig ud af — den kan ikke skrives. */
export type Entry =
  | (EntryBase & { direction: 'Income'; taxTreatment: TaxTreatment })
  | (EntryBase & { direction: 'Expense' })

/** En dateret flytning af penge fra én beholdning til en anden inden for
    husstanden. Hverken en indtægt eller en udgift, og uden skattevirkning —
    to modgående `Entry`-poster ville nette til nul på bufferen og flytte
    ingenting, jf. ADR-0004. Perioden er altid kalenderårsforankret: en
    overførsel har ingen ejer at binde en alder til. */
export type Transfer = {
  id: TransferId
  from: HoldingId
  to: HoldingId
  amountInRealKroner: Real
  timing: Timing
  period: { from?: SimulationYear; to?: SimulationYear }
  recurrence: Recurrence
}

export type Plan = {
  name: string
  startYear: SimulationYear
  /** Andel pr. år, ikke procent: 0,02 er 2 %. */
  inflationAssumption: number
  household: Household
  entries: Entry[]
  transfers: Transfer[]
  /** Andel pr. år, ikke procent: 0,254 er 25,40 %. Hører til husstanden og
      ikke til satsåret, fordi den afhænger af, hvor man bor. */
  municipalTaxRate: number
  /** Om husstanden betaler kirkeskat. Satsen huskes, når den slås fra. */
  churchTax: boolean
  churchTaxRate: number
  /** Beholdningen årets restpost lander på. Præcis én, og pegeren er påkrævet. */
  buffer: HoldingId
}
