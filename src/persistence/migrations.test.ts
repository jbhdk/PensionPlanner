import { describe, expect, it } from 'vitest'
import { migrations, runMigrations, type Migration } from './migrations'

describe('runMigrations', () => {
  it('fører et syntetisk ældre skema frem til den ønskede version, uden datatab', () => {
    // Syntetisk v0: feltet hed dengang 'planNavn'. Ingen rigtig v0 har
    // nogensinde eksisteret — migrationen findes kun for at bevise, at
    // kædemekanikken virker, jf. issue #15.
    const v0 = { planNavn: 'Testplan', startYear: 2026 }
    const synthesizedMigrations: Migration[] = [
      {
        from: 0,
        migrate: (data) => {
          const { planNavn, ...rest } = data as { planNavn: string; [key: string]: unknown }
          return { name: planNavn, ...rest }
        },
      },
    ]

    const result = runMigrations(v0, 0, 1, synthesizedMigrations)

    expect(result).toEqual({ name: 'Testplan', startYear: 2026 })
  })

  it('lader data stå urørt, når kæden er tom og data allerede er på den ønskede version', () => {
    const current = { name: 'Testplan' }

    expect(runMigrations(current, 1, 1, [])).toEqual(current)
  })
})

describe('v1 → v2: kommune- og kirkeskat flytter fra planen til hver person', () => {
  it('fjerner planens felter og sætter dem på hver person i stedet, jf. issue #19', () => {
    // En rigtig gemt v1-plan: kommune- og kirkeskat stod på planen som frit
    // indtastede tal, ikke som en kommunereference. Migrationen kan ikke
    // gætte, hvilken kommune et gammelt tal svarede til — den lander de
    // eksisterende personer på Hvidovre og bærer kun kirkemedlemskabet videre.
    const v1: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      inflationAssumption: 0.02,
      section20ProjectionAssumption: 0.02,
      benefitProjectionAssumption: 0.02,
      municipalTaxRate: 0.22,
      churchTax: false,
      churchTaxRate: 0.006,
      buffer: 'free-assets',
      entries: [],
      transfers: [],
      household: {
        persons: [
          {
            id: 'jesper',
            name: 'Jesper',
            birthYear: 1973,
            birthMonth: 6,
            workEndAge: 65,
            horizon: 90,
            holdings: [],
          },
          {
            id: 'maria',
            name: 'Maria',
            birthYear: 1975,
            birthMonth: 1,
            workEndAge: 65,
            horizon: 90,
            holdings: [],
          },
        ],
      },
    }

    const migrated = runMigrations(v1, 1, 2, migrations) as {
      municipalTaxRate?: unknown
      churchTax?: unknown
      churchTaxRate?: unknown
      household: { persons: Array<{ municipality: unknown; churchMember: unknown }> }
    }

    expect(migrated).not.toHaveProperty('municipalTaxRate')
    expect(migrated).not.toHaveProperty('churchTax')
    expect(migrated).not.toHaveProperty('churchTaxRate')
    for (const person of migrated.household.persons) {
      expect(person.municipality).toBe('Hvidovre')
      expect(person.churchMember).toBe(false)
    }
  })
})

