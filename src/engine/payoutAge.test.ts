import { describe, expect, it } from 'vitest'
import { payoutAge, payoutYear } from './payoutAge'
import type { OpenedOn, PensionSchemeHolding, Person } from './plan'
import { aPlan } from './testing/planFixture'

/** En ratepension med et oprettelsestidspunkt. Saldo og satser er nul —
    intet her regner på penge. */
function aPension(openedOn: OpenedOn, payoutAgeOverride?: number): PensionSchemeHolding {
  return {
    id: 'ratepension',
    name: 'Ratepension',
    variant: 'InstalmentPension',
    balance: 0,
    grossReturn: 0,
    annualCostRate: 0,
    openedOn,
    ...(payoutAgeOverride === undefined ? {} : { payoutAgeOverride }),
  }
}

function aPerson(birthYear: number, birthMonth = 6): Person {
  return aPlan({ birthYear, birthMonth }).household.persons[0]!
}

describe('payoutAge', () => {
  it('giver 60 år for en ordning oprettet før 1. maj 2007, uanset ejerens folkepensionsalder', () => {
    // Folkepensionsalderen er 70 for årgang 1973 og 72,5 for 1985. Det faste
    // regime rører sig ikke af den forskel — det er hele dets natur.
    const gammel = aPension({ year: 2001, month: 3 })
    expect(payoutAge(gammel, aPerson(1973))).toBe(60)
    expect(payoutAge(gammel, aPerson(1985))).toBe(60)
  })

  it('lader måneden afgøre skellet 1. maj 2007', () => {
    // Årgang 1973 har folkepensionsalder 70. En måned skiller de to
    // ordninger ad, og aldersforskellen er fem år.
    const person = aPerson(1973)
    expect(payoutAge(aPension({ year: 2007, month: 4 }), person)).toBe(60)
    expect(payoutAge(aPension({ year: 2007, month: 5 }), person)).toBe(65)
  })

  it('lader måneden afgøre skellet 1. januar 2018', () => {
    // Samme årgang, folkepensionsalder 70: fem år før mod tre år før.
    const person = aPerson(1973)
    expect(payoutAge(aPension({ year: 2017, month: 12 }), person)).toBe(65)
    expect(payoutAge(aPension({ year: 2018, month: 1 }), person)).toBe(67)
  })

  it('følger ejerens folkepensionsalder i de to relative regimer og ikke i det faste', () => {
    // Årgang 1973 har folkepensionsalder 70, årgang 1985 har 72,5. Rykker
    // fødselsdatoen et trin, følger de to relative aldre med — og den faste
    // står stille. Det er dét, der gør, at en ordning ikke skal rettes, når
    // skønnet for en persons folkepensionsalder ændres.
    const fast = aPension({ year: 2001, month: 3 })
    const fem = aPension({ year: 2010, month: 6 })
    const tre = aPension({ year: 2020, month: 6 })

    expect([fast, fem, tre].map((h) => payoutAge(h, aPerson(1973)))).toEqual([60, 65, 67])
    expect([fast, fem, tre].map((h) => payoutAge(h, aPerson(1985)))).toEqual([60, 67.5, 69.5])
  })

  it('lader den bevarede alder vinde over den udledte', () => {
    // Ordningen er oprettet i 2020 og ville ellers give 67 for denne årgang.
    // Er en lavere alder bevaret gennem en overførsel, er det den, der
    // gælder — regimet har intet at skulle have sagt.
    expect(payoutAge(aPension({ year: 2020, month: 6 }, 60), aPerson(1973))).toBe(60)
  })
})

describe('payoutYear', () => {
  it('skubber året over årsskiftet, når fødselsmåneden gør det ved en brøkalder', () => {
    // Årgang 1983 har folkepensionsalder 72,5, og en ordning fra 2020 må
    // udbetales tre år før — 69,5. En januarfødt når den i juli 2052, mens
    // en julifødt først når den i januar 2053. Begge år indeholder lovlige
    // udbetalingsmåneder, og derfor sammenlignes der i kalenderår.
    const ordning = aPension({ year: 2020, month: 6 })
    expect(payoutYear(ordning, aPerson(1983, 1))).toBe(2052)
    expect(payoutYear(ordning, aPerson(1983, 7))).toBe(2053)
  })

  it('giver fødselsåret plus alderen, når udbetalingsalderen er et helt år', () => {
    // Det faste regime er 60 for alle, og så er fødselsmåneden uden
    // betydning — heltalsalderen er formlens specialtilfælde.
    const gammel = aPension({ year: 2001, month: 3 })
    expect(payoutYear(gammel, aPerson(1973, 1))).toBe(2033)
    expect(payoutYear(gammel, aPerson(1973, 12))).toBe(2033)
  })
})
