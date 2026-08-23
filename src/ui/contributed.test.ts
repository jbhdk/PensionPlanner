import { describe, expect, it } from 'vitest'
import type { Contribution, Entry } from '../engine/plan'
import {
  aContribution,
  aHolding,
  aPlan,
  aSalary,
} from '../engine/testing/planFixture'
import { simulateChecked } from '../engine/testing/simulateChecked'
import { contributedInYear, placedByAgreements } from './contributed'

/** Fixturens buffer plus en ratepension, aftalen og indbetalingen kan mødes
    i. Uden afkast, så beløbene står alene. */
function aPlanWithPension(entries: Entry[], contributions: Contribution[] = []) {
  return aPlan({
    balance: 1_000_000,
    holdings: [
      aHolding({
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        balance: 0,
      }),
    ],
    entries,
    contributions,
  })
}

const agreement = {
  employerContribution: { percentageOfEntry: 0.12 },
  employeeContribution: { amountInRealKroner: 0 },
  allocation: [{ to: 'ratepension', form: 'Remainder' as const }],
}

describe('det året lagde til side', () => {
  it('lægger aftalens penge sammen med planens egne indbetalinger', () => {
    // Loftet var i forvejen en sum over flere kilder, og kolonnen er det af
    // samme grund: aftalen er én slags mere, jf. ADR-0041. 66.240 fra
    // aftalen og 27.600 fra indbetalingen.
    const plan = aPlanWithPension(
      [aSalary({ amountInRealKroner: 600_000, pensionAgreement: agreement })],
      [aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.05 })],
    )

    const year = simulateChecked(plan)[0]!

    expect(contributedInYear(year)).toBeCloseTo(93_840, 6)
  })

  it('tæller kun det, der landede — AM-delen ligger i årets skat', () => {
    const plan = aPlanWithPension([
      aSalary({ amountInRealKroner: 600_000, pensionAgreement: agreement }),
    ])

    const year = simulateChecked(plan)[0]!

    expect(placedByAgreements(year)).toBeCloseTo(66_240, 6)
    expect(contributedInYear(year)).toBeCloseTo(66_240, 6)
  })

  it('er nul i et år uden hverken aftale eller indbetaling', () => {
    const plan = aPlanWithPension([aSalary({ amountInRealKroner: 600_000 })])

    const year = simulateChecked(plan)[0]!

    expect(placedByAgreements(year)).toBe(0)
    expect(contributedInYear(year)).toBe(0)
  })
})
