import type { RateYear } from './rateYear'
import { rateYear2026 } from './rateYear2026'

/** Det nyeste kendte satsår. En plan pinner ikke sine satser, så enhver
    beregning bruger altid dette sæt, jf. ADR-0005 — og `YearResult` stempler,
    hvilket det var. Simuleringsår efter det sidst kendte satsår regnes indtil
    videre på det uden fremskrivning; § 20-fremskrivningen er #14. */
export function latestRateYear(): RateYear {
  return rateYear2026
}
