import type {
  Holding,
  HoldingVariant,
  Nominal,
  PayoutSchedule,
  PayoutScheduleHolding,
  PensionSchemeHolding,
  PensionSchemeVariant,
} from './plan'
import type { RateYear, TaxRates } from './rates/rateYear'

/** De varianter, der har et `Cap`. Ikke et begreb ved siden af
    `HoldingVariant`, men den delmængde af den, der bærer et loft — og den
    slags, loftet måles over: personens ordninger af varianten under ét, jf.
    `CapYear`. Hvad der så måles, er formens svar og ikke listens.

    Listen og tabellen kan ikke komme ud af trit: tabellens type kræver en
    loftregel af præcis disse rækker og `undefined` af alle andre. Gives
    livrenten et loft uden at stå her, er det en oversætterfejl og ikke en
    forkert skat, der først ses i et årsresultat. */
const cappedVariants = ['InstalmentPension', 'OldAgeSavings', 'ShareSavingsAccount'] as const

export type CappedVariant = (typeof cappedVariants)[number]

/** Varianttabellen: det opslag, beholdningssiden af motoren hænger på, tegnet
    i docs/diagrams/01-domaenemodel.md. Én række pr. variant og én kolonne pr.
    regel, så en ny variant er en række at udfylde frem for en betingelse at
    finde og rette — jf. ADR-0010, hvor varianten er aksen og beskatningen
    ikke et felt ved siden af den.

    Denne skive bruger otte kolonner. */
const table: {
  [V in HoldingVariant]: Row & {
    cap: V extends CappedVariant ? CapRule : undefined
    /** Om varianten bærer en `PayoutSchedule` i det gemte skema. Cellen kan
        ikke komme ud af trit med typen: den er sand netop for de medlemmer af
        unionen, der har feltet, og falsk for alle andre. Får livrenten sin
        plan, skifter cellen af sig selv — og gør den ikke, er det en
        oversætterfejl og ikke et afsnit i skuffen, der tegner felter, planen
        ikke kan tage imod. */
    payoutSchedule: 'payout' extends keyof Extract<Holding, { variant: V }> ? true : false
  }
} = {
  InstalmentPension: {
    freeAssets: false,
    holdingTaxRate: 'palTaxRate',
    payoutTaxation: 'PersonalIncome',
    deductibility: true,
    payoutSchedule: true,
    uniquePerPerson: false,
    employerAdministered: true,
    cap: {
      form: 'PerYear',
      amount: (rates) => rates.thresholds.instalmentPensionCap,
    },
  },
  LifeAnnuity: {
    freeAssets: false,
    holdingTaxRate: 'palTaxRate',
    payoutTaxation: 'PersonalIncome',
    deductibility: true,
    payoutSchedule: false,
    uniquePerPerson: false,
    employerAdministered: true,
    cap: undefined,
  },
  OldAgeSavings: {
    freeAssets: false,
    holdingTaxRate: 'palTaxRate',
    payoutTaxation: 'TaxFree',
    deductibility: false,
    payoutSchedule: false,
    uniquePerPerson: false,
    employerAdministered: true,
    cap: {
      form: 'PerYear',
      amount: (rates, yearsToStatePensionAge) =>
        yearsToStatePensionAge <= oldAgeSavingsHighCapFrom
          ? rates.thresholds.oldAgeSavingsCapNearStatePensionAge
          : rates.thresholds.oldAgeSavingsCap,
    },
  },
  ShareSavingsAccount: {
    freeAssets: false,
    holdingTaxRate: 'shareSavingsAccountTaxRate',
    payoutTaxation: 'TaxFree',
    deductibility: false,
    payoutSchedule: false,
    uniquePerPerson: true,
    employerAdministered: false,
    cap: {
      form: 'OnBalance',
      amount: (rates) => rates.thresholds.shareSavingsAccountCap,
    },
  },
  ShareDepot: {
    freeAssets: true,
    holdingTaxRate: undefined,
    payoutTaxation: 'TaxFree',
    deductibility: false,
    payoutSchedule: false,
    uniquePerPerson: false,
    employerAdministered: false,
    cap: undefined,
  },
  SavingsAccount: {
    freeAssets: true,
    holdingTaxRate: undefined,
    payoutTaxation: 'TaxFree',
    deductibility: false,
    payoutSchedule: false,
    uniquePerPerson: false,
    employerAdministered: false,
    cap: undefined,
  },
}

