import { describe, expect, it } from 'vitest'
import type {
  AgeBound,
  Contribution,
  Holding,
  HoldingVariant,
  PayoutSchedule,
  Plan,
} from './plan'
import { simulate } from './simulate'
import { totalTaperBase } from './tax/assessHousehold'
import { totalTax } from './tax/assessTax'
import { validatePlan } from './validatePlan'
import {
  aContribution,
  aHolding,
  aHoldingContribution,
  aPlan,
  aPensionIncome,
  aSalary,
  aTaxFreeIncome,
  anExpense,
  aTransfer,
  bufferBalance,
} from './testing/planFixture'
import { simulateChecked } from './testing/simulateChecked'
import type { CapYear, YearResult } from './yearResult'

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

/** Fixturens buffer plus én pensionsordning af den ønskede variant, kaldet
    "ordning". Oprettet i januar 2018 og dermed under det nyeste regime. */
function aPlanWithPensionScheme(
  variant: 'InstalmentPension' | 'LifeAnnuity' | 'OldAgeSavings',
  options: Parameters<typeof aPlan>[0] = {},
): Plan {
  return aPlan({
    balance: 1_000_000,
    ...options,
    holdings: [aHolding({ id: 'ordning', name: 'Ordning', variant, balance: 1_000_000 })],
  })
}

/** Fixturens buffer plus en aktiesparekonto. Kontoen har hverken
    oprettelsestidspunkt eller udbetalingsalder — den er ingen
    pensionsordning. */
function aPlanWithShareSavingsAccount(
  options: Parameters<typeof aPlan>[0] & { shareSavingsAccount?: number } = {},
): Plan {
  const { shareSavingsAccount = 0, ...rest } = options
  return aPlan({
    balance: 0,
    ...rest,
    holdings: [
      {
        id: 'aktiesparekonto',
        name: 'Aktiesparekonto',
        variant: 'ShareSavingsAccount',
        balance: shareSavingsAccount,
        grossReturn: options.grossReturn ?? 0,
        annualCostRate: options.annualCostRate ?? 0,
      },
    ],
  })
}

/** To personer med hver sin ende af en overførsel: aldersopsparingen ejes af
    den ældste, de frie midler af den yngste. Fixturen findes for at vise, at
    aldersforankringen måles på afgiveren og ikke på modtageren. */
function aPlanWithTwoOwners(): Plan {
  const base = aPlan({ balance: 0 })
  const [yngste] = base.household.persons
  return {
    ...base,
    transfers: [
      aTransfer({
        from: 'aldersopsparing',
        to: 'free-assets',
        amountInRealKroner: 50_000,
        period: { anchor: 'PersonAge', from: 70 },
      }),
    ],
    household: {
      persons: [
        yngste!,
        {
          id: 'aeldste',
          name: 'Ældste',
          birthYear: 1963,
          birthMonth: 6,
          workEndAge: 60,
          horizon: 90,
          municipality: 'Hvidovre',
          churchMember: true,
          holdings: [
            {
              id: 'aldersopsparing',
              name: 'Aldersopsparing',
              variant: 'OldAgeSavings',
              openedOn: { year: 2000, month: 1 },
              balance: 500_000,
              grossReturn: 0,
              annualCostRate: 0,
            },
          ],
        },
      ],
    },
  }
}

/** Én beholdnings række i årets resultat. Beholdningen findes altid: planen
    er valideret, og rækkerne er åbnet på planens egne beholdninger. */
function holding(year: YearResult, id: string) {
  return year.holdings.find((h) => h.holding === id)!
}

/** En loftlinje af `PerYear`-formen. `paid` og `withDeductibility` findes
    kun på den ene af `CapYear`s to former, og indsnævringen står ét sted
    frem for i hver assertion — kaster den, står det med det samme, at linjen
    fik den forkerte form. */
function perYear(cap: CapYear): Extract<CapYear, { form: 'PerYear' }> {
  if (cap.form !== 'PerYear') {
    throw new Error(`Loftlinjen for ${cap.variant} har formen ${cap.form} og ikke PerYear.`)
  }
  return cap
}

