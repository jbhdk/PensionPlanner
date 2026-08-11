import type { Household } from '../engine/plan'

/** Otte farver i fast rækkefølge, aldrig genereret eller cyklet — valideret
    mod app-fladens mørke baggrund med dataviz-skillets
    `scripts/validate_palette.js` (CVD-adskillelse ≥ 8 ΔE, kontrast ≥ 3:1 på
    `--flade`). En niende beholdning genbruger paletten frem for at få en
    ny, uvalideret farve. */
const CATEGORICAL_PALETTE = [
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
    stabling bruger — husstandens personrækkefølge, så en beholdning holder
    sin farve, selv om en anden fjernes eller tilføjes bagved den. */
export function orderedHoldings(household: Household) {
  return household.persons.flatMap((person) => person.holdings)
}

export function holdingColor(holdingIndex: number): string {
  return CATEGORICAL_PALETTE[holdingIndex % CATEGORICAL_PALETTE.length]!
}