type Row = {
  freeAssets: boolean
  /** Nøglen til beholdningsskattens sats i satsåret, eller `undefined` når
      varianten ingen har. Rækken navngiver satsen frem for at bære tallet:
      satsåret siger, hvad satserne er, og motoren siger, hvilken variant der
      betaler hvilken. Samme idiom som lagenes `rates.taxRates[layer]`. */
  holdingTaxRate: keyof TaxRates | undefined
  /** Hvad der sker i skatten, når penge forlader en beholdning af varianten.
      Variantens akse på vejen ud, ganske som `deductibility` er det på vejen
      ind, jf. ADR-0010 — og den kolonne, der afgør, hvem der kan tømme hvad:
      kun en `TaxFree` kan tømmes af en `Transfer`, og kun en
      `PersonalIncome` bærer en `PayoutSchedule`, jf. ADR-0022.

      Skellet er ikke pension mod ikke-pension. Aldersopsparingen deler
      kolonne med de frie varianter og med aktiesparekontoen, fordi der ingen
      skat udløses, når pengene hentes — det, der skiller den fra en
      opsparingskonto, er den låste dør indtil dens `PayoutAge`, PAL-skatten
      på afkastet og loftet på vejen ind. */
  payoutTaxation: PayoutTaxation
  /** Om en indbetaling til varianten har `Deductibility`. De to frie
      varianter står med falsk frem for med et hul: en indbetaling til frie
      midler er en overførsel og afvises af `validatePlan`, så feltet aldrig
      slås op for dem. Diagram 01 skriver samme celle som "—". */
  deductibility: boolean
  /** Om personen kun kan have én beholdning af varianten. Sand alene for
      aktiesparekontoen, jf. ASKL § 3; flere ratepensioner, aldersopsparinger
      og livrenter er lovlige, og ADR-0018 hviler på, at to af dem deler ét
      loft. */
  uniquePerPerson: boolean
  /** Om varianten kan være arbejdsgiveradministreret, så en lønpost kan være
      kilde til en indbetaling til den. Falsk for aktiesparekontoen og for de
      to frie varianter — en indbetaling til frie midler er en overførsel og
      afvises i forvejen, så deres celle slås aldrig op. */
  employerAdministered: boolean
}

/** Hvad der sker i skatten, når penge forlader en beholdning:
    `PersonalIncome` for ratepensionen og livrenten, `TaxFree` for
    aldersopsparingen, aktiesparekontoen og de to frie varianter. En egenskab
    ved varianten og aldrig ved den enkelte udbetaling. */
export type PayoutTaxation = 'PersonalIncome' | 'TaxFree'

/** Loftets form, og hvad det gælder i året — de to sider af `Cap`, jf.
    CONTEXT.md.

    Formen er rækkens egen og ikke noget, satsåret svarer på: hvad loftet
    måler, og om pengene overhovedet kommer ind, er en egenskab ved
    ordningen. Beløbet regnes derimod, hvor `holdingTaxRate` blot navngiver
    et satsfelt: et loft kan have en trappe, og den hører i den ene række,
    der har den, frem for i en kolonne, de øvrige rækker skal stå tomme i. */
type CapRule = {
  form: CapForm
  amount: (rates: RateYear, yearsToStatePensionAge: number) => Nominal
}

/** Hvad et loft måler, og hvad det gør ved det overskydende. `PerYear` måler
    årets samlede indbetaling til ordningen, og pengene kommer ind —
    ratepensionens overskydende mister sin fradragsret, aldersopsparingens
    bliver afgiftspligtigt. `OnBalance` måler beholdningens saldo ved årets
    begyndelse, og råderummet er loftet minus den: indskuddet afkortes, og
    det uindskudte bliver liggende i kilden, jf. ADR-0019. */
export type CapForm = 'PerYear' | 'OnBalance'

/** Årets loft for en variant: formen, og det beløb satsåret giver den. */
export type Cap = {
  form: CapForm
  amount: Nominal
}

/** Aldersopsparingens høje loft gælder fra og med det syvende indkomstår før
    det indkomstår, hvor personen når folkepensionsalderen, jf. PBL § 16,
    stk. 1, 2. pkt. Grænsen står i loven og ikke i § 20-tabellen og hører
    derfor ikke i satsåret. Den har ingen øvre ende — loftet bliver ved med
    at være det høje efter folkepensionsalderen — og sammenligningen er
    derfor `<=` og ikke et interval, ganske som det ekstra pensionsfradrags
    egen 15-årsgrænse i `assessTax`. */
const oldAgeSavingsHighCapFrom = 7

