import type { Entry, Plan } from '../plan'
import type { YearResult } from '../yearResult'

type Options = {
  startYear?: number
  inflationAssumption?: number
  birthYear?: number
  horizon?: number
  balance?: number
  entries?: Entry[]
  municipalTaxRate?: number
  churchTax?: boolean
  churchTaxRate?: number
}

/** Den tyndeste gyldige plan: én person, én beholdning der er buffer, ingen
    poster. Testene skruer på det, de handler om, og lader resten stå.

    Kommune- og kirkeskatteprocenten er den samme som i skattemodulets
    facitcase, så en lønpost her og en opgørelse dér kan sammenlignes. */
export function aPlan(options: Options = {}): Plan {
  const {
    startYear = 2026,
    inflationAssumption = 0,
    birthYear = 1973,
    horizon = 90,
    balance = 1_000_000,
    entries = [],
    municipalTaxRate = 0.254,
    churchTax = true,
    churchTaxRate = 0.0074,
  } = options

  return {
    name: 'Ophør som 58',
    startYear,
    inflationAssumption,
    buffer: 'free-assets',
    entries,
    municipalTaxRate,
    churchTax,
    churchTaxRate,
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
    owner: 'jesper',
    direction: 'Expense',
  }
}

/** En lønpost. Beløbet er brutto inklusive arbejdsgiverbidrag, jf. ADR-0007. */
export function aSalary(options: {
  amountInRealKroner: number
  owner?: string
}): Entry {
  return {
    id: 'salary',
    name: 'Løn',
    amountInRealKroner: options.amountInRealKroner,
    owner: options.owner ?? 'jesper',
    direction: 'Income',
    taxTreatment: 'EarnedIncome',
  }
}

/** Saldoen på den beholdning, fixturen udpeger som buffer. */
export function bufferBalance(year: YearResult): number {
  return year.holdings.find((holding) => holding.holding === 'free-assets')!
    .closingBalance
}

/** En skattefri indtægtspost — en arv, for eksempel. */
export function aTaxFreeIncome(options: { amountInRealKroner: number }): Entry {
  return {
    id: 'inheritance',
    name: 'Arv',
    amountInRealKroner: options.amountInRealKroner,
    owner: 'jesper',
    direction: 'Income',
    taxTreatment: 'TaxFree',
  }
}
