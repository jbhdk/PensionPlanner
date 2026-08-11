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
