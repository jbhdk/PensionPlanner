import type {
  ContributionId,
  EntryId,
  HoldingId,
  Nominal,
  PersonId,
  SimulationYear,
  TransferId,
} from './plan'
import type { CappedVariant } from './holdingVariant'
import type { ShareIncomeLayer } from './tax/assessHousehold'
import type { LayerAmount, MarginalTaxRates, TaxAssessment } from './tax/assessTax'

/** Hvorfor bufferen er negativ i ét simuleringsår, jf. ADR-0008:
    `Incomplete`, når husstanden har likviditet andetsteds og blot mangler en
    overførsel, eller `Unsustainable`, når den ikke har. Fraværende, når
    bufferen ikke er negativ.

    Likviditet andetsteds er præcis de beholdninger, en overførsel kan nå i
    netop det år: de øvrige frie midler, aktiesparekontoen, og en
    aldersopsparing, hvis året har passeret dens `PayoutAge`. En ratepension
    tæller ikke med — den kan kun nås af en udbetalingsplan, der binder ti år
    frem, og det er en anden plan og ikke en manglende overførsel, jf.
    ADR-0022. */
export type BufferState = 'Incomplete' | 'Unsustainable'

/** Hvorfor et loft er brudt i ét simuleringsår, jf. ADR-0018:
    `LostDeductibility`, når det overskydende mistede sin fradragsret, eller
    `Chargeable`, når det i stedet er afgiftspligtigt. Fraværende, når intet
    loft er brudt.

    Kun `PerYear`-formen kan bryde. En `OnBalance`-form forhindrer indskuddet
    frem for at straffe det, og der er derfor intet brud at markere —
    afkortningen ses på `CapYear`-linjen i stedet, jf. ADR-0019.

    Et resultat på linje med `BufferState` og ikke en valideringsfejl: om et
    beløb overskrider loftet afhænger af årets fremskrevne beløb målt mod
    årets satsår, og de to vokser med hver sin antagelse — det samme bidrag
    kan være lovligt i 2030 og et brud i 2040. `validatePlan` kender ikke et
    år og kan derfor ikke svare på det.

    Brydes begge slags loft samme år, står `LostDeductibility`: det er den,
    der flytter årets skat, hvor afgiften ikke er modelleret. Samme greb som
    `BufferState`, der også kollapser til én værdi pr. år. */
export type CapBreach = 'LostDeductibility' | 'Chargeable'

/** Om et `YearResult` er regnet på et kendt satsår eller på et fremskrevet,
    jf. ADR-0005. `knownYear` er satsåret selv, når `projected` er falsk, og
    det kendte satsår fremskrivningen løber fra, når den er sand. */
export type RateBasis = {
  knownYear: SimulationYear
  projected: boolean
}

/** En post, sammen med dens beløb i årets egne, løbende priser — for de
    poster der rent faktisk falder i det pågældende år. Forfaldet står ikke
    her: det er en egenskab ved posten selv og læses fra `Plan.entries`,
    ligesom en beholdnings navn og afkastsatser læses fra `Plan` og ikke
    gentages i `HoldingYear`. */
export type EntryYear = {
  entry: EntryId
  amount: Nominal
}

/** Én indbetalings to beløb i ét simuleringsår, i årets egne løbende priser
    — kun for de indbetalinger der faktisk falder i året. Det ene er, hvad der
    forlod kilden; det andet, hvad der landede i beholdningen. Differencen er
    AM-bidraget, som allerede står i personens eget skattelag og derfor ikke
    gentages her: et tredje felt kunne komme til at sige noget andet end
    laget. Forfaldet står heller ikke her — et lønkildet bidrag arver det fra
    sin post, ligesom `EntryYear` læser sit fra `Plan.entries`. */
export type ContributionYear = {
  contribution: ContributionId
  fromSource: Nominal
  intoHolding: Nominal
}

