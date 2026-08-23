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


describe('v5 → v6: folkepensionsalderen kan ikke længere overstyres', () => {
  it('fjerner statePensionAgeOverride fra hver person og lader resten stå', () => {
    // Tabellen er eneste kilde til alderen. Et fremskrevet trin bruges, som
    // det står — ændrer Folketinget det, rettes datagrundlaget, og planen
    // følger med af sig selv.
    const v5: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      buffer: 'free-assets',
      transfers: [],
      entries: [],
      household: {
        persons: [
          {
            id: 'jesper',
            name: 'Jesper',
            birthYear: 1973,
            birthMonth: 6,
            workEndAge: 58,
            statePensionAgeOverride: 68,
            holdings: [],
          },
          {
            id: 'maria',
            name: 'Maria',
            birthYear: 1975,
            birthMonth: 1,
            workEndAge: 62,
            holdings: [],
          },
        ],
      },
    }

    const migrated = runMigrations(v5, 5, 6, migrations) as {
      household: { persons: Array<Record<string, unknown>> }
    }

    const [jesper, maria] = migrated.household.persons
    expect(jesper).not.toHaveProperty('statePensionAgeOverride')
    expect(jesper!.workEndAge).toBe(58)
    expect(maria!.workEndAge).toBe(62)
  })
})

describe('v6 → v7: planen bærer indbetalinger', () => {
  it('giver en gemt plan et tomt contributions og lader resten stå', () => {
    // En plan fra før etape 2 har ingen indbetalinger og skal have listen,
    // motoren nu læser — ikke et manglende felt, den ville falde over.
    const v6: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      buffer: 'free-assets',
      transfers: [{ id: 'transfer', from: 'free-assets', to: 'anden', amountInRealKroner: 1_000 }],
      entries: [{ id: 'salary', name: 'Løn', direction: 'Income' }],
      household: { persons: [{ id: 'jesper', name: 'Jesper', holdings: [] }] },
    }

    const migrated = runMigrations(v6, 6, 7, migrations) as {
      contributions: unknown[]
      transfers: unknown[]
      entries: unknown[]
    }

    expect(migrated.contributions).toEqual([])
    expect(migrated.transfers).toHaveLength(1)
    expect(migrated.entries).toHaveLength(1)
  })
})

describe('v7 → v8: pensionsordningerne bærer et oprettelsestidspunkt', () => {
  it('giver de tre pensionsvarianter 1. januar 2018 og lader de øvrige stå uden', () => {
    // Oprettelsestidspunktet afgør, hvilket regime ordningen falder i, og
    // en gemt plan har det ikke. Gættet er det nyeste regime — tre år før
    // folkepensionsalderen, den seneste af de tre aldre — så en plan aldrig
    // bliver mere optimistisk, end virkeligheden tillader. Brugeren retter
    // tidspunktet i inspektøren, som hun retter kommunen efter v1 → v2.
    //
    // En aktiesparekonto og frie midler får ingenting: de har ingen
    // udbetalingsalder, og et felt, de aldrig bruger, er en løgn i skemaet.
    const v7: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      buffer: 'free-assets',
      transfers: [],
      entries: [],
      contributions: [],
      household: {
        persons: [
          {
            id: 'jesper',
            holdings: [
              { id: 'free-assets', name: 'Frie midler', variant: 'SavingsAccount', balance: 100 },
              { id: 'aktiesparekonto', name: 'ASK', variant: 'ShareSavingsAccount', balance: 200 },
              { id: 'ratepension', name: 'Ratepension', variant: 'InstalmentPension', balance: 300 },
              { id: 'livrente', name: 'Livrente', variant: 'LifeAnnuity', balance: 400 },
              { id: 'aldersopsparing', name: 'Aldersopsparing', variant: 'OldAgeSavings', balance: 500 },
            ],
          },
        ],
      },
    }

    const migrated = runMigrations(v7, 7, 8, migrations) as {
      household: { persons: Array<{ holdings: Array<Record<string, unknown>> }> }
    }

    const holdings = migrated.household.persons[0]!.holdings
    expect(holdings.map((holding) => holding.openedOn)).toEqual([
      undefined,
      undefined,
      { year: 2018, month: 1 },
      { year: 2018, month: 1 },
      { year: 2018, month: 1 },
    ])
    // Migrationen tilføjer ét felt og bygger ikke beholdningen om.
    expect(holdings[2]!.balance).toBe(300)
    expect(holdings[2]!.name).toBe('Ratepension')
  })
})

