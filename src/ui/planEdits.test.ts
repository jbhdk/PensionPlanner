import { describe, expect, it } from 'vitest'
import { aContribution, aPlan, aSalary, aTransfer } from '../engine/testing/planFixture'
import type { Plan } from '../engine/plan'
import { validatePlan } from '../engine/validatePlan'
import { defaultPlan } from './defaultPlan'
import {
  addContribution,
  addEntry,
  addPerson,
  addTransfer,
  removeEntry,
  removeHolding,
  removePerson,
  withVariant,
} from './planEdits'

/** Et to-personers udgangspunkt: fixturens Jesper har bufferen
    ("free-assets"), Maria har en anden beholdning ved siden af. */
function aTwoPersonPlan(): Plan {
  const base = aPlan()
  return {
    ...base,
    household: {
      persons: [
        ...base.household.persons,
        {
          id: 'maria',
          name: 'Maria',
          birthYear: 1975,
          birthMonth: 1,
          workEndAge: 65,
          horizon: 90,
          municipality: 'Hvidovre',
          churchMember: true,
          holdings: [
            {
              id: 'marias-konto',
              name: 'Marias frie midler',
              variant: 'SavingsAccount',
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

describe('removePerson', () => {
  it('flytter bufferen til en tilbageværende beholdning, når ejeren af bufferen fjernes', () => {
    const plan = aTwoPersonPlan()
    expect(plan.buffer).toBe('free-assets') // ejet af Jesper

    const result = removePerson(plan, 'jesper')

    expect(result.household.persons.map((p) => p.id)).toEqual(['maria'])
    expect(result.buffer).toBe('marias-konto')
  })

  it('giver bufferrollen til frie midler, også når personens første beholdning er en ordning', () => {
    const base = aTwoPersonPlan()
    const maria = base.household.persons[1]!
    const plan: Plan = {
      ...base,
      household: {
        persons: [
          base.household.persons[0]!,
          {
            ...maria,
            holdings: [
              {
                id: 'marias-ratepension',
                name: 'Marias ratepension',
                variant: 'InstalmentPension',
                openedOn: { year: 2018, month: 1 },
                balance: 1_000_000,
                grossReturn: 0,
                annualCostRate: 0,
              },
              ...maria.holdings,
            ],
          },
        ],
      },
    }

    const result = removePerson(plan, 'jesper')

    expect(result.buffer).toBe('marias-konto')
    expect(validatePlan(result)).toBeUndefined()
  })

  it('lader bufferen stå, når dens ejer ikke er den, der fjernes', () => {
    const plan = aTwoPersonPlan()

    const result = removePerson(plan, 'maria')

    expect(result.household.persons.map((p) => p.id)).toEqual(['jesper'])
    expect(result.buffer).toBe('free-assets')
  })

  it('fjerner posterne, den fjernede person ejer', () => {
    const plan = aTwoPersonPlan()
    const withEntry: Plan = {
      ...plan,
      entries: [
        {
          id: 'marias-loen',
          name: 'Marias løn',
          amountInRealKroner: 400_000,
          owner: 'maria',
          direction: 'Income',
          taxTreatment: 'EarnedIncome',
          timing: 'Even',
          period: { anchor: 'CalendarYear' },
          recurrence: { kind: 'Annual' },
          regulationRate: 0,
        },
      ],
    }

    const result = removePerson(withEntry, 'maria')

    expect(result.entries).toEqual([])
  })

  it('fjerner overførslerne, der peger på den fjernede persons beholdninger', () => {
    // removeHolding ryddede allerede op efter sig; removePerson gjorde ikke,
    // og overførslen blev stående og flyttede penge ud i et ingenting.
    const plan = aTwoPersonPlan()
    const withTransfer: Plan = {
      ...plan,
      transfers: [
        aTransfer({ from: 'free-assets', to: 'marias-konto', amountInRealKroner: 50_000 }),
      ],
    }

    const result = removePerson(withTransfer, 'maria')

    expect(result.transfers).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })
})

describe('addEntry', () => {
  it('tilføjer en indtægt med lønindkomst som skattebehandling', () => {
    const plan = aPlan()

    const result = addEntry(plan, 'Income')

    expect(result.entries).toHaveLength(1)
    const entry = result.entries[0]!
    expect(entry.name).toBe('Indtægt 1')
    expect(entry.owner).toBe('jesper')
    expect(entry.direction).toBe('Income')
    expect(entry.direction === 'Income' && entry.taxTreatment).toBe('EarnedIncome')
  })

  it('tilføjer en udgift uden skattebehandling', () => {
    const plan = aPlan()

    const result = addEntry(plan, 'Expense')

    expect(result.entries).toHaveLength(1)
    const entry = result.entries[0]!
    expect(entry.name).toBe('Udgift 1')
    expect(entry.direction).toBe('Expense')
  })

  it('tæller kun poster med samme retning ved navngivningen', () => {
    const plan = addEntry(addEntry(aPlan(), 'Income'), 'Expense')

    const result = addEntry(plan, 'Income')

    expect(result.entries.map((e) => e.name)).toEqual(['Indtægt 1', 'Udgift 1', 'Indtægt 2'])
  })
})

describe('removeHolding', () => {
  /** Fixturens buffer, en ratepension lige efter, og frie midler til sidst —
      rækkefølgen er den, en arvtager til bufferrollen møder. */
  function aPlanWithPensionFirst(): Plan {
    return aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          openedOn: { year: 2018, month: 1 },
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
        },
        {
          id: 'anden-frie',
          name: 'Andre frie midler',
          variant: 'SavingsAccount',
          balance: 200_000,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })
  }

  it('lader bufferrollen gå videre til frie midler og springer pensionsbeholdningen over', () => {
    const plan = aPlanWithPensionFirst()

    const result = removeHolding(plan, 'free-assets')

    expect(result.buffer).toBe('anden-frie')
    expect(validatePlan(result)).toBeUndefined()
  })
})


describe('indbetalingens pegere overlever ikke det, de peger på', () => {
  /** Fixturens Jesper med en lønpost og en ratepension, og et bidrag imellem
      dem. Bufferen er stadig "free-assets". */
  function aPlanWithContribution(): Plan {
    return aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000 })],
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
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
      ],
    })
  }

  it('fjerner indbetalingen, når dens lønpost fjernes', () => {
    // Et bidrag uden sin post ville ikke bare udeblive: planen kan slet ikke
    // regnes, og hele resultatspalten går i stå, jf. ADR-0013.
    const result = removeEntry(aPlanWithContribution(), 'salary')

    expect(result.contributions).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })

  it('fjerner indbetalingen, når dens destination fjernes', () => {
    const result = removeHolding(aPlanWithContribution(), 'ratepension')

    expect(result.contributions).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })

  it('fjerner indbetalingen, når personen bag begge ender fjernes', () => {
    const base = aPlanWithContribution()
    const plan: Plan = {
      ...base,
      buffer: 'marias-konto',
      household: {
        persons: [
          ...base.household.persons,
          {
            id: 'maria',
            name: 'Maria',
            birthYear: 1975,
            birthMonth: 1,
            workEndAge: 65,
            horizon: 90,
            municipality: 'Hvidovre',
            churchMember: true,
            holdings: [
              {
                id: 'marias-konto',
                name: 'Marias frie midler',
                variant: 'SavingsAccount',
                balance: 500_000,
                grossReturn: 0,
                annualCostRate: 0,
              },
            ],
          },
        ],
      },
    }

    const result = removePerson(plan, 'jesper')

    expect(result.contributions).toEqual([])
    expect(validatePlan(result)).toBeUndefined()
  })
})

