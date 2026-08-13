import type { Holding, HoldingVariant } from './plan'

/** Varianttabellen: det opslag, beholdningssiden af motoren hænger på, tegnet
    i docs/diagrams/01-domaenemodel.md. Én række pr. variant og én kolonne pr.
    regel, så en ny variant er en række at udfylde frem for en betingelse at
    finde og rette — jf. ADR-0010, hvor varianten er aksen og beskatningen
    ikke et felt ved siden af den.

    Denne skive bruger én kolonne. Beskatningen, fradragsretten og loftet får
    hver sin, når de skives ind. */
const table: Record<HoldingVariant, { freeAssets: boolean }> = {
  InstalmentPension: { freeAssets: false },
  LifeAnnuity: { freeAssets: false },
  OldAgeSavings: { freeAssets: false },
  ShareIncome: { freeAssets: true },
  CapitalIncome: { freeAssets: true },
}

/** Om beholdningen er frie midler. `FreeAssets` er en kategori og ikke en
    variant, jf. ADR-0010: den dækker `ShareIncome` og `CapitalIncome` under
    ét, og det er den, buffer- og overførselsreglerne taler om. */
export function isFreeAssets(holding: Holding): boolean {
  return table[holding.variant].freeAssets
}