/** En loftlinje af `OnBalance`-formen — modstykket til `perYear`. */
function onBalance(cap: CapYear): Extract<CapYear, { form: 'OnBalance' }> {
  if (cap.form !== 'OnBalance') {
    throw new Error(`Loftlinjen for ${cap.variant} har formen ${cap.form} og ikke OnBalance.`)
  }
  return cap
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
    // Horisonten stopper året før folkepensionsalderen. Folkepensionen står
    // ikke i planen og kommer af sig selv, jf. ADR-0023 — en plan uden poster
    // er derfor kun stillestående, så længe personen endnu ikke er
    // folkepensionist.
    const plan = aPlan({ balance: 1_000_000, entries: [], horizon: 69 })

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

    // Beskeden nævner posten ved dens navn og ikke ved dens id: den skrives
    // til den, der planlægger sin pension, og hun kender kun navnet.
    expect(() => simulate(plan)).toThrow(/Løn tilhører en person, der ikke findes/i)
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

  it('beskatter en pensionsindkomstpost som personlig indkomst uden AM-bidrag', () => {
    const plan = aPlan({
      inflationAssumption: 0,
      entries: [aPensionIncome({ amountInRealKroner: 400_000 })],
    })

    const year = simulateChecked(plan)[0]!
    const { tax } = year.persons[0]!

    // 400.000 kr. pensionsindkomst, Hvidovres 25,40 % kommuneskat og 0,72 %
    // kirkeskat. Ingen af de tre led, arbejde udløser, er der:
    // AM-bidrag                                      =       0,00
    // Personlig indkomst                             = 400.000,00
    // Beskæftigelses- og jobfradrag                  =       0,00
    // Skattepligtig indkomst                         = 400.000,00
    // Bundskat    12,01 % af (400.000 − 54.100)      =  41.542,59
    // Kommuneskat 25,40 % af (400.000 − 54.100)      =  87.858,60
    // Kirkeskat    0,72 % af (400.000 − 54.100)      =   2.490,48
    //                                                  ──────────
    //                                                  131.891,67
    expect(tax.layers.labourMarketContribution.amount).toBe(0)
    expect(tax.personalIncome).toBeCloseTo(400_000, 6)
    expect(tax.allowances.employmentAllowance).toBe(0)
    expect(tax.allowances.jobAllowance).toBe(0)
    expect(year.tax).toBeCloseTo(131_891.67, 2)

    // Samme beløb som løn ville have kostet noget helt andet — det er dét,
    // den tredje skattebehandling er til for.
    const somLoen = simulateChecked(
      aPlan({ inflationAssumption: 0, entries: [aSalary({ amountInRealKroner: 400_000 })] }),
    )[0]!
    expect(somLoen.tax).not.toBeCloseTo(year.tax, 2)
  })

  it('skriver ATP som en indtægtspost med aldersforankret start og egen reguleringssats', () => {
    // ATP har ingen figur i planen — den er en post som enhver anden, jf.
    // ADR-0023. Beløbet er brugerens eget tal fra PensionsInfo, starten er
    // en alder, og satsen er postens egen: ATP er ikke satsreguleret og
    // følger derfor hverken planens inflation eller folkepensionens
    // regulering.
    const plan = aPlan({
      startYear: 2026,
      inflationAssumption: 0.02,
      entries: [
        aPensionIncome({
          amountInRealKroner: 30_000,
          regulationRate: 0.03,
          period: { anchor: 'PersonAge', from: 68 },
        }),
      ],
    })

    const years = simulateChecked(plan)
    // Personen er født i 1973, så det 68. år er 2041.
    const foer = years.find((year) => year.year === 2040)!
    const foerste = years.find((year) => year.year === 2041)!

    expect(foer.entries).toEqual([])
    expect(foer.persons[0]!.tax.personalIncome).toBe(0)

    // 15 år med postens egne 3 %, ikke planens 2 %.
    expect(foerste.entries).toEqual([{ entry: 'atp', amount: expect.closeTo(46_739.02, 2) }])
    expect(foerste.income).toBeCloseTo(30_000 * 1.03 ** 15, 6)
    expect(foerste.income).not.toBeCloseTo(30_000 * 1.02 ** 15, 2)

    // Og den er pensionsindkomst hele vejen igennem: fuldt ud personlig
    // indkomst, uden AM-bidrag og uden nogen af de to arbejdsfradrag.
    const { tax } = foerste.persons[0]!
    expect(tax.personalIncome).toBeCloseTo(foerste.income, 6)
    expect(tax.layers.labourMarketContribution.amount).toBe(0)
    expect(tax.allowances.employmentAllowance).toBe(0)
    expect(tax.allowances.jobAllowance).toBe(0)
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
    expect(year.persons[0]!.marginal.earnedIncome).toBeCloseTo(0.430796, 5)
  })

  it('bærer begge marginalskatter pr. person, og lader dem være forskellige', () => {
    // De to satser svarer på hvert sit spørgsmål — hvad koster den næste
    // lønkrone, og hvad koster den næste krone pensionsindkomst. For en
    // person med begge slags indkomst er de aldrig ens: lønkronen bærer
    // AM-bidrag, pensionskronen gør ikke.
    //
    // 600.000 i løn giver 552.000 efter AM-bidrag, plus 200.000 i
    // pensionsindkomst = 752.000 i personlig indkomst. Det er over
    // mellemskattegrænsen på 641.200 og under topskattens, og Hvidovres
    // 25,40 % lader trappens første trin binde ved 44,57 %.
    //
    // Næste pensionskrone:  44,57 % (loftet) + 0,72 % kirkeskat
    // Næste lønkrone:       8 % AM + 92 % × det samme
    const year = simulateChecked(
      aPlan({
        inflationAssumption: 0,
        entries: [
          aSalary({ amountInRealKroner: 600_000 }),
          aPensionIncome({ amountInRealKroner: 200_000 }),
        ],
      }),
    )[0]!
    const { marginal } = year.persons[0]!

    expect(marginal.pensionIncome).toBeCloseTo(0.4457 + 0.0072, 5)
    expect(marginal.earnedIncome).toBeCloseTo(0.08 + 0.92 * (0.4457 + 0.0072), 5)
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
    // jævnt fordelt og lander på bufferen, hvor den vejer nul: afkastet er
    // nettoafkastsatsen af primosaldoen og intet andet, jf. ADR-0024.
    expect(years[0]!.income).toBeCloseTo(600_000, 6)
    expect(years[0]!.return).toBeCloseTo(0.06 * 1_000_000, 6)
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

  it('giver en jævnt fordelt strøm vægten ½ uden for bufferen', () => {
    // ADR-0006's vægt står uændret; ADR-0024 indsnævrer den kun i bufferens
    // ende. En jævn overførsel ud af en anden beholdning mister derfor
    // fortsat halvdelen af sit beløb fra dens afkastgrundlag.
    const years = simulateChecked(
      aPlan({
        balance: 0,
        inflationAssumption: 0,
        holdings: [
          aHolding({
            id: 'anden-beholdning',
            name: 'Anden beholdning',
            variant: 'SavingsAccount',
            balance: 1_000_000,
            grossReturn: 0.07,
            annualCostRate: 0.01,
          }),
        ],
        transfers: [
          aTransfer({
            from: 'anden-beholdning',
            to: 'free-assets',
            amountInRealKroner: 600_000,
          }),
        ],
      }),
    )

    expect(holding(years[0]!, 'anden-beholdning').return).toBeCloseTo(
      0.06 * (1_000_000 - 0.5 * 600_000),
      6,
    )
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
        statePensionProjectionAssumption: 0.02,
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

    // Vægten er en egenskab ved enden, jf. ADR-0024: modtageren får de
    // 200.000 kr. vejet halvt, mens bufferens ende giver nul, fordi
    // overførslen er jævn. Rækken bærer altså to forskellige tal om den
    // samme strøm, og det er hele påstanden.
    expect(buffer.weightedFlow).toBeCloseTo(0, 6)
    expect(anden.weightedFlow).toBeCloseTo(100_000, 6)
  })

  it('lader årets egne overførsler give råderum videre i planens rækkefølge', () => {
    // Året har ingen indre tidsrækkefølge — måneden er en afkastvægt og ikke
    // et tidsskridt, jf. ADR-0006. En beholdning, der ubestridt modtog
    // 200.000 kr., har derfor også noget at give af, selv om den stod tom
    // ved årets begyndelse.
    const plan = aPlanWithSecondHolding({
      balance: 1_000_000,
      transfers: [
        aTransfer({
          id: 'ind',
          from: 'free-assets',
          to: 'anden-beholdning',
          amountInRealKroner: 200_000,
        }),
        aTransfer({
          id: 'ud',
          from: 'anden-beholdning',
          to: 'free-assets',
          amountInRealKroner: 150_000,
        }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    expect(
      year.holdings.find((h) => h.holding === 'anden-beholdning')!.closingBalance,
    ).toBe(50_000)
    expect(bufferBalance(year)).toBe(950_000)
  })

  it('afkorter udtrækket, når det står før indskuddet i planens rækkefølge', () => {
    // Rækkefølgen i planen er den eneste orden, der findes: falder udtrækket
    // først, er beholdningen stadig tom, og der er intet at give af.
    const plan = aPlanWithSecondHolding({
      balance: 1_000_000,
      transfers: [
        aTransfer({
          id: 'ud',
          from: 'anden-beholdning',
          to: 'free-assets',
          amountInRealKroner: 150_000,
        }),
        aTransfer({
          id: 'ind',
          from: 'free-assets',
          to: 'anden-beholdning',
          amountInRealKroner: 200_000,
        }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    expect(
      year.holdings.find((h) => h.holding === 'anden-beholdning')!.closingBalance,
    ).toBe(200_000)
    expect(bufferBalance(year)).toBe(800_000)
    expect(year.transfers.find((t) => t.transfer === 'ud')).toEqual({
      transfer: 'ud',
      requested: 150_000,
      moved: 0,
    })
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

    // Overførslen har intet navn af sig selv og kendes på den ende, der
    // rammer noget — den anden er netop det, beskeden handler om.
    expect(() => simulate(plan)).toThrow(
      /Overførslen fra beholdningen Frie midler går til en beholdning, der ikke findes/i,
    )
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
          period: { anchor: 'CalendarYear', from: 2028, to: 2028 },
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
    const scheme = {
      id: 'ordning',
      name: 'Ordning',
      balance: 1_000_000,
      grossReturn: 0.07,
      annualCostRate: 0.005,
    }
    const first = (variant: HoldingVariant) =>
      simulateChecked(
        aPlan({ balance: 0, holdings: [aHolding({ ...scheme, variant })] }),
      )[0]!

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
            openedOn: { year: 2018, month: 1 },
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

  it('afviser en overførsel ind i en ordning, uanset hvor pengene kom fra', () => {
    // En flytning ind i en ordning er en indbetaling og ikke en overførsel,
    // jf. ADR-0016. Destinationsreglen står urørt, hvor afgiverreglen er
    // løsnet, jf. ADR-0022.
    const plan = aPlanWithPensionScheme('InstalmentPension', {
      transfers: [
        aTransfer({ from: 'free-assets', to: 'ordning', amountInRealKroner: 10_000 }),
      ],
    })

    expect(() => simulate(plan)).toThrow(/indbetaling/i)
  })

  it('afviser en overførsel ud af en ratepension og ud af en livrente', () => {
    // De to har `PayoutTaxation` `PersonalIncome`, og loven binder både
    // start, længde og årligt beløb på vejen ud. Den udbetaling skal gennem
    // en udbetalingsplan og kan ikke skrives som en overførsel, jf. ADR-0022.
    const outOf = (variant: 'InstalmentPension' | 'LifeAnnuity') =>
      aPlanWithPensionScheme(variant, {
        transfers: [
          aTransfer({ from: 'ordning', to: 'free-assets', amountInRealKroner: 10_000 }),
        ],
      })

    expect(() => simulate(outOf('InstalmentPension'))).toThrow(/udbetalingsplan/i)
    expect(() => simulate(outOf('LifeAnnuity'))).toThrow(/udbetalingsplan/i)
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
          openedOn: { year: 2018, month: 1 },
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
          openedOn: { year: 2018, month: 1 },
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
          aHolding({
            id: 'ordning',
            name: 'Ordning',
            variant,
            balance: 500_000,
            grossReturn: 0.06,
            annualCostRate: 0.01,
          }),
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

  it('beskatter aktiesparekontoen efter sin egen sats og ikke efter PAL-satsen', () => {
    const plan = aPlan({
      balance: 0,
      holdings: [
        {
          id: 'aktiesparekonto',
          name: 'Aktiesparekonto',
          variant: 'ShareSavingsAccount',
          balance: 100_000,
          grossReturn: 0.07,
          annualCostRate: 0.005,
        },
      ],
    })

    const year = simulateChecked(plan)[0]!
    const aktiesparekonto = holding(year, 'aktiesparekonto')

    // Nettoafkastsatsen er 6,5 % som i enhver anden beholdning, jf. ADR-0003:
    // 6.500 af de 100.000. Satsen ovenpå er kontoens egen på 17 % og ikke
    // PAL-satsens 15,3 % — det er hele grunden til, at varianten har sin egen
    // række. Afkastet står brutto, saldoen er nettet af skatten.
    expect(aktiesparekonto.return).toBeCloseTo(6_500, 6)
    expect(aktiesparekonto.tax).toBeCloseTo(1_105, 6)
    expect(aktiesparekonto.closingBalance).toBeCloseTo(105_395, 6)

    // Skatten er beholdningens egen og passerer ingen persons indkomst. Den
    // står derfor i årets skat, men hverken i aktie- eller kapitalindkomsten
    // — aktiesparekontoen er ikke et aktiedepot, jf. ADR-0010 og ADR-0017.
    expect(year.tax).toBeCloseTo(1_105, 6)
    expect(year.persons[0]!.shareIncome).toBe(0)
    expect(year.persons[0]!.capitalIncome).toBe(0)
  })

  it('lader aktiesparekontoens negative afkast give en negativ skat, uden gulv', () => {
    const plan = aPlan({
      balance: 0,
      holdings: [
        {
          id: 'aktiesparekonto',
          name: 'Aktiesparekonto',
          variant: 'ShareSavingsAccount',
          balance: 100_000,
          grossReturn: -0.1,
          annualCostRate: 0,
        },
      ],
    })

    const aktiesparekonto = holding(simulateChecked(plan)[0]!, 'aktiesparekonto')

    // Samme fremførselsforenkling som PAL-skatten allerede hviler på: et
    // tabsår giver penge tilbage frem for et nul. Læg ikke et `Math.max(0, …)`
    // ind for aktiesparekontoen alene — den deler regel med de øvrige, og
    // gulvet ville gøre saldoen for lav for altid.
    expect(aktiesparekonto.return).toBeCloseTo(-10_000, 6)
    expect(aktiesparekonto.tax).toBeCloseTo(-1_700, 6)
    expect(aktiesparekonto.closingBalance).toBeCloseTo(91_700, 6)
  })

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
          openedOn: { year: 2018, month: 1 },
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
          openedOn: { year: 2018, month: 1 },
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


describe('aktiesparekontoen', () => {
  it('afviser en plan, hvor bufferen er en aktiesparekonto', () => {
    // Aktiesparekontoen hører ikke under `FreeAssets`: den har et
    // indskudsloft og kan derfor ikke tage imod årets restpost, jf. ADR-0010
    // og diagram 01. Reglen er varianttabellens ene celle og ikke en
    // betingelse skrevet for kontoen selv.
    const plan = aPlan({ variant: 'ShareSavingsAccount' })

    expect(() => simulate(plan)).toThrow(/frie midler/i)
  })

  it('afviser en overførsel ind i aktiesparekontoen — den vej er en indbetaling', () => {
    // Indbetalingen er den form, der kender indskudsloftet, jf. ADR-0016 og
    // ADR-0019. En overførsel ville gå uden om det.
    const plan = aPlanWithShareSavingsAccount({
      transfers: [
        aTransfer({ from: 'free-assets', to: 'aktiesparekonto', amountInRealKroner: 10_000 }),
      ],
    })

    expect(() => simulate(plan)).toThrow(/indbetaling/i)
  })

  it('henter fra aktiesparekontoen uden en udbetalingsalder at vente på', () => {
    // Kontoen er hverken frie midler eller en pensionsordning: den har intet
    // `OpenedOn` og ingen `PayoutAge`, og ejeren hæver af den, når hun vil.
    // Det er dét, der lukker musefælden fra etape 2, jf. ADR-0022.
    const plan = aPlanWithShareSavingsAccount({
      shareSavingsAccount: 100_000,
      transfers: [
        aTransfer({ from: 'aktiesparekonto', to: 'free-assets', amountInRealKroner: 30_000 }),
      ],
    })

    const year = simulateChecked(plan)[0]!

    expect(holding(year, 'aktiesparekonto').closingBalance).toBe(70_000)
    expect(bufferBalance(year)).toBe(30_000)
  })

  it('afviser en person med to aktiesparekonti', () => {
    // ASKL § 3 tillader kun én. To konti ville dele ét råderum, og modellen
    // ville fremskrive en dobbelt så stor skattefri beholdning som den, et
    // pengeinstitut overhovedet ville have oprettet. Det er ikke et loftbrud
    // med et årstal, men en tilstand der ikke findes — og den afvises derfor
    // ved indgangen, jf. ADR-0020.
    const anAccount = (id: string) => ({
      id,
      name: 'Aktiesparekonto',
      variant: 'ShareSavingsAccount' as const,
      balance: 50_000,
      grossReturn: 0,
      annualCostRate: 0,
    })
    const plan = aPlan({ holdings: [anAccount('den-ene'), anAccount('den-anden')] })

    // Beskeden nævner de to konti ved deres navne og aktiesparekontoen ved
    // intet: reglen er varianttabellens og ikke aktiesparekontoens alene, jf.
    // ADR-0010, og varianten har ingen dansk etiket i motoren at låne.
    expect(() => simulate(plan)).toThrow(/jesper har 2 beholdninger af samme type/i)
  })

  it('afviser en lønkildet indbetaling til aktiesparekontoen', () => {
    // Der findes ingen arbejdsgiveradministreret aktiesparekonto. Den
    // lønkildede form indeholder AM-bidrag på vejen ind, fordi kilden er
    // AM-pligtig — rigtigt for de tre pensionsordninger og en kategorifejl
    // her: pengene på en aktiesparekonto har for længst passeret hele ejerens
    // skatteopgørelse. Handlingen skrives som et beholdningskildet bidrag fra
    // bufferen, hvor den regner rigtigt, jf. ADR-0020.
    const plan = aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [
        aContribution({
          source: 'salary',
          to: 'aktiesparekonto',
          percentageOfEntry: 0.05,
        }),
      ],
      holdings: [
        {
          id: 'aktiesparekonto',
          name: 'Aktiesparekonto',
          variant: 'ShareSavingsAccount',
          balance: 0,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })

    expect(() => simulate(plan)).toThrow(/arbejdsgiveradministreret/i)
  })

  it('lader et beholdningskildet bidrag lande med hele beløbet, når der er råderum', () => {
    // Det er den form, handlingen skal skrives i. Pengene var beskattede
    // allerede, da de kom ind på de frie midler, og en beholdningskilde har
    // aldrig båret AM-bidrag: brutto er lig netto, jf. ADR-0016.
    const plan = aPlan({
      balance: 1_000_000,
      contributions: [
        aHoldingContribution({
          source: 'free-assets',
          to: 'aktiesparekonto',
          amountInRealKroner: 50_000,
        }),
      ],
      holdings: [
        {
          id: 'aktiesparekonto',
          name: 'Aktiesparekonto',
          variant: 'ShareSavingsAccount',
          balance: 0,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })

    const year = simulateChecked(plan)[0]!

    expect(year.contributions).toEqual([
      { contribution: 'contribution', fromSource: 50_000, intoHolding: 50_000 },
    ])
    expect(holding(year, 'aktiesparekonto').closingBalance).toBeCloseTo(50_000, 6)
    expect(bufferBalance(year)).toBeCloseTo(950_000, 6)

    // Loftet måler, men afkorter ikke: kontoen står tom ved årets
    // begyndelse, så råderummet er hele de 174.200 kr., og de 50.000 er der
    // rigelig plads til. Linjen står der alligevel, fordi året bad om noget
    // — og året er umarkeret, for der er intet brud, jf. ADR-0019.
    expect(year.persons[0]!.caps).toEqual([
      {
        form: 'OnBalance',
        variant: 'ShareSavingsAccount',
        requested: 50_000,
        cap: 174_200,
        openingBalance: 0,
        deposited: 50_000,
      },
    ])
    expect(year.capBreach).toBeUndefined()
  })

  it('lader to personer have hver sin aktiesparekonto', () => {
    // Modprøve på reglen ovenfor: ASKL § 3 tæller den enkeltes konti og ikke
    // husstandens. En regel, der talte husstandens, ville afvise en plan, der
    // er fuldt lovlig — og den ville se lige så grøn ud som den rigtige uden
    // denne test.
    const anAccount = (id: string) => ({
      id,
      name: 'Aktiesparekonto',
      variant: 'ShareSavingsAccount' as const,
      balance: 50_000,
      grossReturn: 0.05,
      annualCostRate: 0,
    })
    const base = aPlan({ holdings: [anAccount('jespers-konto')] })
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
            holdings: [anAccount('marias-konto')],
          },
        ],
      },
    }

    expect(validatePlan(plan)).toBeUndefined()

    // Begge konti forrentes og beskattes hver for sig: 2.500 i afkast og
    // 17 % af dem, to gange.
    const year = simulateChecked(plan)[0]!
    expect(holding(year, 'jespers-konto').tax).toBeCloseTo(425, 6)
    expect(holding(year, 'marias-konto').tax).toBeCloseTo(425, 6)
  })

  it('lader en lønkildet indbetaling til en ratepension stå', () => {
    // Modprøve på den anden regel, med samme plan som ovenfor og kun
    // destinationens variant skiftet. Reglen måler på destinationen og ikke
    // på formen: den lønkildede indbetaling er hele etapens hovedtilfælde, og
    // en regel, der ramte den bredt, ville lukke det uden at nogen test blev
    // rød af det, den handlede om.
    const plan = aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.05 }),
      ],
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          openedOn: { year: 2018, month: 1 },
          balance: 0,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })

    expect(validatePlan(plan)).toBeUndefined()

    // 5 % af 600.000 er 30.000 brutto, og AM-bidraget går fra på vejen ind:
    // der lander 27.600 i ordningen, jf. ADR-0016.
    expect(simulateChecked(plan)[0]!.contributions).toEqual([
      { contribution: 'contribution', fromSource: 30_000, intoHolding: 27_600 },
    ])
  })

  describe('indskudsloftet', () => {
    /** Kontoen med en saldo at måle råderummet fra. Uden afkast, med mindre
        testen beder om det — så står afkortningen alene. */
    const anAccount = (options: { balance: number; grossReturn?: number }): Holding => ({
      id: 'aktiesparekonto',
      name: 'Aktiesparekonto',
      variant: 'ShareSavingsAccount',
      balance: options.balance,
      grossReturn: options.grossReturn ?? 0,
      annualCostRate: 0,
    })

    /** Et indskud fra de frie midler — den eneste form, der kan nå kontoen,
        jf. ADR-0020. */
    const aDeposit = (amountInRealKroner: number) =>
      aHoldingContribution({
        source: 'free-assets',
        to: 'aktiesparekonto',
        amountInRealKroner,
      })

    it('afkorter indskuddet til råderummet og lader resten blive liggende i kilden', () => {
      // Loftet er 174.200 kr. i 2026, og kontoen står med 150.000 kr. ved
      // årets begyndelse: der er plads til 24.200 kr. Brugeren beder om
      // 50.000, og pengeinstituttet tager imod 24.200 — de resterende 25.800
      // forlader aldrig bufferen. Det er hele skellet mod ratepensionens
      // loft, hvor pengene lander og bliver liggende, jf. ADR-0019.
      const plan = aPlan({
        balance: 1_000_000,
        holdings: [anAccount({ balance: 150_000 })],
        contributions: [aDeposit(50_000)],
      })

      const year = simulateChecked(plan)[0]!

      expect(year.contributions).toEqual([
        { contribution: 'contribution', fromSource: 24_200, intoHolding: 24_200 },
      ])
      expect(holding(year, 'aktiesparekonto').closingBalance).toBeCloseTo(174_200, 6)
      expect(bufferBalance(year)).toBeCloseTo(975_800, 6)
    })

    it('indskyder nul, når råderummet er brugt op, og lader linjen stå', () => {
      // Kontoen står med 200.000 kr. ved årets begyndelse og er dermed
      // allerede over loftet. Der er ikke plads til en krone, indskuddet
      // sker ikke, og de 50.000 forlader aldrig bufferen.
      //
      // Linjen står der alligevel. Den findes, når året **bad om** noget, og
      // ikke når noget landede — ellers forsvandt netop det år, brugeren
      // skal kunne se, jf. ADR-0019.
      const plan = aPlan({
        balance: 1_000_000,
        holdings: [anAccount({ balance: 200_000 })],
        contributions: [aDeposit(50_000)],
      })

      const year = simulateChecked(plan)[0]!

      expect(year.contributions).toEqual([
        { contribution: 'contribution', fromSource: 0, intoHolding: 0 },
      ])
      expect(bufferBalance(year)).toBeCloseTo(1_000_000, 6)
      expect(holding(year, 'aktiesparekonto').closingBalance).toBeCloseTo(200_000, 6)
      expect(year.persons[0]!.caps).toEqual([
        {
          form: 'OnBalance',
          variant: 'ShareSavingsAccount',
          requested: 50_000,
          cap: 174_200,
          openingBalance: 200_000,
          deposited: 0,
        },
      ])
    })

    it('giver den første indbetaling i planens rækkefølge hele råderummet og den næste resten', () => {
      // Kontoen står med 134.200 kr., så der er 40.000 kr. tilbage. To
      // indskud på 30.000 beder tilsammen om 60.000: skranken honorerer det
      // første fuldt ud og afviser 20.000 af det næste. Pro rata ville have
      // afkortet dem begge til 20.000, og den fordeling sker ikke nogen
      // steder, jf. ADR-0019.
      //
      // Rækkefølgen i `plan.contributions` er dermed betydningsbærende, hvor
      // den hidtil var ligegyldig.
      const plan = aPlan({
        balance: 1_000_000,
        holdings: [anAccount({ balance: 134_200 })],
        contributions: [
          aDeposit(30_000),
          { ...aDeposit(30_000), id: 'contribution-2' },
        ],
      })

      const year = simulateChecked(plan)[0]!

      expect(year.contributions).toEqual([
        { contribution: 'contribution', fromSource: 30_000, intoHolding: 30_000 },
        { contribution: 'contribution-2', fromSource: 10_000, intoHolding: 10_000 },
      ])
      expect(holding(year, 'aktiesparekonto').closingBalance).toBeCloseTo(174_200, 6)
      expect(bufferBalance(year)).toBeCloseTo(960_000, 6)
    })

    it('markerer ikke året, når indskuddet blev afkortet', () => {
      // Der bedes om 200.000 kr. mod et loft på 174.200 — et tal, der ligger
      // over loftet, og som en opgørelse, der sammenlignede uden at se på
      // formen, ville kalde et brud.
      //
      // Der er intet brud. `CapBreach` svarer på, hvorfor et loft er brudt,
      // og her skete indskuddet bare ikke: de 25.800 blev liggende på
      // bufferen. Afkortningen ses på loftlinjen i stedet, jf. ADR-0019.
      const plan = aPlan({
        balance: 1_000_000,
        holdings: [anAccount({ balance: 0 })],
        contributions: [aDeposit(200_000)],
      })

      const year = simulateChecked(plan)[0]!

      expect(year.capBreach).toBeUndefined()
      expect(year.persons[0]!.caps).toEqual([
        {
          form: 'OnBalance',
          variant: 'ShareSavingsAccount',
          requested: 200_000,
          cap: 174_200,
          openingBalance: 0,
          deposited: 174_200,
        },
      ])
      expect(bufferBalance(year)).toBeCloseTo(825_800, 6)
    })

    it('lader saldoen vokse over loftet af afkast alene uden at bryde noget', () => {
      // Kontoen står med 170.000 kr. og forrentes 10 %. I 2026 er der 4.200
      // kr. tilbage under loftet, og det er alt, der kommer ind af de 10.000,
      // der blev bedt om. Årets gevinst rører ikke det tal: den samlede
      // værdi opgøres pr. 31. december og styrer det **følgende** års
      // råderum, jf. ASKL § 9, stk. 1, og docs/satser/2026.md.
      //
      // Året efter er saldoen af sig selv over loftet. Der er ikke plads til
      // mere, og intet loft er brudt — det er hele forskellen på et loft, der
      // forhindrer, og et, der straffer, jf. ADR-0019.
      const plan = aPlan({
        balance: 1_000_000,
        holdings: [anAccount({ balance: 170_000, grossReturn: 0.1 })],
        contributions: [aDeposit(10_000)],
      })

      const years = simulateChecked(plan)
      const capIn = (year: number) => years.find((result) => result.year === year)!

      expect(capIn(2026).persons[0]!.caps).toEqual([
        {
          form: 'OnBalance',
          variant: 'ShareSavingsAccount',
          requested: 10_000,
          cap: 174_200,
          openingBalance: 170_000,
          deposited: 4_200,
        },
      ])

      // Forrige års ultimo er dette års primo, og der er intet at trække fra
      // loftet med. Linjen står der stadig, for året bad om 10.000.
      const nextLine = onBalance(capIn(2027).persons[0]!.caps[0]!)
      expect(nextLine.requested).toBeCloseTo(10_000, 6)
      expect(nextLine.openingBalance).toBeCloseTo(
        holding(capIn(2026), 'aktiesparekonto').closingBalance,
        6,
      )
      expect(nextLine.openingBalance).toBeGreaterThan(174_200)
      expect(nextLine.deposited).toBe(0)

      expect(capIn(2026).capBreach).toBeUndefined()
      expect(capIn(2027).capBreach).toBeUndefined()
    })

    it('løfter loftet med § 20-antagelsen som de øvrige beløbsgrænser', () => {
      // Loftet er en § 20-reguleret beløbsgrænse og fremskrives som resten af
      // dem, jf. ADR-0005: 174.200 i 2026 og 2 % mere i 2027, altså 177.684.
      //
      // Kontoen fyldes helt op i det første år, og det er netop
      // fremskrivningen, der giver plads til de 3.484 kr. året efter. Var
      // loftet holdt fast, var råderummet nul.
      const plan = aPlan({
        balance: 1_000_000,
        section20ProjectionAssumption: 0.02,
        holdings: [anAccount({ balance: 0 })],
        contributions: [aDeposit(200_000)],
      })

      const years = simulateChecked(plan)
      const lineIn = (year: number) =>
        onBalance(years.find((result) => result.year === year)!.persons[0]!.caps[0]!)

      expect(lineIn(2026).cap).toBeCloseTo(174_200, 6)
      expect(lineIn(2026).deposited).toBeCloseTo(174_200, 6)
      expect(lineIn(2027).cap).toBeCloseTo(177_684, 6)
      expect(lineIn(2027).openingBalance).toBeCloseTo(174_200, 6)
      expect(lineIn(2027).deposited).toBeCloseTo(3_484, 6)
    })

    it('markerer stadig året, når et PerYear-loft brydes i samme år som et indskud afkortes', () => {
      // Modprøve på filtreringen i `capBreach`. Den skal se på formen, før
      // den sammenligner to tal — men den skal kun sortere `OnBalance` fra,
      // ikke lukke for et brud, der faktisk er sket.
      //
      // Året rummer begge dele: ratepensionen får 96.600 kr. mod et loft på
      // 68.700 og mister fradragsretten for forskellen, mens indskuddet på
      // aktiesparekontoen afvises helt. En filtrering, der lukkede for meget,
      // ville lade året stå umarkeret, og brugeren ville ikke se, at
      // 27.900 kr. holdt op med at virke.
      const plan = aPlan({
        balance: 1_000_000,
        entries: [aSalary({ amountInRealKroner: 700_000 })],
        holdings: [
          anAccount({ balance: 200_000 }),
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 0,
            grossReturn: 0,
            annualCostRate: 0,
          },
        ],
        contributions: [
          aDeposit(50_000),
          {
            ...aContribution({
              source: 'salary',
              to: 'ratepension',
              amountInRealKroner: 105_000,
            }),
            id: 'contribution-2',
          },
        ],
      })

      const year = simulateChecked(plan)[0]!
      const { caps } = year.persons[0]!

      expect(year.capBreach).toBe('LostDeductibility')
      expect(onBalance(caps.find((line) => line.form === 'OnBalance')!).deposited).toBe(0)
      expect(perYear(caps.find((line) => line.form === 'PerYear')!).paid).toBeCloseTo(96_600, 6)
    })

    it('måler råderummet pr. person, så den enes fulde konto ikke lukker den andens', () => {
      // Modprøve på, at loftet er personens. Jespers konto er over loftet, og
      // hans indskud afvises; Marias er tom, og hendes lander helt. En
      // opgørelse, der lagde husstandens konti sammen eller så alle årets
      // indbetalinger under ét, ville afvise et indskud, der er fuldt
      // lovligt — og den ville se lige så grøn ud som den rigtige uden denne
      // test, jf. ADR-0018.
      const account = (id: string, balance: number): Holding => ({
        id,
        name: 'Aktiesparekonto',
        variant: 'ShareSavingsAccount',
        balance,
        grossReturn: 0,
        annualCostRate: 0,
      })
      const base = aPlan({
        balance: 1_000_000,
        holdings: [account('jespers-konto', 200_000)],
        contributions: [
          aHoldingContribution({
            source: 'free-assets',
            to: 'jespers-konto',
            amountInRealKroner: 50_000,
          }),
          {
            ...aHoldingContribution({
              source: 'marias-frie-midler',
              to: 'marias-konto',
              amountInRealKroner: 50_000,
            }),
            id: 'contribution-2',
          },
        ],
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
                  id: 'marias-frie-midler',
                  name: 'Marias frie midler',
                  variant: 'SavingsAccount',
                  balance: 1_000_000,
                  grossReturn: 0,
                  annualCostRate: 0,
                },
                account('marias-konto', 0),
              ],
            },
          ],
        },
      }

      const year = simulateChecked(plan)[0]!

      expect(year.contributions).toEqual([
        { contribution: 'contribution', fromSource: 0, intoHolding: 0 },
        { contribution: 'contribution-2', fromSource: 50_000, intoHolding: 50_000 },
      ])
      expect(onBalance(year.persons[0]!.caps[0]!).deposited).toBe(0)
      expect(onBalance(year.persons[1]!.caps[0]!).deposited).toBeCloseTo(50_000, 6)
    })
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
    openedOn: { year: 2018, month: 1 },
  } as const
  const lifeAnnuity = { id: 'livrente', name: 'Livrente', variant: 'LifeAnnuity' } as const
  const oldAgeSavings = {
    id: 'aldersopsparing',
    name: 'Aldersopsparing',
    variant: 'OldAgeSavings',
    openedOn: { year: 2018, month: 1 },
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
        aHolding({
          ...scheme,
          balance: 0,
          grossReturn: options.grossReturn ?? 0,
          annualCostRate: options.annualCostRate ?? 0,
        }),
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

    // Lønnen og bidraget er begge jævne og passerer bufferen uden at veje
    // noget dér, jf. ADR-0024. Ordningen får derimod sine 44.160 × ½: de
    // penge bliver faktisk investeret ved ankomsten.
    expect(holding(year, 'free-assets').weightedFlow).toBeCloseTo(0, 6)
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
            openedOn: { year: 2018, month: 1 },
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
      expect(perYear(caps[0]!).paid).toBeCloseTo(96_600, 6)
      expect(caps[0]!.cap).toBeCloseTo(68_700, 6)
      expect(perYear(caps[0]!).withDeductibility).toBeCloseTo(68_700, 6)
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
          form: 'PerYear',
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

      expect(perYear(year.persons[0]!.caps[0]!).withDeductibility).toBeCloseTo(68_700, 6)
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
          openedOn: { year: 2018, month: 1 },
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

    // Indbetalingen kendes på den ende, der rammer noget — her lønposten.
    expect(() => simulate(plan)).toThrow(
      /Indbetalingen fra posten Løn går til en beholdning, der ikke findes/i,
    )
  })

  it('afviser en indbetaling, hvis kilden ikke findes', () => {
    const plan = aPlanWith(
      aContribution({ source: 'ingen-loen', to: 'ratepension', percentageOfEntry: 0.08 }),
    )

    expect(() => simulate(plan)).toThrow(
      /Indbetalingen til beholdningen Ratepension kommer fra en post, der ikke findes/i,
    )
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

    expect(() => simulate(plan)).toThrow(/posten Faste udgifter, som er en udgiftspost/i)
  })

  it('afviser en lønkilde, hvor posten og ordningen ikke er samme persons', () => {
    // Jespers løn ind i Marias ratepension findes ikke: en ordning, en
    // arbejdsgiver administrerer, står i lønmodtagerens eget navn, jf.
    // ADR-0028.
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
                openedOn: { year: 2018, month: 1 },
                balance: 0,
                grossReturn: 0,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    // Beskeden siger begge ejere ved navn: hele fejlen er, at de to ikke er
    // den samme, og et id ville lade brugeren gætte hvilke to.
    expect(() => simulate(plan)).toThrow(/tilhører Jesper.*tilhører Maria/is)
  })

  it('afviser en beholdningskilde, der ikke findes', () => {
    const plan = aPlanWith(
      aHoldingContribution({
        source: 'findes-ikke',
        to: 'ratepension',
        amountInRealKroner: 50_000,
      }),
    )

    expect(() => simulate(plan)).toThrow(
      /Indbetalingen til beholdningen Ratepension kommer fra en beholdning, der ikke findes/i,
    )
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
                openedOn: { year: 2018, month: 1 },
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

  it('tager imod et beholdningskildet bidrag fra den anden persons frie midler', () => {
    // Husstandens frie midler flytter sig allerede uhindret mellem ejerne
    // gennem en overførsel, og både loftet og fradragsretten følger
    // destinationens ejer — Jespers frie midler må derfor betale til Marias
    // ratepension, jf. ADR-0028. Uden det kunne intet nå en ordning hos den,
    // der ikke ejer bufferen.
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
                openedOn: { year: 2018, month: 1 },
                balance: 0,
                grossReturn: 0,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    const year = simulateChecked(plan)[0]!
    const landed = year.contributions.find((line) => line.contribution === 'contribution')!

    // Ingen AM-behandling på vejen ind: pengene kommer fra beskattede frie
    // midler, og der lander 100 % i Marias ordning.
    expect(landed.fromSource).toBeCloseTo(50_000, 0)
    expect(landed.intoHolding).toBeCloseTo(50_000, 0)

    // Og loftet er Marias, ikke Jespers: fradragsretten følger destinationens
    // ejer, uanset hvis frie midler pengene forlod.
    const capOf = (personId: string) =>
      year.persons
        .find((person) => person.person === personId)!
        .caps.find((cap) => cap.variant === 'InstalmentPension')
    expect(capOf('maria')).toMatchObject({ form: 'PerYear', withDeductibility: 50_000 })
    expect(capOf('jesper')).toBeUndefined()
  })
})

describe('ratepensionens udbetaling', () => {
  it('deler primosaldoen med de resterende udbetalingsår og genberegner hvert år', () => {
    // Serieprincippet, jf. `SerialPrinciple` i CONTEXT.md: raten er saldoen
    // ved årets begyndelse divideret med antallet af resterende
    // udbetalingsår, og den regnes forfra hvert år. Fødselsåret giver
    // folkepensionsalder 70 og dermed pensionsudbetalingsalder 67 — året,
    // ordningen tidligst må tømmes, er 2040.
    const years = simulateChecked(
      aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 1_000_000,
            grossReturn: 0,
            annualCostRate: 0,
            payout: { start: 67, duration: 10, principle: 'SerialPrinciple' },
          },
        ],
      }),
    )

    const inYear = (year: number) => holding(years.find((y) => y.year === year)!, 'ratepension')

    expect(inYear(2039).payout).toBe(0)
    expect(inYear(2040).payout).toBeCloseTo(100_000, 6)
    expect(inYear(2040).closingBalance).toBeCloseTo(900_000, 6)
    expect(inYear(2041).payout).toBeCloseTo(100_000, 6)
    expect(inYear(2041).closingBalance).toBeCloseTo(800_000, 6)
  })

  it('beskatter raten som pensionsindkomst og holder den ude af årets indtægter', () => {
    // Samme 400.000 kr. som ATP-posten længere oppe, og samme skat på kronen:
    // raten er `PensionIncome` og krydser skattesømmet som sit eget tal, jf.
    // ADR-0023. Men den er ikke `income` — den flytter penge fra
    // beholdningen til bufferen og lader formuen uændret, præcis som en
    // overførsel. Kun dens skat sætter aftryk i balanceinvarianten, som
    // `simulateChecked` prøver for hvert år.
    const years = simulateChecked(
      aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 4_000_000,
            grossReturn: 0,
            annualCostRate: 0,
            payout: { start: 67, duration: 10, principle: 'SerialPrinciple' },
          },
        ],
      }),
    )

    const year = years.find((y) => y.year === 2040)!
    const { tax } = year.persons[0]!

    expect(holding(year, 'ratepension').payout).toBeCloseTo(400_000, 6)
    expect(tax.layers.labourMarketContribution.amount).toBe(0)
    expect(tax.personalIncome).toBeCloseTo(400_000, 6)
    expect(tax.allowances.employmentAllowance).toBe(0)
    expect(year.tax).toBeCloseTo(131_891.67, 2)

    expect(year.income).toBe(0)
    expect(bufferBalance(year)).toBeCloseTo(400_000 - 131_891.67, 2)
  })

  it('regner en ratepension uden udbetalingsplan uden at fejle, og lader den vokse', () => {
    // Feltet er valgfrit: en ratepension, brugeren endnu ikke har besluttet
    // sig om, skal kunne stå i planen. Uden plan bliver den stående og
    // vokser, og det ses i formuegrafen.
    const years = simulateChecked(
      aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 1_000_000,
            grossReturn: 0.05,
            annualCostRate: 0,
          },
        ],
      }),
    )

    expect(years.every((year) => holding(year, 'ratepension').payout === 0)).toBe(true)

    // PAL-skatten tager 15,3 % af afkastet; saldoen vokser hele horisonten
    // igennem og bliver aldrig tømt.
    const last = holding(years.at(-1)!, 'ratepension')
    expect(last.closingBalance).toBeGreaterThan(1_000_000)
    expect(holding(years[0]!, 'ratepension').closingBalance).toBeCloseTo(
      1_000_000 * (1 + 0.05 * (1 - 0.153)),
      6,
    )
  })

  it('fejer resten med i den sidste rate, så beholdningen lukker på præcis nul', () => {
    // Året har både afkast og beholdningsskat, og de er netop det, fejningen
    // skal tage med: når afkastet er tilskrevet og PAL-skatten trukket,
    // lægges det resterende til sidste års rate. Fejningen sker efter
    // afkastet og har derfor vægt nul — ingen cirkularitet, og rækkefølgen i
    // diagram 02 holder.
    const years = simulateChecked(
      aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 1_000_000,
            grossReturn: 0.05,
            annualCostRate: 0,
            payout: { start: 67, duration: 10, principle: 'SerialPrinciple' },
          },
        ],
      }),
    )

    const last = holding(years.find((year) => year.year === 2049)!, 'ratepension')

    expect(last.closingBalance).toBeCloseTo(0, 6)
    // Uden fejningen ville serieprincippet have udbetalt primosaldoen selv og
    // ladt årets afkast efter skat blive stående.
    expect(last.payout).toBeCloseTo(last.openingBalance + last.return - last.tax, 6)
    expect(last.payout).toBeGreaterThan(last.openingBalance)
  })

  it('lader en tømt ratepension blive stående med saldo nul', () => {
    const years = simulateChecked(
      aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 1_000_000,
            grossReturn: 0.05,
            annualCostRate: 0,
            payout: { start: 67, duration: 10, principle: 'SerialPrinciple' },
          },
        ],
      }),
    )

    // Rækken findes i hvert eneste år efter tømningen — også det sidste i
    // horisonten — med saldo nul, ingen rate og intet afkast.
    const after = years.filter((year) => year.year > 2049)
    expect(after.length).toBeGreaterThan(0)
    for (const year of after) {
      const emptied = holding(year, 'ratepension')
      expect(emptied.closingBalance).toBeCloseTo(0, 6)
      expect(emptied.payout).toBe(0)
      expect(emptied.return).toBeCloseTo(0, 6)
    }
  })

  it('flytter en erhvervsophørsforankret udbetalingsstart, når WorkEndAge ændres', () => {
    // Startpunktet er en `AgeBound`: sat til erhvervsophør følger hele
    // forløbet `Person.workEndAge`, uden at planen redigeres. Det er dét, der
    // gør to scenarier sammenlignelige ved at ændre ét tal. Erhvervsophøret
    // skal ligge på eller efter pensionsudbetalingsalderen, som er 67 for
    // denne årgang.
    const firstPayoutYear = (workEndAge: number) => {
      const years = simulateChecked(
        aPlan({
          balance: 0,
          workEndAge,
          holdings: [
            {
              id: 'ratepension',
              name: 'Ratepension',
              variant: 'InstalmentPension',
              openedOn: { year: 2018, month: 1 },
              balance: 1_000_000,
              grossReturn: 0,
              annualCostRate: 0,
              payout: { start: 'WorkEndAge', duration: 10, principle: 'SerialPrinciple' },
            },
          ],
        }),
      )
      return years.find((year) => holding(year, 'ratepension').payout > 0)!.year
    }

    expect(firstPayoutYear(67)).toBe(2040)
    expect(firstPayoutYear(70)).toBe(2043)
  })

  it('regner annuitetsprincippets rate med satsårets amortisationsrente', () => {
    // Annuiteten af primosaldoen over de resterende udbetalingsår, med
    // satsårets amortisationsrente på 3,22 % — Finans Danmarks tal for
    // udbetalingsåret 2026, jf. docs/satser/2026.md og PBL § 11 A, stk. 3:
    //
    //   1.000.000 × 0,0322 ÷ (1 − 1,0322⁻¹⁰) = 118.550,49
    //
    // Renten er ikke beholdningens nettoafkast: her er afkastet nul, og
    // raten er alligevel de 118.550,49 og ikke seriens 100.000.
    const years = simulateChecked(
      aPlan({
        balance: 0,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 1_000_000,
            grossReturn: 0,
            annualCostRate: 0,
            payout: { start: 67, duration: 10, principle: 'AnnuityPrinciple' },
          },
        ],
      }),
    )

    const first = holding(years.find((year) => year.year === 2040)!, 'ratepension')
    expect(first.payout).toBeCloseTo(118_550.49, 2)

    // Andet år: samme annuitet af den nye primosaldo over ni år. Uden afkast
    // falder raten, fordi saldoen faldt mere end nævneren voksede — det er
    // først med et afkast, at raterne bliver tilnærmelsesvis lige store.
    const second = holding(years.find((year) => year.year === 2041)!, 'ratepension')
    expect(second.openingBalance).toBeCloseTo(1_000_000 - 118_550.49, 2)
    expect(second.payout).toBeCloseTo((second.openingBalance * 0.0322) / (1 - 1.0322 ** -9), 6)
  })
})