describe('withVariant', () => {
  it('giver beholdningen et oprettelsestidspunkt, når den bliver en pensionsordning', () => {
    // Et typeskift må ikke kunne skrive en ordning uden det tidspunkt, der
    // afgør, hvornår den må udbetales. Gættet er planens startår og januar
    // — det eneste tidspunkt, en ren redigering kender uden at spørge
    // kalenderen — og brugeren retter det i skuffen ved siden af.
    const plan = withVariant(aPlan({ startYear: 2026 }), 'free-assets', 'InstalmentPension')

    const holding = plan.household.persons[0]!.holdings[0]!
    expect(holding.variant).toBe('InstalmentPension')
    expect(holding).toMatchObject({ openedOn: { year: 2026, month: 1 } })
  })

  it('fjerner oprettelsestidspunktet igen, når ordningen bliver til frie midler', () => {
    // Feltet må ikke blive liggende på en variant, der ikke har det: en
    // opsparingskonto med et oprettelsestidspunkt er en løgn i det gemte
    // skema, og den ville komme tilbage til live ved næste typeskift.
    const ordning = withVariant(aPlan(), 'free-assets', 'OldAgeSavings')

    const holding = withVariant(ordning, 'free-assets', 'SavingsAccount')
      .household.persons[0]!.holdings[0]!
    expect(holding.variant).toBe('SavingsAccount')
    expect(holding).not.toHaveProperty('openedOn')
  })

  it('bevarer oprettelsestidspunktet, når den ene pensionsordning bliver den anden', () => {
    // Ratepensionen og livrenten deler regime: skiftet ændrer beskatningen
    // på vejen ud, ikke hvornår ordningen blev oprettet.
    const plan = aPlan({ variant: 'InstalmentPension', openedOn: { year: 2004, month: 9 } })

    const holding = withVariant(plan, 'free-assets', 'LifeAnnuity')
      .household.persons[0]!.holdings[0]!
    expect(holding).toMatchObject({
      variant: 'LifeAnnuity',
      openedOn: { year: 2004, month: 9 },
    })
  })
})

