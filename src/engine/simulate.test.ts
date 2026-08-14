import { describe, expect, it } from 'vitest'
import type { Contribution, HoldingVariant, Plan } from './plan'
import { simulate } from './simulate'
import { validatePlan } from './validatePlan'
import {
  aContribution,
  aHoldingContribution,
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
        variant: 'SavingsAccount',
        balance: 0,
        grossReturn: options.grossReturn ?? 0,
        annualCostRate: options.annualCostRate ?? 0,
      },
    ],
  })
}

/** Én beholdnings række i årets resultat. Beholdningen findes altid: planen
    er valideret, og rækkerne er åbnet på planens egne beholdninger. */
function holding(year: YearResult, id: string) {
  return year.holdings.find((h) => h.holding === id)!
}

/** De år, hvor der overhovedet faldt en indbetaling. Årsrækken er motorens
    eget svar på, hvornår et bidrag falder, jf. ADR-0012 — testene spørger
    den frem for at regne perioden om. */
function yearsWithContribution(years: YearResult[]): number[] {
  return years.filter((year) => year.contributions.length > 0).map((year) => year.year)
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

  it('lader en brøkalder ramme forskellige kalenderår efter fødselsmåneden', () => {
    // Et halvt år skubber endepunktet over et årsskifte for halvdelen af
    // fødselsmånederne: en junifødt fylder 65,5 i december 2038, mens en
    // septemberfødt først når det i marts 2039.
    const foersteUdgiftsaar = (birthMonth: number) => {
      const plan = aPlan({
        startYear: 2026,
        birthYear: 1973,
        birthMonth,
        balance: 1_000_000,
        inflationAssumption: 0,
        entries: [
          anExpense({
            amountInRealKroner: 110_000,
            period: { anchor: 'PersonAge', from: 65.5 },
          }),
        ],
      })

      return simulateChecked(plan).find((year) => year.expenses > 0)!.year
    }

    expect(foersteUdgiftsaar(6)).toBe(2038)
    expect(foersteUdgiftsaar(9)).toBe(2039)
  })

  it('lader en heltalsalder falde i fødselsåret plus alderen, uanset fødselsmåned', () => {
    // Værnet om, at den gamle adfærd er formlens specialtilfælde: en
    // decemberfødt har det største bidrag fra fødselsmåneden, 11/12, og
    // alligevel skal årstallet stå stille.
    const plan = aPlan({
      startYear: 2026,
      birthYear: 1973,
      birthMonth: 12,
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
    expect(layers.middleBracketTax.amount).toBeCloseTo(17_460, 2)
    expect(layers.topBracketTax.amount).toBeCloseTo(7_207.5, 2)
    expect(layers.taxCeilingRelief.amount).toBeCloseTo(-791.52, 2)
    expect(years[0]!.tax).toBeCloseTo(395_160.17, 2)
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
      // Loftnedslaget står som nul af samme grund: Hvidovres 25,40 % lægger
      // godt nok trappens første trin fri, men indkomsten når ikke op i det
      // lag, nedslaget måles af.
      taxCeilingRelief: 0,
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
                variant: 'SavingsAccount',
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
      variant: 'ShareDepot',
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
      variant: 'ShareDepot',
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
                variant: 'ShareDepot',
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

    const fri = first('SavingsAccount')
    const ratepension = first('InstalmentPension')

    expect(fri.persons[0]!.capitalIncome).toBeCloseTo(65_000, 6)
    expect(ratepension.persons[0]!.capitalIncome).toBe(0)
    expect(ratepension.persons[0]!.shareIncome).toBe(0)
    expect(ratepension.tax).toBeLessThan(fri.tax)
  })

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


describe('beholdningsskat', () => {
  it('trækker PAL-skatten af ratepensionens afkast, og lader afkastet stå brutto', () => {
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

    const ratepension = holding(simulateChecked(plan)[0]!, 'ratepension')

    // Nettoafkastsatsen er 6,5 %, ikke 7 %: ÅOP er trukket fra som i enhver
    // anden beholdning, jf. ADR-0003. PAL-skatten er 15,3 % af de 65.000.
    // Afkastet står brutto, så afkastsats og skattesats kan efterregnes hver
    // for sig; saldoen er nettet af skatten.
    expect(ratepension.return).toBeCloseTo(65_000, 6)
    expect(ratepension.tax).toBeCloseTo(9_945, 6)
    expect(ratepension.closingBalance).toBeCloseTo(1_055_055, 6)
  })

  it('lægger beholdningsskatten til årets samlede skat uden at trække den af bufferen', () => {
    // Ingen poster, så husstanden har hverken indtægt eller skat af egen
    // indkomst: årets skat er beholdningsskatten alene. Bufferen står
    // urørt — beholdningsskatten er trukket i beholdningen selv og passerer
    // aldrig pengestrømmen, jf. `HoldingTax`.
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

    const year = simulateChecked(plan)[0]!

    expect(year.tax).toBeCloseTo(9_945, 6)
    expect(bufferBalance(year)).toBeCloseTo(0, 6)
  })

  it.each(['InstalmentPension', 'LifeAnnuity', 'OldAgeSavings'] as HoldingVariant[])(
    'beskatter %s efter PAL-satsen — satsen følger varianten',
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

      const ordning = holding(simulateChecked(plan)[0]!, 'ordning')

      // ÅOP er trukket fra først som i enhver anden beholdning, jf. ADR-0003:
      // 5 % netto af 500.000 giver 25.000, og 15,3 % af dem er 3.825. De tre
      // ordninger deler sats, fordi varianttabellen giver dem samme række —
      // ikke fordi tre steder i motoren tilfældigvis siger det samme.
      expect(ordning.return).toBeCloseTo(25_000, 6)
      expect(ordning.tax).toBeCloseTo(3_825, 6)
      expect(ordning.closingBalance).toBeCloseTo(521_175, 6)
    },
  )

  it.each(['ShareDepot', 'SavingsAccount'] as HoldingVariant[])(
    'lader %s stå uden beholdningsskat — afkastet beskattes hos personen i stedet',
    (variant) => {
      const plan = aPlan({ balance: 1_000_000, variant, grossReturn: 0.05 })

      const year = simulateChecked(plan)[0]!

      expect(holding(year, 'free-assets').tax).toBe(0)
      // Afkastet er ikke ubeskattet: det er blot personens eller husstandens
      // skat, ikke beholdningens.
      expect(year.tax).toBeGreaterThan(0)
    },
  )

  it('lader et negativt afkast give en negativ beholdningsskat, uden gulv', () => {
    const plan = aPlan({
      balance: 0,
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          balance: 1_000_000,
          grossReturn: -0.1,
          annualCostRate: 0,
        },
      ],
    })

    const ratepension = holding(simulateChecked(plan)[0]!, 'ratepension')

    // Tabsåret giver penge tilbage frem for et nul: et negativt PAL-afkast er
    // fremførbart og bliver før eller siden til netop det. Gulvet ville gøre
    // saldoen for lav for altid.
    expect(ratepension.return).toBeCloseTo(-100_000, 6)
    expect(ratepension.tax).toBeCloseTo(-15_300, 6)
    expect(ratepension.closingBalance).toBeCloseTo(915_300, 6)
  })

  it('bærer den nettede saldo videre som næste års primosaldo', () => {
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

    const years = simulateChecked(plan)

    // Skatten falder før lukningen, som diagram 02 foreskriver — så næste år
    // forrenter den nettede saldo og ikke den brutto.
    expect(holding(years[1]!, 'ratepension').openingBalance).toBeCloseTo(1_055_055, 6)
    expect(holding(years[1]!, 'ratepension').return).toBeCloseTo(1_055_055 * 0.065, 6)
  })
})


