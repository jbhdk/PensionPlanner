import { describe, expect, it } from 'vitest'
import { payoutYear } from './payoutAge'
import type { PensionSchemeHolding, Person } from './plan'
import { aPlan } from './testing/planFixture'

/** En ratepension med en tastet pensionsudbetalingsalder. Saldo og satser er
    nul — intet her regner på penge. */
function aPension(payoutAge: number): PensionSchemeHolding {
  return {
    id: 'ratepension',
    name: 'Ratepension',
    variant: 'InstalmentPension',
    balance: 0,
    grossReturn: 0,
    annualCostRate: 0,
    payoutAge,
  }
}

function aPerson(birthYear: number, birthMonth = 6): Person {
  return aPlan({ birthYear, birthMonth }).household.persons[0]!
}

describe('payoutYear', () => {
  it('skubber året over årsskiftet, når fødselsmåneden gør det ved en brøkalder', () => {
    // En ordning med tastet udbetalingsalder 69,5. En januarfødt når den i
    // juli 2052, mens en julifødt først når den i januar 2053. Begge år
    // indeholder lovlige udbetalingsmåneder, og derfor sammenlignes der i
    // kalenderår.
    const ordning = aPension(69.5)
    expect(payoutYear(ordning, aPerson(1983, 1))).toBe(2052)
    expect(payoutYear(ordning, aPerson(1983, 7))).toBe(2053)
  })

  it('giver fødselsåret plus alderen, når udbetalingsalderen er et helt år', () => {
    const gammel = aPension(60)
    expect(payoutYear(gammel, aPerson(1973, 1))).toBe(2033)
    expect(payoutYear(gammel, aPerson(1973, 12))).toBe(2033)
  })

  it('læser den tastede alder direkte og udleder intet fra ejerens fødselsdato ud over kalenderåret', () => {
    // To ordninger med samme ejer men forskellig tastet alder giver
    // forskellige år — der er intet regime, der kunne overtrumfe det tastede
    // tal, jf. ADR-0032.
    const person = aPerson(1973)
    expect(payoutYear(aPension(60), person)).toBe(2033)
    expect(payoutYear(aPension(67), person)).toBe(2040)
  })
})
