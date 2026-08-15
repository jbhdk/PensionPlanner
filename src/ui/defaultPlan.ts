import type { Plan } from '../engine/plan'

/** Planen der møder en, første gang appen åbnes. Den hører til fladen og ikke
    til motoren: motoren kender kun den plan, den får ind. */
export function defaultPlan(): Plan {
  return {
    name: 'Min plan',
    startYear: new Date().getFullYear(),
    inflationAssumption: 0.02,
    section20ProjectionAssumption: 0.02,
    statePensionProjectionAssumption: 0.02,
    buffer: 'free-assets',
    transfers: [],
    contributions: [],
    entries: [
      {
        id: 'living-costs',
        name: 'Faste udgifter',
        amountInRealKroner: 360_000,
        owner: 'person-1',
        direction: 'Expense',
        timing: 'Even',
        period: { anchor: 'CalendarYear' },
        recurrence: { kind: 'Annual' },
      },
      {
        id: 'salary',
        name: 'Løn',
        amountInRealKroner: 600_000,
        owner: 'person-1',
        direction: 'Income',
        taxTreatment: 'EarnedIncome',
        timing: 'Even',
        period: { anchor: 'CalendarYear' },
        recurrence: { kind: 'Annual' },
        regulationRate: 0.02,
      },
    ],
    household: {
      persons: [
        {
          id: 'person-1',
          name: 'Person 1',
          birthYear: 1973,
          birthMonth: 1,
          workEndAge: 65,
          horizon: 90,
          municipality: 'Hvidovre',
          churchMember: true,
          holdings: [
            {
              id: 'free-assets',
              name: 'Frie midler',
              variant: 'SavingsAccount',
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
