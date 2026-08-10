import { expect } from 'vitest'
import { simulate } from '../simulate'
import type { Plan } from '../plan'
import type { YearResult } from '../yearResult'

/** Kører motoren og efterprøver balanceinvarianten for hvert simuleringsår.

    Alle tests mod den primære søm går herigennem frem for at kalde `simulate`
    direkte. Invarianten er dermed ikke en assertion man kan glemme at skrive,
    men en betingelse for overhovedet at bruge motoren i en test. */
export function simulateChecked(plan: Plan): YearResult[] {
  const results = simulate(plan)

  for (const year of results) {
    const wealthChange = year.closingWealth - year.openingWealth
    const flows =
      year.income + year.return - year.tax - year.expenses - year.conversion

    expect(
      wealthChange,
      `balanceinvarianten knækker i ${year.year}: formuen ændrede sig ` +
        `${wealthChange}, men strømmene giver ${flows}`,
    ).toBeCloseTo(flows, 6)
  }

  return results
}
