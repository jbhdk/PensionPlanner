import type { Entry, Plan } from '../plan'
import type { YearResult } from '../yearResult'

type Options = {
  startYear?: number
  inflationAssumption?: number
  birthYear?: number
  horizon?: number
  balance?: number
  entries?: Entry[]
}

/** Den tyndeste gyldige plan: én person, én beholdning der er buffer, ingen
    poster. Testene skruer på det, de handler om, og lader resten stå. */
export function aPlan(options: Options = {}): Plan {
  const {
    startYear = 2026,
    inflationAssumption = 0,
    birthYear = 1973,
    horizon = 90,
    balance = 1_000_000,
    entries = [],
  } = options

  return {
    name: 'Ophør som 58',
    startYear,
    inflationAssumption,
    buffer: 'free-assets',
    entries,
    household: {
      persons: [
        {
          id: 'jesper',
          name: 'Jesper',
          birthYear,
          horizon,
          holdings: [
            {
              id: 'free-assets',
              name: 'Frie midler',
              variant: 'CapitalIncome',
              balance,
            },
          ],
        },
      ],
    },
  }
}

/** En udgiftspost. Forankring, gentagelse og forfald er låst i denne skive:
    posten løber hele horisonten, jævnt fordelt, hvert år. */
export function anExpense(options: { amountInRealKroner: number }): Entry {
  return {
    id: 'living-costs',
    name: 'Faste udgifter',
    amountInRealKroner: options.amountInRealKroner,
    direction: 'Expense',
  }
}

/** Saldoen på den beholdning, fixturen udpeger som buffer. */
export function bufferBalance(year: YearResult): number {
  return year.holdings.find((holding) => holding.holding === 'free-assets')!
    .closingBalance
}
