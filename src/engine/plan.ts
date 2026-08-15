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
    jf. ADR-0010 og ADR-0015. */
export type HoldingVariant =
  | 'InstalmentPension'
  | 'LifeAnnuity'
  | 'OldAgeSavings'
  | 'ShareSavingsAccount'
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

/** År og måned for den aftale, der oprettede en pensionsordning. Dagen er
    ikke med: begge lovskel falder på den første i en måned, og en dag mere
    ville være et felt, ingen kan svare rigtigt på. */
export type OpenedOn = { year: number; month: number }

/** Det, en `PensionScheme` bærer ud over `HoldingBase`. Felterne hænger på de
    tre varianter og aldrig på grundformen: en aktiesparekonto og frie midler
    har ingen udbetalingsalder, og et felt, de aldrig bruger, er en løgn i det
    gemte skema, jf. ADR-0015. */
type PensionScheme = {
  openedOn: OpenedOn
  /** Sat alene i de overførselstilfælde, hvor en lavere alder er bevaret.
      Er den sat, vinder den over den udledte. */
  payoutAgeOverride?: number
}

/** Den af de to beregningsmåder, en udbetalingsplan regner årets rate efter.
    `SerialPrinciple` deler saldoen med de resterende udbetalingsår og giver
    stigende rater ved positivt afkast; `AnnuityPrinciple` regner en annuitet
    med satsårets amortisationsrente og giver tilnærmelsesvis lige store. */
export type PayoutPrinciple = 'SerialPrinciple' | 'AnnuityPrinciple'

/** Hvornår en beholdning begynder at blive tømt, over hvor mange år, og
    efter hvilket princip. Brugeren vælger de tre; det årlige beløb følger af
    princippet og saldoen og er derfor ikke et felt.

    `start` er en `AgeBound` og aldrig et kalenderår: en beholdning har en
    ejer at måle alderen fra, og en plan, hvis udbetalinger ikke flytter sig
    med `WorkEndAge`, kan ikke sammenlignes med sig selv.

    Forfaldet er ikke et felt. En rate udbetales månedsvis, og strømmen vejes
    derfor som `'Even'` — vægt ½, jf. ADR-0006. */
export type PayoutSchedule = {
  start: AgeBound
  duration: number
  principle: PayoutPrinciple
}

/** En diskrimineret union på `variant`. De tre pensionsordninger bærer
    `PensionScheme`, de tre øvrige gør ikke — og formen er valgt for det, den
    bliver: livrentens omsætningsfelter hænger på sit eget medlem i etape 3,
    hvor de først har noget at lave. Et dødt felt i det gemte skema er en
    løgn, der aldrig fejler, jf. ADR-0015. */
export type Holding =
  | (HoldingBase &
      PensionScheme & {
        variant: 'InstalmentPension'
        /** Udbetalingsplanen. Valgfri: en ratepension, brugeren endnu ikke
            har besluttet sig om, skal kunne stå i planen, uden at motoren
            nægter at regne — den bliver stående og vokser, og det ses i
            formuegrafen.

            Feltet hænger på dette ene medlem og ikke på grundformen, fordi
            kun de varianter, hvis `PayoutTaxation` er `PersonalIncome`, har
            en plan at bære, jf. ADR-0022. */
        payout?: PayoutSchedule
      })
  | (HoldingBase & PensionScheme & { variant: 'LifeAnnuity' })
  | (HoldingBase & PensionScheme & { variant: 'OldAgeSavings' })
  | (HoldingBase & { variant: 'ShareSavingsAccount' })
  | (HoldingBase & { variant: 'ShareDepot' })
  | (HoldingBase & { variant: 'SavingsAccount' })

/** De medlemmer af unionen, der bærer en `PayoutSchedule`. I dag
    ratepensionen alene; livrenten får sin — med start og intet andet, fordi
    den er livsvarig — når omsætningen bygges, jf. ADR-0022, og bliver da et
    led mere her.

    Varianttabellens egen celle udleder sig af unionen og ikke af denne liste,
    så de to ikke kan komme ud af trit: en variant, der får feltet, får
    tabelcellen af sig selv. */
