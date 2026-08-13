import { describe, expect, it } from 'vitest'
import type { HoldingVariant, Plan } from './plan'
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
  return aPlan({
    ...options,
    holdings: [
      {
        id: 'anden-beholdning',
        name: 'Anden beholdning',
        variant: 'CapitalIncome',
        balance: 0,
        grossReturn: options.grossReturn ?? 0,
        annualCostRate: options.annualCostRate ?? 0,
      },
    ],
  })
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

  it('fremskriver en udgift fra dagens kroner til løbende priser efter planens inflation', () => {
    // Udgiften har ingen egen sats — den følger planens inflation, som en
    // overførsel gør.
    const plan = aPlan({
      startYear: 2026,
      inflationAssumption: 0.02,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
    })

    const years = simulateChecked(plan)

    expect(years[0]!.expenses).toBeCloseTo(40_000, 6)
    expect(years[1]!.expenses).toBeCloseTo(40_800, 6)
    expect(years[2]!.expenses).toBeCloseTo(41_616, 6)
  })

  it('fremskriver en indtægt efter dens egen reguleringssats, ikke efter inflationen', () => {
    // Hele grunden til, at indtægten har beholdt sit eget felt: lønnen stiger
    // 3 %, mens priserne stiger 2 %, og den forskel er det, der lægges til
    // side. Fulgte lønnen inflationen, ville forskellen forsvinde.
    const plan = aPlan({
      startYear: 2026,
      inflationAssumption: 0.02,
      entries: [aSalary({ amountInRealKroner: 500_000, regulationRate: 0.03 })],
    })

    const years = simulateChecked(plan)

    expect(years[0]!.income).toBeCloseTo(500_000, 6)
    expect(years[1]!.income).toBeCloseTo(515_000, 6)
    expect(years[2]!.income).toBeCloseTo(530_450, 6)
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

  it('afviser en plan, hvor en post peger på en ejer, der ikke findes', () => {
    // Posten talte med i årets indtægter, men ingen persons skatteopgørelse
    // så den — beløbet gik ubeskattet ind i formuen. Var perioden forankret
    // til en alder i stedet, styrtede motoren på ejerens fødselsår.
    const plan = aPlan({
      entries: [aSalary({ amountInRealKroner: 400_000, owner: 'findes-ikke' })],
    })

    expect(() => simulate(plan)).toThrow(/findes-ikke/)
  })

  it('lægger lønnen til årets indtægter og trækker årets skat af den', () => {
    const plan = aPlan({
      inflationAssumption: 0,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
    })

    const years = simulateChecked(plan)

    // Samme lønmodtager som facitcasen i skattemodulet: 600.000 kr. brutto,
    // Hvidovres 25,40 % kommuneskat og 0,72 % kirkeskat.
    expect(years[0]!.income).toBeCloseTo(600_000, 6)
    expect(years[0]!.tax).toBeCloseTo(220_505.59, 2)
    expect(bufferBalance(years[0]!)).toBeCloseTo(1_000_000 + 600_000 - 220_505.59, 2)
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

  it('regner uden kirkeskat, når personen ikke er medlem af folkekirken', () => {
    const entries = [aSalary({ amountInRealKroner: 600_000 })]
    const medlem = simulateChecked(aPlan({ entries }))
    const udenfor = simulateChecked(aPlan({ entries, churchMember: false }))

    expect(medlem[0]!.persons[0]!.tax.layers.churchTax.amount).toBeCloseTo(3_106.8, 2)
    expect(udenfor[0]!.persons[0]!.tax.layers.churchTax.amount).toBe(0)
    expect(udenfor[0]!.tax).toBeCloseTo(medlem[0]!.tax - 3_106.8, 2)
  })

  it('lader progressionslagene og loftet slå igennem på årets skat', () => {
    const plan = aPlan({
      inflationAssumption: 0,
      entries: [aSalary({ amountInRealKroner: 950_000 })],
    })

    const years = simulateChecked(plan)

    // Samme lønmodtager som facitcasen, hvor det skrå skatteloft binder:
    // 950.000 kr. brutto, Hvidovres 25,40 % kommuneskat og 0,72 % kirkeskat.
    const { layers } = years[0]!.persons[0]!.tax
    expect(layers.middleBracketTax.amount).toBeCloseTo(16_668.48, 2)
    expect(layers.topBracketTax.amount).toBeCloseTo(6_880.76, 2)
    expect(years[0]!.tax).toBeCloseTo(394_833.43, 2)
  })

  it('bærer hvert skattelag for sig pr. person og stempler satsgrundlaget', () => {
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })

    const year = simulateChecked(plan)[0]!

    expect(year.rateBasis).toEqual({ knownYear: 2026, projected: false })
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
      churchTax: expect.closeTo(3_106.8, 2),
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
    // 8 % + 92 % × (12,01 % + 25,40 % + 0,72 %) = 43,0796 %.
    expect(year.persons[0]!.marginalTaxRate).toBeCloseTo(0.430796, 5)
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

    // Beholdningen er en opsparingskonto (fixturens standard), så afkastet
    // beskattes i samme åndedrag som det krediteres, jf. ADR-0010: bundskat
    // af hele beløbet, og topskat af de 5.000 kr. over kapitalindkomstens
    // eget bundfradrag på 55.000 — men bundskat og kommuneskat alene lægger
    // sig på 37,41 %, så topskattens 7,50 % sættes ned til 4,59 % af
    // kapitalindkomstens eget loft på 42 %.
    // Bundskat    60.000 × 12,01 %  = 7.206,00
    // Topskat      5.000 ×  4,59 %  =   229,50
    // Kommuneskat  5.900 × 25,40 %  = 1.498,60
    // Kirkeskat    5.900 ×  0,72 %  =    42,48
    //                                 ─────────
    //                                 8.976,58
    expect(years[0]!.tax).toBeCloseTo(8_976.58, 2)
    expect(bufferBalance(years[0]!)).toBeCloseTo(1_000_000 + 60_000 - 8_976.58, 2)
  })

  it('fører afkastet af en opsparingskonto som ejerens kapitalindkomst', () => {
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

  it('lagerbeskatter et aktiedepots afkast med 27/42 % om progressionsgrænsen', () => {
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

    // Skatten bæres som husstandens to lag og ikke kun som en total, så
    // forklar-året kan vise grundlag og sats, jf. ADR-0014.
    expect(year.shareIncomeTax.shareIncomeBelowThreshold?.amount).toBeCloseTo(21_438, 2)
    expect(year.shareIncomeTax.shareIncomeAboveThreshold?.amount).toBeCloseTo(8_652, 2)
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
            municipality: 'Hvidovre',
            churchMember: true,
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

describe('kommune- og kirkeskat', () => {
  it('slår personens kommune op i satsåret og beskatter med kommunens sats', () => {
    // Hvidovre 2026: 25,40 % kommuneskat, 0,72 % kirkeskat, jf.
    // docs/satser/2026.md. Samme lønmodtager som facitcasen i skattemodulet,
    // men kirkeskatten er nu kommunens egen sats frem for et tal på planen.
    const plan = aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      municipality: 'Hvidovre',
      churchMember: true,
    })

    const year = simulateChecked(plan)[0]!
    const { layers } = year.persons[0]!.tax

    expect(layers.municipalTax.amount).toBeCloseTo(109_601, 2)
    expect(layers.churchTax.amount).toBeCloseTo(3_106.8, 2)
  })

  it('beskatter to personer i samme husstand efter hver sin kommune', () => {
    // Jesper bor i Hvidovre (25,40 % / 0,72 %), Maria i København
    // (23,39 % / 0,80 %) — samme løn, forskellig kommune, jf.
    // docs/satser/2026.md. Beviser opslaget er pr. person, ikke pr. husstand.
    const base = aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000, owner: 'jesper' })],
      municipality: 'Hvidovre',
      churchMember: true,
    })
    const plan: Plan = {
      ...base,
      entries: [
        ...base.entries,
        { ...aSalary({ amountInRealKroner: 600_000, owner: 'maria' }), id: 'salary-maria' },
      ],
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
            municipality: 'København',
            churchMember: true,
            holdings: [],
          },
        ],
      },
    }

    const year = simulateChecked(plan)[0]!
    const jesper = year.persons.find((p) => p.person === 'jesper')!
    const maria = year.persons.find((p) => p.person === 'maria')!

    expect(jesper.tax.layers.municipalTax.amount).toBeCloseTo(109_601, 2)
    expect(jesper.tax.layers.churchTax.amount).toBeCloseTo(3_106.8, 2)
    expect(maria.tax.layers.municipalTax.amount).toBeCloseTo(100_927.85, 2)
    expect(maria.tax.layers.churchTax.amount).toBeCloseTo(3_452, 2)
  })

  it('holder kommune- og kirkeskatteprocenten uændret i et fremskrevet simuleringsår', () => {
    // birthYear 1973 + horizon 54 = 2027: 2026 er kendt, 2027 er fremskrevet.
    // Kommune- og kirkeskatteprocenten fremskrives efter sidst kendte
    // satsår med samme mekanisme som de øvrige procentsatser — den holdes
    // konstant, jf. issue #19.
    const plan = aPlan({ horizon: 54, entries: [aSalary({ amountInRealKroner: 600_000 })] })

    const years = simulateChecked(plan)
    const known = years[0]!.persons[0]!.tax.layers
    const projected = years[1]!.persons[0]!.tax.layers

    expect(projected.municipalTax.rate).toBeCloseTo(known.municipalTax.rate, 10)
    expect(projected.churchTax.rate).toBeCloseTo(known.churchTax.rate, 10)
  })
})

