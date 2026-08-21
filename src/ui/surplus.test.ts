import { describe, expect, it } from 'vitest'
import type { PayoutSchedule, Plan } from '../engine/plan'
import {
  aContribution,
  aPlan,
  aSalary,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import { simulateChecked } from '../engine/testing/simulateChecked'
import type { YearResult } from '../engine/yearResult'
import { surplus } from './surplus'

/** Årets strømme på bufferen, regnet op fra planen selv frem for fra de fire
    tal på bufferens beholdningsår. Det er den anden halvdel af påstanden i
    ADR-0026: at ultimo minus primo, minus afkastet, plus beholdningsskatten
    rent faktisk *er* summen af det, der bevægede sig.

    Kun husstandens egen skat forlader bufferen. Beholdningsskatten er
    trukket af beholdningen selv ved krediteringen og passerer aldrig
    pengestrømmen. */
function flowsOntoBuffer(year: YearResult, plan: Plan): number {
  const householdTax = year.tax - year.holdings.reduce((sum, holding) => sum + holding.tax, 0)
  const payouts = year.holdings.reduce((sum, holding) => sum + holding.payout, 0)

  const transfers = year.transfers.reduce((sum, line) => {
    const transfer = plan.transfers.find((candidate) => candidate.id === line.transfer)!
    const incoming = transfer.to === plan.buffer ? line.moved : 0
    const outgoing = transfer.from === plan.buffer ? line.moved : 0
    return sum + incoming - outgoing
  }, 0)

  // Et lønkildet bidrag forlader altid bufferen: bruttolønnen landede dér.
  // AM-delen af det er ikke med, for den forlader bufferen som skat og er
  // allerede talt med i husstandens.
  const contributions = year.contributions.reduce((sum, line) => {
    const contribution = plan.contributions.find(
      (candidate) => candidate.id === line.contribution,
    )!
    const fromBuffer =
      contribution.kind === 'EntrySourced' || contribution.source === plan.buffer
    return sum + (fromBuffer ? line.intoHolding : 0)
  }, 0)

  return year.income + payouts + transfers - contributions - year.expenses - householdTax
}

/** En plan, der bærer sig selv hele forløbet: lønnen er større end
    udgifterne, og horisonten slutter, før erhvervsophøret. Bufferen forrenter
    sig, og et aktiedepot ved siden af forrenter sig kraftigere — begge dele
    står uden for overskuddet, mens skatten af dem ikke gør. */
function aSurplusPlan(): Plan {
  return aPlan({
    horizon: 57,
    balance: 500_000,
    grossReturn: 0.02,
    holdings: [
      {
        id: 'aktiedepot',
        name: 'Aktiedepot',
        variant: 'ShareDepot',
        balance: 2_000_000,
        grossReturn: 0.05,
        annualCostRate: 0.004,
      },
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        payoutAge: 67,
        balance: 1_000_000,
        grossReturn: 0.04,
        annualCostRate: 0.005,
      },
    ],
    entries: [aSalary({ amountInRealKroner: 800_000 }), anExpense({ amountInRealKroner: 300_000 })],
    contributions: [
      aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.1 }),
    ],
  })
}

/** En plan, der ikke bærer sig selv efter erhvervsophøret: lønnen stopper
    som 58, udgifterne bliver stående, og forløbet løber langt nok til, at
    både ratepensionens rater, folkepensionen og den omsatte livrentes ydelse
    når at komme ind. En overførsel fra aktiedepotet dækker en del af hullet,
    så også den slags bevægelse er med i regnestykket. */
function aDeficitPlan(): Plan {
  return aPlan({
    horizon: 80,
    balance: 400_000,
    grossReturn: 0.02,
    holdings: [
      {
        id: 'aktiedepot',
        name: 'Aktiedepot',
        variant: 'ShareDepot',
        balance: 2_000_000,
        grossReturn: 0.05,
        annualCostRate: 0.004,
      },
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        payoutAge: 67,
        balance: 1_500_000,
        grossReturn: 0.04,
        annualCostRate: 0.005,
        payout: { start: 67, duration: 15, principle: 'AnnuityPrinciple' },
      },
      {
        id: 'livrente',
        name: 'Livrente',
        variant: 'LifeAnnuity',
        payoutAge: 67,
        balance: 800_000,
        grossReturn: 0.045,
        annualCostRate: 0.006,
        quotedReserve: 1_000_000,
        quotedAnnualBenefit: 51_200,
        bonusRate: 0.01,
        payout: { start: 67 },
      },
    ],
    entries: [
      aSalary({
        amountInRealKroner: 800_000,
        period: { anchor: 'PersonAge', to: 'WorkEndAge' },
      }),
      anExpense({ amountInRealKroner: 500_000 }),
    ],
    contributions: [
      aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.1 }),
    ],
    transfers: [
      aTransfer({ from: 'aktiedepot', to: 'free-assets', amountInRealKroner: 100_000 }),
    ],
  })
}

