import { describe, expect, it } from 'vitest'
import type { Plan } from '../engine/plan'
import {
  aHolding,
  aHoldingContribution,
  aPensionIncome,
  aPlan,
  aPlanWithEveryBufferFlow,
  aSalary,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import { simulateChecked } from '../engine/testing/simulateChecked'
import type { YearResult } from '../engine/yearResult'
import { surplus } from './surplus'
import type { SurplusBandName } from './surplusBands'
import { surplusBands } from './surplusBands'

function band(year: YearResult, plan: Plan, name: SurplusBandName): number {
  return surplusBands(year, plan).find((candidate) => candidate.name === name)!.amount
}

function net(year: YearResult, plan: Plan): number {
  return surplusBands(year, plan).reduce(
    (sum, item) => (item.direction === 'Income' ? sum + item.amount : sum - item.amount),
    0,
  )
}

describe('overskuddets bånd', () => {
  it('summerer til årets overskud i hvert eneste simuleringsår', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)

    for (const year of years) {
      expect(net(year, plan), `${year.year}`).toBeCloseTo(surplus(year, plan.buffer), 6)
    }
  })

  it('holder beholdningsskatten uden for skattebåndet', () => {
    // Aktiesparekontoen og de tre ordninger betaler hver sin beholdningsskat,
    // mens husstanden betaler af løn, rater og kapitalindkomst. Kun den
    // sidste passerer bufferen: beholdningsskatten er trukket af saldoen
    // sammen med afkastet, jf. ADR-0026.
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)

    const medBeholdningsskat = years.filter(
      (year) => year.holdings.reduce((sum, holding) => sum + holding.tax, 0) > 0,
    )
    expect(medBeholdningsskat.length).toBeGreaterThan(0)

    for (const year of medBeholdningsskat) {
      const beholdningsskat = year.holdings.reduce((sum, holding) => sum + holding.tax, 0)
      expect(band(year, plan, 'Tax'), `${year.year}`).toBeCloseTo(year.tax - beholdningsskat, 6)
      expect(band(year, plan, 'Tax')).toBeLessThan(year.tax)
    }
  })

  it('tæller ikke en indbetaling med, hvis kilden er en anden beholdning end bufferen', () => {
    // To planer, der kun er forskellige i, hvor de 20.000 kommer fra. Går de
    // fra bufferen, forlader de den; går de fra aktiedepotet, gør de ikke, og
    // årets overskud mærker det ikke.
    const fraBufferen = aContributionPlan('free-assets')
    const fraDepotet = aContributionPlan('aktiedepot')

    const bufferAar = simulateChecked(fraBufferen)[0]!
    const depotAar = simulateChecked(fraDepotet)[0]!

    expect(band(bufferAar, fraBufferen, 'Contributions')).toBeCloseTo(20_000, 6)
    expect(band(depotAar, fraDepotet, 'Contributions')).toBe(0)

    // Og det er ikke bare båndet, der er tomt: året er faktisk 20.000 bedre.
    expect(surplus(depotAar, fraDepotet.buffer) - surplus(bufferAar, fraBufferen.buffer)).toBeCloseTo(
      20_000,
      6,
    )
  })

  it('lader en overførsel uden bufferen i nogen ende tælle hverken op eller ned', () => {
    // Pengene flytter sig fra aldersopsparingen til aktiedepotet. Bufferen er
    // hverken afgiver eller modtager, og året skal se ud, som var overførslen
    // der ikke.
    const uden = aTransferPlan([])
    const med = aTransferPlan([
      aTransfer({
        id: 'omplacering',
        from: 'aldersopsparing',
        to: 'aktiedepot',
        amountInRealKroner: 50_000,
        period: { anchor: 'PersonAge', from: 72 },
      }),
    ])

    const aarUden = simulateChecked(uden)
    const aarMed = simulateChecked(med)

    // Overførslen falder faktisk i nogle af årene — ellers prøver testen intet.
    expect(aarMed.some((year) => year.transfers.some((transfer) => transfer.moved > 0))).toBe(true)

    for (const [i, year] of aarMed.entries()) {
      expect(band(year, med, 'TransfersIn'), `ind i ${year.year}`).toBe(0)
      expect(band(year, med, 'TransfersOut'), `ud i ${year.year}`).toBe(0)
      expect(net(year, med), `${year.year}`).toBeCloseTo(net(aarUden[i]!, uden), 6)
    }
  })

  it('lægger ATP i indtægtsposternes bånd og ikke i ydelsernes', () => {
    // ATP er brugerens eget tal fra PensionsInfo og skrives som en post, jf.
    // ADR-0023. Ydelserne er strømmene uden en saldo: folkepensionens to
    // beløb og en omsat livrentes ydelse.
    const uden = anAtpPlan(false)
    const med = anAtpPlan(true)

    const aarUden = simulateChecked(uden)
    const aarMed = simulateChecked(med)

    const pensionistaar = aarMed.findIndex((year) => year.persons[0]!.statePension !== undefined)
    expect(pensionistaar).toBeGreaterThan(-1)

    const year = aarMed[pensionistaar]!
    const sammenligning = aarUden[pensionistaar]!

    // Folkepensionen ligger i ydelsesbåndet, og ATP løfter det ikke.
    expect(band(year, med, 'Benefits')).toBeGreaterThan(0)
    expect(band(year, med, 'Benefits')).toBeCloseTo(band(sammenligning, uden, 'Benefits'), 6)

    // Hele forskellen ligger i posternes bånd.
    expect(band(year, med, 'IncomeEntries') - band(sammenligning, uden, 'IncomeEntries')).toBeCloseTo(
      30_000,
      6,
    )
  })
})