describe('indbetalinger', () => {
  /** De tre ordninger, en indbetaling kan gå til. De to første deler
      `Deductibility`, den tredje har den ikke — det er hele skellet, testene
      herunder måler på. */
  const instalmentPension = {
    id: 'ratepension',
    name: 'Ratepension',
    variant: 'InstalmentPension',
  } as const
  const lifeAnnuity = { id: 'livrente', name: 'Livrente', variant: 'LifeAnnuity' } as const
  const oldAgeSavings = {
    id: 'aldersopsparing',
    name: 'Aldersopsparing',
    variant: 'OldAgeSavings',
  } as const

  /** Fixturens buffer plus én ordning at betale ind i. Uden afkast, med
      mindre testen beder om det — så står bevægelsen alene. */
  function aPlanWithScheme(
    scheme: { id: string; name: string; variant: HoldingVariant },
    options: Parameters<typeof aPlan>[0] = {},
  ): Plan {
    return aPlan({
      ...options,
      holdings: [
        {
          ...scheme,
          balance: 0,
          grossReturn: options.grossReturn ?? 0,
          annualCostRate: options.annualCostRate ?? 0,
        },
      ],
    })
  }

  /** Ordningen de fleste af testene herunder bruger. */
  function aPlanWithPension(options: Parameters<typeof aPlan>[0] = {}): Plan {
    return aPlanWithScheme(instalmentPension, options)
  }

  it('flytter et fast bidrag fra bufferen ind i ordningen', () => {
    const plan = aPlanWithPension({
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 48_000 }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    // De 48.000 er, hvad der forlod lønnen — brutto. AM-bidraget af dem er
    // allerede betalt som en del af årets skat af hele bruttolønnen, så der
    // lander 92 % i ordningen, jf. ADR-0016.
    expect(holding(year, 'ratepension').closingBalance).toBeCloseTo(44_160, 6)
  })

  it('bærer indbetalingens id og dens to beløb i årsresultatet', () => {
    const plan = aPlanWithPension({
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    // De to beløb og ikke et tredje: differencen er AM-bidraget, som allerede
    // står i personens eget skattelag. Et tredje felt kunne komme til at sige
    // noget andet end laget.
    expect(year.contributions).toEqual([
      { contribution: 'contribution', fromSource: 48_000, intoHolding: 44_160 },
    ])
  })

  it('lader bidraget ophøre af sig selv året efter erhvervsophør', () => {
    // Bidraget er ikke rørt: det har ingen periode at komme ud af trit med
    // lønnens. Lønposten løber til `WorkEndAge`, og bidraget følger med.
    const plan = aPlanWithPension({
      balance: 1_000_000,
      birthYear: 1973,
      birthMonth: 6,
      workEndAge: 58,
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'PersonAge', to: 'WorkEndAge' },
        }),
      ],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
      ],
    })

    const years = simulateChecked(plan)
    const contributionsIn = (year: number) =>
      years.find((y) => y.year === year)!.contributions

    expect(contributionsIn(2031)).toHaveLength(1)
    expect(contributionsIn(2032)).toHaveLength(0)
  })

  it('belaster bufferen nettobeløbet og lader AM-delen ligge i årets skat', () => {
    // Samme plan to gange, kun bidraget skiftet til og fra. Destinationen er
    // en aldersopsparing, som ingen `Deductibility` har, så skatten står
    // stille og bevægelsen kan ses alene: AM-bidraget er af hele bruttolønnen
    // og rører sig ikke af, at en del af den flyttes videre. Bufferen mister
    // derfor præcis nettobeløbet og ikke bruttoet; trak den bruttoet, ville
    // AM-delen være betalt to gange.
    const options = {
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
    }
    const without = simulateChecked(aPlanWithScheme(oldAgeSavings, options))[0]!
    const withContribution = simulateChecked(
      aPlanWithScheme(oldAgeSavings, {
        ...options,
        contributions: [
          aContribution({
            source: 'salary',
            to: 'aldersopsparing',
            amountInRealKroner: 48_000,
          }),
        ],
      }),
    )[0]!

    expect(withContribution.tax).toBeCloseTo(without.tax, 6)
    expect(bufferBalance(without) - bufferBalance(withContribution)).toBeCloseTo(44_160, 6)
    // Intet nyt led i balanceinvarianten: bevægelsen flytter formue mellem to
    // beholdninger og ændrer ikke husstandens samlede.
    expect(withContribution.closingWealth).toBeCloseTo(without.closingWealth, 6)
  })

  it('lader en indbetaling til aldersopsparingen stå uden for den personlige indkomst', () => {
    // Samme løn og samme beløb som ratepensionscasen ovenfor, men en ordning
    // uden `Deductibility`: den personlige indkomst er hele bruttolønnen efter
    // AM-bidrag, 700.000 − 56.000 = 644.000, og indbetalingen nedsætter
    // ingenting. Det er hele grunden til, at brugeren skal kunne sammenligne
    // de to slags ordning.
    const plan = aPlanWithScheme(oldAgeSavings, {
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 700_000 })],
      contributions: [
        aContribution({
          source: 'salary',
          to: 'aldersopsparing',
          amountInRealKroner: 105_000,
        }),
      ],
    })

    const { tax } = simulateChecked(plan)[0]!.persons[0]!

    expect(tax.personalIncome).toBeCloseTo(644_000, 6)
    // Og fradraget følger indbetalingen med fradragsret, ikke indbetalingen:
    // en aldersopsparing giver heller ikke det ekstra pensionsfradrag.
    expect(tax.allowances.extraPensionAllowance).toBe(0)
  })

  it('giver samme beløb til de to slags ordning hver sin skat', () => {
    // Forskellen skal kunne efterregnes: de 96.600 kr., der landede, er ude
    // af den personlige indkomst i den ene plan og med i den anden, og
    // derudover giver de 12 % i ekstra pensionsfradrag af grundlaget i loft.
    //
    // Ordningen med fradragsret er livrenten og ikke ratepensionen, fordi
    // den er uden årligt loft: så måler forskellen fradragsretten alene, og
    // ikke fradragsretten og loftet blandet sammen.
    const options = {
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 700_000 })],
    }
    const contribution = (to: string) => [
      aContribution({ source: 'salary', to, amountInRealKroner: 105_000 }),
    ]
    const pension = simulateChecked(
      aPlanWithScheme(lifeAnnuity, {
        ...options,
        contributions: contribution('livrente'),
      }),
    )[0]!
    const savings = simulateChecked(
      aPlanWithScheme(oldAgeSavings, {
        ...options,
        contributions: contribution('aldersopsparing'),
      }),
    )[0]!

    expect(pension.tax).toBeLessThan(savings.tax)

    // Hvidovre 2026: 25,40 % kommuneskat og 0,72 % kirkeskat. De 96.600 kr.
    // går ud af den personlige indkomst, og oven i dem giver de 12 % i ekstra
    // pensionsfradrag af grundlaget i loft — 12 % af 87.800 = 10.536, den
    // lave sats fordi der er 17 indkomstår til folkepensionsalderen. Det
    // fradrag er ligningsmæssigt og rører kun kommune- og kirkeskatten, hvor
    // fradragsretten rører alle lag ovenpå den personlige indkomst.
    //
    //   Bundskat    12,01 % af  96.600           = 11.601,6600
    //   Kommuneskat 25,40 % af (96.600 + 10.536) = 27.212,5440
    //   Kirkeskat    0,72 % af (96.600 + 10.536) =    771,3792
    //   Mellemskat   7,16 % af   2.800           =    200,4800
    //                                              ────────────
    //                                              39.786,0632
    //
    // Mellemskatten er fradragsrettens virkning på et lag ovenpå, gjort til
    // et tal: 644.000 lå over grænsen på 641.200, 547.400 ligger under, så
    // laget forsvinder helt. Satsen er 7,16 % og ikke 7,50 %, fordi det skrå
    // skatteloft binder ved Hvidovres kommunesats.
    expect(savings.tax - pension.tax).toBeCloseTo(39_786.0632, 4)
  })

  it('giver livrenten samme fradragsret som ratepensionen', () => {
    // De to varianter deler beskatning fuldstændigt og skilles kun af loftet,
    // jf. ADR-0015 — fradragsretten er den samme.
    const options = {
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 700_000 })],
    }
    const annuity = simulateChecked(
      aPlanWithScheme(lifeAnnuity, {
        ...options,
        contributions: [
          aContribution({ source: 'salary', to: 'livrente', amountInRealKroner: 105_000 }),
        ],
      }),
    )[0]!

    expect(annuity.persons[0]!.tax.personalIncome).toBeCloseTo(547_400, 6)
  })

  it('regner det ekstra pensionsfradrag af årets faktiske indbetaling', () => {
    // Fradraget stod som nul gennem hele etape 1, fordi planen ingen
    // indbetalinger havde at regne det af. Nu har den: 12 % af de 96.600 kr.,
    // der landede — den lave sats, fordi der er 17 indkomstår til
    // folkepensionsalderen, jf. LL § 9 L, stk. 3.
    //
    // Livrenten og ikke ratepensionen, så det er fradragets eget
    // grundlagsloft på 87.800 kr., der binder, og ikke ordningens.
    const plan = aPlanWithScheme(lifeAnnuity, {
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 700_000 })],
      contributions: [
        aContribution({ source: 'salary', to: 'livrente', amountInRealKroner: 105_000 }),
      ],
    })

    const { tax } = simulateChecked(plan)[0]!.persons[0]!

    // Grundlaget er i loft ved 87.800 kr.: 12 % af 87.800 = 10.536.
    expect(tax.allowances.extraPensionAllowance).toBeCloseTo(10_536, 6)
  })

  it('holder en indbetaling til ratepensionen uden for den personlige indkomst', () => {
    // 700.000 kr. brutto, hvoraf 70.000 kr. går videre som arbejdsgiverbidrag.
    // Der lander 64.400 kr. på ordningen, og det er dét beløb, fradragsretten
    // holder uden for indkomsten: 700.000 − 56.000 − 64.400 = 579.600.
    //
    // Bidraget er holdt under ratepensionens loft med vilje. Fradragsretten
    // og loftet måler på samme beløb, og en test, der rammer begge, kan ikke
    // sige hvilken af de to der flyttede tallet.
    const plan = aPlanWithPension({
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 700_000 })],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 70_000 }),
      ],
    })

    const { tax } = simulateChecked(plan)[0]!.persons[0]!

    expect(tax.personalIncome).toBeCloseTo(579_600, 6)
    // AM-bidraget måler stadig på hele bruttolønnen.
    expect(tax.layers.labourMarketContribution.base).toBeCloseTo(700_000, 6)
  })

  it('lader et procentbidrag følge lønpostens regulering uden et andet tal at vedligeholde', () => {
    const plan = aPlanWithPension({
      balance: 1_000_000,
      inflationAssumption: 0.02,
      entries: [aSalary({ amountInRealKroner: 600_000, regulationRate: 0.03 })],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
      ],
    })

    const years = simulateChecked(plan)

    // Lønnen stiger 3 %, ikke de 2 % planen inflaterer med, og bidraget
    // følger med af sig selv, fordi det måles af posten.
    expect(years[0]!.contributions[0]!.fromSource).toBeCloseTo(48_000, 6)
    expect(years[1]!.contributions[0]!.fromSource).toBeCloseTo(48_000 * 1.03, 6)
    expect(years[2]!.contributions[0]!.fromSource).toBeCloseTo(48_000 * 1.03 ** 2, 6)
  })

  it('løfter også et fast bidrag med lønpostens reguleringssats', () => {
    // Bidraget arver alt andet fra posten og arver dermed også dens tempo.
    // Fulgte det planens inflationsantagelse i stedet, ville et fast bidrag
    // skride fra den løn, det er en del af.
    const plan = aPlanWithPension({
      balance: 1_000_000,
      inflationAssumption: 0.02,
      entries: [aSalary({ amountInRealKroner: 600_000, regulationRate: 0.03 })],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 9_900 }),
      ],
    })

    const years = simulateChecked(plan)

    expect(years[1]!.contributions[0]!.fromSource).toBeCloseTo(9_900 * 1.03, 6)
  })

  it('vejer bidraget ind i afkastgrundlaget i begge ender', () => {
    const plan = aPlanWithPension({
      balance: 0,
      grossReturn: 0.05,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    // Lønposten lagde hele sit bruttobeløb vægtet på bufferen: 600.000 × ½.
    // Bidraget tager de 44.160 × ½ ud igen og lægger dem i ordningen. Uden
    // modposten på bufferen ville de samme kroner forrente sig to steder.
    expect(holding(year, 'free-assets').weightedFlow).toBeCloseTo(277_920, 6)
    expect(holding(year, 'ratepension').weightedFlow).toBeCloseTo(22_080, 6)
  })

  it('trækker intet AM-bidrag, når kildeposten ikke er AM-pligtig', () => {
    // AM-behandlingen følger kilden, jf. ADR-0016. En skattefri indtægt har
    // aldrig båret AM-bidrag, så der er intet at trække af på vejen ind — og
    // trak motoren de 8 % alligevel, ville pengene blive stående på bufferen
    // som en skat, ingen har betalt.
    const plan = aPlanWithPension({
      balance: 1_000_000,
      entries: [aTaxFreeIncome({ amountInRealKroner: 100_000 })],
      contributions: [
        aContribution({ source: 'inheritance', to: 'ratepension', amountInRealKroner: 48_000 }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    expect(year.contributions[0]).toEqual({
      contribution: 'contribution',
      fromSource: 48_000,
      intoHolding: 48_000,
    })
  })

  describe('lofterne', () => {
    it('giver kun den del af årets indbetaling, der er under loftet, fradragsret', () => {
      // Lønmodtageren fra ADR-0007: 105.000 kr. i arbejdsgiverbidrag, hvoraf
      // 96.600 lander på ordningen efter AM-bidrag. Ratepensionens loft er
      // 68.700 kr. i 2026 og måler netop det beløb, der landede — de
      // overskydende 27.900 kr. mister deres fradragsret, jf.
      // docs/satser/2026.md. Den personlige indkomst bliver dermed
      // 700.000 − 56.000 − 68.700 = 575.300 og ikke 547.400.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        contributions: [
          aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 105_000 }),
        ],
      })

      const { tax } = simulateChecked(plan)[0]!.persons[0]!

      expect(tax.contributionWithDeductibility).toBeCloseTo(68_700, 6)
      expect(tax.personalIncome).toBeCloseTo(575_300, 6)
    })

    it('lader hele indbetalingen lande i ordningen, også den del der ligger over loftet', () => {
      // Motoren flytter ikke pengene. De 27.900 kr. over loftet bliver
      // liggende i ordningen; kun skattevirkningen er begrænset. At skubbe
      // dem tilbage på bufferen ville være den stiltiende rettelse af
      // brugerens plan, ADR-0002 forbyder.
      //
      // Målt mod livrenten, som er uden loft: samme beløb ind, samme saldo
      // ud. Det er loftets virkning på pengene — ingen — sagt som et tal.
      const options = {
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
      }
      const capped = simulateChecked(
        aPlanWithScheme(instalmentPension, {
          ...options,
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 105_000 }),
          ],
        }),
      )[0]!
      const uncapped = simulateChecked(
        aPlanWithScheme(lifeAnnuity, {
          ...options,
          contributions: [
            aContribution({ source: 'salary', to: 'livrente', amountInRealKroner: 105_000 }),
          ],
        }),
      )[0]!

      expect(holding(capped, 'ratepension').closingBalance).toBeCloseTo(96_600, 6)
      expect(holding(capped, 'ratepension').closingBalance).toBeCloseTo(
        holding(uncapped, 'livrente').closingBalance,
        6,
      )
      expect(capped.contributions[0]!.intoHolding).toBeCloseTo(96_600, 6)

      // Bufferen er belastet det samme i de to planer: loftet flyttede ikke
      // en krone, det flyttede skatten. Forskellen på de to buffere er
      // præcis forskellen på årets skat og intet andet.
      expect(
        bufferBalance(capped) - bufferBalance(uncapped),
      ).toBeCloseTo(uncapped.tax - capped.tax, 6)
    })

    it('måler ét loft på tværs af ordninger af samme slags', () => {
      // To ratepensioner med 40.000 kr. hver er ét brud og ikke to lovlige
      // indbetalinger: loftet er personens og gælder årets samlede
      // indbetaling til den slags ordning, ikke den enkelte beholdning og
      // ikke det enkelte bidrag.
      //
      // Bidragene er beholdningskildede, så der intet AM-bidrag er på vejen
      // ind: de 40.000 kr. er både det, der forlod kilden, og det, der
      // landede, og loftet måler netop det sidste.
      const plan = aPlan({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        holdings: [
          {
            ...instalmentPension,
            balance: 0,
            grossReturn: 0,
            annualCostRate: 0,
          },
          {
            id: 'ratepension-2',
            name: 'Ratepension 2',
            variant: 'InstalmentPension',
            balance: 0,
            grossReturn: 0,
            annualCostRate: 0,
          },
        ],
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 40_000,
          }),
          {
            ...aHoldingContribution({
              source: 'free-assets',
              to: 'ratepension-2',
              amountInRealKroner: 40_000,
            }),
            id: 'contribution-2',
          },
        ],
      })

      const { tax } = simulateChecked(plan)[0]!.persons[0]!

      expect(tax.contributionWithDeductibility).toBeCloseTo(68_700, 6)
    })

    it('bærer loftlinjen med indbetalt, loft og fradragsberettiget del', () => {
      // Tre tal på samme linje, så den kan efterregnes af sig selv:
      // 96.600 landede, loftet var 68.700, og det er den del, der beholdt
      // sin fradragsret. Forskellen er de 27.900 kr., docs/satser/2026.md
      // regner sig frem til.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        contributions: [
          aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 105_000 }),
        ],
      })

      const { caps } = simulateChecked(plan)[0]!.persons[0]!

      expect(caps).toHaveLength(1)
      expect(caps[0]!.variant).toBe('InstalmentPension')
      expect(caps[0]!.paid).toBeCloseTo(96_600, 6)
      expect(caps[0]!.cap).toBeCloseTo(68_700, 6)
      expect(caps[0]!.withDeductibility).toBeCloseTo(68_700, 6)
    })

    it('står uden loftlinje i et år uden indbetaling til en loftbelagt ordning', () => {
      // En linje på nul ville sige, at året indbetalte til en ordning, det
      // ikke rørte — og et loft, der ikke blev målt mod noget, er ikke et
      // svar, brugeren skal læse.
      const plan = aPlanWithScheme(lifeAnnuity, {
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        contributions: [
          aContribution({ source: 'salary', to: 'livrente', amountInRealKroner: 105_000 }),
        ],
      })

      const person = simulateChecked(plan)[0]!.persons[0]!

      // Livrenten er uden loft og har derfor ingen linje — men hele
      // indbetalingen beholdt sin fradragsret.
      expect(person.caps).toEqual([])
      expect(person.tax.contributionWithDeductibility).toBeCloseTo(96_600, 6)
    })

    it('måler aldersopsparingens loft uden at røre årets skat', () => {
      // Aldersopsparingen har et loft og ingen fradragsret. Der er derfor
      // intet at miste ved at bryde det, og afgiften efter PBL § 25 A er
      // ikke modelleret, jf. docs/udskudt.md — men loftlinjen står der,
      // fordi brugeren skal kunne se, at der blev indbetalt for meget.
      //
      // Jesper er født i 1973 og når folkepensionsalderen i 2043. I 2026 er
      // der 17 indkomstår til, altså langt uden for syvårsvinduet, og loftet
      // er det lave på 9.900 kr.
      const options = {
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
      }
      const paying = simulateChecked(
        aPlanWithScheme(oldAgeSavings, {
          ...options,
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'aldersopsparing',
              amountInRealKroner: 20_000,
            }),
          ],
        }),
      )[0]!
      const idle = simulateChecked(aPlanWithScheme(oldAgeSavings, options))[0]!

      expect(paying.persons[0]!.caps).toEqual([
        {
          variant: 'OldAgeSavings',
          paid: 20_000,
          cap: 9_900,
          withDeductibility: 0,
        },
      ])
      // Ingen afgift: de 10.100 kr. over loftet koster ingenting i modellen.
      expect(paying.tax).toBeCloseTo(idle.tax, 6)
    })

    it('skifter aldersopsparingens loft fra lavt til højt syv år før folkepensionsalderen', () => {
      // PBL § 16, stk. 1, 2. pkt.: det høje grundbeløb gælder "fra og med det
      // syvende indkomstår før det indkomstår, hvor pensionsopspareren når
      // folkepensionsalderen". Jesper er født i juni 1973, når
      // folkepensionsalderen i 2043, og vinduet åbner derfor i 2036 — ikke i
      // 2035.
      const plan = aPlanWithScheme(oldAgeSavings, {
        balance: 5_000_000,
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'aldersopsparing',
            amountInRealKroner: 20_000,
          }),
        ],
      })

      const years = simulateChecked(plan)
      const capIn = (year: number) =>
        years.find((result) => result.year === year)!.persons[0]!.caps[0]!.cap

      expect(capIn(2035)).toBeCloseTo(9_900, 6)
      expect(capIn(2036)).toBeCloseTo(64_200, 6)
      // Og vinduet lukker aldrig igen: satsen bliver ved med at være den høje
      // efter folkepensionsalderen, jf. § 20-tabellens egen formulering.
      expect(capIn(2043)).toBeCloseTo(64_200, 6)
    })

    it('flytter vinduet med fødselsmåneden, når folkepensionsalderen er en brøk', () => {
      // Årgang 1983 har trinnet 72,5 år. En halv alder skubber året over
      // årsskiftet for de fødselsmåneder, hvor den skal: født juli 1983 nås
      // folkepensionsalderen i januar 2056, født maj 1983 i 2055. Vinduet
      // åbner syv indkomstår før og flytter sig derfor med — 2049 mod 2048.
      //
      // Halvdelen af fødselsmånederne rammes, så optællingen skal regnes og
      // ikke skønnes, jf. docs/satser/2026.md.
      const capIn = (birthMonth: number, year: number) => {
        const plan = aPlanWithScheme(oldAgeSavings, {
          birthYear: 1983,
          birthMonth,
          balance: 5_000_000,
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'aldersopsparing',
              amountInRealKroner: 20_000,
            }),
          ],
        })
        return simulateChecked(plan).find((result) => result.year === year)!.persons[0]!
          .caps[0]!.cap
      }

      expect(capIn(5, 2048)).toBeCloseTo(64_200, 6)
      expect(capIn(7, 2048)).toBeCloseTo(9_900, 6)
      expect(capIn(7, 2049)).toBeCloseTo(64_200, 6)
    })

    it('markerer året, hvor ratepensionens loft er brudt, som et tabt fradrag', () => {
      // Konklusionen står ét sted, ved siden af `bufferState` og med samme
      // form: fladen markerer rækken fra det ene felt og sammenligner ikke
      // selv indbetalt med loft, jf. ADR-0012.
      const paying = (amountInRealKroner: number) =>
        simulateChecked(
          aPlanWithPension({
            balance: 1_000_000,
            entries: [aSalary({ amountInRealKroner: 700_000 })],
            contributions: [
              aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner }),
            ],
          }),
        )[0]!

      expect(paying(105_000).capBreach).toBe('LostDeductibility')
      expect(paying(70_000).capBreach).toBeUndefined()
    })

    it('kalder et beløb præcis på loftet for ubrudt', () => {
      // Loven giver loftet som det beløb, der *kan* anvendes. Et brud er
      // beløbet derover, og et bidrag, der rammer loftet på kronen, har
      // hverken mistet fradragsret eller udløst afgift.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 68_700,
          }),
        ],
      })

      const year = simulateChecked(plan)[0]!

      expect(year.persons[0]!.caps[0]!.withDeductibility).toBeCloseTo(68_700, 6)
      expect(year.capBreach).toBeUndefined()
    })

    it('markerer aldersopsparingens brud som afgiftspligtigt', () => {
      // Den har ingen fradragsret at miste. Bruddet koster ikke noget i
      // modellen, men brugeren skal kunne se, at der er indbetalt for meget.
      const plan = aPlanWithScheme(oldAgeSavings, {
        balance: 1_000_000,
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'aldersopsparing',
            amountInRealKroner: 20_000,
          }),
        ],
      })

      expect(simulateChecked(plan)[0]!.capBreach).toBe('Chargeable')
    })

    it('lader det tabte fradrag veje tungest, når begge slags loft er brudt', () => {
      // Året har kun ét felt, og det skal sige det, der flyttede skatten:
      // afgiften er ikke modelleret, fradragsrettens tab er.
      const plan = aPlan({
        balance: 2_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        holdings: [
          { ...instalmentPension, balance: 0, grossReturn: 0, annualCostRate: 0 },
          { ...oldAgeSavings, balance: 0, grossReturn: 0, annualCostRate: 0 },
        ],
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 100_000,
          }),
          {
            ...aHoldingContribution({
              source: 'free-assets',
              to: 'aldersopsparing',
              amountInRealKroner: 20_000,
            }),
            id: 'contribution-2',
          },
        ],
      })

      const year = simulateChecked(plan)[0]!

      expect(year.persons[0]!.caps).toHaveLength(2)
      expect(year.capBreach).toBe('LostDeductibility')
    })

    it('lader det samme bidrag være lovligt i ét år og et brud i et senere', () => {
      // Bidraget følger lønnens 5 %, loftet følger § 20-fremskrivningen på 0
      // — de to vokser med hver sin antagelse, og derfor er et loftbrud
      // årets svar og ikke planens. Det er hele grunden til, at `validatePlan`
      // ikke kan afgøre det: den kender ikke et år.
      //
      // 70.000 kr. brutto giver 64.400 kr. ind i ordningen i 2026 og vokser
      // 5 % om året: 67.620 i 2027 og 71.001 i 2028, hvor loftet på 68.700
      // først bliver brudt.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000, regulationRate: 0.05 })],
        contributions: [
          aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 70_000 }),
        ],
      })

      expect(validatePlan(plan)).toBeUndefined()

      const breachIn = (year: number) =>
        simulateChecked(plan).find((result) => result.year === year)!.capBreach

      expect(breachIn(2026)).toBeUndefined()
      expect(breachIn(2027)).toBeUndefined()
      expect(breachIn(2028)).toBe('LostDeductibility')
    })

    it('lægger loftet på det ekstra pensionsfradrags grundlag med', () => {
      // Fradragets grundlag er de indbetalinger, der har fradragsret, og
      // loftet har allerede afgjort hvor mange af dem der er: 12 % af
      // 68.700 = 8.244 og ikke 12 % af 87.800. De to lofter ligger i
      // forlængelse af hinanden og ikke ved siden af.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        contributions: [
          aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 105_000 }),
        ],
      })

      const { tax } = simulateChecked(plan)[0]!.persons[0]!

      expect(tax.allowances.extraPensionAllowance).toBeCloseTo(8_244, 6)
    })
  })

  describe('beholdningskildede', () => {
    it('flytter hele beløbet fra de frie midler ind i ordningen', () => {
      // Der er ingen løn i året — det er hele grunden til, at formen findes.
      // Pengene er beskattet, da de kom ind på de frie midler, så der er
      // intet AM-bidrag at trække på vejen videre: brutto er lig netto.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 50_000,
          }),
        ],
      })

      const year = simulateChecked(plan)[0]!

      expect(holding(year, 'ratepension').closingBalance).toBeCloseTo(50_000, 6)
      expect(bufferBalance(year)).toBeCloseTo(950_000, 6)
      expect(year.contributions).toEqual([
        { contribution: 'contribution', fromSource: 50_000, intoHolding: 50_000 },
      ])
    })

    it('lander med 100 %, hvor det lønkildede af samme beløb lander med 92 %', () => {
      // Kontrasten er hele grunden til, at `ContributionYear` bærer to beløb
      // og ikke ét: for den ene form er de forskellige, for den anden ens.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 600_000 })],
        contributions: [
          aContribution({
            source: 'salary',
            to: 'ratepension',
            amountInRealKroner: 50_000,
          }),
          {
            ...aHoldingContribution({
              source: 'free-assets',
              to: 'ratepension',
              amountInRealKroner: 50_000,
            }),
            id: 'fra-frie-midler',
          },
        ],
      })

      const year = simulateChecked(plan)[0]!

      expect(year.contributions).toEqual([
        { contribution: 'contribution', fromSource: 50_000, intoHolding: 46_000 },
        { contribution: 'fra-frie-midler', fromSource: 50_000, intoHolding: 50_000 },
      ])
    })

    it('falder kun i de år, dets egen periode dækker', () => {
      const plan = aPlanWithPension({
        balance: 1_000_000,
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 50_000,
            period: { anchor: 'CalendarYear', from: 2028, to: 2029 },
          }),
        ],
      })

      const years = simulateChecked(plan)

      expect(yearsWithContribution(years)).toEqual([2028, 2029])
    })

    it('bærer sin egen gentagelse', () => {
      const plan = aPlanWithPension({
        balance: 1_000_000,
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 50_000,
            period: { anchor: 'CalendarYear', from: 2026, to: 2032 },
            recurrence: { kind: 'EveryNYears', n: 3 },
          }),
        ],
      })

      const years = simulateChecked(plan)

      expect(yearsWithContribution(years)).toEqual([2026, 2029, 2032])
    })

    it('kan aldersforankres og flytter sig, når erhvervsophørsalderen ændres', () => {
      // Aldersopsparingens vindue ligger efter sidste lønkrone, og uden en
      // kilde, der er en beholdning, kan det slet ikke skrives. Forankringen
      // er formens egen: en overførsel har ingen ejer at måle en alder fra,
      // men destinationen har.
      const stoppingAt = (workEndAge: number) =>
        aPlanWithScheme(oldAgeSavings, {
          balance: 1_000_000,
          workEndAge,
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'aldersopsparing',
              amountInRealKroner: 50_000,
              period: { anchor: 'PersonAge', from: 'WorkEndAge', to: 'WorkEndAge' },
            }),
          ],
        })

      // Jesper er født i juni 1973, så han fylder 58 i 2031 og 60 i 2033.
      expect(yearsWithContribution(simulateChecked(stoppingAt(58)))).toEqual([2031])
      // Bidraget er ikke rørt — kun alderen er.
      expect(yearsWithContribution(simulateChecked(stoppingAt(60)))).toEqual([2033])
    })

    it('løfter beløbet med planens inflationsantagelse, som en overførsel gør', () => {
      // Bidraget er ikke en indtægt og har derfor ingen reguleringssats at
      // følge. Beløbet er tastet i dagens kroner og løftes til årets egne.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        inflationAssumption: 0.02,
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 50_000,
          }),
        ],
      })

      const years = simulateChecked(plan)

      expect(years[2]!.contributions[0]!.fromSource).toBeCloseTo(50_000 * 1.02 ** 2, 6)
    })

    it('vejer sit eget forfald ind i afkastgrundlaget i begge ender', () => {
      // Forfaldet er bidragets eget her — der er ingen post at arve det fra.
      // April vejer ni tolvtedele: pengene er ude af kilden og inde i
      // ordningen resten af året.
      const plan = aPlanWithPension({
        balance: 1_000_000,
        grossReturn: 0.05,
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'ratepension',
            amountInRealKroner: 100_000,
            timing: 4,
          }),
        ],
      })

      const year = simulateChecked(plan)[0]!

      expect(holding(year, 'free-assets').weightedFlow).toBeCloseTo(-75_000, 6)
      expect(holding(year, 'ratepension').weightedFlow).toBeCloseTo(75_000, 6)
    })

    it('lader fradragsretten følge destinationen, uanset at kilden er en beholdning', () => {
      // Samme kilde, samme beløb, to destinationer. Ratepensionen har
      // fradragsret, aldersopsparingen har ingen — og kilden siger intet om
      // det, jf. ADR-0016. Lønnen står her kun, så der er en personlig
      // indkomst at nedsætte.
      const payingInto = (scheme: { id: string; name: string; variant: HoldingVariant }) =>
        aPlanWithScheme(scheme, {
          balance: 1_000_000,
          entries: [aSalary({ amountInRealKroner: 700_000 })],
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: scheme.id,
              amountInRealKroner: 50_000,
            }),
          ],
        })

      const intoPension = simulateChecked(payingInto(instalmentPension))[0]!.persons[0]!
      const intoOldAge = simulateChecked(payingInto(oldAgeSavings))[0]!.persons[0]!

      // 700.000 − 56.000 = 644.000 uden fradragsret; hele det indbetalte
      // beløb går fra, når destinationen har den.
      expect(intoPension.tax.personalIncome).toBeCloseTo(594_000, 6)
      expect(intoOldAge.tax.personalIncome).toBeCloseTo(644_000, 6)
    })
  })
})

