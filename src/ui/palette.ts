import { isFreeAssets } from '../engine/holdingVariant'
import type { Household } from '../engine/plan'

/** Otte farver i fast rækkefølge, aldrig genereret eller cyklet — valideret
    mod app-fladens mørke baggrund med dataviz-skillets
    `scripts/validate_palette.js` (CVD-adskillelse ≥ 8 ΔE, kontrast ≥ 3:1 på
    `--flade`). En niende beholdning genbruger paletten frem for at få en
    ny, uvalideret farve. */
export const CATEGORICAL_PALETTE = [
  '#3987e5', // blå
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // gul
  '#d55181', // magenta
  '#008300', // grøn
  '#9085e9', // violet
  '#e66767', // rød
]

/** Beholdningerne i den rækkefølge, farvetildelingen og formuegrafens
    stabling bruger: frie midler først, bundne beholdninger derefter, og inden
    for hver gruppe husstandens personrækkefølge, så en beholdning holder sin
    farve, selv om en anden fjernes eller tilføjes bagved den.

    Grupperingen er formuegrafens skel mellem "hvad er til rådighed" og "hvad
    er bundet". Den flytter kun rækkefølgen — hvad der er frie midler, står i
    varianttabellen. */
export function orderedHoldings(household: Household) {
  const holdings = household.persons.flatMap((person) => person.holdings)
  return [...holdings.filter(isFreeAssets), ...holdings.filter((h) => !isFreeAssets(h))]
}

export function holdingColor(holdingIndex: number): string {
  return CATEGORICAL_PALETTE[holdingIndex % CATEGORICAL_PALETTE.length]!
}

// Overskudsgrafens to toner, taget fra den samme validerede palette frem for
// fundet på. Aqua og violet står langt fra hinanden i både kulør og lyshed,
// så fortegnsskiftet ses på en skærmfuld søjler uden at aksen læses.
//
// Underskuddet er violet og ikke rød: rød er forbeholdt den negative buffer
// alene, jf. `app.css`, og et underskud er ingen fejltilstand — det er
// beløbet, der mangler at blive flyttet, jf. ADR-0026.
//
// Eksporteret, så Overskudsgrafens egen legend — Overskud mod Underskud —
// kan vise præcis de to farver, søjlerne selv bruger.
export const SURPLUS = CATEGORICAL_PALETTE[2]!
export const DEFICIT = CATEGORICAL_PALETTE[6]!

/** Årets overskud er ét begreb og to ord, og fortegnet er det, der skiller
    dem — derfor én funktion af beløbet og ikke to farver at vælge imellem. */
export function surplusColor(amount: number): string {
  return amount < 0 ? DEFICIT : SURPLUS
}

/** Båndenes farver i overskudsgrafens øverste panel, ét pr. plads i den
    faste rækkefølge. Otte bånd og otte farver: paletten rækker præcis, og
    der indføres ingen niende. Rækkefølgen er båndenes egen og ligger fast
    hele horisonten igennem, så et bånd kan følges med øjnene fra første til
    sidste år.

    Fordi de otte bånd bruger hele paletten, deler to af dem nødvendigvis
    tone med `surplusColor`s to. Det er ikke en tvetydighed inde i ét panel:
    båndene har legenden og deres egen skala, søjlen nedenunder har hverken
    eller — den er ikke en kategori, men totalen. */
export function surplusBandColor(bandIndex: number): string {
  return CATEGORICAL_PALETTE[bandIndex % CATEGORICAL_PALETTE.length]!
}