/** En plan med én ratepension og den udbetalingsplan, testen handler om.
    Ordningen er oprettet i januar 2018 og ejeren født i juni 1973, så
    pensionsudbetalingsalderen er 67 og året, den nås, 2040. */
function aPlanWithPayout(payout: PayoutSchedule): Plan {
  return aPlan({
    balance: 0,
    holdings: [
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        openedOn: { year: 2018, month: 1 },
        balance: 1_000_000,
        grossReturn: 0,
        annualCostRate: 0,
        payout,
      },
    ],
  })
}

/** De tre lovregler om udbetalingsplanen, jf. PBL § 11 A, stk. 1. De afvises
    ved indgangen og ikke som et årsresultat: svaret er det samme i alle
    simuleringsår og afhænger ikke af et satsår, jf. ADR-0020. Fladen
    forhindrer dem desuden med et `min` på feltet, men en importeret JSON-fil
    er ikke gået gennem et felt. */
describe('udbetalingsplanens lovregler', () => {
  it('afviser en udbetaling, der begynder før pensionsudbetalingsalderen', () => {
    const early = aPlanWithPayout({ start: 66, duration: 10, principle: 'SerialPrinciple' })
    const legal = aPlanWithPayout({ start: 67, duration: 10, principle: 'SerialPrinciple' })

    expect(validatePlan(early)).toMatch(/pensionsudbetalingsalder/i)
    expect(() => simulate(early)).toThrow(/pensionsudbetalingsalder/i)
    expect(validatePlan(legal)).toBeUndefined()
  })

  it('afviser en udbetaling, der løber under ti år', () => {
    const short = aPlanWithPayout({ start: 67, duration: 9, principle: 'SerialPrinciple' })
    const legal = aPlanWithPayout({ start: 67, duration: 10, principle: 'SerialPrinciple' })

    expect(validatePlan(short)).toMatch(/ti år|10 år/i)
    expect(() => simulate(short)).toThrow(/ti år|10 år/i)
    expect(validatePlan(legal)).toBeUndefined()
  })

  it('afviser en sidste rate, der falder mere end tredive år efter pensionsudbetalingsalderen', () => {
    // Pensionsudbetalingsalderen nås i 2040, så den sidste rate må falde i
    // 2070 og ikke senere. En udbetaling fra 2040 over 31 år slutter præcis
    // dér; 32 år er ét år for meget. Grænsen måles i kalenderår og ikke i
    // aldre, ganske som starten.
    const legal = aPlanWithPayout({ start: 67, duration: 31, principle: 'SerialPrinciple' })
    const late = aPlanWithPayout({ start: 67, duration: 32, principle: 'SerialPrinciple' })

    expect(validatePlan(legal)).toBeUndefined()
    expect(validatePlan(late)).toMatch(/2070|tredive|30 år/i)
    expect(() => simulate(late)).toThrow(/2070|tredive|30 år/i)
  })
})

