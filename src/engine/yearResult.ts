import type { EntryId, HoldingId, Nominal, PersonId, SimulationYear } from './plan'
import type { ShareIncomeLayer } from './tax/assessHousehold'
import type { LayerAmount, TaxAssessment } from './tax/assessTax'

/** Hvorfor bufferen er negativ i ét simuleringsår, jf. ADR-0008:
    `Incomplete`, når husstanden har likviditet andetsteds og blot mangler en
    overførsel, eller `Unsustainable`, når husstandens samlede frie midler
    også er negative. Fraværende, når bufferen ikke er negativ. */
export type BufferState = 'Incomplete' | 'Unsustainable'

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

export type HoldingYear = {
  holding: HoldingId
  openingBalance: Nominal
  closingBalance: Nominal
  return: Nominal
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
  /** Fraværende, når bufferen ikke er negativ. */
  bufferState?: BufferState
}
