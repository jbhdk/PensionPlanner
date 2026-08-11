import { describe, expect, it } from 'vitest'
import type { Plan } from './plan'
import { simulate } from './simulate'
import {
  aPlan,
  aSalary,
  aTaxFreeIncome,
  anExpense,
  aTransfer,
  bufferBalance,
} from './testing/planFixture'
import { simulateChecked } from './testing/simulateChecked'
import type { YearResult } from './yearResult'

/** Fixturens buffer ("free-assets") plus én beholdning til, med samme
    bruttoafkast som bufferen, så en overførsel har et sted at flytte penge
    hen. */
function aPlanWithSecondHolding(options: Parameters<typeof aPlan>[0] = {}): Plan {
  const base = aPlan(options)
  return {
    ...base,
    household: {
      persons: [
        {
          ...base.household.persons[0]!,
          holdings: [
            ...base.household.persons[0]!.holdings,
            {
              id: 'anden-beholdning',
              name: 'Anden beholdning',
              variant: 'CapitalIncome',
              balance: 0,
              grossReturn: options.grossReturn ?? 0,
              annualCostRate: options.annualCostRate ?? 0,
            },
          ],
        },
      ],
    },
  }
}

describe('simulate', () => {
  it('løber fra planens startår til og med personens horisont, ét kalenderår ad gangen', () => {
    const plan = aPlan({ startYear: 2026, birthYear: 1973, horizon: 90 })

    const years = simulateChecked(plan).map((year) => year.year)

    expect(years[0]).toBe(2026)
    expect(years.at(-1)).toBe(2063)
    expect(years).toHaveLength(2063 - 2026 + 1)
  })

  it('bærer formuen fra år til år, når planen ingen poster har', () => {
    const plan = aPlan({ balance: 1_000_000, entries: [] })

    const years = simulateChecked(plan)

    expect(years[0]!.openingWealth).toBe(1_000_000)
    for (const [index, year] of years.entries()) {
      expect(year.closingWealth).toBe(1_000_000)
      if (index > 0) {
        expect(year.openingWealth).toBe(years[index - 1]!.closingWealth)
      }
    }
  })

  it('trækker udgiftsposten fra bufferen hvert år', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
    })

    const years = simulateChecked(plan)

    expect(years[0]!.expenses).toBe(40_000)
    expect(years[0]!.closingWealth).toBe(960_000)
    expect(years[1]!.closingWealth).toBe(920_000)
    expect(bufferBalance(years[1]!)).toBe(920_000)
  })

  it('lader en engangsudgift falde i ét år alene, når gentagelsen er "Once"', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      entries: [
        anExpense({
          amountInRealKroner: 320_000,
          period: { anchor: 'CalendarYear', from: 2029 },
          recurrence: { kind: 'Once' },
        }),
      ],
    })

    const years = simulateChecked(plan)

    expect(years.find((y) => y.year === 2028)!.expenses).toBe(0)
    expect(years.find((y) => y.year === 2029)!.expenses).toBe(320_000)
    expect(years.find((y) => y.year === 2030)!.expenses).toBe(0)
  })

  it('bærer årets aktive poster i entries, og udelader dem uden for deres periode', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      entries: [
        aSalary({ amountInRealKroner: 600_000 }),
        anExpense({
          amountInRealKroner: 320_000,
          period: { anchor: 'CalendarYear', from: 2029 },
          recurrence: { kind: 'Once' },
        }),
      ],
    })

    const years = simulateChecked(plan)
    const entriesIn = (year: number) => years.find((y) => y.year === year)!.entries

    expect(entriesIn(2028)).toEqual([{ entry: 'salary', amount: 600_000 }])
    expect(entriesIn(2029)).toEqual([
      { entry: 'salary', amount: 600_000 },
      { entry: 'living-costs', amount: 320_000 },
    ])
  })

  it('summerer to overlappende poster korrekt i de år, hvor begges perioder dækker', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      entries: [
        anExpense({
          amountInRealKroner: 100_000,
          period: { anchor: 'CalendarYear', from: 2026, to: 2035 },
        }),
        anExpense({
          amountInRealKroner: 60_000,
          period: { anchor: 'CalendarYear', from: 2030 },
        }),
      ],
    })

    const years = simulateChecked(plan)
    const expensesIn = (year: number) => years.find((y) => y.year === year)!.expenses

    expect(expensesIn(2028)).toBe(100_000)
    expect(expensesIn(2032)).toBe(160_000)
    expect(expensesIn(2040)).toBe(60_000)
  })

  it('lader en post med "Hvert N. år" falde med det interval, uden at ramme årene imellem', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      entries: [
        anExpense({
          amountInRealKroner: 420_000,
          period: { anchor: 'CalendarYear', from: 2028 },
          recurrence: { kind: 'EveryNYears', n: 8 },
        }),
      ],
    })

    const years = simulateChecked(plan)
    const expensesIn = (year: number) => years.find((y) => y.year === year)!.expenses

    expect(expensesIn(2028)).toBe(420_000)
    expect(expensesIn(2031)).toBe(0)
    expect(expensesIn(2036)).toBe(420_000)
  })

  it('forankrer en post til en fast alder, så perioden følger personens fødselsår', () => {
    const plan = aPlan({
      startYear: 2026,
      birthYear: 1973,
      balance: 1_000_000,
      inflationAssumption: 0,
      entries: [
        anExpense({
          amountInRealKroner: 110_000,
          period: { anchor: 'PersonAge', from: 70, to: 80 },
        }),
      ],
    })

    const years = simulateChecked(plan)
    const expensesIn = (year: number) => years.find((y) => y.year === year)!.expenses

    // Jesper er født 1973, så alder 70 falder i 2043 og alder 80 i 2053.
    expect(expensesIn(2042)).toBe(0)
    expect(expensesIn(2043)).toBe(110_000)
    expect(expensesIn(2053)).toBe(110_000)
    expect(expensesIn(2054)).toBe(0)
  })

  it('flytter en aldersforankret post, der peger på erhvervsophør, når workEndAge ændres — uden at posten redigeres', () => {
    const entries = [
      aSalary({
        amountInRealKroner: 600_000,
        period: { anchor: 'PersonAge', to: 'WorkEndAge' },
      }),
    ]
    const stopperTidligt = aPlan({
      startYear: 2026,
      birthYear: 1973,
      workEndAge: 58,
      inflationAssumption: 0,
      entries,
    })
    const stopperSent = aPlan({
      startYear: 2026,
      birthYear: 1973,
      workEndAge: 65,
      inflationAssumption: 0,
      entries,
    })

    const tidligt = simulateChecked(stopperTidligt)
    const sent = simulateChecked(stopperSent)

    // Født 1973: alder 58 falder i 2031, alder 65 i 2038 — samme post, ingen
    // redigering, kun workEndAge der flytter.
    expect(tidligt.find((y) => y.year === 2031)!.income).toBeCloseTo(600_000, 6)
    expect(tidligt.find((y) => y.year === 2032)!.income).toBe(0)
    expect(sent.find((y) => y.year === 2031)!.income).toBeCloseTo(600_000, 6)
    expect(sent.find((y) => y.year === 2038)!.income).toBeCloseTo(600_000, 6)
    expect(sent.find((y) => y.year === 2039)!.income).toBe(0)
  })

  it('fremskriver postens beløb fra dagens kroner til løbende priser efter dens egen reguleringssats', () => {
    const plan = aPlan({
      startYear: 2026,
      inflationAssumption: 0,
      entries: [anExpense({ amountInRealKroner: 40_000, regulationRate: 0.02 })],
    })

    const years = simulateChecked(plan)

    expect(years[0]!.expenses).toBeCloseTo(40_000, 6)
    expect(years[1]!.expenses).toBeCloseTo(40_800, 6)
    expect(years[2]!.expenses).toBeCloseTo(41_616, 6)
  })

  it('lader bufferen gå negativt frem for at rette planen', () => {
    const plan = aPlan({
      balance: 100_000,
      inflationAssumption: 0,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
    })

    const years = simulateChecked(plan)

    expect(bufferBalance(years[2]!)).toBe(-20_000)
    expect(bufferBalance(years[3]!)).toBe(-60_000)
    expect(years[3]!.closingWealth).toBe(-60_000)
  })

  it('er ren: samme plan giver samme årsrække, og planen røres ikke', () => {
    const plan = aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })
    const before = JSON.stringify(plan)

    expect(simulateChecked(plan)).toEqual(simulateChecked(plan))
    expect(JSON.stringify(plan)).toBe(before)
  })

  it('afviser en plan, hvis bufferpegeren ikke rammer en beholdning', () => {
    const plan = { ...aPlan(), buffer: 'findes-ikke' }

    expect(() => simulate(plan)).toThrow(/buffer/i)
  })

  it('lægger lønnen til årets indtægter og trækker årets skat af den', () => {
    const plan = aPlan({
      inflationAssumption: 0,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
    })

    const years = simulateChecked(plan)

    // Samme lønmodtager som facitcasen i skattemodulet: 600.000 kr. brutto,
    // 25,40 % kommuneskat og 0,74 % kirkeskat.
    expect(years[0]!.income).toBeCloseTo(600_000, 6)
    expect(years[0]!.tax).toBeCloseTo(220_591.89, 2)
    expect(bufferBalance(years[0]!)).toBeCloseTo(1_000_000 + 600_000 - 220_591.89, 2)
  })

  it('lader en skattefri indtægtspost øge formuen uden at udløse skat', () => {
    const plan = aPlan({
      entries: [aTaxFreeIncome({ amountInRealKroner: 900_000 })],
    })

    const years = simulateChecked(plan)

    expect(years[0]!.income).toBeCloseTo(900_000, 6)
    expect(years[0]!.tax).toBe(0)
    expect(bufferBalance(years[0]!)).toBeCloseTo(1_900_000, 6)
  })

  it('regner uden kirkeskat, når husstanden ikke betaler den', () => {
    const entries = [aSalary({ amountInRealKroner: 600_000 })]
    const medlem = simulateChecked(aPlan({ entries }))
    const udenfor = simulateChecked(aPlan({ entries, churchTax: false }))

    expect(medlem[0]!.persons[0]!.tax.layers.churchTax.amount).toBeCloseTo(3_193.1, 2)
    expect(udenfor[0]!.persons[0]!.tax.layers.churchTax.amount).toBe(0)
    expect(udenfor[0]!.tax).toBeCloseTo(medlem[0]!.tax - 3_193.1, 2)
  })

  it('lader progressionslagene og loftet slå igennem på årets skat', () => {
    const plan = aPlan({
      inflationAssumption: 0,
      entries: [aSalary({ amountInRealKroner: 950_000 })],
    })

    const years = simulateChecked(plan)

    // Samme lønmodtager som facitcasen, hvor det skrå skatteloft binder:
    // 950.000 kr. brutto, 25,40 % kommuneskat og 0,74 % kirkeskat.
    const { layers } = years[0]!.persons[0]!.tax
    expect(layers.middleBracketTax.amount).toBeCloseTo(16_668.48, 2)
    expect(layers.topBracketTax.amount).toBeCloseTo(6_880.76, 2)
    expect(years[0]!.tax).toBeCloseTo(394_984.13, 2)
  })

  it('bærer hvert skattelag for sig pr. person og stempler satsgrundlaget', () => {
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })

    const year = simulateChecked(plan)[0]!

    expect(year.rateYear).toBe(2026)
    expect(year.persons.map((person) => person.person)).toEqual(['jesper'])

    const { tax } = year.persons[0]!
    expect(tax.rateYear).toBe(2026)
    // Beløbet for hvert lag, ikke hele LayerAmount — men stadig hele
    // objektet, ikke ét felt ad gangen, så et glemt lag stadig ville stå
    // uden nøgle her og fejle testen.
    const amounts = Object.fromEntries(
      Object.entries(tax.layers).map(([layer, { amount }]) => [layer, amount]),
    )
    expect(amounts).toEqual({
      labourMarketContribution: expect.closeTo(48_000, 2),
      bottomBracketTax: expect.closeTo(59_797.79, 2),
      municipalTax: expect.closeTo(109_601, 2),
      churchTax: expect.closeTo(3_193.1, 2),
      // 552.000 i personlig indkomst ligger under mellemskattegrænsen. De tre
      // progressionslag står som nul frem for at mangle — hvert lag er der
      // altid, så et lag ikke kan blive glemt i summen.
      middleBracketTax: 0,
      topBracketTax: 0,
      additionalTopBracketTax: 0,
    })

    // Begge fradrag er i loft ved 600.000, og personlig indkomst ligger
    // under mellemskattegrænsen: næste krone koster kun AM-bidrag, bundskat,
    // kommune- og kirkeskat, ingen af dem loftbegrænsede ved denne kommunesats.
    // 8 % + 92 % × (12,01 % + 25,40 % + 0,74 %) = 43,098 %.
    expect(year.persons[0]!.marginalTaxRate).toBeCloseTo(0.43098, 5)
  })

  it('krediterer nettoafkastet på beholdningens primosaldo, når planen ingen strømme har', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      grossReturn: 0.07,
      annualCostRate: 0.01,
      entries: [],
    })

    const years = simulateChecked(plan)

    // Nettoafkastsatsen er 6 %, og uden strømme er grundlaget bare primosaldoen.
    expect(years[0]!.return).toBeCloseTo(60_000, 6)
    expect(years[0]!.income).toBe(0)

    // Beholdningen er CapitalIncome (fixturens standard), så afkastet
    // beskattes i samme åndedrag som det krediteres, jf. ADR-0010: bundskat
    // af hele beløbet, og topskat af de 5.000 kr. over kapitalindkomstens
    // eget bundfradrag på 55.000 — men bundskat og kommuneskat alene lægger
    // sig på 37,41 %, så topskattens 7,50 % sættes ned til 4,59 % af
    // kapitalindkomstens eget loft på 42 %.
    // Bundskat    60.000 × 12,01 %  = 7.206,00
    // Topskat      5.000 ×  4,59 %  =   229,50
    // Kommuneskat  5.900 × 25,40 %  = 1.498,60
    // Kirkeskat    5.900 ×  0,74 %  =    43,66
    //                                 ─────────
    //                                 8.977,76
    expect(years[0]!.tax).toBeCloseTo(8_977.76, 2)
    expect(bufferBalance(years[0]!)).toBeCloseTo(1_000_000 + 60_000 - 8_977.76, 2)
  })

  it('fører afkastet af en CapitalIncome-beholdning som ejerens kapitalindkomst', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      grossReturn: 0.07,
      annualCostRate: 0.01,
      entries: [],
    })

    const person = simulateChecked(plan)[0]!.persons[0]!

    expect(person.capitalIncome).toBeCloseTo(60_000, 6)
    expect(person.shareIncome).toBe(0)
  })

  it('bogfører afkastet for sig og ikke som en indtægt i pengestrømmen', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      grossReturn: 0.07,
      annualCostRate: 0.01,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
    })

    const years = simulateChecked(plan)

    // Indtægten er kun lønnen — afkastet står i sit eget felt. Lønnen er
    // jævnt fordelt og vejer derfor med ½ i afkastgrundlaget.
    expect(years[0]!.income).toBeCloseTo(600_000, 6)
    expect(years[0]!.return).toBeCloseTo(0.06 * (1_000_000 + 0.5 * 600_000), 6)
  })

  it('vejer en strøm i januar tungere end den samme strøm i december, efter Modified Dietz', () => {
    const early = simulateChecked(
      aPlan({
        balance: 1_000_000,
        inflationAssumption: 0,
        grossReturn: 0.07,
        annualCostRate: 0.01,
        entries: [aTaxFreeIncome({ amountInRealKroner: 600_000, timing: 1 })],
      }),
    )
    const late = simulateChecked(
      aPlan({
        balance: 1_000_000,
        inflationAssumption: 0,
        grossReturn: 0.07,
        annualCostRate: 0.01,
        entries: [aTaxFreeIncome({ amountInRealKroner: 600_000, timing: 12 })],
      }),
    )

    // Vægt januar = (12−1+1)/12 = 1; vægt december = (12−12+1)/12 = 1/12.
    expect(early[0]!.return).toBeCloseTo(0.06 * (1_000_000 + 1 * 600_000), 6)
    expect(late[0]!.return).toBeCloseTo(0.06 * (1_000_000 + (1 / 12) * 600_000), 6)
    expect(early[0]!.return).toBeGreaterThan(late[0]!.return)
  })

  it('giver en jævnt fordelt strøm vægten ½', () => {
    const years = simulateChecked(
      aPlan({
        balance: 1_000_000,
        inflationAssumption: 0,
        grossReturn: 0.07,
        annualCostRate: 0.01,
        entries: [aTaxFreeIncome({ amountInRealKroner: 600_000, timing: 'Even' })],
      }),
    )

    expect(years[0]!.return).toBeCloseTo(0.06 * (1_000_000 + 0.5 * 600_000), 6)
  })

  it('bærer afkastet pr. beholdning i YearResult, ikke kun husstandens samlede', () => {
    const base = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      grossReturn: 0.07,
      annualCostRate: 0.01,
      entries: [],
    })
    const plan: Plan = {
      ...base,
      household: {
        persons: [
          {
            ...base.household.persons[0]!,
            holdings: [
              ...base.household.persons[0]!.holdings,
              {
                id: 'anden-beholdning',
                name: 'Anden beholdning',
                variant: 'CapitalIncome',
                balance: 500_000,
                grossReturn: 0.04,
                annualCostRate: 0.005,
              },
            ],
          },
        ],
      },
    }

    const year = simulateChecked(plan)[0]!

    const buffer = year.holdings.find((h) => h.holding === 'free-assets')!
    const anden = year.holdings.find((h) => h.holding === 'anden-beholdning')!

    expect(buffer.return).toBeCloseTo(0.06 * 1_000_000, 6)
    expect(anden.return).toBeCloseTo(0.035 * 500_000, 6)
    expect(year.return).toBeCloseTo(buffer.return + anden.return, 6)
  })

  it('lagerbeskatter en ShareIncome-beholdnings afkast med 27/42 % om progressionsgrænsen', () => {
    const plan = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      variant: 'ShareIncome',
      grossReturn: 0.1,
      annualCostRate: 0,
      entries: [],
    })

    const year = simulateChecked(plan)[0]!

    // Afkastet er 100.000 kr., 20.600 kr. over den enlige persons egen
    // progressionsgrænse på 79.400 kr.
    // 27 % af  79.400 = 21.438,00
    // 42 % af  20.600 =  8.652,00
    //                    ─────────
    //                    30.090,00
    expect(year.persons[0]!.shareIncome).toBeCloseTo(100_000, 6)
    expect(year.tax).toBeCloseTo(30_090, 2)
  })

  it('facitcase: et par deler aktieindkomstens progressionsgrænse på tværs', () => {
    // Kilde: docs/satser/2026.md — progressionsgrænsen for aktieindkomst er
    // 79.400 kr. pr. person og fælles og overførbar mellem ægtefæller, så
    // parret tilsammen har 158.800 kr. til 27 %. Verificeret 2026-08-10.
    //
    // Jesper har 40.000 kr. i aktieindkomst — under sin egen grænse — og
    // Maria har 140.000 kr. — over sin egen. Delte de ikke grænsen, ville
    // Jespers ubrugte rum gå tabt, og husstanden betale mere:
    //   uden deling: 40.000 × 27 % + 79.400 × 27 % + 60.600 × 42 %
    //              =  10.800,00   +  21.438,00     +  25.452,00 = 57.690,00
    // Med den fælles grænse er det den samlede aktieindkomst, 180.000 kr.,
    // der prøves mod den samlede grænse, 158.800 kr.:
    //   27 % af 158.800 = 42.876,00
    //   42 % af  21.200 =  8.904,00
    //                      ─────────
    //                      51.780,00
    const base = aPlan({
      balance: 1_000_000,
      inflationAssumption: 0,
      variant: 'ShareIncome',
      grossReturn: 0.04,
      annualCostRate: 0,
      entries: [],
    })
    const plan: Plan = {
      ...base,
      household: {
        persons: [
          ...base.household.persons,
          {
            id: 'maria',
            name: 'Maria',
            birthYear: 1973,
            birthMonth: 6,
            workEndAge: 58,
            horizon: 90,
            holdings: [
              {
                id: 'marias-aktier',
                name: 'Marias frie midler',
                variant: 'ShareIncome',
                balance: 2_000_000,
                grossReturn: 0.07,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    const year = simulateChecked(plan)[0]!
    const jesper = year.persons.find((p) => p.person === 'jesper')!
    const maria = year.persons.find((p) => p.person === 'maria')!

    expect(jesper.shareIncome).toBeCloseTo(40_000, 6)
    expect(maria.shareIncome).toBeCloseTo(140_000, 6)
    expect(year.tax).toBeCloseTo(51_780, 2)
  })

  it('bærer hvert fradrag for sig i årsresultatet', () => {
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })

    const { tax } = simulateChecked(plan)[0]!.persons[0]!

    // Fradragene står hver for sig og aldrig som én sum — forklar-året skal
    // kunne vise linjerne, og et fradrag i loft skal kunne kendes fra et,
    // der ikke er.
    expect(tax.allowances).toEqual({
      employmentAllowance: expect.closeTo(63_300, 2),
      jobAllowance: expect.closeTo(3_100, 2),
      // Etape 1 har ingen indbetalinger på planen, så det ekstra
      // pensionsfradrag står som nul frem for at mangle.
      extraPensionAllowance: 0,
    })

    // Og de nedsætter den skattepligtige indkomst, ikke den personlige.
    expect(tax.personalIncome).toBeCloseTo(552_000, 2)
    expect(tax.taxableIncome).toBeCloseTo(485_600, 2)
  })
})

describe('overførsler', () => {
  it('flytter beløbet fra afgiverens til modtagerens beholdning, uden at ændre totalformuen', () => {
    const plan = aPlanWithSecondHolding({
      balance: 1_000_000,
      inflationAssumption: 0,
      transfers: [
        aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 200_000 }),
      ],
    })

    const years = simulateChecked(plan)

    expect(bufferBalance(years[0]!)).toBe(800_000)
    expect(
      years[0]!.holdings.find((h) => h.holding === 'anden-beholdning')!.closingBalance,
    ).toBe(200_000)
    expect(years[0]!.closingWealth).toBe(1_000_000)
  })

  it('udløser ingen skat og optræder hverken som indtægt eller udgift', () => {
    const plan = aPlanWithSecondHolding({
      balance: 1_000_000,
      inflationAssumption: 0,
      transfers: [
        aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 200_000 }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    expect(year.income).toBe(0)
    expect(year.expenses).toBe(0)
    expect(year.tax).toBe(0)
  })

  it('vejer overførslens forfald ind i afkastgrundlaget i begge ender', () => {
    const early = simulateChecked(
      aPlanWithSecondHolding({
        balance: 1_000_000,
        inflationAssumption: 0,
        grossReturn: 0.12,
        transfers: [
          aTransfer({
            from: 'free-assets',
            to: 'anden-beholdning',
            amountInRealKroner: 600_000,
            timing: 1,
          }),
        ],
      }),
    )
    const late = simulateChecked(
      aPlanWithSecondHolding({
        balance: 1_000_000,
        inflationAssumption: 0,
        grossReturn: 0.12,
        transfers: [
          aTransfer({
            from: 'free-assets',
            to: 'anden-beholdning',
            amountInRealKroner: 600_000,
            timing: 12,
          }),
        ],
      }),
    )

    const buffer = (years: YearResult[]) =>
      years[0]!.holdings.find((h) => h.holding === 'free-assets')!.return
    const anden = (years: YearResult[]) =>
      years[0]!.holdings.find((h) => h.holding === 'anden-beholdning')!.return

    // Januar-forfald flytter mest af afkastgrundlaget: afgiveren mister det
    // meste af sit afkast, og modtageren får det meste af det.
    expect(buffer(early)).toBeLessThan(buffer(late))
    expect(anden(early)).toBeGreaterThan(anden(late))
  })

  it('bærer den vægtede strøm, der indgik i afkastgrundlaget, pr. beholdning', () => {
    const plan = aPlanWithSecondHolding({
      balance: 1_000_000,
      inflationAssumption: 0,
      transfers: [
        aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 200_000 }),
      ],
    })

    const year = simulateChecked(plan)[0]!
    const buffer = year.holdings.find((h) => h.holding === 'free-assets')!
    const anden = year.holdings.find((h) => h.holding === 'anden-beholdning')!

    // Jævnt forfald vejer halvt: 200.000 kr. bliver til 100.000 i grundlaget,
    // negativt hos afgiveren og positivt hos modtageren.
    expect(buffer.weightedFlow).toBeCloseTo(-100_000, 6)
    expect(anden.weightedFlow).toBeCloseTo(100_000, 6)
  })

  it('afviser en plan hvor to beholdninger er udpeget som samme buffer', () => {
    const base = aPlanWithSecondHolding()
    const plan: Plan = {
      ...base,
      buffer: 'delt-id',
      household: {
        persons: [
          {
            ...base.household.persons[0]!,
            holdings: base.household.persons[0]!.holdings.map((holding) => ({
              ...holding,
              id: 'delt-id',
            })),
          },
        ],
      },
    }

    expect(() => simulate(plan)).toThrow(/buffer/i)
  })

  it('mærker året ufuldstændig, når bufferen er negativ, men husstanden har likviditet andetsteds', () => {
    const plan = aPlanWithSecondHolding({
      balance: 0,
      inflationAssumption: 0,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
      transfers: [],
    })
    // Anden beholdning har rigeligt til at dække underskuddet, men ingen
    // overførsel flytter det derfra.
    const withLiquidity: Plan = {
      ...plan,
      household: {
        persons: [
          {
            ...plan.household.persons[0]!,
            holdings: plan.household.persons[0]!.holdings.map((holding) =>
              holding.id === 'anden-beholdning' ? { ...holding, balance: 500_000 } : holding,
            ),
          },
        ],
      },
    }

    const year = simulateChecked(withLiquidity)[0]!

    expect(bufferBalance(year)).toBeLessThan(0)
    expect(year.bufferState).toBe('Incomplete')
  })

  it('mærker året uholdbar, når husstandens samlede frie midler også er negative', () => {
    const plan = aPlanWithSecondHolding({
      balance: 0,
      inflationAssumption: 0,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
      transfers: [],
    })

    const year = simulateChecked(plan)[0]!

    expect(bufferBalance(year)).toBeLessThan(0)
    expect(year.bufferState).toBe('Unsustainable')
  })

  it('lader bufferState stå udefineret, når bufferen ikke er negativ', () => {
    const plan = aPlan({ balance: 1_000_000, entries: [] })

    const year = simulateChecked(plan)[0]!

    expect(year.bufferState).toBeUndefined()
  })

  it('lader en overførsel med et afgrænset kalenderårsinterval kun falde i de år, perioden dækker', () => {
    const plan = aPlanWithSecondHolding({
      balance: 1_000_000,
      inflationAssumption: 0,
      transfers: [
        aTransfer({
          from: 'free-assets',
          to: 'anden-beholdning',
          amountInRealKroner: 100_000,
          period: { from: 2028, to: 2028 },
        }),
      ],
    })

    const years = simulateChecked(plan)
    const anden = (year: number) =>
      years.find((y) => y.year === year)!.holdings.find((h) => h.holding === 'anden-beholdning')!
        .closingBalance

    expect(anden(2027)).toBe(0)
    expect(anden(2028)).toBe(100_000)
    expect(anden(2029)).toBe(100_000)
  })
})
