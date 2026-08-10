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

export type Entry = {
  id: string
  name: string
  /** Positivt i begge retninger — fortegnet er retningens arbejde. */
  amountInRealKroner: Real
  direction: Direction
}

export type Plan = {
  name: string
  startYear: SimulationYear
  /** Andel pr. år, ikke procent: 0,02 er 2 %. */
  inflationAssumption: number
  household: Household
  entries: Entry[]
  /** Beholdningen årets restpost lander på. Præcis én, og pegeren er påkrævet. */
  buffer: HoldingId
}
