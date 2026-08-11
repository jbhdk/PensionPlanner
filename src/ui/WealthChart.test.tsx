import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Plan } from '../engine/plan'
import { simulate } from '../engine/simulate'
import { anExpense, aPlan } from '../engine/testing/planFixture'
import { fireResize } from './testSetup'
import { WealthChart } from './WealthChart'

/** Fixturens buffer plus én beholdning til, så grafen har mere end ét lag
    at stable. */
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
              balance: 500_000,
              grossReturn: 0,
              annualCostRate: 0,
            },
          ],
        },
      ],
    },
  }
}

describe('WealthChart', () => {
  it('tegner ét arealag pr. beholdning, med hver sin farve, og navngiver dem i en legend', () => {
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const lag = container.querySelectorAll('svg [data-holding]')
    expect(lag).toHaveLength(2)
    expect(lag[0]!.getAttribute('data-holding')).toBe('free-assets')
    expect(lag[1]!.getAttribute('data-holding')).toBe('anden-beholdning')

    const farver = new Set(Array.from(lag).map((el) => el.getAttribute('fill')))
    expect(farver.size).toBe(2)

    expect(screen.getByText('Frie midler')).toBeTruthy()
    expect(screen.getByText('Anden beholdning')).toBeTruthy()
  })

  it('viser legend selv med kun én beholdning — grafen har ingen anden titel, der navngiver den', () => {
    const plan = aPlan()
    const years = simulate(plan)
    render(<WealthChart years={years} plan={plan} unit="Real" />)

    expect(screen.getByText('Frie midler')).toBeTruthy()
  })

  it('ændrer stablingens geometri, når kronetypen skifter til løbende priser', () => {
    // Voksende saldo (afkast over inflationen), så løbende priser og dagens
    // kroner reelt tegner to forskellige grafer — ikke kun samme tal to
    // gange.
    const plan = aPlan({ inflationAssumption: 0.02, grossReturn: 0.05 })
    const years = simulate(plan)

    const real = render(<WealthChart years={years} plan={plan} unit="Real" />)
    const dReal = real.container.querySelector('path[data-holding]')!.getAttribute('d')
    real.unmount()

    const nominal = render(<WealthChart years={years} plan={plan} unit="Nominal" />)
    const dNominal = nominal.container.querySelector('path[data-holding]')!.getAttribute('d')

    expect(dReal).not.toBe(dNominal)
  })

  it('floorer en negativ buffer ved nul og markerer spændet i stedet, med ordet der skelner tilstandene', () => {
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
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    // Ingen bufferbeholdning tegnes under nul, uanset hvor negativ saldoen er.
    const bufferBand = container.querySelector('path[data-holding="free-assets"]')!
    expect(bufferBand.getAttribute('d')).not.toMatch(/-\d/)

    const ufuldstaendig = container.querySelectorAll('[data-buffer-state="Incomplete"]')
    const uholdbar = container.querySelectorAll('[data-buffer-state="Unsustainable"]')
    expect(ufuldstaendig.length).toBeGreaterThan(0)
    expect(uholdbar.length).toBeGreaterThan(0)

    expect(screen.getByText(/Ufuldstændig/)).toBeTruthy()
    expect(screen.getByText(/Uholdbar/)).toBeTruthy()
  })

  it('viser en y-akse i kr og en x-akse med startår og slutår', () => {
    // Fixturens standardværdier: startår 2026, født 1973, horisont til 90 år
    // — altså 2026–2063.
    const plan = aPlan({ balance: 1_000_000 })
    const years = simulate(plan)
    render(<WealthChart years={years} plan={plan} unit="Real" />)

    // Ingen vækst i fixturen: saldoen (og dermed toppen af stablingen) står
    // fladt på 1.000.000 hele horisonten — y-aksens gitterlinjer trappes i
    // pæne trin derfra.
    expect(screen.getByText('0')).toBeTruthy()
    expect(screen.getByText('1.000.000')).toBeTruthy()

    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('2063')).toBeTruthy()
  })

  it('ankrer det sidste årstal til højre, så det ikke klippes af viewBox-kanten', () => {
    const plan = aPlan({ balance: 1_000_000 })
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const sidsteAar = screen.getByText('2063')
    expect(sidsteAar.getAttribute('text-anchor')).toBe('end')

    // Et årstal midt i grafen har rigelig plads på begge sider og skal
    // fortsat centreres om sit gitterpunkt.
    const midtiAar = screen.getByText('2030')
    expect(midtiAar.getAttribute('text-anchor')).toBe('middle')

    const width = Number(container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2])
    expect(Number(sidsteAar.getAttribute('x'))).toBeLessThanOrEqual(width)
  })

  it('vælger beholdningen og dæmper de andre bånd, når der klikkes på legenden', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const onSelect = vi.fn()
    const { container, rerender } = render(
      <WealthChart years={years} plan={plan} unit="Real" onSelect={onSelect} />,
    )

    await user.click(screen.getByRole('button', { name: 'Anden beholdning' }))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'holding', id: 'anden-beholdning' })

    // Klikket alene ændrer ikke grafen — det er den ejende komponent, der
    // lukker løkken tilbage via `selected`, ligesom navigatorens rækker.
    rerender(
      <WealthChart
        years={years}
        plan={plan}
        unit="Real"
        selected={{ kind: 'holding', id: 'anden-beholdning' }}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByRole('button', { name: 'Anden beholdning' }).className).toContain('valgt')

    const bufferBaand = container.querySelector('path[data-holding="free-assets"]')!
    const andenBaand = container.querySelector('path[data-holding="anden-beholdning"]')!
    expect(bufferBaand.getAttribute('fill-opacity')).toBe('0.28')
    expect(andenBaand.getAttribute('fill-opacity')).toBe('1')
  })

  it('fravælger beholdningen, når der klikkes på dens allerede valgte legend, og alle bånd ender ens', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const onSelect = vi.fn()
    const { container, rerender } = render(
      <WealthChart
        years={years}
        plan={plan}
        unit="Real"
        selected={{ kind: 'holding', id: 'anden-beholdning' }}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Anden beholdning' }))
    expect(onSelect).toHaveBeenCalledWith(null)

    // Klikket alene ændrer ikke grafen — den ejende komponent lukker løkken
    // tilbage via `selected`, ligesom ved valget.
    rerender(
      <WealthChart years={years} plan={plan} unit="Real" selected={null} onSelect={onSelect} />,
    )

    const bufferBaand = container.querySelector('path[data-holding="free-assets"]')!
    const andenBaand = container.querySelector('path[data-holding="anden-beholdning"]')!
    expect(bufferBaand.getAttribute('fill-opacity')).toBe('1')
    expect(andenBaand.getAttribute('fill-opacity')).toBe('1')
  })

  it('måler sin egen plads og tegner om, når containeren skifter størrelse', () => {
    const plan = aPlan()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const plot = container.querySelector('.formuegraf-plot')!
    const svgFoer = container.querySelector('svg')!
    const hoejdeFoer = svgFoer.getAttribute('viewBox')!.split(' ')[3]

    act(() => {
      fireResize(plot, { width: 600, height: 555 })
    })

    const svgEfter = container.querySelector('svg')!
    expect(svgEfter.getAttribute('viewBox')!.split(' ')[3]).toBe('555')
    expect(svgEfter.getAttribute('viewBox')!.split(' ')[3]).not.toBe(hoejdeFoer)
  })

  it('følger den målte bredde i viewBox, så aksernes tekst ikke skaleres ned i en smal spalte', () => {
    // Smallere end den hidtidige faste bredde på 900 — resultatspalten
    // bliver netop så smal, når inspektørskuffen er åben. En viewBox, der
    // stadig påstod 900, ville tvinge SVG'en til at nedskalere hele
    // tegningen ensartet for at nå den bredde, og fontstørrelsen med den.
    const plan = aPlan()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const plot = container.querySelector('.formuegraf-plot')!
    act(() => {
      fireResize(plot, { width: 480, height: 300 })
    })

    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')!.split(' ')[2]).toBe('480')
  })
})