/** Fixturens buffer plus en aldersopsparing, oprettet før maj 2007 og derfor
    under det faste regime: pensionsudbetalingsalderen er 60 år, uafhængigt af
    folkepensionsalderens tabel. Fixturens person er født i juni 1973 og når
    den i 2033 — det år, døren går op. */
function aPlanWithOldAgeSavings(
  options: Parameters<typeof aPlan>[0] & { oldAgeSavings?: number } = {},
): Plan {
  const { oldAgeSavings = 0, ...rest } = options
  return aPlan({
    balance: 0,
    ...rest,
    holdings: [
      {
        id: 'aldersopsparing',
        name: 'Aldersopsparing',
        variant: 'OldAgeSavings',
        openedOn: { year: 2000, month: 1 },
        balance: oldAgeSavings,
        grossReturn: options.grossReturn ?? 0,
        annualCostRate: options.annualCostRate ?? 0,
      },
    ],
  })
}

/** Det år, `aPlanWithOldAgeSavings`' ordning tidligst må udbetales. */
const oldAgeSavingsPayoutYear = 2033

describe('overførsel ud af en skattefri ordning', () => {
  it('henter fra en aldersopsparing og lander i de frie midler', () => {
    const plan = aPlanWithOldAgeSavings({
      oldAgeSavings: 500_000,
      transfers: [
        aTransfer({
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 100_000,
          period: { anchor: 'CalendarYear', from: oldAgeSavingsPayoutYear },
        }),
      ],
    })

    const year = simulateChecked(plan).find((y) => y.year === oldAgeSavingsPayoutYear)!

    expect(holding(year, 'aldersopsparing').closingBalance).toBe(400_000)
    expect(bufferBalance(year)).toBe(100_000)
  })

  it('afkorter beløbet til afgiverens primosaldo og lukker den på nul', () => {
    // Et fast kronebeløb kunne ellers drive ordningen negativ, og en
    // beholdning, der ikke er bufferen, må ikke gå under nul.
    const plan = aPlanWithOldAgeSavings({
      oldAgeSavings: 100_000,
      transfers: [
        aTransfer({
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 150_000,
          period: { anchor: 'CalendarYear', from: oldAgeSavingsPayoutYear },
        }),
      ],
    })

    const year = simulateChecked(plan).find((y) => y.year === oldAgeSavingsPayoutYear)!

    expect(holding(year, 'aldersopsparing').closingBalance).toBe(0)
    expect(bufferBalance(year)).toBe(100_000)
  })

  it('giver den første overførsel i planens rækkefølge hele saldoen og den næste resten', () => {
    // Samme greb som to indbetalinger, der deler ét råderum under et
    // `OnBalance`-loft: målte de begge mod primosaldoen hver for sig, ville
    // de tilsammen tømme ordningen to gange.
    const inYear = { anchor: 'CalendarYear' as const, from: oldAgeSavingsPayoutYear }
    const plan = aPlanWithOldAgeSavings({
      oldAgeSavings: 100_000,
      transfers: [
        aTransfer({
          id: 'foerste',
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 80_000,
          period: inYear,
        }),
        aTransfer({
          id: 'anden',
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 80_000,
          period: inYear,
        }),
      ],
    })

    const year = simulateChecked(plan).find((y) => y.year === oldAgeSavingsPayoutYear)!

    expect(holding(year, 'aldersopsparing').closingBalance).toBe(0)
    expect(bufferBalance(year)).toBe(100_000)
  })

  it('bærer det ønskede og det flyttede beløb på en overførselslinje', () => {
    const plan = aPlanWithOldAgeSavings({
      oldAgeSavings: 100_000,
      transfers: [
        aTransfer({
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 150_000,
          period: { anchor: 'CalendarYear', from: oldAgeSavingsPayoutYear },
        }),
      ],
    })

    const years = simulateChecked(plan)
    const truncated = years.find((y) => y.year === oldAgeSavingsPayoutYear)!

    expect(truncated.transfers).toEqual([
      { transfer: 'transfer', requested: 150_000, moved: 100_000 },
    ])
    // Året før falder overførslen ikke, og linjen findes derfor ikke.
    expect(years.find((y) => y.year === oldAgeSavingsPayoutYear - 1)!.transfers).toEqual([])
  })

  it('opløser en aldersforankret periode mod afgiverbeholdningens ejer', () => {
    // Enderne har hver sin ejer, og de to er født med ti års mellemrum.
    // Måltes alderen mod modtageren, ville tømningen begynde et helt andet
    // sted — afgiveren er den entydige, jf. ADR-0022.
    const plan = aPlanWithTwoOwners()

    const years = simulateChecked(plan)
    const movedIn = years
      .filter((year) => year.transfers.length > 0)
      .map((year) => year.year)

    // Afgiveren er født i 1963 og fylder 70 i 2033; modtagerens ejer er født
    // i 1973 og ville have givet 2043.
    expect(movedIn[0]).toBe(2033)
  })

  it('flytter en erhvervsophørsforankret overførsel, når WorkEndAge ændres', () => {
    const at = (workEndAge: number) =>
      aPlanWithOldAgeSavings({
        workEndAge,
        oldAgeSavings: 500_000,
        transfers: [
          aTransfer({
            from: 'aldersopsparing',
            to: 'free-assets',
            amountInRealKroner: 50_000,
            period: { anchor: 'PersonAge', from: 'WorkEndAge' },
          }),
        ],
      })

    const firstMove = (plan: Plan) =>
      simulateChecked(plan).find((year) => year.transfers.length > 0)!.year

    // Fixturens person er født i juni 1973.
    expect(firstMove(at(62))).toBe(2035)
    expect(firstMove(at(65))).toBe(2038)
  })

  it('afviser en overførsel, der begynder før afgiverens pensionsudbetalingsalder', () => {
    // En hævning fra en aldersopsparing før den alder koster 20 % i afgift
    // og er ikke noget, planen skal kunne beskrive, jf. ADR-0020.
    const from = (year: number) =>
      aPlanWithOldAgeSavings({
        oldAgeSavings: 500_000,
        transfers: [
          aTransfer({
            from: 'aldersopsparing',
            to: 'free-assets',
            amountInRealKroner: 50_000,
            period: { anchor: 'CalendarYear', from: year },
          }),
        ],
      })

    expect(validatePlan(from(oldAgeSavingsPayoutYear - 1))).toMatch(
      /pensionsudbetalingsalder/i,
    )
    expect(validatePlan(from(oldAgeSavingsPayoutYear))).toBeUndefined()
  })

  it('afviser en overførsel uden startår — den ville begynde ved planens start', () => {
    const plan = aPlanWithOldAgeSavings({
      oldAgeSavings: 500_000,
      transfers: [
        aTransfer({ from: 'aldersopsparing', to: 'free-assets', amountInRealKroner: 50_000 }),
      ],
    })

    expect(validatePlan(plan)).toMatch(/pensionsudbetalingsalder/i)
  })

  it('lader døren stå åben for aktiesparekontoen og de frie midler', () => {
    // Ingen af dem er en pensionsordning: de har intet oprettelsestidspunkt
    // og dermed ingen udbetalingsalder at vente på.
    const konto = aPlanWithShareSavingsAccount({
      shareSavingsAccount: 100_000,
      transfers: [
        aTransfer({ from: 'aktiesparekonto', to: 'free-assets', amountInRealKroner: 10_000 }),
      ],
    })

    expect(validatePlan(konto)).toBeUndefined()
  })

  it('beskatter ikke udbetalingen og lader den stå uden for enhver indkomst', () => {
    // `PayoutTaxation` er `TaxFree`: der udløses ingen skat, og beløbet
    // indgår hverken i årets indtægter eller i nogen persons opgørelse.
    // Sammenlignet med en ratepensions rate, som er personlig indkomst, er
    // det hele forskellen.
    const plan = aPlanWithOldAgeSavings({
      oldAgeSavings: 500_000,
      transfers: [
        aTransfer({
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 200_000,
          period: { anchor: 'CalendarYear', from: oldAgeSavingsPayoutYear },
        }),
      ],
    })

    const year = simulateChecked(plan).find((y) => y.year === oldAgeSavingsPayoutYear)!

    expect(year.income).toBe(0)
    expect(year.expenses).toBe(0)
    expect(year.tax).toBe(0)
    expect(totalTax(year.persons[0]!.tax)).toBe(0)
    expect(year.closingWealth).toBe(500_000)
  })

  it('kalder året uholdbart, når den eneste likviditet er en ratepension', () => {
    // Ratepensionen kan kun nås af en udbetalingsplan, der binder ti år
    // frem. Det er en anden plan og ikke en manglende overførsel, og
    // pengene tæller derfor ikke som likviditet andetsteds, jf. ADR-0022.
    const plan = aPlanWithPensionScheme('InstalmentPension', {
      balance: 0,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
    })

    const year = simulateChecked(plan)[0]!

    expect(bufferBalance(year)).toBeLessThan(0)
    expect(year.bufferState).toBe('Unsustainable')
  })

  it('kalder året ufuldstændigt, når likviditeten står på en aktiesparekonto', () => {
    // Kontoen har ingen dør at vente på: en overførsel kan hente fra den i
    // ethvert år, og der mangler derfor kun én.
    const plan = aPlanWithShareSavingsAccount({
      shareSavingsAccount: 500_000,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
    })

    const year = simulateChecked(plan)[0]!

    expect(bufferBalance(year)).toBeLessThan(0)
    expect(year.bufferState).toBe('Incomplete')
  })

  it('tæller en aldersopsparing med først fra dens pensionsudbetalingsalder', () => {
    // Den samme plan skifter svar undervejs: pengene er der hele tiden, men
    // ingen overførsel kan nå dem, før døren går op i 2033.
    const plan = aPlanWithOldAgeSavings({
      oldAgeSavings: 5_000_000,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
    })

    const years = simulateChecked(plan)
    const stateIn = (year: number) => years.find((y) => y.year === year)!.bufferState

    expect(stateIn(oldAgeSavingsPayoutYear - 1)).toBe('Unsustainable')
    expect(stateIn(oldAgeSavingsPayoutYear)).toBe('Incomplete')
  })
})