export type PayoutScheduleHolding = Extract<Holding, { variant: 'InstalmentPension' }>

/** De medlemmer af unionen, der er en `PensionScheme`. Udledt af unionen selv
    frem for skrevet som en liste ved siden af den: en syvende variant med et
    oprettelsestidspunkt er med af sig selv, og en liste kunne komme ud af
    trit med det, typen bærer. */
export type PensionSchemeHolding = Extract<Holding, { openedOn: OpenedOn }>

/** De varianter, en `PensionSchemeHolding` kan have. Udledt af unionen på
    samme måde og af samme grund. */
export type PensionSchemeVariant = PensionSchemeHolding['variant']

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

/** Det skattemæssige spor en indtægtspost lander i. Hver værdi bærer hele
    indkomstens skattemæssige opførsel og ikke ét enkelt træk — derfor er de
    tre værdier og ikke tre felter.

    `EarnedIncome` er AM-pligtig, indgår i den personlige indkomst, giver
    beskæftigelses- og jobfradrag og aftrapper ikke pensionstillægget.
    `PensionIncome` indgår i den personlige indkomst uden AM-bidrag, giver
    ingen af de to fradrag og tæller i `TaperBase` — det sidste har endnu
    ingen virkning, men værdien bærer det fra starten, så den ikke skal
    omdefineres, når aftrapningen bygges. `TaxFree` beskattes ikke.

    ATP skrives med `PensionIncome`; der findes ingen `Benefit`-figur i
    planen, jf. ADR-0023. */
export type TaxTreatment = 'EarnedIncome' | 'PensionIncome' | 'TaxFree'

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

/** En dateret flytning af penge fra én af husstandens beholdninger til dens
    frie midler. Hverken en indtægt eller en udgift, og uden skattevirkning —
    to modgående `Entry`-poster ville nette til nul på bufferen og flytte
    ingenting, jf. ADR-0004.

    Afgiveren skal være en variant, hvis `PayoutTaxation` er `TaxFree`, og
    det er dermed også den, der tømmer en aldersopsparing og en
    aktiesparekonto: efter pensionsudbetalingsalderen er de konti, ejeren
    hæver af som hun vil, og en `PayoutSchedule` ville påstå en lovregel, der
    ikke findes, jf. ADR-0022. Destinationen er det, der skiller overførslen
    fra en `Contribution`: går pengene ind i en ordning, er det en
    indbetaling, uanset hvor de kom fra.

    Perioden kan aldersforankres som en posts, og alderen måles på
    afgiverbeholdningens ejer — en beholdning har præcis én. Uden det ville
    en aldersopsparings tømning ikke flytte sig med `WorkEndAge`, og det er
    netop dét, en udbetalingsplans start blev aldersforankret for at kunne.

    Beløbet er det, planen beder om. Hvad der faktisk flyttede sig, står i
    `TransferYear`: afgiverens saldo rakte ikke nødvendigvis. */
export type Transfer = {
  id: TransferId
  from: HoldingId
  to: HoldingId
  amountInRealKroner: Real
  timing: Timing
  period: Period
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
  /** Andel pr. år. Løfter folkepensionens grundbeløb og pensionstillæg for
      simuleringsår efter det sidst kendte satsår — rører aldrig
      aftrapningens procent.

      Navnet siger folkepension og ikke ydelser, fordi det er det eneste,
      feltet løfter: ATP bærer sin egen `regulationRate` som enhver anden
      indtægtspost, og livrentens ydelse følger sin bonusantagelse, jf.
      ADR-0023. */
  statePensionProjectionAssumption: number
  household: Household
  entries: Entry[]
  transfers: Transfer[]
  contributions: Contribution[]
  /** Beholdningen årets restpost lander på. Præcis én, og pegeren er påkrævet. */
  buffer: HoldingId
}