describe('satsfremskrivning', () => {
  it('markerer kun de simuleringsår efter det sidst kendte satsår som fremskrevne', () => {
    // birthYear 1973 + horizon 54 = 2027: to år, 2026 (kendt) og 2027 (fremskrevet).
    const years = simulateChecked(aPlan({ horizon: 54 }))

    expect(years.map((year) => year.rateBasis)).toEqual([
      { knownYear: 2026, projected: false },
      { knownYear: 2026, projected: true },
    ])
  })

  it('lader en ændret § 20-fremskrivning slå igennem i det fremskrevne år, men ikke i det kendte', () => {
    const build = (section20ProjectionAssumption: number) =>
      aPlan({
        horizon: 54,
        inflationAssumption: 0,
        section20ProjectionAssumption,
        entries: [aSalary({ amountInRealKroner: 600_000 })],
      })

    const low = simulateChecked(build(0))
    const high = simulateChecked(build(0.05))

    // 2026 er kendt for begge planer, uanset fremskrivningsantagelsen.
    expect(low[0]!.tax).toBeCloseTo(high[0]!.tax, 6)
    // 2027 er fremskrevet, så en højere § 20-sats løfter personfradrag og
    // øvrige grænser og giver en anden skat.
    expect(low[1]!.tax).not.toBeCloseTo(high[1]!.tax, 2)
  })

  it('holder balanceinvarianten i et fremskrevet år, også når fremskrivningen løfter beløbsgrænserne', () => {
    simulateChecked(
      aPlan({
        horizon: 54,
        section20ProjectionAssumption: 0.02,
        benefitProjectionAssumption: 0.02,
        entries: [
          aSalary({ amountInRealKroner: 950_000 }),
          anExpense({ amountInRealKroner: 200_000 }),
        ],
      }),
    )
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

  it('afviser en plan, hvor en overførsel peger på en beholdning, der ikke findes', () => {
    // Slettede man personen bag modtagerbeholdningen, blev overførslen
    // stående og flyttede penge ud i et ingenting: bufferen faldt, og
    // totalformuen blev NaN resten af årsrækken, uden et ord fra motoren.
    const plan = aPlan({
      transfers: [
        aTransfer({ from: 'free-assets', to: 'findes-ikke', amountInRealKroner: 10_000 }),
      ],
    })

    expect(() => simulate(plan)).toThrow(/findes-ikke/)
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

describe('pensionsbeholdninger', () => {
  it('forrenter en ratepension som enhver anden beholdning, med ÅOP trukket fra bruttoafkastet', () => {
    const plan = aPlan({
      balance: 0,
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          balance: 1_000_000,
          grossReturn: 0.07,
          annualCostRate: 0.005,
        },
      ],
    })

    const ratepension = simulateChecked(plan)[0]!.holdings.find(
      (holding) => holding.holding === 'ratepension',
    )!

    // Nettoafkastsatsen er 6,5 %, ikke 7 %: ÅOP er trukket fra, som i
    // enhver anden beholdning — jf. ADR-0003.
    expect(ratepension.return).toBeCloseTo(65_000, 6)
    expect(ratepension.closingBalance).toBeCloseTo(1_065_000, 6)
  })

  it('holder en pensionsbeholdnings afkast ude af personens kapitalindkomst', () => {
    // Samme beholdning to gange, kun varianten skiftet: afkastet er
    // kapitalindkomst i den ene og ingen personindkomst i den anden. Det er
    // varianten alene, der afgør det, jf. ADR-0010 — beskatningen er ikke et
    // felt ved siden af den.
    const holding = {
      id: 'ordning',
      name: 'Ordning',
      balance: 1_000_000,
      grossReturn: 0.07,
      annualCostRate: 0.005,
    }
    const first = (variant: HoldingVariant) =>
      simulateChecked(aPlan({ balance: 0, holdings: [{ ...holding, variant }] }))[0]!

    const fri = first('CapitalIncome')
    const ratepension = first('InstalmentPension')

    expect(fri.persons[0]!.capitalIncome).toBeCloseTo(65_000, 6)
    expect(ratepension.persons[0]!.capitalIncome).toBe(0)
    expect(ratepension.persons[0]!.shareIncome).toBe(0)
    expect(ratepension.tax).toBeLessThan(fri.tax)
  })

  const pensionVariants: HoldingVariant[] = ['InstalmentPension', 'LifeAnnuity', 'OldAgeSavings']

  it.each(pensionVariants)(
    'forrenter %s efter samme regel som enhver anden beholdning',
    (variant) => {
      const plan = aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ordning',
            name: 'Ordning',
            variant,
            balance: 500_000,
            grossReturn: 0.06,
            annualCostRate: 0.01,
          },
        ],
      })

      const ordning = simulateChecked(plan)[0]!.holdings.find(
        (holding) => holding.holding === 'ordning',
      )!

      expect(ordning.return).toBeCloseTo(25_000, 6)
      expect(ordning.closingBalance).toBeCloseTo(525_000, 6)
    },
  )

  it('afviser en plan, hvor bufferen er en pensionsbeholdning', () => {
    // Bufferen bærer årets restpost, og en ordning kan ikke modtage frit
    // forbrug: pengene ind i den er en indbetaling med et loft og en
    // skattevirkning, jf. ADR-0016. Bufferen er frie midler.
    const plan = {
      ...aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension' as const,
            balance: 1_000_000,
            grossReturn: 0,
            annualCostRate: 0,
          },
        ],
      }),
      buffer: 'ratepension',
    }

    expect(() => simulate(plan)).toThrow(/frie midler/i)
  })

  it('afviser en overførsel med en pensionsbeholdning i den ene eller den anden ende', () => {
    // En flytning ind i en ordning er en indbetaling og ikke en overførsel,
    // uanset hvor pengene kom fra, jf. ADR-0016 — og den anden vej ud er en
    // udbetaling, som hører i etape 3.
    const withTransfer = (from: string, to: string) => ({
      ...aPlan({
        balance: 1_000_000,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension' as const,
            balance: 1_000_000,
            grossReturn: 0,
            annualCostRate: 0,
          },
        ],
        transfers: [aTransfer({ from, to, amountInRealKroner: 10_000 })],
      }),
    })

    expect(() => simulate(withTransfer('free-assets', 'ratepension'))).toThrow(
      /indbetaling/i,
    )
    expect(() => simulate(withTransfer('ratepension', 'free-assets'))).toThrow(
      /frie midler/i,
    )
  })
})