/** Én overførsels to beløb i ét simuleringsår, i årets egne løbende priser
    — kun for de overførsler der faktisk falder i året. Det ene er, hvad
    planen bad om; det andet, hvad der faktisk blev flyttet, når afgiverens
    primosaldo ikke rakte.

    De to er ens i næsten alle år, og linjen findes for de år, hvor de ikke
    er: en tavs afkortning er den slags fejl, der aldrig viser sig. Samme
    greb som `CapYear` under et `OnBalance`-loft, hvor det afviste beløb
    ellers ville have været usynligt, jf. ADR-0019 og ADR-0022.

    Forfaldet står ikke her; det er en egenskab ved overførslen selv og læses
    fra `Plan.transfers`, ligesom `EntryYear` læser sit fra `Plan.entries`. */
export type TransferYear = {
  transfer: TransferId
  requested: Nominal
  moved: Nominal
}

/** Én persons indbetaling til én slags loftbelagt ordning i ét
    simuleringsår, målt mod det loft der gjaldt. Linjen kan efterregnes af
    sig selv, som et `LayerAmount` kan — og hvilke tal der skal til, følger
    loftets form.

    En union på `Cap`-formen frem for ét sæt felter med huller i: de to
    former måler ikke det samme, og et felt, der kun giver mening for den
    ene, skal ikke kunne skrives for den anden. Samme greb som `Entry` på
    `direction` og `Contribution` på `kind`, jf. ADR-0019.

    Loftet er personens og måles over personens ordninger af varianten under
    ét: to ratepensioner deler ét loft, jf. PBL § 16 og ADR-0018. En variant
    uden loft har ingen linje, og linjen findes, når året **bad om** noget,
    ikke når noget landede — ellers forsvandt netop det år, hvor råderummet
    var nul, og hele indskuddet blev afvist. */
export type CapYear =
  | {
      form: 'PerYear'
      variant: CappedVariant
      /** Det, der landede i ordningerne i alt. Måler **efter** AM-bidrag,
          jf. PBL § 16, stk. 3, og docs/satser/2026.md. */
      paid: Nominal
      cap: Nominal
      /** Den del af `paid`, der beholdt sin `Deductibility` — `min(paid, cap)`
          for en variant, der har fradragsret, og nul for en, der ingen har.
          Aldersopsparingen har ingen at miste: dens overskydende er
          afgiftspligtigt i stedet, og afgiften er ikke modelleret, jf.
          docs/udskudt.md. */
      withDeductibility: Nominal
    }
  | {
      form: 'OnBalance'
      variant: CappedVariant
      /** Det, årets indbetalinger tilsammen bad om. AM-bidrag rører ikke
          denne form: pengene er fuldt beskattede midler, ejeren selv flytter
          derind, jf. docs/satser/2026.md. */
      requested: Nominal
      cap: Nominal
      /** Saldoen ved årets begyndelse — forrige års ultimo, jf. ASKL § 9,
          stk. 1. Det er den, loftet måles mod, og derfor ånder råderummet
          med afkastet. */
      openingBalance: Nominal
      /** Det, der faktisk kom ind: `requested` afkortet til råderummet.
          Resten forlod aldrig kilden, jf. ADR-0019. */
      deposited: Nominal
    }

export type HoldingYear = {
  holding: HoldingId
  openingBalance: Nominal
  closingBalance: Nominal
  /** Årets afkast **brutto** — før beholdningsskatten. Står brutto, så
      afkastsatsen og skattesatsen kan efterregnes hver for sig;
      `closingBalance` er nettet af `tax`. */
  return: Nominal
  /** Beholdningsskatten af årets afkast, båret af beholdningen selv og
      trukket af dens saldo, jf. `HoldingTax` i CONTEXT.md. Nul for de
      varianter, der ingen har. Indgår i `YearResult.tax` — den passerer
      ingen persons indkomst, men den er en skat husstanden betaler. */
  tax: Nominal
  /** Årets udbetaling fra beholdningen — det, en `PayoutSchedule` tømte den
      med. Nul for de beholdninger og de år, hvor ingen plan tømmer noget.

      Den er ikke `YearResult.income`: pengene flytter sig fra beholdningen
      til bufferen og lader husstandens formue uændret, præcis som en
      overførsel gør. Kun dens skat sætter aftryk i balanceinvarianten.

      I det sidste udbetalingsår bærer tallet også fejningen — det, der stod
      tilbage, når årets afkast er tilskrevet og beholdningsskatten trukket
      — så beholdningen lukker på præcis nul. En omsat livrentes ydelse står
      ikke her: den har ingen saldo at forlade. */
  payout: Nominal
  /** Årets strømme ind og ud af beholdningen, hver vægtet efter sit forfald
      — bufferens andel af posterne, og enhver overførsel til eller fra
      beholdningen. Det, der lægges til primosaldoen i Modified Dietz, før
      afkastet regnes, jf. `netReturn`. */
  weightedFlow: Nominal
}

