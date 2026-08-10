/** Ét kalenderår. Den mindste tidsenhed motoren regner i. */
export type SimulationYear = number

/** Beløb i det pågældende simuleringsårs egne kroner. Motoren regner i disse. */
export type Nominal = number

/** Beløb i startårets prisniveau. Alt brugeren taster, er i disse. */
export type Real = number

export type HoldingId = string
export type PersonId = string

/** Beskatningsformen er beholdningens akse. Etape 1 kender kun de to frie. */
export type HoldingVariant = 'ShareIncome' | 'CapitalIncome'

export type Holding = {
  id: HoldingId
  name: string
  variant: HoldingVariant
  /** Saldoen ved planens startår, hvor dagens kroner og løbende priser er ét. */
  balance: Real
}

export type Person = {
  id: PersonId
  name: string
  birthYear: number
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

type EntryBase = {
  id: string
  name: string
  /** Positivt i begge retninger — fortegnet er retningens arbejde. */
  amountInRealKroner: Real
  owner: PersonId
}

/** Kun indtægtsposter bærer en skattebehandling. Retningen er diskriminanten
    frem for et felt ved siden af den: en udgiftspost med en skattebehandling
    er ikke noget, motoren skal validere sig ud af — den kan ikke skrives. */
export type Entry =
  | (EntryBase & { direction: 'Income'; taxTreatment: TaxTreatment })
  | (EntryBase & { direction: 'Expense' })

export type Plan = {
  name: string
  startYear: SimulationYear
  /** Andel pr. år, ikke procent: 0,02 er 2 %. */
  inflationAssumption: number
  household: Household
  entries: Entry[]
  /** Andel pr. år, ikke procent: 0,254 er 25,40 %. Hører til husstanden og
      ikke til satsåret, fordi den afhænger af, hvor man bor. */
  municipalTaxRate: number
  /** Om husstanden betaler kirkeskat. Satsen huskes, når den slås fra. */
  churchTax: boolean
  churchTaxRate: number
  /** Beholdningen årets restpost lander på. Præcis én, og pegeren er påkrævet. */
  buffer: HoldingId
}