describe('v8 → v9: satsreguleringen hedder det, den løfter', () => {
  it('omdøber feltet uden at røre satsen eller resten af planen', () => {
    // Feltet skalerede i forvejen kun folkepensionens grundbeløb og
    // pensionstillæg, så det gamle navn lovede mere, end det holdt — ATP
    // bærer sin egen sats som enhver anden indtægtspost, jf. ADR-0023. Det
    // er en ren omdøbning: værdien betyder præcis det samme bagefter, og der
    // er intet at gætte.
    const v8: unknown = {
      name: 'Gammel plan',
      startYear: 2026,
      inflationAssumption: 0.02,
      section20ProjectionAssumption: 0.02,
      benefitProjectionAssumption: 0.031,
      buffer: 'free-assets',
      entries: [],
      transfers: [],
      contributions: [],
      household: { persons: [] },
    }

    const migrated = runMigrations(v8, 8, 9, migrations) as Record<string, unknown>

    expect(migrated.statePensionProjectionAssumption).toBe(0.031)
    expect('benefitProjectionAssumption' in migrated).toBe(false)
    // Naboen med det næsten ens navn står urørt — de to er selvstændige og
    // følger hvert sit indeks.
    expect(migrated.section20ProjectionAssumption).toBe(0.02)
    expect(migrated.inflationAssumption).toBe(0.02)
    expect(migrated.name).toBe('Gammel plan')
  })

  it('lader en plan uden feltet passere frem for at skrive et nul ind', () => {
    // Feltet har været der siden v1, så tilfældet burde ikke findes — men et
    // led i kæden, der opfinder en sats, er værre end et, der lader være.
    const migrated = runMigrations({ name: 'Uden feltet' }, 8, 9, migrations) as Record<
      string,
      unknown
    >

    expect('statePensionProjectionAssumption' in migrated).toBe(false)
  })
})

describe('v9 → v10: overførslens periode bliver en fuld periode', () => {
  it('forankrer en gemt overførsel til kalenderår og lader endepunkterne stå', () => {
    // Indtil nu bar overførslen kun to årstal: den kunne ikke
    // aldersforankres, fordi begge ender var frie midler. Nu måles alderen
    // på afgiverbeholdningens ejer, og perioden har derfor samme form som
    // en posts. En gemt periode betød kalenderår og bliver ved med at gøre
    // det — der er intet at gætte, jf. ADR-0022.
    const v9: unknown = {
      transfers: [
        { id: 'transfer-1', from: 'a', to: 'b', period: { from: 2030, to: 2035 } },
        { id: 'transfer-2', from: 'a', to: 'b', period: {} },
      ],
    }

    const v10 = runMigrations(v9, 9, 10, migrations) as {
      transfers: Array<{ id: string; period: unknown }>
    }

    expect(v10.transfers[0]!.period).toEqual({
      anchor: 'CalendarYear',
      from: 2030,
      to: 2035,
    })
    expect(v10.transfers[1]!.period).toEqual({ anchor: 'CalendarYear' })
  })

  it('lader en plan uden overførsler stå med en tom liste', () => {
    const v10 = runMigrations({ name: 'Plan' }, 9, 10, migrations)

    expect(v10).toEqual({ name: 'Plan', transfers: [] })
  })
})

