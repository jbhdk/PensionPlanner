import { isFreeAssets } from '../engine/holdingVariant'
import type { Household } from '../engine/plan'

/** 16 farver i fast rækkefølge, aldrig cyklet inden for paletten selv —
    valideret mod app-fladens mørke baggrund med dataviz-skillets
    `scripts/validate_palette.js` (lyshedsbånd, mætningsgulv, normalsyns-
    gulv og kontrast ≥ 3:1 på `--flade`, alle tilstødende par). CVD-
    adskillelsen er bevidst opgivet ud over `SURPLUS`/`DEFICIT`-parret,
    jf. ADR-0039 — 16 indbyrdes CVD-sikre farver får ikke plads i det
    lyshed/mætnings-bånd, fladen kræver, og en beholdning står aldrig med
    farve alene: legenden, dataglimtet og inspektørskuffen navngiver den
    altid ved siden af. En syttende beholdning genbruger paletten frem for
    at få en ny, uvalideret farve. */
export const CATEGORICAL_PALETTE = [
  '#277ad9', // blå
  '#c25600', // orange
  '#0091af', // petroleum
  '#c64668', // rød
  '#009761', // skovgrøn
  '#a653b2', // magenta — DEFICIT
  '#6f8700', // oliven
  '#656bd9', // violet
  '#b16700', // gul
  '#0087ca', // azur
  '#c94a3a', // rustrød
  '#00978c', // turkis
  '#bb4a90', // pink
  '#30912c', // grøn — SURPLUS
  '#8b5ecc', // lilla
  '#967800', // gulgrøn
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
// fundet på. Grøn og magenta står 180° fra hinanden på farvehjulet — den
// størst mulige afstand i denne palet — og er derfor det eneste par, der
// stadig klarer CVD-målet, selvom resten af paletten har opgivet det, jf.
// ADR-0039.
//
// Underskuddet er magenta og ikke rød: rød er forbeholdt den negative
// buffer alene, jf. `app.css`, og et underskud er ingen fejltilstand — det
// er beløbet, der mangler at blive flyttet, jf. ADR-0026.
//
// Eksporteret, så Overskudsgrafens egen legend — Overskud mod Underskud —
// kan vise præcis de to farver, søjlerne selv bruger.
export const SURPLUS = CATEGORICAL_PALETTE[13]!
export const DEFICIT = CATEGORICAL_PALETTE[5]!

/** Årets overskud er ét begreb og to ord, og fortegnet er det, der skiller
    dem — derfor én funktion af beløbet og ikke to farver at vælge imellem. */
export function surplusColor(amount: number): string {
  return amount < 0 ? DEFICIT : SURPLUS
}

/** Båndenes farver i overskudsgrafens øverste panel, ét pr. plads i den
    faste rækkefølge. Otte bånd, og altid paletten første otte pladser — der
    indføres ingen niende. Rækkefølgen er båndenes egen og ligger fast hele
    horisonten igennem, så et bånd kan følges med øjnene fra første til
    sidste år.

    Paletten har flere pladser end panelet har bånd, så kun `DEFICIT` (plads
    5) falder inden for de otte pladser, båndene bruger — `SURPLUS` (plads
    13) gør ikke. Det er ikke en tvetydighed inde i ét panel: båndene har
    legenden og deres egen skala, søjlen nedenunder har hverken eller — den
    er ikke en kategori, men totalen. */
export function surplusBandColor(bandIndex: number): string {
  return CATEGORICAL_PALETTE[bandIndex % CATEGORICAL_PALETTE.length]!
}
