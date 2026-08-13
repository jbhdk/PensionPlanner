/** Ét led i migrationskæden: løfter data fra skemaversion `from` til `from + 1`. */
export type Migration = {
  from: number
  migrate: (data: unknown) => unknown
}

/** Kæden fra dag ét. Et nyt skemaskifte tilføjer et led her, aldrig en
    ombygning af et eksisterende. */
export const migrations: Migration[] = [
  {
    // v1 → v2, jf. issue #19: kommune- og kirkeskat flytter fra planen til
    // hver person. En v1-plan gemte dem som frit indtastede tal på planen —
    // migrationen kan ikke gætte, hvilken kommune et sådant tal svarede til,
    // så hver person lander på Hvidovre og bærer kun det gamle
    // kirkemedlemskab videre. Brugeren retter kommunen i personens
    // inspektør, hvis Hvidovre ikke er den rigtige.
    from: 1,
    migrate: (data) => {
      const plan = data as {
        municipalTaxRate?: unknown
        churchTax?: unknown
        churchTaxRate?: unknown
        household: { persons: Array<Record<string, unknown>> }
        [key: string]: unknown
      }
      const { municipalTaxRate: _municipalTaxRate, churchTax, churchTaxRate: _churchTaxRate, ...rest } = plan

      return {
        ...rest,
        household: {
          persons: plan.household.persons.map((person) => ({
            ...person,
            municipality: 'Hvidovre',
            churchMember: churchTax ?? true,
          })),
        },
      }
    },
  },
  {
    // v2 → v3: reguleringssatsen er kun indtægtens. En udgift har ikke
    // længere sit eget tempo — den følger planens inflationsantagelse, som en
    // overførsel allerede gør — så satsen fjernes fra udgiftsposterne.
    // Indtægternes egen sats står urørt: en løn stiger hurtigere end
    // priserne, og den forskel er hele grunden til, at feltet bliver.
    from: 2,
    migrate: (data) => {
      const plan = data as {
        entries?: Array<Record<string, unknown>>
        [key: string]: unknown
      }

      return {
        ...plan,
        entries: (plan.entries ?? []).map((entry) => {
          if (entry.direction !== 'Expense') return entry
          const { regulationRate: _regulationRate, ...rest } = entry
          return rest
        }),
      }
    },
  },
  {
    // v3 → v4: en peger, der ikke rammer noget, går ikke længere gennem
    // motoren, jf. ADR-0013. Indtil nu efterlod removePerson overførslerne
    // mod den slettede persons beholdninger, og motoren regnede videre med
    // NaN i totalformuen. Kontrollen ved indgangen ville afvise sådan en
    // gemt plan helt, så kæden rydder skaden op i stedet: overførslen
    // uden begge ender og posten uden ejer forsvinder, resten står urørt.
    from: 3,
    migrate: (data) => {
      const plan = data as {
        household?: { persons?: Array<{ id?: unknown; holdings?: Array<{ id?: unknown }> }> }
        transfers?: Array<Record<string, unknown>>
        entries?: Array<Record<string, unknown>>
        [key: string]: unknown
      }
      const persons = plan.household?.persons ?? []
      const holdings = new Set(
        persons.flatMap((person) => (person.holdings ?? []).map((holding) => holding.id)),
      )
      const owners = new Set(persons.map((person) => person.id))

      return {
        ...plan,
        transfers: (plan.transfers ?? []).filter(
          (transfer) => holdings.has(transfer.from) && holdings.has(transfer.to),
        ),
        entries: (plan.entries ?? []).filter((entry) => owners.has(entry.owner)),
      }
    },
  },
  {
    // v4 → v5: de to frie varianter hed en indkomst, og det er de ikke. En
    // beholdning er en konto, du ejer; indkomsten er det, dens afkast bliver
    // til hos personen. `ShareIncome` er nu `ShareDepot` og `CapitalIncome`
    // `SavingsAccount`, jf. ADR-0017 — personens `shareIncome` og
    // `capitalIncome` er urørte, for dér er det stadig indkomster.
    from: 4,
    migrate: (data) => {
      const renamed: Record<string, string> = {
        ShareIncome: 'ShareDepot',
        CapitalIncome: 'SavingsAccount',
      }
      const plan = data as {
        household?: { persons?: Array<Record<string, unknown>> }
        [key: string]: unknown
      }

      return {
        ...plan,
        household: {
          persons: (plan.household?.persons ?? []).map((person) => ({
            ...person,
            holdings: ((person.holdings ?? []) as Array<Record<string, unknown>>).map(
              (holding) => ({
                ...holding,
                variant: renamed[holding.variant as string] ?? holding.variant,
              }),
            ),
          })),
        },
      }
    },
  },
  {
    // v5 → v6: folkepensionsalderen kan ikke længere overstyres. Tabellen i
    // docs/satser/folkepensionsalder.md er eneste kilde, også for de årgange
    // hvor trinnet kun er fremskrevet og ikke vedtaget — det tal er det
    // bedste, der findes, og et håndtag ved siden af det var et greb, ingen
    // ville bruge. Vedtager Folketinget noget andet, rettes datagrundlaget,
    // og enhver plan følger med af sig selv.
    from: 5,
    migrate: (data) => {
      const plan = data as {
        household?: { persons?: Array<Record<string, unknown>> }
        [key: string]: unknown
      }

      return {
        ...plan,
        household: {
          persons: (plan.household?.persons ?? []).map((person) => {
            const { statePensionAgeOverride: _statePensionAgeOverride, ...rest } = person
            return rest
          }),
        },
      }
    },
  },
  {
    // v6 → v7: planen bærer indbetalinger. En plan fra før etape 2 har ingen
    // og får en tom liste — motoren læser `contributions` for hvert år, og et
    // manglende felt ville få den til at falde over frem for at regne på en
    // plan uden indbetalinger.
    from: 6,
    migrate: (data) => {
      const plan = data as { [key: string]: unknown }
      return { ...plan, contributions: [] }
    },
  },
]

/** Kører kæden fra `fromVersion` til `toVersion`, ét led ad gangen. Rent og
    uafhængigt af den rigtige kæde ovenfor, så mekanikken kan bevises med et
    syntetisk skema uden at vente på en rigtig skemaændring. */
export function runMigrations(
  data: unknown,
  fromVersion: number,
  toVersion: number,
  chain: Migration[],
): unknown {
  let version = fromVersion
  let current = data
  while (version < toVersion) {
    const step = chain.find((migration) => migration.from === version)
    if (!step) {
      throw new Error(`Ingen migration fra skemaversion ${version} til ${version + 1}.`)
    }
    current = step.migrate(current)
    version += 1
  }
  return current
}
