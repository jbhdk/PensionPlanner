import type { Plan } from '../engine/plan'

/** Minimumsplanen: det tyndeste, `validatePlan` accepterer — én person og én
    bufferbeholdning. En helt tom plan findes ikke, for bufferen skal pege på
    frie midler, der er der, og en plan uden dem kan ikke simuleres, jf.
    ADR-0013.

    Den er værktøjets eneste begyndelse. Den samme plan møder en, første gang
    appen åbnes, og den samme står tilbage, når alt er slettet — to
    begyndelser ville skulle vedligeholdes hver for sig, hver gang `Plan`
    vokser med et felt.

    Alt, der kan være nul, er nul. En saldo eller et afkast, brugeren ikke har
    tastet, er ikke et skøn, værktøjet skal lave på hendes vegne — samme
    begrundelse som `addHolding`s. Kommunen kan ikke undgås, fordi den er en
    nøgle ind i satsårets tabel, men kirkeskatten kan: et flueben, ingen har
    sat, skal ikke koste 0,94 % af indkomsten.

    Den hører til fladen og ikke til motoren: motoren kender kun den plan,
    den får ind. */
export function defaultPlan(): Plan {
  const startYear = new Date().getFullYear()

  return {
    name: 'Min plan',
    startYear,
    inflationAssumption: 0.02,
    section20ProjectionAssumption: 0.02,
    statePensionProjectionAssumption: 0.02,
    buffer: 'free-assets',
    transfers: [],
    contributions: [],
    entries: [],
    household: {
      persons: [
        {
          id: 'person-1',
          name: 'Person 1',
          birthYear: startYear - 40,
          birthMonth: 1,
          workEndAge: 63,
          horizon: 90,
          municipality: 'Silkeborg',
          churchMember: false,
          holdings: [
            {
              id: 'free-assets',
              name: 'Frie midler',
              variant: 'SavingsAccount',
              balance: 0,
              grossReturn: 0,
              annualCostRate: 0,
            },
          ],
        },
      ],
    },
  }
}
