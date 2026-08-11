import type { SimulationYear } from '../plan'
import type { RateBasis } from '../yearResult'
import type { RateYear, Sourced, StatePension, Thresholds } from './rateYear'
import { rateYear2026 } from './rateYear2026'

/** De kendte satsår, ældste først. Tilføjes et nyt, overtager det automatisk
    de simuleringsår, der før blev fremskrevet fra det forrige — `rateYearFor`
    vælger altid det seneste kendte år, der ikke ligger efter simuleringsåret. */
const knownRateYears: readonly RateYear[] = [rateYear2026]

/** Det nyeste kendte satsår. En plan pinner ikke sine satser, så enhver
    beregning bruger altid dette sæt som grundlag, jf. ADR-0005. */
export function latestRateYear(): RateYear {
  return knownRateYears[knownRateYears.length - 1]!
}

/** Fremskrivningens to selvstændige antagelser — § 20-grænser og
    satsregulerede ydelser — hver med sin egen sats, jf. CONTEXT.md. */
export type ProjectionAssumptions = {
  section20ProjectionAssumption: number
  benefitProjectionAssumption: number
}

/** Satserne for ét simuleringsår, sammen med hvilket satsgrundlag de hviler
    på. Er `year` selv et kendt satsår, returneres det uændret. Ellers
    fremskrives det seneste kendte satsår før `year`: § 20-regulerede
    beløbsgrænser løftes med `section20ProjectionAssumption`, satsregulerede
    ydelser med `benefitProjectionAssumption`, og alle procenter — bracket-,
    afkast- og fradragssatser samt det skrå skatteloft — holdes uændrede. */
export function rateYearFor(
  year: SimulationYear,
  assumptions: ProjectionAssumptions,
  knownYears: readonly RateYear[] = knownRateYears,
): { rates: RateYear; basis: RateBasis } {
  const base = knownRateYearFor(year, knownYears)
  if (base.year === year) {
    return { rates: base, basis: { knownYear: base.year, projected: false } }
  }

  const yearsSince = year - base.year
  const section20Factor = (1 + assumptions.section20ProjectionAssumption) ** yearsSince
  const benefitFactor = (1 + assumptions.benefitProjectionAssumption) ** yearsSince

  const rates: RateYear = {
    ...base,
    year,
    thresholds: scaleThresholds(base.thresholds, section20Factor),
    statePension: scaleStatePension(base.statePension, benefitFactor),
  }
  return { rates, basis: { knownYear: base.year, projected: true } }
}

/** Det seneste kendte satsår, der ikke ligger efter `year`. Ligger `year`
    før samtlige kendte satsår, bruges det ældste kendte i stedet — motoren
    fremskriver ikke baglæns i praksis, men formlen er den samme. Tager
    `knownYears` som parameter frem for at læse `knownRateYears` direkte, så
    reglen — et nyt kendt satsår overtager automatisk de år, der lå efter det
    forrige — kan afprøves med et opdigtet sæt uden at satsdata skal ændres. */
function knownRateYearFor(
  year: SimulationYear,
  knownYears: readonly RateYear[],
): RateYear {
  const atOrBefore = knownYears.filter((rateYear) => rateYear.year <= year)
  return atOrBefore.length > 0 ? atOrBefore[atOrBefore.length - 1]! : knownYears[0]!
}

/** Samtlige beløbsgrænser i `Thresholds` er § 20-regulerede, jf. typens egen
    dokumentation, og skaleres derfor alle med samme faktor. */
function scaleThresholds(thresholds: Sourced<Thresholds>, factor: number): Sourced<Thresholds> {
  return {
    ...thresholds,
    personalAllowance: thresholds.personalAllowance * factor,
    middleBracketTax: thresholds.middleBracketTax * factor,
    topBracketTax: thresholds.topBracketTax * factor,
    additionalTopBracketTax: thresholds.additionalTopBracketTax * factor,
    shareIncome: thresholds.shareIncome * factor,
    capitalIncomeInTopBracket: thresholds.capitalIncomeInTopBracket * factor,
    employmentAllowanceMax: thresholds.employmentAllowanceMax * factor,
    jobAllowanceMax: thresholds.jobAllowanceMax * factor,
    jobAllowanceFloor: thresholds.jobAllowanceFloor * factor,
    extraPensionAllowanceBaseMax: thresholds.extraPensionAllowanceBaseMax * factor,
    oldAgeSavingsCap: thresholds.oldAgeSavingsCap * factor,
    oldAgeSavingsCapNearStatePensionAge: thresholds.oldAgeSavingsCapNearStatePensionAge * factor,
    instalmentPensionCap: thresholds.instalmentPensionCap * factor,
    shareSavingsAccountCap: thresholds.shareSavingsAccountCap * factor,
  }
}

/** Ydelsernes kronebeløb skaleres; `Taper.rate` er en procent og holdes
    uændret, jf. `BenefitProjectionAssumption`. */
function scaleStatePension(
  statePension: Sourced<StatePension>,
  factor: number,
): Sourced<StatePension> {
  return {
    ...statePension,
    basicAmount: statePension.basicAmount * factor,
    taper: statePension.taper.map((taper) => ({
      ...taper,
      pensionSupplement: taper.pensionSupplement * factor,
      allowance: taper.allowance * factor,
      cutOff: taper.cutOff * factor,
    })),
  }
}
