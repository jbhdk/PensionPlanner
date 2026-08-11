import { describe, expect, it } from 'vitest'
import { runMigrations, type Migration } from './migrations'

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