describe('livrentens omsætning', () => {
  /** Fixturens buffer plus én livrente. Fødselsåret giver folkepensionsalder
      70 og dermed pensionsudbetalingsalder 67, så omsætningsåret er 2040,
      med mindre testen flytter starten.

      Selskabet oplyser et depot på 1.000.000 kr. og en årlig ydelse på
      55.000 kr. — kvotienten er 0,055, og den er alt, de to tal bruges til. */
  function aPlanWithLifeAnnuity(
    annuity: {
      balance?: number
      grossReturn?: number
      quotedReserve?: number
      quotedAnnualBenefit?: number
      bonusRate?: number
      /** Udeladt betyder ingen udbetalingsplan: livrenten bliver stående og
          vokser, ganske som en ratepension uden plan. */
      start?: AgeBound | 'none'
    } = {},
    options: Parameters<typeof aPlan>[0] = {},
  ): Plan {
    const start = annuity.start ?? 67
    return aPlan({
      balance: 0,
      ...options,
      holdings: [
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          openedOn: { year: 2018, month: 1 },
          balance: annuity.balance ?? 2_000_000,
          grossReturn: annuity.grossReturn ?? 0,
          annualCostRate: 0,
          quotedReserve: annuity.quotedReserve ?? 1_000_000,
          quotedAnnualBenefit: annuity.quotedAnnualBenefit ?? 55_000,
          bonusRate: annuity.bonusRate ?? 0,
          ...(start === 'none' ? {} : { payout: { start } }),
        },
        ...(options.holdings ?? []),
      ],
    })
  }

  /** Året hvor fixturens livrente omsættes: personen fylder 67 i 2040. */
  const conversionYear = 2040

  const benefitsIn = (year: YearResult) => year.persons[0]!.lifeAnnuityBenefits

  it('omsætter primosaldoen til en livsvarig ydelse ved udbetalingsstart', () => {
    // Kvotienten ganget på det faktisk fremskrevne depot er ydelsen, jf.
    // ADR-0009: 2.000.000 × 0,055 = 110.000 kr. om året, livsvarigt.
    const years = simulateChecked(aPlanWithLifeAnnuity())

    const year = years.find((y) => y.year === conversionYear)!

    // Depotet forlader husstandens formue uden at være hverken en udgift
    // eller en skat. Uden `conversion`-leddet går regnestykket ikke op, og
    // det er `simulateChecked`, der prøver det for hvert eneste år.
    expect(year.conversion).toBeCloseTo(2_000_000, 6)
    expect(holding(year, 'livrente').closingBalance).toBeCloseTo(0, 6)

    expect(benefitsIn(year)).toEqual([{ holding: 'livrente', amount: 110_000 }])
  })

  it('vejer omsætningen fuldt i depotets ende og ydelsen ingen steder', () => {
    // De to ender af omsætningsåret spørges hver for sig. Depotet forlader
    // livrenten ved årets begyndelse og vejer derfor fuldt — det er dét, der
    // lader beholdningen lukke på nul af sig selv. Ydelsen udbetales
    // månedsvis og lander på bufferen, hvor en jævn strøm vejer nul, jf.
    // ADR-0024; bufferens afkast er derfor nøjagtig satsen af primosaldoen.
    const years = simulateChecked(
      aPlanWithLifeAnnuity({}, { balance: 1_000_000, grossReturn: 0.04 }),
    )

    const year = years.find((y) => y.year === conversionYear)!
    const buffer = holding(year, 'free-assets')
    expect(holding(year, 'livrente').weightedFlow).toBeCloseTo(-2_000_000, 6)
    expect(buffer.weightedFlow).toBeCloseTo(0, 6)
    expect(buffer.return).toBeCloseTo(0.04 * buffer.openingBalance, 6)
  })

  it('omsætter præcis én gang og lader beholdningen stå på nul bagefter', () => {
    // Depotet forrenter sig helt frem til omsætningen — det er dét, der får
    // ydelsen til at reagere på, hvor længe der er betalt ind — og det er
    // netop derfor, nullet bagefter ikke er et trivielt nul.
    const years = simulateChecked(aPlanWithLifeAnnuity({ grossReturn: 0.05 }))

    expect(years.filter((year) => year.conversion !== 0).map((year) => year.year)).toEqual([
      conversionYear,
    ])

    const before = holding(years.find((y) => y.year === conversionYear - 1)!, 'livrente')
    expect(before.closingBalance).toBeGreaterThan(2_000_000)

    const after = years.filter((year) => year.year > conversionYear)
    expect(after.every((year) => holding(year, 'livrente').closingBalance === 0)).toBe(true)
    expect(after.every((year) => holding(year, 'livrente').return === 0)).toBe(true)
  })

  it('lader en livrente uden udbetalingsstart stå og vokse', () => {
    // Feltet er valgfrit af samme grund som ratepensionens: en livrente,
    // brugeren endnu ikke har besluttet sig om, skal kunne stå i planen uden
    // at motoren nægter at regne. Uden en start er der ingen omsætning.
    const years = simulateChecked(
      aPlanWithLifeAnnuity({ start: 'none', grossReturn: 0.05 }),
    )

    expect(years.every((year) => year.conversion === 0)).toBe(true)
    expect(years.every((year) => benefitsIn(year).length === 0)).toBe(true)
    expect(holding(years.at(-1)!, 'livrente').closingBalance).toBeGreaterThan(2_000_000)
  })

  it('lader ydelsen komme udefra og beskatter den som pensionsindkomst', () => {
    // Samme 400.000 kr. som ATP-posten og ratepensionens rate længere oppe,
    // og samme skat på kronen: ydelsen er `PensionIncome` og krydser
    // skattesømmet som sit eget tal.
    //
    // Men modsat raten er den indkomst **udefra**. En rate flytter penge fra
    // beholdningen til bufferen og lader formuen uændret; ydelsen har ingen
    // saldo bag sig og indgår derfor i `income`, jf. ADR-0009 og diagram 02.
    const years = simulateChecked(
      aPlanWithLifeAnnuity({ balance: 4_000_000, quotedAnnualBenefit: 100_000 }),
    )

    const year = years.find((y) => y.year === conversionYear)!
    const { tax } = year.persons[0]!

    expect(benefitsIn(year)).toEqual([{ holding: 'livrente', amount: 400_000 }])
    expect(year.income).toBeCloseTo(400_000, 6)

    expect(tax.layers.labourMarketContribution.amount).toBe(0)
    expect(tax.personalIncome).toBeCloseTo(400_000, 6)
    expect(tax.allowances.employmentAllowance).toBe(0)
    expect(year.tax).toBeCloseTo(131_891.67, 2)

    // Ydelsen står ikke som en udbetaling fra beholdningen: efter
    // omsætningen har livrenten ingen saldo at forlade, og strømmen er en
    // `Benefit` og ikke en `payout` — glossarets første navnefælde.
    expect(holding(year, 'livrente').payout).toBe(0)

    expect(bufferBalance(year)).toBeCloseTo(400_000 - 131_891.67, 2)
  })

  it('regulerer ydelsen alene med bonusantagelsen derefter', () => {
    // Planens inflation og folkepensionsreguleringen står højere end
    // bonussatsen og rører den ikke: ydelsen er garanteret og følger sin
    // egen antagelse, jf. ADR-0023. Der er hverken aldersskalering eller
    // genberegning — depotet er væk, og der er intet tilbage at regne af.
    const years = simulateChecked(
      aPlanWithLifeAnnuity(
        { bonusRate: 0.02 },
        { inflationAssumption: 0.03, statePensionProjectionAssumption: 0.05 },
      ),
    )

    const benefitIn = (year: number) =>
      benefitsIn(years.find((y) => y.year === year)!)[0]!.amount

    expect(benefitIn(conversionYear)).toBeCloseTo(110_000, 6)
    expect(benefitIn(conversionYear + 1)).toBeCloseTo(110_000 * 1.02, 6)
    expect(benefitIn(conversionYear + 2)).toBeCloseTo(110_000 * 1.02 ** 2, 6)
    expect(benefitIn(conversionYear + 20)).toBeCloseTo(110_000 * 1.02 ** 20, 6)
  })

  it('sænker den livsvarige ydelse, når der er betalt ind i færre år', () => {
    // Det er hele grunden til, at depotet bliver i opsparingsfasen, jf.
    // ADR-0009: uden det ville otte års manglende indbetalinger ikke sænke
    // ydelsen, og scenariesammenligningen ville være forkert på planens
    // længstløbende indkomststrøm.
    const benefitWhenWorkEndsAt = (workEndAge: number) => {
      const years = simulateChecked(
        aPlanWithLifeAnnuity(
          { balance: 0, grossReturn: 0.05 },
          {
            workEndAge,
            entries: [
              aSalary({
                amountInRealKroner: 600_000,
                period: { anchor: 'PersonAge', to: 'WorkEndAge' },
              }),
            ],
            contributions: [
              aContribution({
                source: 'salary',
                to: 'livrente',
                percentageOfEntry: 0.15,
              }),
            ],
          },
        ),
      )
      return benefitsIn(years.find((y) => y.year === conversionYear)!)[0]!.amount
    }

    expect(benefitWhenWorkEndsAt(58)).toBeLessThan(benefitWhenWorkEndsAt(66))
  })

  it('lader depotet forlade beholdningen ved årets begyndelse, uden noget tilbage at forrente', () => {
    // Omsætningen har vægt 1: det, der omsættes, er saldoen ved årets
    // begyndelse, og det forlader beholdningen der. Afkastgrundlaget er
    // derfor kun det, der ellers faldt i året — her indbetalingens halve.
    const years = simulateChecked(
      aPlanWithLifeAnnuity(
        { grossReturn: 0.05 },
        {
          balance: 1_000_000,
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'livrente',
              amountInRealKroner: 100_000,
              period: { anchor: 'CalendarYear', from: conversionYear, to: conversionYear },
            }),
          ],
        },
      ),
    )

    const year = years.find((y) => y.year === conversionYear)!
    const livrente = holding(year, 'livrente')

    // Havde depotet forrentet sig, ville afkastet være hundredvis af tusinder.
    expect(livrente.return).toBeCloseTo(0.05 * 50_000, 6)

    // Ydelsen er regnet af primosaldoen — det depot, selskabet omsætter — og
    // ikke af det, indbetalingen lagde oveni bagefter.
    expect(benefitsIn(year)[0]!.amount).toBeCloseTo(livrente.openingBalance * 0.055, 6)

    // Fejningen tager indbetalingens rest med i omsætningen efter afkastet
    // og beholdningsskatten, ganske som den sidste rates gør, så livrenten
    // lukker på præcis nul frem for at lade en splint stå i formuegrafen.
    expect(livrente.closingBalance).toBeCloseTo(0, 6)
    expect(year.conversion).toBeCloseTo(
      livrente.openingBalance + 100_000 + livrente.return - livrente.tax,
      6,
    )
  })

  it('lader ydelsen forrente sig først året efter, den er landet', () => {
    // Ydelsen er en jævn strøm på bufferen og vejer derfor nul i
    // omsætningsåret, jf. ADR-0024 — den efterlader kun sit overskud ved
    // årets slutning. Året efter er de penge primosaldo og forrenter sig
    // fuldt. Er bufferen en opsparingskonto, er det afkast personens
    // kapitalindkomst, og skatten af det regnes af det samme afkast, som
    // beholdningsrækken viser, jf. ADR-0012.
    const years = simulateChecked(
      aPlanWithLifeAnnuity({}, { grossReturn: 0.05 }),
    )

    const conversion = years.find((y) => y.year === conversionYear)!
    expect(holding(conversion, 'free-assets').return).toBeCloseTo(0, 6)

    const after = years.find((y) => y.year === conversionYear + 1)!
    const buffer = holding(after, 'free-assets')
    expect(buffer.openingBalance).toBeGreaterThan(0)
    expect(buffer.return).toBeCloseTo(0.05 * buffer.openingBalance, 6)
    expect(after.persons[0]!.capitalIncome).toBeCloseTo(buffer.return, 6)
  })

  it('afviser en omsætning, der begynder før pensionsudbetalingsalderen', () => {
    // Lovens ene regel, ratepensionen og livrenten deler: udbetalingen må
    // tidligst begynde ved ordningens `PayoutAge`. De to øvrige — ti år og
    // tredive år — måler på en varighed, livrenten ikke har.
    const early = aPlanWithLifeAnnuity({ start: 66 })
    const legal = aPlanWithLifeAnnuity({ start: 67 })

    expect(validatePlan(early)).toMatch(/pensionsudbetalingsalder/i)
    expect(() => simulate(early)).toThrow(/pensionsudbetalingsalder/i)
    expect(validatePlan(legal)).toBeUndefined()
  })
})

