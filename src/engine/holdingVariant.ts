import type { Holding, HoldingVariant, Nominal } from './plan'
import type { RateYear, TaxRates } from './rates/rateYear'

/** De varianter, der har et `Cap`. Ikke et begreb ved siden af
    `HoldingVariant`, men den delmængde af den, der bærer et loft — og den
    slags, loftet måles over: årets samlede indbetaling til personens
    ordninger af varianten, jf. `CapYear`.

    Listen og tabellen kan ikke komme ud af trit: tabellens type kræver en
    loftregel af præcis disse rækker og `undefined` af alle andre. Gives
    livrenten et loft uden at stå her, er det en oversætterfejl og ikke en
    forkert skat, der først ses i et årsresultat. */
const cappedVariants = ['InstalmentPension', 'OldAgeSavings'] as const

export type CappedVariant = (typeof cappedVariants)[number]

/** Varianttabellen: det opslag, beholdningssiden af motoren hænger på, tegnet
    i docs/diagrams/01-domaenemodel.md. Én række pr. variant og én kolonne pr.
    regel, så en ny variant er en række at udfylde frem for en betingelse at
    finde og rette — jf. ADR-0010, hvor varianten er aksen og beskatningen
    ikke et felt ved siden af den.

    Denne skive bruger fire kolonner. */
const table: {
  [V in HoldingVariant]: Row & { cap: V extends CappedVariant ? CapRule : undefined }
} = {
  InstalmentPension: {
    freeAssets: false,
    holdingTaxRate: 'palTaxRate',
    deductibility: true,
    cap: (rates) => rates.thresholds.instalmentPensionCap,
  },
  LifeAnnuity: {
    freeAssets: false,
    holdingTaxRate: 'palTaxRate',
    deductibility: true,
    cap: undefined,
  },
  OldAgeSavings: {
    freeAssets: false,
    holdingTaxRate: 'palTaxRate',
    deductibility: false,
    cap: (rates, yearsToStatePensionAge) =>
      yearsToStatePensionAge <= oldAgeSavingsHighCapFrom
        ? rates.thresholds.oldAgeSavingsCapNearStatePensionAge
        : rates.thresholds.oldAgeSavingsCap,
  },
  ShareSavingsAccount: {
    freeAssets: false,
    holdingTaxRate: 'shareSavingsAccountTaxRate',
    deductibility: false,
    cap: undefined,
  },
  ShareDepot: {
    freeAssets: true,
    holdingTaxRate: undefined,
    deductibility: false,
    cap: undefined,
  },
  SavingsAccount: {
    freeAssets: true,
    holdingTaxRate: undefined,
    deductibility: false,
    cap: undefined,
  },
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

/** Årets loftbeløb for en variant, slået op i satsåret. Rækken regner
    beløbet frem for at navngive et satsfelt, som `holdingTaxRate` gør: et
    loft kan have en trappe, og den hører i den ene række, der har den, frem
    for i en kolonne, de øvrige rækker skal stå tomme i. */
type CapRule = (rates: RateYear, yearsToStatePensionAge: number) => Nominal

/** Aldersopsparingens høje loft gælder fra og med det syvende indkomstår før
    det indkomstår, hvor personen når folkepensionsalderen, jf. PBL § 16,
    stk. 1, 2. pkt. Grænsen står i loven og ikke i § 20-tabellen og hører
    derfor ikke i satsåret. Den har ingen øvre ende — loftet bliver ved med
    at være det høje efter folkepensionsalderen — og sammenligningen er
    derfor `<=` og ikke et interval, ganske som det ekstra pensionsfradrags
    egen 15-årsgrænse i `assessTax`. */
const oldAgeSavingsHighCapFrom = 7

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

/** Loftet over det, der må lande i beholdningen i ét år, eller `undefined`
    når varianten ingen har. Kun `PerYear`-formen findes: den måler årets
    samlede indbetaling, og det overskydende afvises ikke — det mister sin
    fradragsret eller bliver afgiftspligtigt, jf. `Cap` i CONTEXT.md.

    Beløbet måler på det, der **landede** efter AM-bidrag, samme form som
    fradragsretten selv, jf. PBL § 16, stk. 3, og docs/satser/2026.md.

    Aktiesparekontoen står også uden, og cellen er tom med vilje frem for ved
    en forglemmelse: dens loft er en `OnBalance`-form, der måler saldoen og
    afkorter selve indbetalingen, og den findes ikke i denne skive, jf.
    ADR-0019.

    Livrenten har intet loft: PBL § 16, stk. 2, opremser ratepensionen og de
    ophørende livrenter, og den livsvarige står ikke i den. Det er netop den
    forskel, ADR-0015 krævede belagt, før livrenten blev en egen variant.

    `yearsToStatePensionAge` er antallet af indkomstår frem til det år,
    personen når folkepensionsalderen — nul i selve det år, negativt bagefter
    — og det er den differens, aldersopsparingens trappe måles på. Den kommer
    fra `statePensionYear`, motorens eneste vej til det årstal, så trappen og
    det ekstra pensionsfradrags 15-årsgrænse ikke kan skille sig i det halve
    år, en brøkalder giver. */
export function cap(
  holding: Holding,
  rates: RateYear,
  yearsToStatePensionAge: number,
): Nominal | undefined {
  return table[holding.variant].cap?.(rates, yearsToStatePensionAge)
}

/** Beholdningens variant, når den har et loft — ellers `undefined`. Det
    opslag, der gør en `HoldingVariant` til en `CappedVariant` uden et cast:
    svaret kommer fra listen selv, og tabellens type holder de to i takt. */
export function cappedVariant(holding: Holding): CappedVariant | undefined {
  return cappedVariants.find((variant) => variant === holding.variant)
}
