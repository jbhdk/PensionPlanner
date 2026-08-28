import { deriveStatePensionAge } from '../engine/statePensionAge'

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
  {
    // v9 → v10, jf. issue #41: overførslens periode er nu en fuld periode med
    // en forankring. Indtil nu bar den kun to årstal, fordi begge ender var
    // frie midler og der ingen ejer var at binde en alder til; afgiveren kan
    // nu være en ordning, og alderen måles på dens ejer, jf. ADR-0022.
    //
    // Der er intet at gætte: en gemt periode betød kalenderår og bliver ved
    // med at betyde det. Endepunkterne står urørt, også når de mangler — et
    // udeladt endepunkt betyder stadig "fra planens start" henholdsvis "til
    // horisontens slut".
    from: 9,
    migrate: (data) => {
      const plan = data as {
        transfers?: Array<Record<string, unknown>>
        [key: string]: unknown
      }

      return {
        ...plan,
        transfers: (plan.transfers ?? []).map((transfer) => ({
          ...transfer,
          period: {
            anchor: 'CalendarYear',
            ...((transfer.period ?? {}) as Record<string, unknown>),
          },
        })),
      }
    },
  },
  {
    // v10 → v11, jf. issue #42: livrenten bærer sine omsætningsfelter.
    // Etape 2 tilføjede værdien `LifeAnnuity` uden dem, fordi
    // opsparingsfasen ikke havde brug for dem, og et dødt felt i et gemt
    // skema er en løgn, der aldrig fejler, jf. ADR-0015.
    //
    // Der er intet at gætte. Selskabets oplyste depot og årlige ydelse står
    // på pensionsoverblikket, og et opfundet standardtal ville se ud som et
    // svar, brugeren ikke har givet: alle tre felter lander på nul, og indtil
    // de er tastet, er kvotienten nul og ydelsen nul. Udbetalingsstarten
    // tilføjes ikke — den er valgfri, ganske som ratepensionens plan.
    from: 10,
    migrate: (data) => {
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
                holding.variant === 'LifeAnnuity'
                  ? {
                      ...holding,
                      quotedReserve: 0,
                      quotedAnnualBenefit: 0,
                      bonusRate: 0,
                    }
                  : holding,
            ),
          })),
        },
      }
    },
  },
  {
    // v11 → v12: overførslen og indbetalingen bærer et navn, brugeren selv
    // kan rette, som posten og beholdningen altid har gjort. Indtil nu havde
    // de intet, og fladen skrev deres to ender i stedet.
    //
    // Der er intet at gætte: de to ender er præcis det, planen har vist
    // indtil nu, og de skrives derfor som navnet. En nummerering ville have
    // omdøbt hver eneste flytning i en gemt plan til noget, brugeren aldrig
    // har set. Nye figurer nummereres derimod — "Overførsel 1" — for dér er
    // der ingen ender, der er valgt endnu, jf. `addTransferOrContribution`.
    //
    // En ende, der ikke rammer noget, kan ikke navngives og beholder sit id.
    // Sådan en plan afvises alligevel ved indgangen, jf. ADR-0013, og
    // beskeden skal kunne pege på den figur, der er gået i stykker.
    from: 11,
    migrate: (data) => {
      const plan = data as {
        household?: { persons?: Array<{ holdings?: Array<Record<string, unknown>> }> }
        entries?: Array<Record<string, unknown>>
        transfers?: Array<Record<string, unknown>>
        contributions?: Array<Record<string, unknown>>
        [key: string]: unknown
      }
      const named = (rows: Array<Record<string, unknown>>) =>
        new Map(rows.map((row) => [row.id, row.name]))
      const holdings = named(
        (plan.household?.persons ?? []).flatMap((person) => person.holdings ?? []),
      )
      const entries = named(plan.entries ?? [])
      const nameOf = (book: Map<unknown, unknown>, id: unknown) => book.get(id) ?? id

      return {
        ...plan,
        transfers: (plan.transfers ?? []).map((transfer) => ({
          ...transfer,
          name: `${nameOf(holdings, transfer.from)} \u2192 ${nameOf(holdings, transfer.to)}`,
        })),
        contributions: (plan.contributions ?? []).map((contribution) => ({
          ...contribution,
          name: `${nameOf(
            contribution.kind === 'EntrySourced' ? entries : holdings,
            contribution.source,
          )} \u2192 ${nameOf(holdings, contribution.to)}`,
        })),
      }
    },
  },
  {
    // v12 \u2192 v13, jf. ADR-0032: en pensionsordnings udbetalingsalder tastes
    // nu direkte, i stedet for at blive udledt af et oprettelsestidspunkt og
    // et regels\u00e6t. Migrationen regner hver ordnings alder ud \u00e9n gang, af de
    // gamle openedOn- og payoutAgeOverride-felter og ejerens f\u00f8dselsdato \u2014
    // pr\u00e6cis den udledning, den levende motor foretog indtil nu.
    //
    // De tre regimers datoskel st\u00e5r frosne herunder og importeres ikke fra
    // payoutAge.ts, som mister dem i denne version: loven er lukket for
    // evigt \u2014 der kommer intet fjerde regime \u2014 og et led, der importerede
    // fra levende motorkode, ville risikere at \u00e6ndre mening, den dag nogen
    // r\u00f8rte ved den af en helt anden grund. Ingen af k\u00e6dens \u00f8vrige led
    // importerer fra motoren, af samme grund; de hardkoder deres egne
    // fakta, som variantnavnene i v7 \u2192 v8.
    //
    // `deriveStatePensionAge` er derimod levende, aktivt vedligeholdt data \u2014
    // ikke en del af det, der fryses her \u2014 og genbruges derfor som den er.
    //
    // Kilde: pensionsbeskatningslovens \u00a7 1 a, stk. 1 \u26a0\ufe0e \u2014 kun det nyeste
    // regime (tre \u00e5r f\u00f8r folkepensionsalderen) er bekr\u00e6ftet i selve
    // lovteksten; de to \u00e6ldre regimers datoskel hviler p\u00e5 sekund\u00e6re kilder.
    //
    // \u00c5bent punkt, som migrationen bevidst ikke regner: \u00a7 1 a, stk. 2 b\u00e6rer
    // en anden tabel, indekseret efter f\u00f8dselsdato og ikke efter
    // oprettelsestidspunkt, som for personer f\u00f8dt f\u00f8r 1961 ville give en
    // lavere alder end de tre regimer herunder. Det rammer kun ejere, der i
    // 2026 allerede er fyldt 65, og det g\u00f8r aldrig en migreret plan mere fri,
    // end den er \u2014 kun mindre.
    from: 12,
    migrate: (data) => {
      const pensionSchemes = ['InstalmentPension', 'LifeAnnuity', 'OldAgeSavings', 'CapitalPension']

      function payoutAgeFor(
        openedOn: { year: number; month: number },
        payoutAgeOverride: number | undefined,
        birthYear: number,
        birthMonth: number,
      ): number {
        if (payoutAgeOverride !== undefined) return payoutAgeOverride
        const statePensionAge = deriveStatePensionAge(birthYear, birthMonth).age
        const reached = (skel: { year: number; month: number }) =>
          openedOn.year !== skel.year ? openedOn.year > skel.year : openedOn.month >= skel.month
        if (reached({ year: 2018, month: 1 })) return statePensionAge - 3
        if (reached({ year: 2007, month: 5 })) return statePensionAge - 5
        return 60
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
              (holding) => {
                if (!pensionSchemes.includes(holding.variant as string)) return holding
                const { openedOn, payoutAgeOverride, ...rest } = holding as {
                  openedOn: { year: number; month: number }
                  payoutAgeOverride?: number
                  [key: string]: unknown
                }
                return {
                  ...rest,
                  payoutAge: payoutAgeFor(
                    openedOn,
                    payoutAgeOverride,
                    person.birthYear as number,
                    person.birthMonth as number,
                  ),
                }
              },
            ),
          })),
        },
      }
    },
  },
  {
    // v13 → v14, jf. ADR-0040: lønposten er lønsedlens løn, og
    // arbejdsgiverbidraget lægges til af en `PensionAgreement` på posten.
    //
    // Leddet kan ikke gøre arbejdet færdigt, og det er ikke en forglemmelse.
    // Et gemt beløb skifter betydning uden at skifte form: 672.000 kr. kan
    // være 600.000 kr. i løn med 12 % fra arbejdsgiveren eller 672.000 kr. i
    // løn helt uden en ordning, og intet i planen siger hvilken. Et gæt ville
    // være en tavs rettelse af brugerens eget tal.
    //
    // Leddet lader derfor tallet stå. Beskeden til planlæggeren hører ikke
    // her — kæden svarer med data og ikke med ord — men i konvolutten, som
    // kender den version, filen kom fra, jf. `parsePlanEnvelope`.
    from: 13,
    migrate: (data) => data,
  },
  {
    // v14 → v15, jf. ADR-0042: pensionsaftalen bærer et gebyr og en
    // forsikringspræmie, som trækkes efter AM-bidraget og før fordelingen.
    //
    // De to er kronebeløb og ikke valgfri felter — en aftale, hvor de
    // manglede, ville regne med `NaN` fra første år. Nul er ikke et skøn her,
    // sådan som v13 → v14's lønbeløb var det: den gemte plan regnede uden de
    // to, og nul er præcis det, den regnede med. Leddet kan derfor gøre
    // arbejdet færdigt, og der er ingen besked til planlæggeren.
    from: 14,
    migrate: (data) => {
      const plan = data as {
        entries?: Array<Record<string, unknown>>
        [key: string]: unknown
      }
      if (!plan.entries) return plan

      return {
        ...plan,
        entries: plan.entries.map((entry) => {
          // Fraværet er hele svaret: en lønpost uden aftale har ingen
          // firmapension, og leddet må ikke skrive en tom aftale på den.
          if (!entry.pensionAgreement) return entry
          const agreement = entry.pensionAgreement as Record<string, unknown>
          return {
            ...entry,
            pensionAgreement: { fee: 0, insurancePremium: 0, ...agreement },
          }
        }),
      }
    },
  },
  {
    // v15 → v16, jf. issue #83: overførslen og det beholdningskildede bidrag
    // bærer nu en fælles `position` — ingen af de to arrays alene kan
    // udtrykke, hvor en overførsel hører hjemme mellem to bidrag i den
    // sammenlagte liste, skuffen viser dem i, jf. ADR-0047.
    //
    // Der er intet at gætte: positionen udledes af den rækkefølge, brugeren
    // allerede ser i dag — alle overførsler i deres nuværende
    // `plan.transfers`-rækkefølge, derefter alle beholdningskildede bidrag i
    // deres nuværende relative rækkefølge i `plan.contributions` — så en
    // migreret plan ser visuelt uændret ud. Det lønkildede bidrag er ikke en
    // del af sammenlægningen og får ikke feltet.
    from: 15,
    migrate: (data) => {
      const plan = data as {
        transfers?: Array<Record<string, unknown>>
        contributions?: Array<Record<string, unknown>>
        [key: string]: unknown
      }
      const transfers = plan.transfers ?? []
      const contributions = plan.contributions ?? []
      let next = 0

      return {
        ...plan,
        transfers: transfers.map((transfer) => ({ ...transfer, position: next++ })),
        contributions: contributions.map((contribution) =>
          contribution.kind === 'HoldingSourced'
            ? { ...contribution, position: next++ }
            : contribution,
        ),
      }
    },
  },
]

/** Den skemaversion, hvor lønpostens beløb skiftede betydning, jf. ADR-0040.
    En plan gemt før den skal efterses af et menneske, og konvolutten siger
    det ved indlæsningen. */
export const SALARY_MEANING_CHANGED_IN = 14

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
