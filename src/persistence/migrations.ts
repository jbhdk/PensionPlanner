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
  {
    // v7 → v8, jf. issue #38: en pensionsordning bærer det tidspunkt, den
    // blev oprettet på, og det er dét, der afgør, hvornår den lovligt må
    // udbetales. En gemt plan har det ikke, og migrationen kan ikke gætte
    // det — den vælger 1. januar 2018, det nyeste regime, som giver tre år
    // før folkepensionsalderen. Det er den seneste af de tre aldre, så en
    // gammel plan aldrig kommer til at se mere fri ud, end den er.
    // Brugeren retter tidspunktet i beholdningens inspektør, hvis ordningen
    // er ældre — samme greb som Hvidovre i v1 → v2.
    //
    // Varianterne står som tekst her og slås ikke op i varianttabellen: et
    // led i kæden skal blive ved med at gøre det samme ved de samme data,
    // også når tabellen ændrer sig.
    from: 7,
    migrate: (data) => {
      const pensionSchemes = ['InstalmentPension', 'LifeAnnuity', 'OldAgeSavings']
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
              (holding) =>
                pensionSchemes.includes(holding.variant as string)
                  ? { ...holding, openedOn: { year: 2018, month: 1 } }
                  : holding,
            ),
          })),
        },
      }
    },
  },
  {
    // v8 → v9, jf. ADR-0023: feltet hedder nu det, det løfter. Det skalerede
    // i forvejen kun folkepensionens grundbeløb og pensionstillæg og aldrig
    // ydelser i almindelighed — ATP bærer sin egen reguleringssats som
    // enhver anden indtægtspost, og livrentens ydelse følger sin
    // bonusantagelse. Navnet lovede altså mere, end det holdt.
    //
    // En ren omdøbning: værdien betyder præcis det samme bagefter, og der er
    // intet at gætte. Mangler feltet, skrives der intet — et led, der
    // opfinder en sats, er værre end et, der lader være.
    from: 8,
    migrate: (data) => {
      const { benefitProjectionAssumption, ...rest } = data as {
        benefitProjectionAssumption?: unknown
        [key: string]: unknown
      }

      return benefitProjectionAssumption === undefined
        ? rest
        : { ...rest, statePensionProjectionAssumption: benefitProjectionAssumption }
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
