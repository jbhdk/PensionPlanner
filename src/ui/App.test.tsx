import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Plan } from '../engine/plan'
import { aPlan, aSalary, aTransfer, anExpense } from '../engine/testing/planFixture'
import { App } from './App'
import { defaultPlan } from './defaultPlan'

/** Fixturens buffer plus én beholdning til, så en overførsel har et sted at
    flytte penge hen. */
function aPlanWithSecondHolding(): Plan {
  const base = aPlan()
  return {
    ...base,
    household: {
      persons: [
        {
          ...base.household.persons[0]!,
          holdings: [
            ...base.household.persons[0]!.holdings,
            {
              id: 'anden-beholdning',
              name: 'Anden beholdning',
              variant: 'CapitalIncome' as const,
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

/** Som ovenfor, men med en tredje beholdning, så "Fra" og "Til" hver har
    mere end ét lovligt valg tilbage, når den anden er udelukket. */
function aPlanWithThreeHoldings(): Plan {
  const base = aPlanWithSecondHolding()
  return {
    ...base,
    household: {
      persons: [
        {
          ...base.household.persons[0]!,
          holdings: [
            ...base.household.persons[0]!.holdings,
            {
              id: 'tredje-beholdning',
              name: 'Tredje beholdning',
              variant: 'CapitalIncome' as const,
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

/** Etiketten på det første felt i Perioden-afsnittet — til at fastslå
    rækkefølgen af felter i skuffen. */
function firstPeriodenFelt(container: HTMLElement): string | null | undefined {
  const overskrift = Array.from(container.querySelectorAll('h3')).find(
    (h) => h.textContent === 'Perioden',
  )
  const felt = overskrift?.parentElement?.querySelector('.felt label, .felt .etiket')
  return felt?.textContent
}

/** Årstabellen ligger bag sin egen fane, med Formuen som standardfane. */
async function showYearTable(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Årstabellen' }))
}

/** En beholdnings navn findes både som navigatorrække og som knap i
    grafens legend — de to skal kunne skelnes, ikke kun den ene fjernes.
    Denne henter navigatorens, som de fleste tests handler om. */
function navigatorButton(name: string | RegExp) {
  const navigatorspalte = document.querySelector('.navigatorspalte') as HTMLElement
  return within(navigatorspalte).getByRole('button', { name })
}

/** Tre simuleringsår, så tabellen kan tælles med det blotte øje. */
function aThreeYearPlan() {
  return aPlan({
    startYear: 2026,
    birthYear: 1973,
    horizon: 55,
    balance: 1_000_000,
    inflationAssumption: 0.02,
    entries: [anExpense({ amountInRealKroner: 40_000, regulationRate: 0.02 })],
  })
}

describe('fladen', () => {
  it('viser én række i årstabellen pr. simuleringsår, i dagens kroner', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')

    expect(rows).toHaveLength(1 + 3)
    expect(within(rows[1]!).getByText('2026')).toBeTruthy()
    expect(within(rows[3]!).getByText('2028')).toBeTruthy()

    // Udgiften er tastet i dagens kroner og står derfor uændret år efter år,
    // selv om motoren fremskriver den med inflationen bag facaden.
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    const udgifter = headers.indexOf('Udgifter')
    expect(headers).toEqual([
      'År',
      'Jesper',
      'Indtægter',
      'Afkast',
      'Skat',
      'Udgifter',
      'Nettoresultat',
      'Buffer',
      'Formue',
    ])

    for (const row of rows.slice(1)) {
      const cells = within(row).getAllByRole('cell')
      expect(cells[udgifter]!.textContent).toBe('-40.000')
    }
  })

  it('regner årstabellen om, når saldoen rettes i skuffen — uden en beregn-knap', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    await user.click(navigatorButton(/Frie midler/))
    const balance = screen.getByLabelText(/Saldo/)
    await user.clear(balance)
    await user.type(balance, '2000000')

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // Bufferen er husstandens eneste beholdning her, så Buffer- og
    // Formue-kolonnen viser samme tal.
    expect(within(rows[1]!).getAllByText('1.960.000')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /beregn/i })).toBeNull()
  })

  it('giver kun indtægtsposten en skattebehandling, og siger at lønnen er brutto', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          entries: [
            anExpense({ amountInRealKroner: 40_000 }),
            aSalary({ amountInRealKroner: 600_000 }),
          ],
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect(screen.queryByLabelText(/Skattebehandling/)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Løn/ }))
    expect(screen.getByLabelText(/Skattebehandling/)).toBeTruthy()

    // Bruttolønnen er ikke det tal, folk kalder deres løn — feltet må sige
    // det selv, jf. ADR-0007.
    expect(screen.getByText(/brutto inklusive arbejdsgiverbidrag/i)).toBeTruthy()
  })

  it('gør en udgiftspost til en indtægtspost, og skattebehandlingen følger med', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    await user.selectOptions(screen.getByLabelText(/Retning/), 'Indtægt')

    const behandling = screen.getByLabelText(/Skattebehandling/) as HTMLSelectElement
    expect(behandling.value).toBe('Arbejdsindkomst')
  })

  it('sætter kommuneskat og kirkeskat i planafsnittet, og årstabellen følger med', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          birthYear: 1973,
          horizon: 55,
          inflationAssumption: 0,
          entries: [aSalary({ amountInRealKroner: 600_000 })],
        })}
      />,
    )
    await showYearTable(user)

    const skat = () =>
      within(within(screen.getByRole('table')).getAllByRole('row')[1]!)
        .getAllByRole('cell')[4]!.textContent

    expect(skat()).toBe('-220.592')

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))
    const kommune = screen.getByLabelText(/Kommuneskat/)
    await user.clear(kommune)
    await user.type(kommune, '20')

    // 431.500 kr. i skattepligtig indkomst efter personfradrag, nu til 20 %
    // frem for 25,40 %.
    expect(skat()).toBe('-197.291')

    await user.click(screen.getByLabelText(/Betaler kirkeskat/))
    expect(skat()).toBe('-194.098')
  })

  it('møder brugeren med en skattekolonne, der ikke længere er nul', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={defaultPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const skat = within(rows[1]!).getAllByRole('cell')[4]!.textContent

    expect(skat).not.toBe('0')
    expect(Number(skat!.replace(/\D/g, ''))).toBeGreaterThan(0)
  })

  it('viser nettoafkastet udledt af bruttoafkast og ÅOP i beholdningens inspektør', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({ grossReturn: 0.07, annualCostRate: 0.005 })}
      />,
    )

    await user.click(navigatorButton(/Frie midler/))

    expect((screen.getByLabelText(/Bruttoafkast/) as HTMLInputElement).value).toBe('7')
    expect((screen.getByLabelText(/ÅOP/) as HTMLInputElement).value).toBe('0.5')
    expect(screen.getByText('6,50 %')).toBeTruthy()
  })

  it('opdaterer nettoafkastet, når bruttoafkastet rettes i skuffen', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({ grossReturn: 0.07, annualCostRate: 0.005 })}
      />,
    )

    await user.click(navigatorButton(/Frie midler/))
    const bruttoafkast = screen.getByLabelText(/Bruttoafkast/)
    await user.clear(bruttoafkast)
    await user.type(bruttoafkast, '10')

    expect(screen.getByText('9,50 %')).toBeTruthy()
  })

  it('lader en beholdnings variant vælges mellem Aktieindkomst og Kapitalindkomst', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(navigatorButton(/Frie midler/))
    const variant = screen.getByLabelText(/Variant/) as HTMLSelectElement

    // Fixturens beholdning er CapitalIncome, og etape 1 tilbyder kun de to
    // lovlige varianter — ingen af de tre, der først findes i senere etaper.
    expect(variant.value).toBe('Kapitalindkomst')
    expect(
      Array.from(variant.options).map((option) => option.value),
    ).toEqual(['Aktieindkomst', 'Kapitalindkomst'])

    await user.selectOptions(variant, 'Aktieindkomst')
    expect(variant.value).toBe('Aktieindkomst')
  })

  it('lader en posts forfald vælges som jævnt fordelt eller en bestemt måned', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    const forfald = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(forfald.value).toBe('Jævnt fordelt')

    await user.selectOptions(forfald, 'Juni')
    expect(forfald.value).toBe('Juni')
  })

  it('viser Gentagelse som det første felt i Perioden, både for poster og overførsler', async () => {
    const user = userEvent.setup()

    const entryRender = render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )
    await user.click(entryRender.getByRole('button', { name: /Faste udgifter/ }))
    expect(firstPeriodenFelt(entryRender.container)).toBe('Gentagelse')
    entryRender.unmount()

    const transferRender = render(
      <App
        initialPlan={{
          ...aPlanWithSecondHolding(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )
    await user.click(
      transferRender.getByRole('button', { name: /Frie midler.*Anden beholdning/ }),
    )
    expect(firstPeriodenFelt(transferRender.container)).toBe('Gentagelse')
  })

  it('lader forankringen vælges, og periodefelterne skifter mellem årstal og aldre', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect(screen.getByLabelText(/Fra \(år\)/)).toBeTruthy()
    expect(screen.queryByLabelText(/Fra \(alder\)/)).toBeNull()

    await user.selectOptions(screen.getByLabelText(/Forankring/), 'Alder')

    expect(screen.queryByLabelText(/Fra \(år\)/)).toBeNull()
    expect(screen.getByLabelText(/Fra \(alder\)/)).toBeTruthy()
  })

  it('spørger kun om N, når gentagelsen er "Hvert N. år"', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect(screen.queryByLabelText(/Hvert/)).toBeNull()

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Hvert N. år')
    expect(screen.getByLabelText(/Hvert/)).toBeTruthy()

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Én gang')
    expect(screen.queryByLabelText(/Hvert/)).toBeNull()
  })

  it('samler en engangsposts periode til ét årsfelt og fjerner "Jævnt fordelt" fra forfald', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          entries: [anExpense({ amountInRealKroner: 40_000, timing: 'Even' })],
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect(screen.getByLabelText(/Fra \(år\)/)).toBeTruthy()
    const forfaldFoer = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(
      Array.from(forfaldFoer.options).map((option) => option.value),
    ).toContain('Jævnt fordelt')

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Én gang')

    // Fra/Til er blevet til ét samlet årsfelt.
    expect(screen.queryByLabelText(/Fra \(år\)/)).toBeNull()
    expect(screen.queryByLabelText(/Til \(år\)/)).toBeNull()
    const aar = screen.getByLabelText('År') as HTMLInputElement
    expect(aar.value).toBe('2026')

    // "Jævnt fordelt" er ikke længere et gyldigt valg, og forfaldet er
    // rettet til et bestemt tidspunkt i stedet.
    const forfald = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(
      Array.from(forfald.options).map((option) => option.value),
    ).not.toContain('Jævnt fordelt')
    expect(forfald.value).toBe('Januar')
  })

  it('lader postens reguleringssats redigeres uafhængigt af planens inflation', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          inflationAssumption: 0.02,
          entries: [anExpense({ amountInRealKroner: 40_000, regulationRate: 0.03 })],
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    const regulering = screen.getByLabelText(/Reguleringssats/) as HTMLInputElement
    expect(regulering.value).toBe('3')

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))
    expect((screen.getByLabelText(/Inflation/) as HTMLInputElement).value).toBe('2')

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    await user.clear(screen.getByLabelText(/Reguleringssats/))
    await user.type(screen.getByLabelText(/Reguleringssats/), '5')
    expect((screen.getByLabelText(/Reguleringssats/) as HTMLInputElement).value).toBe('5')

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))
    expect((screen.getByLabelText(/Inflation/) as HTMLInputElement).value).toBe('2')
  })

  it('viser en aldersforankret periode som de årstal, den faktisk falder i', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          birthYear: 1973,
          entries: [
            anExpense({
              amountInRealKroner: 40_000,
              period: { anchor: 'PersonAge', from: 70, to: 80 },
            }),
          ],
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))

    // Født 1973: alder 70 falder i 2043, alder 80 i 2053.
    expect(screen.getByText('2043–2053')).toBeTruthy()
  })

  it('lader et periodeendepunkt sættes til erhvervsophør via afkrydsningsfeltet', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          birthYear: 1973,
          workEndAge: 60,
          entries: [anExpense({ amountInRealKroner: 40_000 })],
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    await user.selectOptions(screen.getByLabelText(/Forankring/), 'Alder')

    const til = screen.getByLabelText(/Til \(alder\)/) as HTMLInputElement
    // "Fra" og "Til" har hver sit afkrydsningsfelt — "Til" er det andet.
    const [, tilErhvervsophoer] = screen.getAllByRole('checkbox', {
      name: /erhvervsophør/i,
    })
    await user.click(tilErhvervsophoer!)

    expect(til.disabled).toBe(true)
    // Født 1973, erhvervsophør 60 falder i 2033.
    expect(screen.getByText('til 2033')).toBeTruthy()
  })

  it('tilføjer person nummer to via husstandsgruppen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    // Navigatorens gruppehoved for Husstanden viser også personnavnene i sit
    // resumé, så rækken findes med et anker i starten af navnet — ellers
    // rammer forespørgslen begge knapper.
    expect(screen.queryByRole('button', { name: /^Person 2/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: '+ Person' }))

    expect(screen.getByRole('button', { name: /^Person 2/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ Person' })).toBeNull()
  })

  it('fjerner person nummer to igen fra dennes inspektør', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: '+ Person' }))
    await user.click(screen.getByRole('button', { name: /^Person 2/ }))
    await user.click(screen.getByRole('button', { name: /Fjern person/ }))

    expect(screen.queryByRole('button', { name: /^Person 2/ })).toBeNull()
    expect(screen.getByRole('button', { name: '+ Person' })).toBeTruthy()
    // Skuffen lukker, fordi den viste person ikke findes mere.
    expect(screen.queryByLabelText(/Fjern person/)).toBeNull()
  })

  it('kan ikke fjerne den sidste person i husstanden', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: /^Jesper/ }))
    expect(screen.queryByRole('button', { name: /Fjern person/ })).toBeNull()
  })

  it('flytter en beholdning til en anden ejer via ejer-vælgeren', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: '+ Person' }))
    await user.click(navigatorButton(/Frie midler/))

    const ejer = screen.getByLabelText(/Ejer/) as HTMLSelectElement
    expect(ejer.value).toBe('Jesper')
    expect(Array.from(ejer.options).map((option) => option.value)).toEqual([
      'Jesper',
      'Person 2',
    ])

    await user.selectOptions(ejer, 'Person 2')

    expect(ejer.value).toBe('Person 2')
    // Beholdningen er flyttet, ikke duplikeret.
    const beholdninger = screen.getByRole('button', { name: /Beholdninger/ })
    expect(within(beholdninger).getByText('1')).toBeTruthy()
  })

  it('flytter en post til en anden ejer via ejer-vælgeren', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: '+ Person' }))
    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))

    const ejer = screen.getByLabelText(/Ejer/) as HTMLSelectElement
    expect(ejer.value).toBe('Jesper')
    expect(Array.from(ejer.options).map((option) => option.value)).toEqual([
      'Jesper',
      'Person 2',
    ])

    await user.selectOptions(ejer, 'Person 2')
    expect(ejer.value).toBe('Person 2')
  })

  it('viser folkepensionsalderen udledt af fødselsdatoen, og markerer et skøn som sådan', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ birthYear: 1985, birthMonth: 6 })} />)

    await user.click(screen.getByRole('button', { name: /^Jesper/ }))

    expect(screen.getByText('72,5 år')).toBeTruthy()
    expect(screen.getByText(/skøn/i)).toBeTruthy()
    expect(screen.queryByLabelText(/Overstyret folkepensionsalder/)).toBeNull()
  })

  it('lader folkepensionsalderen overstyres, synligt adskilt fra den udledte', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ birthYear: 1973, birthMonth: 6 })} />)

    await user.click(screen.getByRole('button', { name: /^Jesper/ }))
    expect(screen.getByText('70 år')).toBeTruthy()

    await user.click(screen.getByLabelText(/Overstyr folkepensionsalderen/))
    const override = screen.getByLabelText(/Overstyret folkepensionsalder/) as HTMLInputElement
    await user.clear(override)
    await user.type(override, '72')

    expect(override.value).toBe('72')
    // Den udledte værdi står stadig, adskilt fra overstyringen.
    expect(screen.getByText('70 år')).toBeTruthy()
  })

  it('viser hver persons alder i årstabellen, én kolonne pr. person', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    const alder = headers.indexOf('Jesper')

    // Startår 2026, født 1973.
    expect(within(rows[1]!).getAllByRole('cell')[alder]!.textContent).toBe('53')
    expect(within(rows[3]!).getAllByRole('cell')[alder]!.textContent).toBe('55')
  })

  it('får en ekstra alderskolonne, når husstanden får person nummer to', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    await user.click(screen.getByRole('button', { name: '+ Person' }))

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)

    expect(headers).toContain('Jesper')
    expect(headers).toContain('Person 2')
  })

  it('deler posterne i Indtægter og Udgifter i navigatoren', () => {
    render(
      <App
        initialPlan={aPlan({
          entries: [
            anExpense({ amountInRealKroner: 360_000 }),
            aSalary({ amountInRealKroner: 600_000 }),
          ],
        })}
      />,
    )

    const indtaegter = screen.getByRole('button', { name: /Indtægter/ })
    const udgifter = screen.getByRole('button', { name: /Udgifter/ })

    // Grupperne viser kun deres antal — ikke en sum, der ville blive
    // misvisende af poster med begrænset periode eller gentagelse. De
    // nøjagtige tal står i årstabellen i stedet.
    expect(within(indtaegter).getByText('1')).toBeTruthy()
    expect(within(udgifter).getByText('1')).toBeTruthy()

    expect(screen.getByRole('button', { name: /Faste udgifter/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Løn/ })).toBeTruthy()
  })

  it('viser overførsler som sin egen gruppe i navigatoren, med fra- og til-navn i rækken', () => {
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    const gruppe = screen.getByRole('button', { name: /Overførsler/ })
    expect(within(gruppe).getByText('1')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }),
    ).toBeTruthy()
  })

  it('redigerer en overførsels fra-beholdning, beløb og forfald i skuffen', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Frie midler')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect((screen.getByLabelText(/Beløb/) as HTMLInputElement).value).toBe('50000')

    const beloeb = screen.getByLabelText(/Beløb/)
    await user.clear(beloeb)
    await user.type(beloeb, '75000')

    await user.click(screen.getByRole('button', { name: /Luk inspektøren/ }))
    expect(
      screen.getByRole('button', { name: /Frie midler.*Anden beholdning.*75.000/ }),
    ).toBeTruthy()
  })

  it('mærker en ufuldstændig og en uholdbar buffer forskelligt i årstabellen', async () => {
    const base = aPlanWithSecondHolding()
    const plan: Plan = {
      ...base,
      entries: [anExpense({ amountInRealKroner: 40_000 })],
      household: {
        persons: [
          {
            ...base.household.persons[0]!,
            holdings: [
              // Bufferen tømmes med det samme; ingen renter forstyrrer.
              { ...base.household.persons[0]!.holdings[0]!, balance: 0 },
              // Rigelig likviditet andetsteds — men ingen overførsel henter den.
              { ...base.household.persons[0]!.holdings[1]!, balance: 500_000 },
            ],
          },
        ],
      },
    }
    const user = userEvent.setup()
    render(<App initialPlan={plan} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const ufuldstaendigRow = rows[1]!
    expect(within(ufuldstaendigRow).getByText('Ufuldstændig')).toBeTruthy()
    expect(ufuldstaendigRow.className).toContain('ufuldstaendig')

    // Anden beholdning tømmes efter to år, hvorefter der intet er at hente.
    const uholdbarRow = rows.at(-1)!
    expect(within(uholdbarRow).getByText('Uholdbar')).toBeTruthy()
    expect(uholdbarRow.className).toContain('uholdbar')
  })

  it('tilføjer en beholdning via beholdningsgruppen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    expect(screen.queryByRole('button', { name: /^Beholdning 2/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: '+ Beholdning' }))

    expect(navigatorButton(/^Beholdning 2/)).toBeTruthy()
    const beholdninger = screen.getByRole('button', { name: /Beholdninger/ })
    expect(within(beholdninger).getByText('2')).toBeTruthy()
  })

  it('tilføjer en indtægt og en udgift via deres grupper', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: '+ Indtægt' }))
    expect(navigatorButton(/^Indtægt 1/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '+ Udgift' }))
    expect(navigatorButton(/^Udgift 1/)).toBeTruthy()
  })

  it('lader "+ Beholdning" gøre "+ Overførsel" muligt, når husstanden kun havde én beholdning', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    expect(screen.queryByRole('button', { name: '+ Overførsel' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '+ Beholdning' }))

    expect(screen.getByRole('button', { name: '+ Overførsel' })).toBeTruthy()
  })

  it('samler en engangsoverførsels periode til ét årsfelt og fjerner "Jævnt fordelt" fra forfald', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          startYear: 2026,
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))
    expect(screen.getByLabelText(/Fra \(år\)/)).toBeTruthy()

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Én gang')

    expect(screen.queryByLabelText(/Fra \(år\)/)).toBeNull()
    expect(screen.queryByLabelText(/Til \(år\)/)).toBeNull()
    expect((screen.getByLabelText('År') as HTMLInputElement).value).toBe('2026')

    const forfald = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(
      Array.from(forfald.options).map((option) => option.value),
    ).not.toContain('Jævnt fordelt')
  })

  it('udelukker den valgte fra-beholdning fra til-vælgeren og omvendt', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlanWithThreeHoldings(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))

    const fra = screen.getByLabelText('Fra') as HTMLSelectElement
    const til = screen.getByLabelText('Til') as HTMLSelectElement

    // "Til" kan ikke vælges til det samme som "Fra" — og omvendt.
    expect(Array.from(fra.options).map((o) => o.value)).not.toContain('Anden beholdning')
    expect(Array.from(til.options).map((o) => o.value)).not.toContain('Frie midler')
    // Men det tredje valg er stadig muligt i begge.
    expect(Array.from(fra.options).map((o) => o.value)).toContain('Tredje beholdning')
    expect(Array.from(til.options).map((o) => o.value)).toContain('Tredje beholdning')

    await user.selectOptions(til, 'Tredje beholdning')
    expect(Array.from(fra.options).map((o) => o.value)).not.toContain('Tredje beholdning')
    expect(Array.from(fra.options).map((o) => o.value)).toContain('Anden beholdning')
  })

  it('tilføjer en overførsel via overførselsgruppen, og dens inspektør kan åbnes', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(screen.getByRole('button', { name: '+ Overførsel' }))

    const raekke = screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ })
    expect(raekke).toBeTruthy()

    await user.click(raekke)
    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Frie midler')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Anden beholdning')
  })

  it('skjuler "+ Overførsel", når husstanden kun har én beholdning', () => {
    render(<App initialPlan={aPlan()} />)

    expect(screen.queryByRole('button', { name: '+ Overførsel' })).toBeNull()
  })

  it('viser en forklarende besked frem for en tom tabel, når bufferpegeren ikke rammer en beholdning', () => {
    render(<App initialPlan={{ ...aPlan(), buffer: 'findes-ikke' }} />)

    expect(screen.getByText(/kan ikke simuleres/i)).toBeTruthy()
    expect(screen.getByText(/findes-ikke/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('slår årstabellen om til løbende priser, uden at røre inputfeltet i skuffen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    expect(screen.getByRole('button', { name: 'Dagens kroner', pressed: true })).toBeTruthy()
    const udgifter2028 = () =>
      within(within(screen.getByRole('table')).getAllByRole('row')[3]!).getAllByRole('cell')[5]!
        .textContent
    expect(udgifter2028()).toBe('-40.000')

    await user.click(screen.getByRole('button', { name: 'Løbende priser' }))

    expect(screen.getByRole('button', { name: 'Løbende priser', pressed: true })).toBeTruthy()
    // 40.000 kr. fremskrevet to år med 2 % — planens inflation, som posten
    // her følger 1:1.
    expect(udgifter2028()).toBe('-41.616')

    // Inputfeltet i skuffen er og bliver i dagens kroner, jf. issue #12.
    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect((screen.getByLabelText(/Beløb/) as HTMLInputElement).value).toBe('40000')
  })

  it('viser Formuen som standardfane, og skifter til Årstabellen ved klik', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    expect(screen.getByRole('button', { name: 'Formuen', pressed: true })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Formuegraf' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Årstabellen' }))

    expect(screen.getByRole('button', { name: 'Årstabellen', pressed: true })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Formuegraf' })).toBeNull()
  })

  it('åbner inspektøren for beholdningen, når der klikkes på grafens legend', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(<App initialPlan={plan} />)

    // "Anden beholdning" findes både i navigatoren og i grafens legend —
    // afgrænset til grafen, som er den, testen handler om.
    const graf = screen.getByRole('img', { name: 'Formuegraf' }).closest('.formuegraf')!
    await user.click(within(graf as HTMLElement).getByRole('button', { name: 'Anden beholdning' }))

    const skuffe = screen.getByRole('complementary', { name: 'Inspektør' })
    expect(within(skuffe).getByText('Anden beholdning')).toBeTruthy()

    // Den valgte beholdnings bånd holder fuld styrke, mens den anden dæmpes.
    const andenBaand = graf.querySelector('path[data-holding="anden-beholdning"]')!
    const bufferBaand = graf.querySelector('path[data-holding="free-assets"]')!
    expect(andenBaand.getAttribute('fill-opacity')).toBe('1')
    expect(bufferBaand.getAttribute('fill-opacity')).toBe('0.28')
  })

  it('lukker inspektøren igen, når der klikkes på den samme legend en gang til', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(<App initialPlan={plan} />)

    const graf = screen.getByRole('img', { name: 'Formuegraf' }).closest('.formuegraf')!
    const legendKnap = within(graf as HTMLElement).getByRole('button', { name: 'Anden beholdning' })

    await user.click(legendKnap)
    expect(screen.getByRole('complementary', { name: 'Inspektør' })).toBeTruthy()

    await user.click(legendKnap)
    expect(screen.queryByRole('complementary', { name: 'Inspektør' })).toBeNull()

    // Med intet valgt skal alle bånd stå med samme styrke igen.
    const andenBaand = graf.querySelector('path[data-holding="anden-beholdning"]')!
    const bufferBaand = graf.querySelector('path[data-holding="free-assets"]')!
    expect(andenBaand.getAttribute('fill-opacity')).toBe('1')
    expect(bufferBaand.getAttribute('fill-opacity')).toBe('1')
  })
})
