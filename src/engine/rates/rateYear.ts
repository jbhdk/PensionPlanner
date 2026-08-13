import type { Municipality, Nominal, SimulationYear } from '../plan'

/** En blok satsdata med den kilde, den er hentet fra.

    `unconfirmed` navngiver de tal i blokken, der er krydstjekket mellem flere
    sekundære kilder, men ikke fundet i en officiel tabel — ⚠︎ i
    docs/satser/. Mærket er en del af dataene og ikke en note ved siden af
    dem, så et ubekræftet tal ikke kan nå ind i en facitcase ubemærket. */
export type Sourced<T> = T & {
  readonly source: string
  readonly unconfirmed: readonly (keyof T)[]
}

/** De fire lag på personlig indkomst. Skat.dk offentliggør dem samlet, og
    de har derfor deres egen blok — de øvrige satser står andre steder og kan
    ikke dele kilde med dem. Alle som andel, ikke procent: 0,08 er 8 %. */
export type BracketTaxRates = {
  bottomBracketTax: number
  middleBracketTax: number
  topBracketTax: number
  additionalTopBracketTax: number
}

/** AM-bidraget og satserne på afkast.

    Et satsfelt beholder lagets navn, når det slås op med lagets nøgle;
    ellers siger det, hvad det er. `labourMarketContribution`,
    `shareIncomeBelowThreshold` og `shareIncomeAboveThreshold` er bærende
    nøgler — lagene slår deres egen sats op med `rates.taxRates[layer]`, og
    et omdøbt felt ville knække opslaget. De to sidste slås ikke op af et
    lag, og de hedder derfor det, de er: satser. */
export type TaxRates = {
  labourMarketContribution: number
  shareIncomeBelowThreshold: number
  shareIncomeAboveThreshold: number
  palTaxRate: number
  shareSavingsAccountTaxRate: number
}

/** Det skrå skatteloft, trappet fra 2026. Alle tre ekskl. AM-bidrag og
    kirkeskat. */
export type TaxCeiling = {
  atMiddleBracket: number
  atTopBracket: number
  atAdditionalTopBracket: number
  capitalIncome: number
}

/** Beløbsgrænserne efter personskattelovens § 20. Progressionsgrænserne er
    målt på personlig indkomst **efter** AM-bidrag — det er den kolonne, loven
    regulerer. Sekundære kilder angiver oftest de samme grænser før AM-bidrag,
    og de to sæt må aldrig blandes. */
export type Thresholds = {
  personalAllowance: Nominal
  middleBracketTax: Nominal
  topBracketTax: Nominal
  additionalTopBracketTax: Nominal
  shareIncome: Nominal
  capitalIncomeInTopBracket: Nominal
  employmentAllowanceMax: Nominal
  jobAllowanceMax: Nominal
  jobAllowanceFloor: Nominal
  /** Loftet over den indbetaling, procenten regnes af — ikke over fradraget.
      § 20-tabellen kalder linjen "Maksimalt grundlag for ekstra
      pensionsfradrag (§ 9 L, stk. 1)". Måler på indbetalingen **efter**
      AM-bidrag, jf. LL § 9 L, stk. 1, 3. og 4. pkt. */
  extraPensionAllowanceBaseMax: Nominal
  /** PBL § 16, stk. 1, 1. pkt. Måler på indbetalingen **efter** AM-bidrag,
      jf. stk. 3. */
  oldAgeSavingsCap: Nominal
  /** PBL § 16, stk. 1, 2. pkt.: gælder fra og med det syvende indkomstår før
      det indkomstår, hvor personen når folkepensionsalderen, og alle år
      derefter. Måler på indbetalingen **efter** AM-bidrag, jf. stk. 3. */
  oldAgeSavingsCapNearStatePensionAge: Nominal
  /** PBL § 16, stk. 2. Bæres af `InstalmentPension`, ikke af `LifeAnnuity`:
      opremsningen dækker ratepension og *ophørende* livrenter, og den
      livsvarige ordning er uden årligt loft. Måler på indbetalingen **efter**
      AM-bidrag, jf. stk. 3. */
  instalmentPensionCap: Nominal
  shareSavingsAccountCap: Nominal
}

export type AllowanceRates = {
  employmentAllowance: number
  jobAllowance: number
  /** Over 15 år til folkepensionsalderen. */
  extraPensionAllowanceEarly: number
  /** 15 år eller mindre til folkepensionsalderen. */
  extraPensionAllowanceLate: number
}

/** Kommune- og kirkeskatteprocenten for én kommune. Fastsat af kommunen selv
    år for år, jf. `Municipality`. */
export type MunicipalTaxRates = {
  municipalTaxRate: number
  churchTaxRate: number
}

/** Kommunerne slås op under `rates`, ikke direkte på `Sourced<MunicipalTax>`
    selv — et indeks-signatur-felt kan ikke sameksistere med de navngivne
    `source`/`unconfirmed`-felter, `Sourced<T>` lægger til. */
export type MunicipalTax = {
  rates: Record<Municipality, MunicipalTaxRates>
}

export type CivilStatus = 'Single' | 'WithNonPensioner' | 'WithPensioner'

/** Aftrapningen af pensionstillægget for én civilstand.

    De fire tal er ikke uafhængige: `cutOff` følger af de tre andre, og den
    relation er satsårets egen selvkontrol. */
export type Taper = {
  civilStatus: CivilStatus
  pensionSupplement: Nominal
  /** Fradragsbeløbet — indtægten aftrapper først over dette. */
  allowance: Nominal
  rate: number
  /** Bortfaldsgrænsen: indtægten hvor tillægget er væk. */
  cutOff: Nominal
}

export type StatePension = {
  /** Grundbeløbet er fladt — aftrapningen efter egen arbejdsindkomst blev
      afskaffet med virkning fra 2023. */
  basicAmount: Nominal
  taper: readonly Taper[]
}

/** Et komplet sæt officielle satser for ét kalenderår. Delt referencedata,
    aldrig en del af en plan, jf. ADR-0005. */
export type RateYear = {
  year: SimulationYear
  /** Hvornår tallene sidst blev efterset mod kilderne. */
  verifiedOn: string
  bracketTaxRates: Sourced<BracketTaxRates>
  taxRates: Sourced<TaxRates>
  taxCeiling: Sourced<TaxCeiling>
  thresholds: Sourced<Thresholds>
  allowanceRates: Sourced<AllowanceRates>
  statePension: Sourced<StatePension>
  /** Kommune- og kirkeskatteprocenten pr. kommune, for alle landets ca. 98
      kommuner. */
  municipalTax: Sourced<MunicipalTax>
}