describe('addPerson', () => {
  it('tilføjer den samme tynde person, som minimumsplanen selv bærer', () => {
    // De to er hver især "den tyndeste person", og de skal blive ved med at
    // være den samme. Stod kommunen og kirkeskattefluebenet to steder med
    // hver sin værdi, ville husstandens skat afhænge af, om personen kom med
    // planen eller blev tilføjet bagefter.
    const tilfoejet = addPerson(aPlan()).household.persons[1]!
    const minimumsplanens = defaultPlan().household.persons[0]!

    expect(tilfoejet.municipality).toBe(minimumsplanens.municipality)
    expect(tilfoejet.churchMember).toBe(minimumsplanens.churchMember)
    expect(tilfoejet.municipality).toBe('Silkeborg')
    expect(tilfoejet.churchMember).toBe(false)
  })
})

describe('addTransfer og addContribution', () => {
  /** En plan med to beholdninger med frie midler og en ordning at betale
      til — nok til, at begge knapper har et lovligt par at bygge på. */
  function aPlanToAddTo(): Plan {
    const base = aTwoPersonPlan()
    const owner = base.household.persons[0]!
    return {
      ...base,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      household: {
        persons: [
          {
            ...owner,
            holdings: [
              ...owner.holdings,
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
          },
          ...base.household.persons.slice(1),
        ],
      },
    }
  }

  it('nummererer den nye overførsel og den nye indbetaling', () => {
    // Navnet skrives ved oprettelsen som en beholdnings og udledes ikke af
    // enderne: en etikette, der læste sig selv af de to beholdninger, ville
    // skifte under brugeren, hver gang en ende blev valgt om.
    const plan = addTransfer(addTransfer(aPlanToAddTo()))

    expect(plan.transfers.map((transfer) => transfer.name)).toEqual([
      'Overførsel 1',
      'Overførsel 2',
    ])
  })

  it('nummererer den nye indbetaling', () => {
    const plan = addContribution(addContribution(aPlanToAddTo()))

    expect(plan.contributions.map((contribution) => contribution.name)).toEqual([
      'Indbetaling 1',
      'Indbetaling 2',
    ])
  })
})
