import type { Holding, HoldingVariant } from './plan'
import type { TaxRates } from './rates/rateYear'

/** Varianttabellen: det opslag, beholdningssiden af motoren hænger på, tegnet
    i docs/diagrams/01-domaenemodel.md. Én række pr. variant og én kolonne pr.
    regel, så en ny variant er en række at udfylde frem for en betingelse at
    finde og rette — jf. ADR-0010, hvor varianten er aksen og beskatningen
    ikke et felt ved siden af den.

    Denne skive bruger to kolonner. Fradragsretten og loftet får hver sin,
    når de skives ind. */
const table: Record<HoldingVariant, Row> = {
  InstalmentPension: { freeAssets: false, holdingTaxRate: 'palTaxRate' },
  LifeAnnuity: { freeAssets: false, holdingTaxRate: 'palTaxRate' },
  OldAgeSavings: { freeAssets: false, holdingTaxRate: 'palTaxRate' },
  ShareDepot: { freeAssets: true, holdingTaxRate: undefined },
  SavingsAccount: { freeAssets: true, holdingTaxRate: undefined },
}

type Row = {
  freeAssets: boolean
  /** Nøglen til beholdningsskattens sats i satsåret, eller `undefined` når
      varianten ingen har. Rækken navngiver satsen frem for at bære tallet:
      satsåret siger, hvad satserne er, og motoren siger, hvilken variant der
      betaler hvilken. Samme idiom som lagenes `rates.taxRates[layer]`. */
  holdingTaxRate: keyof TaxRates | undefined
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
