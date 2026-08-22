import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { aPlan, aSalary, anExpense } from '../engine/testing/planFixture'
import { simulateChecked } from '../engine/testing/simulateChecked'
import { ResultGraphs } from './ResultGraphs'
import type { MainGraph } from './ResultGraphs'

/** En plan med både en indtægt og en udgift, så alle tre grafer har noget
    at vise: Fordelingens bånd og Overskuddets søjle rører sig kun, når der
    faktisk er en strøm på bufferen. */
function aResultPlan() {
  return aPlan({
    horizon: 65,
    entries: [
      aSalary({ amountInRealKroner: 600_000 }),
      anExpense({ amountInRealKroner: 300_000 }),
    ],
  })
}

/** Den kontrollerede brug, `App` selv står for: `mainGraph` er tilstand hos
    den ejende komponent, ikke i `ResultGraphs` selv. */
function Harness({
  onSelectYear = () => {},
  initialMainGraph = 'Wealth',
}: {
  onSelectYear?: (year: number) => void
  initialMainGraph?: MainGraph
}) {
  const [plan] = useState(aResultPlan)
  const years = simulateChecked(plan)
  const [mainGraph, setMainGraph] = useState<MainGraph>(initialMainGraph)

  return (
    <ResultGraphs
      years={years}
      plan={plan}
      unit="Real"
      onSelectYear={onSelectYear}
      mainGraph={mainGraph}
      onMainGraphChange={setMainGraph}
    />
  )
}

describe('ResultGraphs', () => {
  it('viser Formuen som hovedgraf, med de to andre som mini-grafer ved siden af', () => {
    render(<Harness />)

    expect(screen.getByRole('img', { name: 'Formuegraf' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Fordelingsgraf' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Overskudsgraf' })).toBeTruthy()

    // Kun hovedgrafen har en signaturforklaring.
    expect(document.querySelector('.formuegraf-legend')).toBeTruthy()
    expect(document.querySelector('.fordelingsgraf-legend')).toBeNull()
    expect(document.querySelector('.overskudsgraf-legend')).toBeNull()

    const hoved = document.querySelector('.hovedgraf-plads')!
    const minier = document.querySelector('.mini-graferne')!
    expect(hoved.querySelector('[data-mode="main"]')).toBeTruthy()
    expect(minier.querySelectorAll('[data-mode="mini"]')).toHaveLength(2)
  })

  it('bytter mini-grafen ind som hovedgraf ved klik, og lader den anden mini stå', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const fordelingKnap = document
      .querySelector('.mini-graferne')!
      .querySelector('[aria-label="Fordelingsgraf"]')!
      .closest('button')!
    await user.click(fordelingKnap)

    // Fordelingen er nu hovedgraf, med sin egen legend.
    expect(
      document.querySelector('.hovedgraf-plads [aria-label="Fordelingsgraf"]'),
    ).toBeTruthy()
    expect(document.querySelector('.fordelingsgraf-legend')).toBeTruthy()
    expect(document.querySelector('.formuegraf-legend')).toBeNull()

    // Formuen og Overskuddet står nu som de to minier — Overskuddet rørte
    // sig ikke, den stod allerede som mini.
    const minier = document.querySelector('.mini-graferne')!
    expect(minier.querySelector('[aria-label="Formuegraf"]')).toBeTruthy()
    expect(minier.querySelector('[aria-label="Overskudsgraf"]')).toBeTruthy()
  })

  it('kalder onSelectYear fra hovedgrafen, men ikke fra en mini-graf', async () => {
    const user = userEvent.setup()
    const onSelectYear = vi.fn()
    render(<Harness onSelectYear={onSelectYear} initialMainGraph="Overskud" />)

    // Overskuddet er hovedgraf: et klik på en søjle åbner forklar-året.
    await user.click(document.querySelector('.hovedgraf-plads rect.overskudssoejle')!)
    expect(onSelectYear).toHaveBeenCalled()
    onSelectYear.mockClear()

    // Fordelingen står som mini: et klik på et af dens bånd bytter den frem
    // i stedet for at åbne forklar-året.
    const fordelingKnap = document
      .querySelector('.mini-graferne')!
      .querySelector('[aria-label="Fordelingsgraf"]')!
      .closest('button')!
    await user.click(fordelingKnap.querySelector('rect[data-band]')!)
    expect(onSelectYear).not.toHaveBeenCalled()

    // Klikket bragte til gengæld Fordelingen frem som hovedgraf.
    expect(
      document.querySelector('.hovedgraf-plads [aria-label="Fordelingsgraf"]'),
    ).toBeTruthy()
  })

  it('kalder onSelectYear fra Formuens søjler, men ikke fra en mini-graf', async () => {
    const user = userEvent.setup()
    const onSelectYear = vi.fn()
    render(<Harness onSelectYear={onSelectYear} initialMainGraph="Fordeling" />)

    // Formuen står som mini: et klik på grafen bytter den frem i stedet for
    // at åbne forklar-året.
    const formueKnap = document
      .querySelector('.mini-graferne')!
      .querySelector('[aria-label="Formuegraf"]')!
      .closest('button')!
    await user.click(formueKnap)
    expect(onSelectYear).not.toHaveBeenCalled()

    // Klikket bragte Formuen frem som hovedgraf, med sin egen legend.
    expect(document.querySelector('.hovedgraf-plads [aria-label="Formuegraf"]')).toBeTruthy()
    expect(document.querySelector('.formuegraf-legend')).toBeTruthy()

    // Nu er Formuen hovedgraf: et klik i et års kolonne åbner forklar-året.
    await user.click(document.querySelector('.hovedgraf-plads svg .aarsfelt')!)
    expect(onSelectYear).toHaveBeenCalled()
  })
})
