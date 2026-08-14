import type {
  ContributionId,
  EntryId,
  HoldingId,
  Nominal,
  PersonId,
  SimulationYear,
} from './plan'
import type { CappedVariant } from './holdingVariant'
import type { ShareIncomeLayer } from './tax/assessHousehold'
import type { LayerAmount, TaxAssessment } from './tax/assessTax'

/** Hvorfor bufferen er negativ i ét simuleringsår, jf. ADR-0008:
    `Incomplete`, når husstanden har likviditet andetsteds og blot mangler en
    overførsel, eller `Unsustainable`, når husstandens samlede frie midler
    også er negative. Fraværende, når bufferen ikke er negativ. */
export type BufferState = 'Incomplete' | 'Unsustainable'

/** Hvorfor et loft er brudt i ét simuleringsår, jf. ADR-0018:
    `LostDeductibility`, når det overskydende mistede sin fradragsret, eller
    `Chargeable`, når det i stedet er afgiftspligtigt. Fraværende, når intet
    loft er brudt.

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

/** Én persons indbetaling til én slags loftbelagt ordning i ét
    simuleringsår, målt mod det loft der gjaldt. Tre tal på samme linje — det
    der landede, loftet, og den del der beholdt sin fradragsret — så linjen
    kan efterregnes af sig selv, som et `LayerAmount` kan.

    Loftet er personens og måles over årets samlede indbetaling til
    varianten: to ratepensioner deler ét loft, jf. PBL § 16 og ADR-0018. En
    variant uden loft har ingen linje, og en variant, året intet indbetalte
    til, har heller ingen.

    Alle tre tal måler **efter** AM-bidrag, altså det der landede i
    beholdningen, jf. PBL § 16, stk. 3, og docs/satser/2026.md. */
export type CapYear = {
  variant: CappedVariant
  paid: Nominal
  cap: Nominal
  /** Den del af `paid`, der beholdt sin `Deductibility` — `min(paid, cap)`
      for en variant, der har fradragsret, og nul for en, der ingen har.
      Aldersopsparingen har ingen at miste: dens overskydende er
      afgiftspligtigt i stedet, og afgiften er ikke modelleret, jf.
      docs/udskudt.md. */
  withDeductibility: Nominal
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
  /** Hvad næste krone lønindkomst koster netop denne person i netop dette
      år — se `marginalTaxRate`. Aktie- og kapitalindkomst har flade satser
      og har ikke en marginal at vise. */
  marginalTaxRate: number
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
  /** Fraværende, når bufferen ikke er negativ. */
  bufferState?: BufferState
  /** Fraværende, når intet loft er brudt. Konklusionen står her og ikke pr.
      person: fladen markerer årets række fra det ene felt og laver ingen
      aritmetik, jf. ADR-0012. Hvilket loft, hvor meget og hos hvem står i
      `PersonYear.caps`. */
  capBreach?: CapBreach
}