/** En pensionist uden løn, med en ratepension der enten tømmes eller ikke.
    De to planer er ens i alt andet, så forskellen mellem dem er raten og
    dens skat og intet andet. */
function aRetiredPlan(payout?: PayoutSchedule): Plan {
  return aPlan({
    startYear: 2040,
    horizon: 70,
    balance: 300_000,
    holdings: [
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        payoutAge: 67,
        balance: 2_000_000,
        grossReturn: 0.04,
        annualCostRate: 0,
        ...(payout ? { payout } : {}),
      },
    ],
    entries: [anExpense({ amountInRealKroner: 250_000 })],
  })
}

describe('årets overskud', () => {
  it('er summen af det, der bevægede sig på bufferen — i hvert eneste år', () => {
    const plan = aSurplusPlan()

    for (const year of simulateChecked(plan)) {
      expect(surplus(year, plan.buffer), `overskuddet knækker i ${year.year}`).toBeCloseTo(
        flowsOntoBuffer(year, plan),
        6,
      )
    }
  })

  it('holder også, når planen ikke bærer sig selv efter erhvervsophøret', () => {
    // Den samme identitet, men nu med rater, en overførsel ind, folkepension
    // og en omsat livrentes ydelse i regnestykket — de fire slags bevægelser,
    // den første plan aldrig når forbi.
    const plan = aDeficitPlan()
    const years = simulateChecked(plan)

    for (const year of years) {
      expect(surplus(year, plan.buffer), `overskuddet knækker i ${year.year}`).toBeCloseTo(
        flowsOntoBuffer(year, plan),
        6,
      )
    }

    // Testen prøver kun det, den siger, hvis planen faktisk skifter fortegn.
    // Lønåret bærer sig selv; erhvervsophørsåret gør ikke, for raterne
    // begynder først som 67.
    const yearOf = (calendar: number) => years.find((year) => year.year === calendar)!
    expect(surplus(yearOf(2030), plan.buffer)).toBeGreaterThan(0)
    expect(surplus(yearOf(2031), plan.buffer)).toBeLessThan(0)
  })

  it('står højere i et år med en rate end i det samme år uden', () => {
    // Det er hele grunden til, at kolonnen skiftede navn. Raten er ikke en
    // indtægt, men dens skat er en skat, og det gamle nettoresultat faldt
    // derfor netop det år, ordningen begyndte at betale regningerne.
    const untouched = aRetiredPlan()
    const emptying = aRetiredPlan({ start: 67, duration: 10, principle: 'AnnuityPrinciple' })
    const idle = simulateChecked(untouched)[0]!
    const paying = simulateChecked(emptying)[0]!

    expect(surplus(paying, emptying.buffer)).toBeGreaterThan(
      surplus(idle, untouched.buffer),
    )

    const netResult = (year: YearResult) =>
      year.income + year.return - year.tax - year.expenses
    expect(netResult(paying)).toBeLessThan(netResult(idle))
  })

  it('kan vise underskud i et år, hvor formuen alligevel vokser', () => {
    // Afkastet står uden for tallet, fordi det ikke er penge, husstanden kan
    // bruge, før der hæves. En ratepension, der forrenter sig kraftigt, mens
    // udgifterne betales af bufferen, er præcis det år, ADR-0026 beskriver:
    // året bar sig ikke selv, og formuen voksede alligevel.
    const plan = aPlan({
      startYear: 2040,
      horizon: 68,
      balance: 1_000_000,
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 67,
          balance: 5_000_000,
          grossReturn: 0.05,
          annualCostRate: 0,
        },
      ],
      entries: [anExpense({ amountInRealKroner: 150_000 })],
    })

    const first = simulateChecked(plan)[0]!

    expect(surplus(first, plan.buffer)).toBeLessThan(0)
    expect(first.closingWealth).toBeGreaterThan(first.openingWealth)
  })
})
