import type { Nominal, Plan, Real, SimulationYear } from '../engine/plan'

/** Deflaterer et beløb i løbende priser tilbage til startårets prisniveau.

    Motoren regner i løbende priser og kender ikke denne funktion — den hører
    til visningen, jf. ADR-0001. Enhver ny visning skal huske den: et råt tal
    fra motoren er aldrig direkte fremvisningsegnet. */
export function inRealKroner(
  amount: Nominal,
  year: SimulationYear,
  plan: Plan,
): Real {
  return amount / (1 + plan.inflationAssumption) ** (year - plan.startYear)
}