describe('v10 → v11: livrenten bærer sine omsætningsfelter', () => {
  it('giver hver gemt livrente de tre felter med nul i, og lader de øvrige stå urørt', () => {
    // Etape 2 tilføjede værdien `LifeAnnuity` uden ekstra felter, fordi
    // opsparingsfasen ikke havde brug for dem; omsætningen tilføjer dem her,
    // jf. ADR-0015. Selskabets to tal står på pensionsoverblikket og kan
    // ikke gættes — nul betyder, at brugeren endnu ikke har tastet dem, og
    // et opfundet standardtal ville se ud som et svar.
    const v10: unknown = {
      household: {
        persons: [
          {
            id: 'jesper',
            holdings: [
              { id: 'livrente', variant: 'LifeAnnuity', balance: 760_000 },
              { id: 'ratepension', variant: 'InstalmentPension', balance: 900_000 },
              { id: 'frie', variant: 'SavingsAccount', balance: 100_000 },
            ],
          },
        ],
      },
    }

    const v11 = runMigrations(v10, 10, 11, migrations) as {
      household: { persons: Array<{ holdings: Array<Record<string, unknown>> }> }
    }
    const holdings = v11.household.persons[0]!.holdings

    expect(holdings[0]).toEqual({
      id: 'livrente',
      variant: 'LifeAnnuity',
      balance: 760_000,
      quotedReserve: 0,
      quotedAnnualBenefit: 0,
      bonusRate: 0,
    })
    expect(holdings[1]).toEqual({
      id: 'ratepension',
      variant: 'InstalmentPension',
      balance: 900_000,
    })
    expect(holdings[2]).toEqual({ id: 'frie', variant: 'SavingsAccount', balance: 100_000 })
  })

  it('lader en plan uden personer stå med en tom husstand', () => {
    const v11 = runMigrations({ name: 'Plan' }, 10, 11, migrations)

    expect(v11).toEqual({ name: 'Plan', household: { persons: [] } })
  })
})

describe('v11 → v12: overførslen og indbetalingen bærer et navn', () => {
  it('skriver de to ender som navnet, så planen hedder det, den hidtil har vist', () => {
    // Indtil nu havde de to figurer intet navn, og fladen skrev deres ender
    // i stedet. Det er dermed også det eneste, migrationen kan skrive uden
    // at gætte: en nummerering ville omdøbe hver eneste flytning i en gemt
    // plan til noget, brugeren aldrig har set.
    const v11: unknown = {
      household: {
        persons: [
          {
            id: 'jesper',
            holdings: [
              { id: 'frie', name: 'Frie midler' },
              { id: 'opsparing', name: 'Opsparing' },
              { id: 'ratepension', name: 'Ratepension' },
            ],
          },
        ],
      },
      entries: [{ id: 'salary', name: 'Løn' }],
      transfers: [{ id: 'transfer-1', from: 'opsparing', to: 'frie' }],
      contributions: [
        { id: 'contribution-1', kind: 'EntrySourced', source: 'salary', to: 'ratepension' },
        {
          id: 'contribution-2',
          kind: 'HoldingSourced',
          source: 'frie',
          to: 'ratepension',
        },
      ],
    }

    const v12 = runMigrations(v11, 11, 12, migrations) as {
      transfers: Array<{ name: string }>
      contributions: Array<{ name: string }>
    }

    expect(v12.transfers[0]!.name).toBe('Opsparing → Frie midler')
    // Kilden slås op i den bog, formen peger ind i: en post i den ene
    // udgave, en beholdning i den anden.
    expect(v12.contributions[0]!.name).toBe('Løn → Ratepension')
    expect(v12.contributions[1]!.name).toBe('Frie midler → Ratepension')
  })

  it('lader en ende, der ikke rammer noget, beholde sit id i navnet', () => {
    // Sådan en plan afvises alligevel ved indgangen, jf. ADR-0013, og
    // beskeden skal kunne pege på den figur, der er gået i stykker.
    const v12 = runMigrations(
      { transfers: [{ id: 'transfer-1', from: 'findes-ikke', to: 'findes-heller-ikke' }] },
      11,
      12,
      migrations,
    ) as { transfers: Array<{ name: string }> }

    expect(v12.transfers[0]!.name).toBe('findes-ikke → findes-heller-ikke')
  })

  it('lader en plan uden nogen af delene stå med to tomme lister', () => {
    const v12 = runMigrations({ name: 'Plan' }, 11, 12, migrations)

    expect(v12).toEqual({ name: 'Plan', transfers: [], contributions: [] })
  })
})

