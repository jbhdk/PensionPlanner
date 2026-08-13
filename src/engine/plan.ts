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
export type ContributionId = string

/** Den kommune en person er bosat i. En nøgle ind i satsårets
    `RateYear.municipalTax`, ikke et tal skrevet direkte på personen — kommune-
    og kirkeskatteprocenten slås op for det simuleringsår, der regnes på. */
export type Municipality = string

/** Beskatningsformen er beholdningens akse og ikke et felt ved siden af den,
    jf. ADR-0010 og ADR-0015. `ShareSavingsAccount` hører i etape 3 og står
    derfor ikke her endnu. */
export type HoldingVariant =
  | 'InstalmentPension'
  | 'LifeAnnuity'
  | 'OldAgeSavings'
  | 'ShareDepot'
  | 'SavingsAccount'

type HoldingBase = {
  id: HoldingId
  name: string
  /** Saldoen ved planens startår, hvor dagens kroner og løbende priser er ét. */
  balance: Real
  /** Andel pr. år, ikke procent: 0,07 er 7 %. Nettoafkastsatsen er
      bruttoafkast minus ÅOP og udledes, hvor den vises, jf. ADR-0003. */
  grossReturn: number
  annualCostRate: number
}

/** En diskrimineret union på `variant`. De fem medlemmer er ens i dag, og
    formen er valgt for det, de bliver: livrentens omsætningsfelter hænger på
    sit eget medlem i etape 3, hvor de først har noget at lave. Et dødt felt i
    det gemte skema er en løgn, der aldrig fejler, jf. ADR-0015. */
export type Holding =
  | (HoldingBase & { variant: 'InstalmentPension' })
  | (HoldingBase & { variant: 'LifeAnnuity' })
  | (HoldingBase & { variant: 'OldAgeSavings' })
  | (HoldingBase & { variant: 'ShareDepot' })
  | (HoldingBase & { variant: 'SavingsAccount' })

export type Person = {
  id: PersonId
  name: string
  birthYear: number
  birthMonth: number
  /** Det år personen holder op med at arbejde. En fri beslutning, ikke en
      lovbestemt alder — se `AgeBound`, som aldersforankrede perioder kan
      binde sig til. */
  workEndAge: number
  /** Alderen simuleringen løber til og med. */
  horizon: number
  /** Bopælskommunen. Kommune- og kirkeskatteprocenten hører til satsåret og
      slås op dér for hvert simuleringsår — ikke gemt som et tal her. */
  municipality: Municipality
  /** Om personen betaler kirkeskat. Uafhængig af `municipality`: to personer
      i samme kommune kan have hver sit svar. */
  churchMember: boolean
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
}

/** Kun indtægtsposter bærer en skattebehandling og en egen reguleringssats.
    Retningen er diskriminanten frem for felter ved siden af den: en
    udgiftspost med en skattebehandling er ikke noget, motoren skal validere
    sig ud af — den kan ikke skrives.

    Reguleringssatsen hører samme sted hen af samme grund. En løn stiger
    hurtigere end priserne, og den forskel afgør, hvor meget der er lagt til
    side ved erhvervsophør; en udgift har ikke den slags eget tempo og følger
    `Plan.inflationAssumption`, som en overførsel allerede gør. */
export type Entry =
  | (EntryBase & {
      direction: 'Income'
      taxTreatment: TaxTreatment
      /** Andel pr. år, ikke procent. Indtægtens egen fremskrivning —
          uafhængig af `Plan.inflationAssumption`. */
      regulationRate: number
    })
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

/** Beløbsangivelsen på et lønkildet bidrag: enten en procent af lønposten,
    eller et fast kronebeløb i dagens kroner. Formen er felterne selv — der er
    ikke et tredje felt ved siden af dem, der siger hvilken af de to der
    gælder, og et bidrag kan derfor ikke bære begge tal på én gang. */
type ContributionAmount = { percentageOfEntry: number } | { amountInRealKroner: Real }

type ContributionBase = {
  id: ContributionId
  /** Destinationen. Aldrig frie midler — så er det en overførsel. */
  to: HoldingId
}

/** En bevægelse af penge ind i en beholdning, der ikke er frie midler, jf.
    ADR-0016. Destinationen er hele skellet mod `Transfer`: hverken
    skattevirkningen eller loftet indgår i det.

    En diskrimineret union på kilden. Det lønkildede medlem peger på sin
    `Entry` og bærer kun destinationen og en beløbsangivelse: periode,
    forankring, gentagelse og forfald arves fra lønposten og findes ikke her.
    Det er dét, der får bidraget til at ophøre af sig selv, når lønnen
    ophører ved erhvervsophør, og som gør, at de to aldrig kan komme ud af
    trit. Det beholdningskildede medlem har ingen post at arve fra og bærer
    dem alle selv, som en `Transfer` gør — det er den form, der kan skrives i
    år, hvor der ingen løn er. Modsat overførslen kan det aldersforankres:
    destinationen har en ejer og dermed en alder at måle fra.

    Beløbet er et fast kronebeløb i den beholdningskildede form og har ingen
    procentvariant: en procent skal have en post at måle af.

    Hverken fradragsretten eller AM-behandlingen er felter: den første følger
    destinationens variant, den anden kilden — og en beholdningskilde har
    aldrig båret AM-bidrag, så dér er brutto lig netto. */
export type Contribution =
  | (ContributionBase & {
      kind: 'EntrySourced'
      /** Lønposten, bidraget måles af og arver sin periode fra. */
      source: EntryId
    } & ContributionAmount)
  | (ContributionBase & {
      kind: 'HoldingSourced'
      /** Beholdningen, pengene kommer fra. Altid frie midler: en flytning
          mellem to ordninger er ikke en indbetaling. */
      source: HoldingId
      amountInRealKroner: Real
      timing: Timing
      period: Period
      recurrence: Recurrence
    })

export type Plan = {
  name: string
  startYear: SimulationYear
  /** Andel pr. år, ikke procent: 0,02 er 2 %. */
  inflationAssumption: number
  /** Andel pr. år. Løfter § 20-regulerede beløbsgrænser (`Thresholds`) for
      simuleringsår efter det sidst kendte satsår, jf. `RateBasis`. */
  section20ProjectionAssumption: number
  /** Andel pr. år. Løfter satsregulerede ydelser (folkepensionens grundbeløb
      og pensionstillæg) for simuleringsår efter det sidst kendte satsår —
      rører aldrig aftrapningens procent. */
  benefitProjectionAssumption: number
  household: Household
  entries: Entry[]
  transfers: Transfer[]
  contributions: Contribution[]
  /** Beholdningen årets restpost lander på. Præcis én, og pegeren er påkrævet. */
  buffer: HoldingId
}