describe('v2 → v3: reguleringssatsen er kun indtægtens', () => {
  it('fjerner satsen fra udgiftsposterne og lader indtægternes stå', () => {
    // En rigtig gemt v2-plan: hver post bar sin egen reguleringssats, også
    // udgifterne. Udgiften følger nu planens inflationsantagelse, som en
    // overførsel allerede gjorde, mens indtægten beholder sit eget tempo —
    // en løn stiger hurtigere end priserne, og den forskel er hele grunden
    // til, at feltet bliver.
    const v2: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      inflationAssumption: 0.02,
      buffer: 'free-assets',
      transfers: [],
      entries: [
        {
          id: 'living-costs',
          name: 'Faste udgifter',
          amountInRealKroner: 360_000,
          owner: 'jesper',
          direction: 'Expense',
          timing: 'Even',
          period: { anchor: 'CalendarYear' },
          recurrence: { kind: 'Annual' },
          regulationRate: 0.03,
        },
        {
          id: 'salary',
          name: 'Løn',
          amountInRealKroner: 600_000,
          owner: 'jesper',
          direction: 'Income',
          taxTreatment: 'EarnedIncome',
          timing: 'Even',
          period: { anchor: 'CalendarYear' },
          recurrence: { kind: 'Annual' },
          regulationRate: 0.03,
        },
      ],
      household: { persons: [] },
    }

    const migrated = runMigrations(v2, 2, 3, migrations) as {
      entries: Array<Record<string, unknown>>
    }

    const [expense, income] = migrated.entries
    expect(expense).not.toHaveProperty('regulationRate')
    expect(income!.regulationRate).toBe(0.03)

    // Resten af udgiften står urørt — migrationen fjerner ét felt, den
    // bygger ikke posten om.
    expect(expense!.amountInRealKroner).toBe(360_000)
    expect(expense!.direction).toBe('Expense')
  })
})

describe('v3 → v4: pegere, der ikke rammer noget, ryddes op', () => {
  it('dropper overførslen mod en beholdning, der ikke findes, og posten uden ejer', () => {
    // removePerson efterlod indtil nu overførslerne mod den slettede persons
    // beholdninger, og motoren regnede videre med NaN. Den afviser nu sådan
    // en plan, jf. ADR-0013 — og en plan, der allerede er gemt med skaden,
    // skal renses ved indlæsningen frem for at blive uindlæselig.
    const v3: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      buffer: 'free-assets',
      household: {
        persons: [
          {
            id: 'jesper',
            holdings: [{ id: 'free-assets' }, { id: 'depot' }],
          },
        ],
      },
      transfers: [
        { id: 'god', from: 'free-assets', to: 'depot' },
        { id: 'haengende', from: 'free-assets', to: 'marias-konto' },
      ],
      entries: [
        { id: 'loen', owner: 'jesper' },
        { id: 'marias-loen', owner: 'maria' },
      ],
    }

    const migrated = runMigrations(v3, 3, 4, migrations) as {
      transfers: Array<{ id: string }>
      entries: Array<{ id: string }>
    }

    expect(migrated.transfers.map((transfer) => transfer.id)).toEqual(['god'])
    expect(migrated.entries.map((entry) => entry.id)).toEqual(['loen'])
  })
})

describe('v4 → v5: de frie varianter hedder ikke længere en indkomst', () => {
  it('omdøber ShareIncome og CapitalIncome i beholdningerne og lader resten stå', () => {
    // En beholdning er ikke en indkomst — den er en konto, du ejer, og dens
    // afkast bliver til en indkomst hos personen. De to variantnavne sagde
    // det modsatte og er skiftet til det, kontoen er. Personens felter
    // `shareIncome` og `capitalIncome` er urørte: dér er det indkomster.
    const v4: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      buffer: 'free-assets',
      transfers: [],
      entries: [],
      household: {
        persons: [
          {
            id: 'jesper',
            holdings: [
              { id: 'free-assets', name: 'Frie midler', variant: 'CapitalIncome', balance: 100 },
              { id: 'aktier', name: 'Aktier', variant: 'ShareIncome', balance: 200 },
              { id: 'ratepension', name: 'Ratepension', variant: 'InstalmentPension', balance: 300 },
            ],
          },
        ],
      },
    }

    const migrated = runMigrations(v4, 4, 5, migrations) as {
      household: { persons: Array<{ holdings: Array<Record<string, unknown>> }> }
    }

    const holdings = migrated.household.persons[0]!.holdings
    expect(holdings.map((holding) => holding.variant)).toEqual([
      'SavingsAccount',
      'ShareDepot',
      'InstalmentPension',
    ])
    // Migrationen skifter ét felt og bygger ikke beholdningen om.
    expect(holdings[0]!.balance).toBe(100)
    expect(holdings[0]!.name).toBe('Frie midler')
  })
})