describe('v12 → v13: pensionsudbetalingsalderen tastes, den udledes ikke længere', () => {
  it('udleder alderen af oprettelsestidspunktet og ejerens folkepensionsalder, som motoren gjorde', () => {
    // Jesper er født i juni 1973, folkepensionsalder 70. Ratepensionen er
    // oprettet i 2018 — det nyeste regime, tre år før — og lander derfor på
    // 67. Aktiesparekontoen har hverken oprettelsestidspunkt eller
    // udbetalingsalder og skal stå urørt.
    const v12: unknown = {
      household: {
        persons: [
          {
            id: 'jesper',
            birthYear: 1973,
            birthMonth: 6,
            holdings: [
              {
                id: 'ratepension',
                name: 'Ratepension',
                variant: 'InstalmentPension',
                balance: 300,
                openedOn: { year: 2018, month: 1 },
              },
              {
                id: 'aktiesparekonto',
                name: 'ASK',
                variant: 'ShareSavingsAccount',
                balance: 200,
              },
            ],
          },
        ],
      },
    }

    const migrated = runMigrations(v12, 12, 13, migrations) as {
      household: { persons: Array<{ holdings: Array<Record<string, unknown>> }> }
    }
    const [ratepension, aktiesparekonto] = migrated.household.persons[0]!.holdings

    expect(ratepension).toEqual({
      id: 'ratepension',
      name: 'Ratepension',
      variant: 'InstalmentPension',
      balance: 300,
      payoutAge: 67,
    })
    expect(aktiesparekonto).toEqual({
      id: 'aktiesparekonto',
      name: 'ASK',
      variant: 'ShareSavingsAccount',
      balance: 200,
    })
  })

  it('lader en bevaret udbetalingsalder vinde over den udledte, som payoutAge() gjorde', () => {
    const v12: unknown = {
      household: {
        persons: [
          {
            id: 'jesper',
            birthYear: 1973,
            birthMonth: 6,
            holdings: [
              {
                id: 'livrente',
                name: 'Livrente',
                variant: 'LifeAnnuity',
                balance: 400,
                openedOn: { year: 2020, month: 6 },
                payoutAgeOverride: 60,
              },
            ],
          },
        ],
      },
    }

    const migrated = runMigrations(v12, 12, 13, migrations) as {
      household: { persons: Array<{ holdings: Array<Record<string, unknown>> }> }
    }

    expect(migrated.household.persons[0]!.holdings[0]!.payoutAge).toBe(60)
  })

  it('giver det faste regime 60 år uanset ejerens folkepensionsalder', () => {
    const v12: unknown = {
      household: {
        persons: [
          {
            id: 'jesper',
            birthYear: 1985,
            birthMonth: 6,
            holdings: [
              {
                id: 'aldersopsparing',
                name: 'Aldersopsparing',
                variant: 'OldAgeSavings',
                balance: 500,
                openedOn: { year: 2001, month: 3 },
              },
            ],
          },
        ],
      },
    }

    const migrated = runMigrations(v12, 12, 13, migrations) as {
      household: { persons: Array<{ holdings: Array<Record<string, unknown>> }> }
    }

    expect(migrated.household.persons[0]!.holdings[0]!.payoutAge).toBe(60)
  })

  it('lader en plan uden personer stå med en tom husstand', () => {
    const migrated = runMigrations({ name: 'Plan' }, 12, 13, migrations)

    expect(migrated).toEqual({ name: 'Plan', household: { persons: [] } })
  })
})

describe('v13 → v14: lønposten er lønsedlens løn', () => {
  it('lader lønpostens beløb stå — motoren kan ikke vide, hvor meget der var arbejdsgiverens', () => {
    // Beløbet skifter betydning uden at skifte form. En gemt lønpost på
    // 672.000 kr. kan være 600.000 kr. i løn og 12 % fra arbejdsgiveren, men
    // den kan også være 672.000 kr. i løn uden nogen ordning — og intet i
    // planen siger hvilken. Leddet lader tallet stå og overlader rettelsen
    // til planlæggeren, som får besked ved indlæsningen.
    const v13 = {
      name: 'Gammel plan',
      entries: [
        {
          id: 'salary',
          name: 'Løn',
          direction: 'Income',
          taxTreatment: 'EarnedIncome',
          amountInRealKroner: 672_000,
        },
      ],
    }

    expect(runMigrations(v13, 13, 14, migrations)).toEqual(v13)
  })
})