describe('indbetalingens pegere', () => {
  /** Fixturens buffer, en ratepension og en lønpost — det mindste, en gyldig
      indbetaling kan bygges på. Testene skruer på den ene peger, de handler om. */
  function aPlanWith(contribution: Contribution): Plan {
    return aPlan({
      balance: 1_000_000,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [contribution],
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          balance: 0,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })
  }

  it('afviser en indbetaling, hvis destination ikke findes', () => {
    const plan = aPlanWith(
      aContribution({ source: 'salary', to: 'findes-ikke', percentageOfEntry: 0.08 }),
    )

    expect(() => simulate(plan)).toThrow(/findes-ikke.*ikke findes/i)
  })

  it('afviser en indbetaling, hvis kilden ikke findes', () => {
    const plan = aPlanWith(
      aContribution({ source: 'ingen-loen', to: 'ratepension', percentageOfEntry: 0.08 }),
    )

    expect(() => simulate(plan)).toThrow(/ingen-loen.*ikke findes/i)
  })

  it('afviser en indbetaling til frie midler — så er det en overførsel', () => {
    const plan = aPlanWith(
      aContribution({ source: 'salary', to: 'free-assets', percentageOfEntry: 0.08 }),
    )

    expect(() => simulate(plan)).toThrow(/overførsel/i)
  })

  it('afviser en lønkilde, der ikke er en indtægtspost', () => {
    // En udgift er ikke en kilde, penge kan komme fra. Uden reglen ville
    // motoren måle en procent af et forbrug og kalde det opsparing.
    const plan: Plan = {
      ...aPlanWith(
        aContribution({ source: 'living-costs', to: 'ratepension', percentageOfEntry: 0.08 }),
      ),
      entries: [anExpense({ amountInRealKroner: 360_000 })],
    }

    expect(() => simulate(plan)).toThrow(/living-costs.*udgiftspost|udgift/i)
  })

  it('afviser en indbetaling, hvor kilde og destination ikke er samme persons', () => {
    // Jespers løn ind i Marias ordning ville placere skattevirkningen hos den
    // forkerte: fradragsretten nedsætter den personlige indkomst, og den
    // hører hos den, der har ordningen.
    const base = aPlanWith(
      aContribution({ source: 'salary', to: 'marias-ratepension', percentageOfEntry: 0.08 }),
    )
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
            municipality: 'København',
            churchMember: true,
            holdings: [
              {
                id: 'marias-ratepension',
                name: 'Marias ratepension',
                variant: 'InstalmentPension',
                balance: 0,
                grossReturn: 0,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    expect(() => simulate(plan)).toThrow(/samme person/i)
  })

  it('afviser en beholdningskilde, der ikke findes', () => {
    const plan = aPlanWith(
      aHoldingContribution({
        source: 'findes-ikke',
        to: 'ratepension',
        amountInRealKroner: 50_000,
      }),
    )

    expect(() => simulate(plan)).toThrow(/findes-ikke.*ikke findes/i)
  })

  it('afviser en beholdningskilde, der ikke er frie midler', () => {
    // En flytning mellem to ordninger er ikke en indbetaling. Loven har sine
    // egne regler om overførsel mellem ordninger, og de er ikke i domænet —
    // planen skal afvises frem for at blive regnet efter en regel, der ikke
    // gælder.
    const base = aPlanWith(
      aHoldingContribution({
        source: 'ratepension',
        to: 'aldersopsparing',
        amountInRealKroner: 50_000,
      }),
    )
    const person = base.household.persons[0]!
    const plan: Plan = {
      ...base,
      household: {
        persons: [
          {
            ...person,
            holdings: [
              ...person.holdings,
              {
                id: 'aldersopsparing',
                name: 'Aldersopsparing',
                variant: 'OldAgeSavings',
                balance: 0,
                grossReturn: 0,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    expect(() => simulate(plan)).toThrow(/ratepension.*ikke er frie midler/i)
  })

  it('afviser et beholdningskildet bidrag, hvor kilde og destination ikke er samme persons', () => {
    // Samme regel som for lønkilden, og af samme grund: fradragsretten hører
    // hos den, der ejer ordningen.
    const base = aPlanWith(
      aHoldingContribution({
        source: 'free-assets',
        to: 'marias-ratepension',
        amountInRealKroner: 50_000,
      }),
    )
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
            municipality: 'København',
            churchMember: true,
            holdings: [
              {
                id: 'marias-ratepension',
                name: 'Marias ratepension',
                variant: 'InstalmentPension',
                balance: 0,
                grossReturn: 0,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    expect(() => simulate(plan)).toThrow(/samme person/i)
  })
})