/** De varianter, der er en `PensionScheme`. Skrevet som en udtømmende
    tabel og ikke som en liste: en syvende variant med et oprettelsestidspunkt
    får unionen til at kræve en række her, hvor en liste tavst kunne mangle
    den. Rækkerne bærer ingen data — spørgsmålet er, om varianten står i
    tabellen. */
const pensionSchemeVariants: Record<PensionSchemeVariant, true> = {
  InstalmentPension: true,
  LifeAnnuity: true,
  OldAgeSavings: true,
}

/** Om beholdningen er en pensionsordning — altså om den har et
    oprettelsestidspunkt og dermed en `PayoutAge`. Svaret indsnævrer typen,
    så `payoutAge` kan kaldes uden et cast.

    Kategorien er hverken "ikke frie midler" eller "har et loft":
    aktiesparekontoen er ingen af delene og har hverken regime eller
    udbetalingsalder — ejeren hæver af den, når hun vil. */
export function isPensionScheme(holding: Holding): holding is PensionSchemeHolding {
  return isPensionSchemeVariant(holding.variant)
}

/** Samme spørgsmål stillet om varianten alene, ganske som
    `isFreeAssetsVariant`: fladen spørger, før beholdningen har varianten —
    et typeskift skal vide, om ordningen skal have et oprettelsestidspunkt
    med, mens beholdningen endnu er den, den var. */
export function isPensionSchemeVariant(
  variant: HoldingVariant,
): variant is PensionSchemeVariant {
  return variant in pensionSchemeVariants
}

/** Om beholdningen er frie midler. `FreeAssets` er en kategori og ikke en
    variant, jf. ADR-0010: den dækker `ShareDepot` og `SavingsAccount` under
    ét, og det er den, buffer- og overførselsreglerne taler om. */
export function isFreeAssets(holding: Holding): boolean {
  return isFreeAssetsVariant(holding.variant)
}

/** Samme spørgsmål stillet om varianten alene, ganske som
    `isUniquePerPerson`: fladen spørger, før beholdningen har varianten —
    typelisten skal vide, om et skifte ville tage de frie midler fra
    bufferen, mens beholdningen endnu er den, den var.

    De to former står ved siden af hinanden frem for at afløse hinanden:
    resten af koden spørger om en beholdning, den har i hånden, og læser
    `filter(isFreeAssets)` frem for en lambda om et felt. */
export function isFreeAssetsVariant(variant: HoldingVariant): boolean {
  return table[variant].freeAssets
}

/** Om personen kun kan have én beholdning af varianten, jf. `UniquePerPerson`
    i CONTEXT.md. Spørgsmålet stilles om varianten og ikke om en beholdning:
    fladen spørger, før beholdningen har varianten — det er hele pointen, at
    den ikke kan få den — og `validatePlan` tæller varianter og ikke
    beholdninger.

    En strukturel umulighed og ikke et årsafhængigt brud, jf. ADR-0020:
    svaret er det samme i alle simuleringsår, og planen afvises derfor ved
    indgangen frem for at bære en markering i årsresultatet. */
export function isUniquePerPerson(variant: HoldingVariant): boolean {
  return table[variant].uniquePerPerson
}

/** Om beholdningen kan være arbejdsgiveradministreret, jf.
    `EmployerAdministered` i CONTEXT.md. Der findes ingen
    arbejdsgiveradministreret aktiesparekonto, og en lønkildet indbetaling
    til den kan derfor ikke ske: den form indeholder AM-bidrag på vejen ind, og pengene
    på kontoen er allerede fuldt beskattede midler, ejeren selv flytter
    derind.

    Svaret afgør alene, om indbetalingen kan skrives, og aldrig hvad den
    koster — AM-behandlingen følger kilden og ikke destinationen, jf.
    ADR-0016. */
export function isEmployerAdministered(holding: Holding): boolean {
  return table[holding.variant].employerAdministered
}

/** Om beholdningen kan bære en udbetalingsplan, jf. `PayoutSchedule` i
    CONTEXT.md. Svaret indsnævrer typen, så planen kan skrives uden et cast.

    Spørgsmålet er ikke, om beholdningen *har* en plan: feltet er valgfrit, og
    en ratepension uden plan bliver stående og vokser. Det er dét skel, der
    lader skuffen tilbyde en plan dér, hvor der endnu ingen er. */
export function bearsPayoutSchedule(holding: Holding): holding is PayoutScheduleHolding {
  return table[holding.variant].payoutSchedule
}

/** Beholdningens udbetalingsplan, eller `undefined` når varianten ingen kan
    bære, eller når brugeren ikke har lagt en.

    Det ene sted, feltet læses. Både motoren, indgangskontrollen og fladen
    spørger herigennem, så ingen af dem nævner `InstalmentPension` ved navn
    for at komme til en plan — hvilke varianter der har en, er variantens egen
    viden, jf. ADR-0010 og ADR-0022. */