/** To ens planer bortset fra, hvilken beholdning de 20.000 kommer fra. */
function aContributionPlan(source: string): Plan {
  return aPlan({
    horizon: 57,
    balance: 1_000_000,
    holdings: [
      aHolding({ id: 'aktiedepot', name: 'Aktiedepot', variant: 'ShareDepot', balance: 500_000 }),
      aHolding({
        id: 'aktiesparekonto',
        name: 'Aktiesparekonto',
        variant: 'ShareSavingsAccount',
        balance: 0,
      }),
    ],
    entries: [aSalary({ amountInRealKroner: 600_000 }), anExpense({ amountInRealKroner: 300_000 })],
    contributions: [
      aHoldingContribution({ source, to: 'aktiesparekonto', amountInRealKroner: 20_000 }),
    ],
  })
}

function aTransferPlan(transfers: Plan['transfers']): Plan {
  return aPlan({
    horizon: 80,
    balance: 1_000_000,
    holdings: [
      aHolding({ id: 'aktiedepot', name: 'Aktiedepot', variant: 'ShareDepot', balance: 500_000 }),
      aHolding({
        id: 'aldersopsparing',
        name: 'Aldersopsparing',
        variant: 'OldAgeSavings',
        balance: 400_000,
      }),
    ],
    entries: [
      aSalary({ amountInRealKroner: 600_000, period: { anchor: 'PersonAge', to: 'WorkEndAge' } }),
      anExpense({ amountInRealKroner: 250_000 }),
    ],
    transfers,
  })
}

/** To ens planer bortset fra ATP-posten. */
function anAtpPlan(withAtp: boolean): Plan {
  return aPlan({
    horizon: 78,
    balance: 3_000_000,
    entries: [
      aSalary({ amountInRealKroner: 600_000, period: { anchor: 'PersonAge', to: 'WorkEndAge' } }),
      anExpense({ amountInRealKroner: 300_000 }),
      ...(withAtp
        ? [aPensionIncome({ amountInRealKroner: 30_000, period: { anchor: 'PersonAge', from: 70 } })]
        : []),
    ],
  })
}
