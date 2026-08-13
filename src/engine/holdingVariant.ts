import type { Holding, HoldingVariant } from './plan'
import type { TaxRates } from './rates/rateYear'

/** Varianttabellen: det opslag, beholdningssiden af motoren hænger på, tegnet
    i docs/diagrams/01-domaenemodel.md. Én række pr. variant og én kolonne pr.
    regel, så en ny variant er en række at udfylde frem for en betingelse at
    finde og rette — jf. ADR-0010, hvor varianten er aksen og beskatningen
    ikke et felt ved siden af den.

    Denne skive bruger tre kolonner. Loftet får sin, når det skives ind. */
const table: Record<HoldingVariant, Row> = {
  InstalmentPension: { freeAssets: false, holdingTaxRate: 'palTaxRate', deductibility: true },
  LifeAnnuity: { freeAssets: false, holdingTaxRate: 'palTaxRate', deductibility: true },
  OldAgeSavings: { freeAssets: false, holdingTaxRate: 'palTaxRate', deductibility: false },
  ShareDepot: { freeAssets: true, holdingTaxRate: undefined, deductibility: false },
  SavingsAccount: { freeAssets: true, holdingTaxRate: undefined, deductibility: false },
}

type Row = {
  freeAssets: boolean
  /** Nøglen til beholdningsskattens sats i satsåret, eller `undefined` når
      varianten ingen har. Rækken navngiver satsen frem for at bære tallet:
      satsåret siger, hvad satserne er, og motoren siger, hvilken variant der
      betaler hvilken. Samme idiom som lagenes `rates.taxRates[layer]`. */
  holdingTaxRate: keyof TaxRates | undefined
  /** Om en indbetaling til varianten har `Deductibility`. De to frie
      varianter står med falsk frem for med et hul: en indbetaling til frie
      midler er en overførsel og afvises af `validatePlan`, så feltet aldrig
      slås op for dem. Diagram 01 skriver samme celle som "—". */
  deductibility: boolean
}

/** Om beholdningen er frie midler. `FreeAssets` er en kategori og ikke en
    variant, jf. ADR-0010: den dækker `ShareDepot` og `SavingsAccount` under
    ét, og det er den, buffer- og overførselsreglerne taler om. */
export function isFreeAssets(holding: Holding): boolean {
  return table[holding.variant].freeAssets
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