describe('folkepensionen', () => {
  /** Fixturens person er født i juni 1973. Folkepensionsalderen er 70 for
      årgangen, og året er dermed 2043 — motorens eneste vej til det tal er
      `statePensionAge`, og der står intet folkepensionsobjekt i planen, jf.
      ADR-0023. */
  const statePensionYear = 2043

  const statePensionIn = (year: YearResult) => year.persons[0]!.statePension

  /** Folkepensionens to kronebeløb alene. Linjen bærer også hele
      aftrapningsregnestykket, og prøverne herunder handler om beløbene. */
  const amountsIn = (year: YearResult) => {
    const line = statePensionIn(year)!
    return { basicAmount: line.basicAmount, pensionSupplement: line.pensionSupplement }
  }

  /** Fixturens person plus en ægtefælle, der er folkepensionist i forvejen.
      Husstanden er dermed to, og ingen af dem er enlig. */
  function aPlanWithSpouse(): Plan {
    const base = aPlan({ horizon: 70 })
    return {
      ...base,
      household: {
        persons: [
          ...base.household.persons,
          {
            id: 'anne',
            name: 'Anne',
            birthYear: 1963,
            birthMonth: 6,
            workEndAge: 60,
            horizon: 90,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              aHolding({
                id: 'annes-frie-midler',
                name: 'Annes frie midler',
                variant: 'SavingsAccount',
                balance: 0,
              }),
            ],
          },
        ],
      },
    }
  }

  it('lader grundbeløbet og pensionstillægget begynde i folkepensionsåret', () => {
    // Satsårets to kronebeløb for en enlig, jf. docs/satser/2026.md.
    // Planen har ingen indkomst, og aftrapningen har derfor intet at tage af:
    // tillægget udbetales fuldt.
    const years = simulateChecked(aPlan({ horizon: 70 }))

    expect(statePensionIn(years.find((y) => y.year === statePensionYear - 1)!)).toBeUndefined()
    expect(amountsIn(years.find((y) => y.year === statePensionYear)!)).toEqual({
      basicAmount: 90_528,
      pensionSupplement: 104_748,
    })
  })

  it('lader folkepensionen komme udefra og indgå i årets indtægter', () => {
    // Folkepensionen er en ydelse uden saldo. Den kommer udefra, ganske som
    // den omsatte livrentes, og indgår derfor i `income`, hvor en rate blot
    // flytter penge mellem husstandens egne lommer, jf. diagram 02.
    const years = simulateChecked(aPlan({ horizon: 70 }))

    expect(years.find((y) => y.year === statePensionYear - 1)!.income).toBe(0)
    expect(years.find((y) => y.year === statePensionYear)!.income).toBeCloseTo(
      90_528 + 104_748,
      6,
    )
  })

  it('lader folkepensionen passere bufferen uden at forrente sig', () => {
    // Folkepensionen udbetales månedsvis, og en jævn strøm vejer nul i
    // bufferens ende, jf. ADR-0024. Pengene passerer transaktionskontoen og
    // efterlader først over- eller underskuddet ved årets slutning, hvor det
    // lander som en bevægelse uden vægt.
    const years = simulateChecked(aPlan({ horizon: 70, grossReturn: 0.05, balance: 0 }))

    const year = years.find((y) => y.year === statePensionYear)!
    expect(holding(year, 'free-assets').weightedFlow).toBeCloseTo(0, 6)
  })

  it('beskatter folkepensionen som pensionsindkomst', () => {
    // Det samme beløb to år i træk: i 2042 som en indtægtspost med
    // `PensionIncome` — sådan ATP skrives, jf. ADR-0023 — og i 2043 som
    // folkepensionen selv. Skatten er den samme på kronen: opgørelsen kender
    // ikke ydelsen fra posten, den kender personlig indkomst uden AM-bidrag.
    const amount = 90_528 + 104_748
    const years = simulateChecked(
      aPlan({
        horizon: 70,
        entries: [
          aPensionIncome({
            amountInRealKroner: amount,
            period: { anchor: 'CalendarYear', from: 2042, to: 2042 },
          }),
        ],
      }),
    )

    const asEntry = years.find((y) => y.year === statePensionYear - 1)!
    const asStatePension = years.find((y) => y.year === statePensionYear)!

    expect(asEntry.income).toBeCloseTo(amount, 6)
    expect(asStatePension.income).toBeCloseTo(amount, 6)
    expect(asStatePension.tax).toBeCloseTo(asEntry.tax, 6)

    // Hverken AM-bidrag eller beskæftigelsesfradrag: bidraget er betalt på
    // vejen ind, og de to arbejdsfradrag følger arbejde.
    const { tax } = asStatePension.persons[0]!
    expect(tax.layers.labourMarketContribution.amount).toBe(0)
    expect(tax.personalIncome).toBeCloseTo(amount, 6)
    expect(tax.allowances.employmentAllowance).toBe(0)
  })

  it('lader fødselsmåneden afgøre året, når folkepensionsalderen er en brøk', () => {
    // Årgang 1979 har folkepensionsalder 71,5. Et halvt år lagt til en
    // januarfødsel lander stadig i 2050; lagt til en julifødsel skubber det
    // over årsskiftet. Alderen er en brøk for de fleste årgange, og
    // sammenligningen sker derfor i kalenderår og aldrig i aldre.
    const firstYear = (birthMonth: number) =>
      simulateChecked(aPlan({ birthYear: 1979, birthMonth, horizon: 72 })).find(
        (year) => year.persons[0]!.statePension !== undefined,
      )!.year

    expect(firstYear(1)).toBe(2050)
    expect(firstYear(7)).toBe(2051)
  })

  it('lader grundbeløbet være fladt uanset arbejdsindkomst', () => {
    // Aftrapningen af grundbeløbet efter egen arbejdsindkomst blev afskaffet
    // med virkning fra 2023. En folkepensionist, der arbejder videre, får
    // stadig hele grundbeløbet — og hele tillægget, for arbejdsindkomst står
    // uden for aftrapningsgrundlaget.
    const years = simulateChecked(
      aPlan({ horizon: 70, entries: [aSalary({ amountInRealKroner: 1_200_000 })] }),
    )

    expect(amountsIn(years.find((y) => y.year === statePensionYear)!)).toEqual({
      basicAmount: 90_528,
      pensionSupplement: 104_748,
    })
  })

  it('giver en husstand med to det lavere pensionstillæg', () => {
    // Tillægget følger civilstanden: 104.748 kr. for en enlig, 53.604 kr.
    // for en gift eller samlevende, jf. docs/satser/2026.md. Husstanden er
    // én eller to personer, der er gift eller samlevende — er der to, er
    // ingen af dem enlig.
    const years = simulateChecked(aPlanWithSpouse())

    expect(amountsIn(years.find((y) => y.year === statePensionYear)!)).toEqual({
      basicAmount: 90_528,
      pensionSupplement: 53_604,
    })
  })

  it('fremskriver begge beløb med folkepensionsreguleringen', () => {
    // Satsåret 2026 er det sidst kendte, og 2043 er derfor fremskrevet.
    // Antagelsen løfter de to kronebeløb og intet andet — aftrapningens
    // procent er en sats og står stille.
    const years = simulateChecked(
      aPlan({ horizon: 70, statePensionProjectionAssumption: 0.02 }),
    )

    const year = years.find((y) => y.year === statePensionYear)!
    const factor = 1.02 ** (statePensionYear - 2026)

    expect(year.rateBasis).toEqual({ knownYear: 2026, projected: true })
    expect(statePensionIn(year)!.basicAmount).toBeCloseTo(90_528 * factor, 6)
    expect(statePensionIn(year)!.pensionSupplement).toBeCloseTo(104_748 * factor, 6)
  })
})

