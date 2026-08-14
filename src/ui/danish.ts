import type {
  Anchor,
  Direction,
  HoldingVariant,
  Recurrence,
  TaxTreatment,
  Timing,
} from '../engine/plan'

/** Det ene sted de to sprog møder hinanden. Koden bruger glossarets engelske
    identifiers, skærmen viser dansk, og kortene herunder oversætter begge
    veje. Ingen anden fil må have sit eget kort — så ville et begreb kunne
    hedde to ting på skærmen. */

export const directions: Record<string, Direction> = {
  Indtægt: 'Income',
  Udgift: 'Expense',
}

/** Ordningerne først, de frie midler til sidst — samme rækkefølge som
    varianttabellen i motoren. Aktiesparekontoen står blandt ordningerne og
    ikke ved de frie midler: den har et indskudsloft, og penge derind er en
    indbetaling og ikke en overførsel, jf. ADR-0016. */
export const variants: Record<string, HoldingVariant> = {
  Ratepension: 'InstalmentPension',
  Livrente: 'LifeAnnuity',
  Aldersopsparing: 'OldAgeSavings',
  Aktiesparekonto: 'ShareSavingsAccount',
  Aktiedepot: 'ShareDepot',
  Opsparingskonto: 'SavingsAccount',
}

export const treatments: Record<string, TaxTreatment> = {
  Arbejdsindkomst: 'EarnedIncome',
  Skattefri: 'TaxFree',
}

/** De danske månedsnavne er koden helt uvedkommende — kun tallet 1–12
    forlader dette kort. */
export const timings: Record<string, Timing> = {
  'Jævnt fordelt': 'Even',
  Januar: 1,
  Februar: 2,
  Marts: 3,
  April: 4,
  Maj: 5,
  Juni: 6,
  Juli: 7,
  August: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  December: 12,
}

export const anchors: Record<string, Anchor> = {
  Kalenderår: 'CalendarYear',
  Alder: 'PersonAge',
}

export const recurrences: Record<string, Recurrence['kind']> = {
  'Hvert år': 'Annual',
  'Én gang': 'Once',
  'Hvert N. år': 'EveryNYears',
}

export function danish<T extends string>(map: Record<string, T>, value: T): string {
  return Object.keys(map).find((key) => map[key] === value)!
}

export function danishTiming(timing: Timing): string {
  return Object.keys(timings).find((key) => timings[key] === timing)!
}

/** "Jævnt fordelt" står for en strøm af mange små betalinger hen over året —
    en løn, for eksempel. En engangspost falder i én bestemt måned og kan
    ikke være jævnt fordelt, så valget udelades, når gentagelsen er "Once". */
export function timingOptions(recurrence: Recurrence): string[] {
  const all = Object.keys(timings)
  return recurrence.kind === 'Once' ? all.filter((label) => label !== 'Jævnt fordelt') : all
}

/** Forfaldet, en engangspost arver, når den skifter væk fra "jævnt fordelt" —
    den kan ikke længere være det, så et bestemt tidspunkt vælges i stedet. */
export function timingForOnce(timing: Timing): Timing {
  return timing === 'Even' ? 1 : timing
}

/** De to måder et lønkildet bidrags beløb kan angives på. Kortet peger på
    selve feltet frem for på et navn ved siden af det: formen *er* felterne,
    og et tredje ord for dem kunne komme til at sige noget andet end de to. */
export const contributionAmounts: Record<string, 'percentageOfEntry' | 'amountInRealKroner'> = {
  'Procent af posten': 'percentageOfEntry',
  'Fast beløb': 'amountInRealKroner',
}
