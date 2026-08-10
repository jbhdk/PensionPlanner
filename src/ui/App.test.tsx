import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { anExpense, aPlan } from '../engine/testing/planFixture'
import { App } from './App'

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
})