export function payoutScheduleOf(holding: Holding): PayoutSchedule | undefined {
  return bearsPayoutSchedule(holding) ? holding.payout : undefined
}

/** Satsnøglen for beholdningens egen skat på årets afkast, eller `undefined`
    når varianten ingen har. `ShareDepot` og `SavingsAccount` har ikke en:
    deres afkast beskattes hos personen eller husstanden i stedet, jf.
    `HoldingTax` i CONTEXT.md. */
export function holdingTaxRate(holding: Holding): keyof TaxRates | undefined {
  return table[holding.variant].holdingTaxRate
}

/** Om en indbetaling til beholdningen har `Deductibility` — altså holdes
    uden for indbetalerens personlige indkomst. Den følger destinationens
    variant og er aldrig et felt på indbetalingen selv, jf. ADR-0016:
    `InstalmentPension` og `LifeAnnuity` har den, `OldAgeSavings` ikke.

    Reglen er ikke "ratepension giver fradragsret", men "indbetalinger til
    ordninger, hvis udbetaling er personlig indkomst, giver fradragsret" —
    og at de to i dag falder sammen, er varianttabellens svar og ikke
    skattemodulets. Derfor stopper varianten her og krydser aldrig
    skattesømmet, jf. ADR-0014. */
export function hasDeductibility(holding: Holding): boolean {
  return table[holding.variant].deductibility
}

/** Hvad der sker i skatten, når penge forlader beholdningen. Det opslag,
    både overførslens afgiverende og udbetalingsplanens plads hviler på: en
    `Transfer` må kun hente, hvor svaret er `TaxFree`, fordi en udbetaling,
    der er personlig indkomst, skal gennem en plan — loven binder både dens
    start, dens længde og dens årlige beløb, jf. ADR-0022.

    Reglen er dermed ét opslag i varianttabellen og ikke en liste af
    varianter, der skulle holdes i takt med den. */
export function payoutTaxation(holding: Holding): PayoutTaxation {
  return table[holding.variant].payoutTaxation
}

/** Beholdningens loft i året, eller `undefined` når varianten ingen har.
    Svaret er formen og beløbet sammen: de to tal, formen sammenligner, er
    ikke de samme, og et bart tal kunne måles mod det forkerte.

    `PerYear` måler årets samlede indbetaling, og det overskydende afvises
    ikke — det mister sin fradragsret eller bliver afgiftspligtigt. Beløbet
    måler dér på det, der **landede** efter AM-bidrag, samme form som
    fradragsretten selv, jf. PBL § 16, stk. 3, og docs/satser/2026.md.

    `OnBalance` måler en helt anden ting: aktiesparekontoens loft gælder
    beholdningens værdi og ikke en indbetaling, og AM-bidrag rører det slet
    ikke. Råderummet er loftet minus primosaldoen, og indskuddet afkortes til
    det, jf. ASKL § 9, stk. 1, ADR-0019 og docs/satser/2026.md. De to
    måleformer må aldrig bytte plads.

    Livrenten har intet loft: PBL § 16, stk. 2, opremser ratepensionen og de
    ophørende livrenter, og den livsvarige står ikke i den. Det er netop den
    forskel, ADR-0015 krævede belagt, før livrenten blev en egen variant.

    `yearsToStatePensionAge` er antallet af indkomstår frem til det år,
    personen når folkepensionsalderen — nul i selve det år, negativt bagefter
    — og det er den differens, aldersopsparingens trappe måles på. Den kommer
    fra `statePensionYear`, motorens eneste vej til det årstal, så trappen og
    det ekstra pensionsfradrags 15-årsgrænse ikke kan skille sig i det halve
    år, en brøkalder giver. */
export function cap(
  holding: Holding,
  rates: RateYear,
  yearsToStatePensionAge: number,
): Cap | undefined {
  const rule = table[holding.variant].cap
  if (rule === undefined) return undefined
  return { form: rule.form, amount: rule.amount(rates, yearsToStatePensionAge) }
}

/** Beholdningens variant, når den har et loft — ellers `undefined`. Det
    opslag, der gør en `HoldingVariant` til en `CappedVariant` uden et cast:
    svaret kommer fra listen selv, og tabellens type holder de to i takt. */
export function cappedVariant(holding: Holding): CappedVariant | undefined {
  return cappedVariants.find((variant) => variant === holding.variant)
}
