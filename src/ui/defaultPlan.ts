import type { Plan } from '../engine/plan'

/** Planen der møder en, første gang appen åbnes. Den hører til fladen og ikke
    til motoren: motoren kender kun den plan, den får ind. */
export function defaultPlan(): Plan {
  return {
    name: 'Min plan',
    startYear: new Date().getFullYear(),
    inflationAssumption: 0.02,
    municipalTaxRate: 0.254,
    churchTax: true,
    churchTaxRate: 0.0074,
    buffer: 'free-assets',
    entries: [
      {
        id: 'living-costs',
        name: 'Faste udgifter',
        amountInRealKroner: 360_000,
        owner: 'person-1',
        direction: 'Expense',
        timing: 'Even',
      },
      {
        id: 'salary',
        name: 'Løn',
        amountInRealKroner: 600_000,
        owner: 'person-1',
        direction: 'Income',
        taxTreatment: 'EarnedIncome',
        timing: 'Even',
      },
    ],
    household: {
      persons: [
        {
          id: 'person-1',
          name: 'Person 1',
          birthYear: 1973,
          horizon: 90,
          holdings: [
            {
              id: 'free-assets',
              name: 'Frie midler',
              variant: 'CapitalIncome',
              balance: 8_000_000,
              grossReturn: 0.07,
              annualCostRate: 0.005,
            },
          ],
        },
      ],
    },
  }
}