describe('aftrapningen af pensionstillægget', () => {
  /** Fixturens person er født i juni 1973 og er folkepensionist fra 2043.
      Satsårets tal for en enlig, jf. docs/satser/2026.md: 104.748 kr. i
      fuldt tillæg, 99.200 kr. i fradragsbeløb og 30,9 % aftrapning. */
  const statePensionYear = 2043

  const taperIn = (years: YearResult[], year = statePensionYear) =>
    years.find((y) => y.year === year)!.persons[0]!.statePension!

  it('tæller rater, livrenteydelser og ATP med i aftrapningsgrundlaget', () => {
    // De tre indtægter, aftrapningen rammer, hver ad sin vej gennem motoren:
    // raten som en udbetaling fra en beholdning, ydelsen som en `Benefit`
    // uden saldo, og ATP som en indtægtspost med `PensionIncome`. Skatten
    // kender dem ikke fra hinanden, og aftrapningen gør heller ikke.
    //
    //   rate, 1.000.000 over ti år      100.000
    //   livrenteydelse, 2.000.000×0,055 110.000
    //   ATP                              60.000
    //                                   ───────
    //   grundlag                        270.000
    //   270.000 − 99.200 = 170.800 over fradragsbeløbet
    //   30,9 % af 170.800 =  52.777,20
    //   104.748 − 52.777,20 = 51.970,80
    const years = simulateChecked(
      aPlan({
        horizon: 70,
        balance: 0,
        entries: [aPensionIncome({ amountInRealKroner: 60_000 })],
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 1_000_000,
            grossReturn: 0,
            annualCostRate: 0,
            payout: { start: 67, duration: 10, principle: 'SerialPrinciple' },
          },
          {
            id: 'livrente',
            name: 'Livrente',
            variant: 'LifeAnnuity',
            openedOn: { year: 2018, month: 1 },
            balance: 2_000_000,
            grossReturn: 0,
            annualCostRate: 0,
            quotedReserve: 1_000_000,
            quotedAnnualBenefit: 55_000,
            bonusRate: 0,
            payout: { start: 67 },
          },
        ],
      }),
    )

    const { taper, pensionSupplement } = taperIn(years)

    // Grundlaget står som sine bestanddele, så forklar-året kan vise præcis
    // hvilken indkomst der kostede tillæg.
    expect(taper.base).toEqual({
      pensionIncome: expect.closeTo(270_000, 6),
      capitalIncome: 0,
      shareIncome: 0,
      spouse: 0,
    })
    expect(taper.fullSupplement).toBeCloseTo(104_748, 6)
    expect(taper.allowance).toBeCloseTo(99_200, 6)
    expect(taper.rate).toBeCloseTo(0.309, 10)
    expect(pensionSupplement).toBeCloseTo(51_970.8, 6)
  })

  it('holder arbejdsindkomst, aldersopsparing og aktiesparekonto ude af grundlaget', () => {
    // De tre, der ikke tæller med. En folkepensionist med en million i løn,
    // en aldersopsparing hun tømmer, og en aktiesparekonto der forrenter sig,
    // beholder hele sit tillæg — grundlaget er nul.
    //
    // Aldersopsparingen tømmes af en overførsel og ikke af en
    // udbetalingsplan, jf. ADR-0022, og aktiesparekontoens afkast bæres af
    // beholdningen selv og er ingen persons aktieindkomst.
    const years = simulateChecked(
      aPlan({
        horizon: 70,
        balance: 0,
        entries: [aSalary({ amountInRealKroner: 1_000_000 })],
        transfers: [
          // Aldersopsparingen er oprettet før maj 2007 og må først tømmes
          // fra 60 år, altså 2033.
          aTransfer({
            from: 'aldersopsparing',
            to: 'free-assets',
            amountInRealKroner: 80_000,
            period: { anchor: 'CalendarYear', from: 2033 },
          }),
        ],
        holdings: [
          {
            id: 'aldersopsparing',
            name: 'Aldersopsparing',
            variant: 'OldAgeSavings',
            openedOn: { year: 2000, month: 1 },
            balance: 2_000_000,
            grossReturn: 0,
            annualCostRate: 0,
          },
          {
            id: 'aktiesparekonto',
            name: 'Aktiesparekonto',
            variant: 'ShareSavingsAccount',
            balance: 174_200,
            grossReturn: 0.07,
            annualCostRate: 0,
          },
        ],
      }),
    )

    const { taper, pensionSupplement } = taperIn(years)

    expect(totalTaperBase(taper.base)).toBe(0)
    expect(pensionSupplement).toBeCloseTo(104_748, 6)
  })

  it('skifter både aftrapningsprocenten og bortseelsen i det år, ægtefællen selv bliver pensionist', () => {
    // De to hører sammen og må ikke anvendes hver for sig, jf. PL § 49,
    // stk. 1, nr. 4. Jesper er folkepensionist fra 2043, Anne fra 2044.
    //
    //   2043, Anne endnu ikke pensionist — 32 % og 54 % bortseelse
    //     grundlag  150.000 + 46 % af 300.000 = 288.000
    //     32 % af (288.000 − 198.800)         =  28.544
    //     53.604 − 28.544                     =  25.060
    //
    //   2044, Anne er nu pensionist — 16 % og ingen bortseelse
    //     grundlag  150.000 + 300.000         = 450.000
    //     16 % af (450.000 − 198.800)         =  40.192
    //     53.604 − 40.192                     =  13.412
    //
    // Anvendtes de 54 % med de 16 %, ville tillægget være 29.412 kr. — over
    // det dobbelte af det rigtige.
    const base = aPlan({
      horizon: 75,
      balance: 0,
      entries: [aPensionIncome({ amountInRealKroner: 150_000 })],
    })
    const years = simulateChecked({
      ...base,
      entries: [
        ...base.entries,
        {
          ...aPensionIncome({ amountInRealKroner: 300_000, owner: 'anne' }),
          id: 'annes-atp',
        },
      ],
      household: {
        persons: [
          ...base.household.persons,
          {
            id: 'anne',
            name: 'Anne',
            birthYear: 1974,
            birthMonth: 6,
            workEndAge: 60,
            horizon: 74,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              aHolding({
                id: 'annes-frie-midler',
                name: 'Annes frie midler',
                variant: 'SavingsAccount',
                balance: 0,
              }),
            ],
          },
        ],
      },
    })

    const withNonPensioner = taperIn(years, 2043)
    const withPensioner = taperIn(years, 2044)

    expect(withNonPensioner.taper.rate).toBeCloseTo(0.32, 10)
    expect(withNonPensioner.taper.base.spouse).toBeCloseTo(138_000, 6)
    expect(withNonPensioner.pensionSupplement).toBeCloseTo(25_060, 6)

    expect(withPensioner.taper.rate).toBeCloseTo(0.16, 10)
    expect(withPensioner.taper.base.spouse).toBeCloseTo(300_000, 6)
    expect(withPensioner.pensionSupplement).toBeCloseTo(13_412, 6)
  })
})

