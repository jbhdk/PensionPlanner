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
    entries: [anExpense({ amountInRealKroner: 40_000 })],
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
        .getAllByRole('cell')[3]!.textContent

    expect(skat()).toBe('-237.949')

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))
    const kommune = screen.getByLabelText(/Kommuneskat/)
    await user.clear(kommune)
    await user.type(kommune, '20')

    // 497.900 kr. efter personfradrag, nu til 20 % frem for 25,40 %.
    expect(skat()).toBe('-211.062')

    await user.click(screen.getByLabelText(/Betaler kirkeskat/))
    expect(skat()).toBe('-207.378')
  })

  it('møder brugeren med en skattekolonne, der ikke længere er nul', () => {
    render(<App initialPlan={defaultPlan()} />)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const skat = within(rows[1]!).getAllByRole('cell')[3]!.textContent

    expect(skat).not.toBe('0')
    expect(Number(skat!.replace(/\D/g, ''))).toBeGreaterThan(0)
  })

  it('viser posternes nettovirkning pr. år i navigatorens resumé', () => {
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

    expect(screen.getByText('240.000 kr./år')).toBeTruthy()
  })
})
