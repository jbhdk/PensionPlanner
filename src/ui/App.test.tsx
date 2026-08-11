import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { aPlan, aSalary, anExpense } from '../engine/testing/planFixture'
import { App } from './App'
import { defaultPlan } from './defaultPlan'

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
  it('viser én række i årstabellen pr. simuleringsår, i dagens kroner', () => {
    render(<App initialPlan={aThreeYearPlan()} />)

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

    await user.click(screen.getByRole('button', { name: /Frie midler/ }))
    const balance = screen.getByLabelText(/Saldo/)
    await user.clear(balance)
    await user.type(balance, '2000000')

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(within(rows[1]!).getByText('1.960.000')).toBeTruthy()
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

  it('møder brugeren med en skattekolonne, der ikke længere er nul', () => {
    render(<App initialPlan={defaultPlan()} />)

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

    await user.click(screen.getByRole('button', { name: /Frie midler/ }))

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

    await user.click(screen.getByRole('button', { name: /Frie midler/ }))
    const bruttoafkast = screen.getByLabelText(/Bruttoafkast/)
    await user.clear(bruttoafkast)
    await user.type(bruttoafkast, '10')

    expect(screen.getByText('9,50 %')).toBeTruthy()
  })

  it('lader en beholdnings variant vælges mellem Aktieindkomst og Kapitalindkomst', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: /Frie midler/ }))
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
    await user.click(screen.getByRole('button', { name: /Frie midler/ }))

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

  it('viser hver persons alder i årstabellen, én kolonne pr. person', () => {
    render(<App initialPlan={aThreeYearPlan()} />)

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
})
