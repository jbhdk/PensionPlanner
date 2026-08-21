import { expect } from 'vitest'
import { simulate } from '../simulate'
import { totalTax } from '../tax/assessTax'
import type { Plan } from '../plan'
import type { YearResult } from '../yearResult'

/** Kører motoren og efterprøver to invarianter for hvert simuleringsår.

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

    // Årets skat er summen af sine dele og intet andet: hver persons egne
    // lag, plus aktieindkomstens, som er husstandens, plus beholdningernes,
    // som beholdningen selv bærer, plus afgiften på en overførsel ud af en
    // `Chargeable` ordning, jf. ADR-0029. Uden den her kunne et lag blive
    // regnet med i totalen uden at stå nogen steder — og forklar-året ville
    // vise et tal, der ikke kan efterregnes, jf. ADR-0014.
    const fromPersons = year.persons.reduce((sum, person) => sum + totalTax(person.tax), 0)
    const fromShareIncome = Object.values(year.shareIncomeTax).reduce(
      (sum, layer) => sum + layer.amount,
      0,
    )
    const fromHoldings = year.holdings.reduce((sum, holding) => sum + holding.tax, 0)
    const fromTransferCharges = year.transfers.reduce(
      (sum, transfer) =>
        sum + (transfer.payoutTaxation === 'Chargeable' ? transfer.moved - transfer.landed : 0),
      0,
    )

    expect(
      year.tax,
      `skatten går ikke op i ${year.year}: året siger ${year.tax}, men ` +
        `personerne giver ${fromPersons}, aktieindkomsten ${fromShareIncome}, ` +
        `beholdningerne ${fromHoldings} og overførselsafgifterne ${fromTransferCharges}`,
    ).toBeCloseTo(fromPersons + fromShareIncome + fromHoldings + fromTransferCharges, 6)
  }

  return results
}