describe('bufferens jævne strømme', () => {
  it('lader den jævne drift passere bufferen uden at forrente sig', () => {
    // ADR-0024's første værn: bufferen er husstandens transaktionskonto, og
    // en jævn strøm efterlader intet på den før årets slutning. Afkastet er
    // derfor nøjagtig nettoafkastsatsen af primosaldoen, og den vægtede
    // strøm er nul. Falder prøven, har nogen lagt en vægtning tilbage.
    const [year] = simulateChecked(
      aPlan({
        balance: 1_000_000,
        grossReturn: 0.04,
        entries: [
          aTaxFreeIncome({ amountInRealKroner: 100_000 }),
          anExpense({ amountInRealKroner: 60_000 }),
        ],
      }),
    )

    expect(holding(year!, 'free-assets').weightedFlow).toBeCloseTo(0, 6)
    expect(holding(year!, 'free-assets').return).toBeCloseTo(40_000, 6)
  })

  it('lader raten miste sin vægt i ratepensionen og ingen få i bufferen', () => {
    // ADR-0024's andet værn: vægten er en egenskab ved enden. Pengene
    // forlader faktisk ratepensionen månedsvis, så dens afkastgrundlag mister
    // `½ × raten` — de forrenter sig blot ingen steder i det halve år, de er
    // undervejs. Asymmetrien er hele påstanden; falder prøven, har nogen
    // "rettet" den.
    const years = simulateChecked(
      aPlan({
        balance: 1_000_000,
        grossReturn: 0.04,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            openedOn: { year: 2018, month: 1 },
            balance: 1_000_000,
            grossReturn: 0,
            annualCostRate: 0,
            payout: { start: 67, duration: 10, principle: 'SerialPrinciple' },
          },
        ],
      }),
    )

    const year = years.find((y) => y.year === 2040)!
    expect(holding(year, 'ratepension').payout).toBeCloseTo(100_000, 6)
    expect(holding(year, 'ratepension').weightedFlow).toBeCloseTo(-50_000, 6)
    expect(holding(year, 'free-assets').weightedFlow).toBeCloseTo(0, 6)
  })

  it('lader et boligsalg i februar beholde sin vægt på bufferen', () => {
    // ADR-0024's tredje værn: reglen rammer kun de jævne strømme. En post
    // med et forfald er en begivenhed og ikke et niveau, og de 2 mio. kr.
    // ligger der i elleve tolvtedele af året — præcis det tilfælde, ADR-0006
    // købte måneden for. Den jævne udgift ved siden af vejer nul og må ikke
    // trække fra. Falder prøven, har nogen generaliseret reglen.
    const [year] = simulateChecked(
      aPlan({
        balance: 0,
        grossReturn: 0.04,
        entries: [
          aTaxFreeIncome({
            amountInRealKroner: 2_000_000,
            timing: 2,
            period: { anchor: 'CalendarYear', from: 2026 },
            recurrence: { kind: 'Once' },
          }),
          anExpense({ amountInRealKroner: 300_000 }),
        ],
      }),
    )

    expect(holding(year!, 'free-assets').weightedFlow).toBeCloseTo(
      (2_000_000 * 11) / 12,
      6,
    )
  })

  it('lader en jævn overførsel til bufferen veje nul i bufferens ende', () => {
    // Reglen gælder begge retninger: den er ikke en regel om penge, der
    // forlader bufferen, men om bufferens ende. Afgiveren mister sine
    // `½ × beløbet` som før — pengene forlader den faktisk månedsvis.
    const [year] = simulateChecked(
      aPlan({
        balance: 0,
        grossReturn: 0.04,
        holdings: [
          aHolding({
            id: 'anden-beholdning',
            name: 'Anden beholdning',
            variant: 'SavingsAccount',
            balance: 1_000_000,
            grossReturn: 0.04,
          }),
        ],
        transfers: [
          aTransfer({ from: 'anden-beholdning', to: 'free-assets', amountInRealKroner: 100_000 }),
        ],
      }),
    )

    expect(holding(year!, 'anden-beholdning').weightedFlow).toBeCloseTo(-50_000, 6)
    expect(holding(year!, 'free-assets').weightedFlow).toBeCloseTo(0, 6)
  })

  it('lader indbetalingen veje nul i bufferen og fuldt i ordningen', () => {
    // Den anden retning: pengene forlader bufferen jævnt og vejer derfor nul
    // dér, men de bliver faktisk investeret i ordningen ved ankomsten og
    // vejer fuldt i dens ende. Det er nettobeløbet, der vejes — AM-delen
    // forlader bufferen som skat, og skat rører aldrig afkastgrundlaget.
    const [year] = simulateChecked(
      aPlan({
        balance: 0,
        grossReturn: 0.04,
        entries: [aSalary({ amountInRealKroner: 500_000 })],
        holdings: [
          aHolding({
            id: 'ordning',
            name: 'Ordning',
            variant: 'InstalmentPension',
            balance: 0,
            grossReturn: 0.04,
          }),
        ],
        contributions: [aContribution({ source: 'salary', to: 'ordning', percentageOfEntry: 0.1 })],
      }),
    )

    expect(holding(year!, 'ordning').weightedFlow).toBeCloseTo((50_000 * 0.92) / 2, 6)
    expect(holding(year!, 'free-assets').weightedFlow).toBeCloseTo(0, 6)
  })
})