/** Årets skatteopgørelse for én person. Indkomsten føres pr. person og aldrig
    som husstandssum, jf. ADR-0010: skatten summerer over husstanden, men
    aftrapningen bruger persongrundlaget, og en gemt sum kan ikke splittes.

    `shareIncome` og `capitalIncome` er afkastet af personens egne
    `ShareDepot`- og `SavingsAccount`-beholdninger — ikke en skat, men
    grundlaget senere etapers aftrapning skal bruge. Aktieindkomstens skat
    står ikke her: den er husstandens og har sit eget felt på `YearResult`,
    jf. ADR-0010 og ADR-0014. */
export type PersonYear = {
  person: PersonId
  shareIncome: Nominal
  capitalIncome: Nominal
  tax: TaxAssessment
  /** Personens marginalskat på hver sin indkomstart — hvad næste krone
      arbejdsindkomst koster, og hvad næste krone pensionsindkomst koster.
      De to er sjældent ens: lønkronen bærer AM-bidrag og kan flytte et af
      arbejdsfradragene, hvor pensionskronen gør ingen af delene. Se
      `marginalTaxRates`.

      Aktie- og kapitalindkomst har flade satser og har ikke en marginal at
      vise. */
  marginal: MarginalTaxRates
  /** Årets loftlinjer, én pr. slags loftbelagt ordning personen indbetalte
      til. Tom, når året ingen sådan indbetaling havde. Konklusionen — om et
      loft rent faktisk er brudt — står ét sted, på `YearResult`, så fladen
      kan markere rækken uden selv at sammenligne to tal, jf. ADR-0012. */
  caps: CapYear[]
}

/** Motorens fulde output for ét simuleringsår — alle mellemregninger, ikke
    kun totaler. De syv strømme er balanceinvariantens led:

      closingWealth − openingWealth = income + return − tax − expenses − conversion

    Felter, som denne skive ikke fylder, står som nul frem for at mangle. */
export type YearResult = {
  year: SimulationYear
  /** Satsgrundlaget, året er regnet på, jf. ADR-0005. */
  rateBasis: RateBasis
  openingWealth: Nominal
  closingWealth: Nominal
  income: Nominal
  return: Nominal
  tax: Nominal
  expenses: Nominal
  conversion: Nominal
  holdings: HoldingYear[]
  persons: PersonYear[]
  /** Aktieindkomstens skat, opgjort for husstanden under ét — den kan ikke
      fordeles på personer, for progressionsgrænsen er fælles og
      overførbar, jf. ADR-0014. Et lag er udeladt, når dets grundlag er nul,
      og hele feltet er et tomt objekt, når ingen har aktieindkomst. */
  shareIncomeTax: Partial<Record<ShareIncomeLayer, LayerAmount>>
  entries: EntryYear[]
  contributions: ContributionYear[]
  /** Årets overførsler, én linje pr. overførsel der falder i året. Tom, når
      ingen gør. Linjen bærer både det ønskede og det flyttede, så en
      afkortning kan ses frem for at forsvinde. */
  transfers: TransferYear[]
  /** Fraværende, når bufferen ikke er negativ. */
  bufferState?: BufferState
  /** Fraværende, når intet loft er brudt. Konklusionen står her og ikke pr.
      person: fladen markerer årets række fra det ene felt og laver ingen
      aritmetik, jf. ADR-0012. Hvilket loft, hvor meget og hos hvem står i
      `PersonYear.caps`. */
  capBreach?: CapBreach
}
