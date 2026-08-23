import type {
  Anchor,
  Holding,
  HoldingVariant,
  PayoutPrinciple,
  Recurrence,
  TaxTreatment,
  Timing,
} from '../engine/plan'
import { cappedVariant } from '../engine/holdingVariant'

/** Det ene sted de to sprog møder hinanden. Koden bruger glossarets engelske
    identifiers, skærmen viser dansk, og kortene herunder oversætter begge
    veje. Ingen anden fil må have sit eget kort — så ville et begreb kunne
    hedde to ting på skærmen. */

/** Der er intet kort for `Direction`. Retningen vælges ikke i et felt — den
    følger af, hvilken slags post der blev skabt — og de to ruder skriver
    deres eget ord på overskriftslinjen, som overskudsbåndene gør det. Et
    kort oversætter en værdi, brugeren kan vælge imellem; her er der ingen. */

/** Ordningerne først, de frie midler til sidst — samme rækkefølge som
    varianttabellen i motoren. Aktiesparekontoen står blandt ordningerne og
    ikke ved de frie midler: den har et indskudsloft, og penge derind er en
    indbetaling og ikke en overførsel, jf. ADR-0016. */
export const variants: Record<string, HoldingVariant> = {
  Ratepension: 'InstalmentPension',
  Livrente: 'LifeAnnuity',
  Aldersopsparing: 'OldAgeSavings',
  Kapitalpension: 'CapitalPension',
  Aktiesparekonto: 'ShareSavingsAccount',
  Aktiedepot: 'ShareDepot',
  Opsparingskonto: 'SavingsAccount',
}

/** De to måder, en udbetalingsplan kan regne årets rate på. Serieprincippet
    står først, fordi det er det, en plan får, når den lægges: det deler
    saldoen med de resterende år og kræver ingen sats at forstå. */
export const payoutPrinciples: Record<string, PayoutPrinciple> = {
  Serieprincippet: 'SerialPrinciple',
  Annuitetsprincippet: 'AnnuityPrinciple',
}

/** Rækkefølgen er indkomstens vej gennem livet: arbejdsindkomsten først,
    pensionsindkomsten efter den, og den skattefri til sidst — den er ingen
    af de to. */
export const treatments: Record<string, TaxTreatment> = {
  Arbejdsindkomst: 'EarnedIncome',
  Pensionsindkomst: 'PensionIncome',
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

/** De former, en fordelingslinje kan vælges imellem. Resten er ikke iblandt
    dem: præcis én linje er den, og den vælges ikke til og fra — den er
    fordelingens form og ikke en mulighed på lige fod med de øvrige.

    `UpToCap` står her, men tilbydes kun, hvor destinationen har et loft at
    fylde ud, jf. `allocationFormsFor`. */
export const allocationForms: Record<string, 'Percentage' | 'Amount' | 'UpToCap'> = {
  Procent: 'Percentage',
  Kronebeløb: 'Amount',
  'Op til loftet': 'UpToCap',
}

/** De former, netop denne destination kan bære. Livrenten har intet loft, og
    "op til loftet" er derfor ikke et valg dér — ét klik må ikke skrive en
    plan, indgangskontrollen afviser, jf. ADR-0020. */
export function allocationFormsFor(destination: Holding | undefined): string[] {
  return Object.keys(allocationForms).filter(
    (label) =>
      allocationForms[label] !== 'UpToCap' ||
      (destination !== undefined && cappedVariant(destination) !== undefined),
  )
}
