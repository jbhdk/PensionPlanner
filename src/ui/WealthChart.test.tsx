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
  return aPlan({
    holdings: [
      {
        id: 'anden-beholdning',
        name: 'Anden beholdning',
        variant: 'SavingsAccount',
        balance: 500_000,
        grossReturn: 0,
        annualCostRate: 0,
      },
    ],
  })
}

/** En plan, der knækker begge veje: bufferen er tom fra første år, mens der
    står rigelig likviditet på den anden beholdning uden en overførsel til at
    hente den — ufuldstændig først, uholdbar når pengene er brugt. */
function aPlanWithBufferFault(): Plan {
  const base = aPlanWithSecondHolding()
  return {
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
    const plan = aPlanWithBufferFault()
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
    // pæne trin derfra. Millionbeløb skrives i millioner, så mærkatet kan
    // være i margenen.
    expect(screen.getByText('0,0 mio.')).toBeTruthy()
    expect(screen.getByText('1,0 mio.')).toBeTruthy()

    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('2063')).toBeTruthy()
  })

  it('tegner markeringen foran båndene, og uden en flade over dataene', () => {
    const plan = aPlanWithBufferFault()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    // En tonet flade bag stablingen forsvinder præcis, når stablingen er høj
    // — og høj er den netop, når planen er ufuldstændig.
    const alle = Array.from(container.querySelectorAll('svg *'))
    const sidsteBaand = alle.reduce((sidste, el, i) => (el.hasAttribute('data-holding') ? i : sidste), -1)
    const foersteMarkering = alle.findIndex((el) => el.hasAttribute('data-buffer-state'))
    expect(sidsteBaand).toBeGreaterThan(-1)
    expect(foersteMarkering).toBeGreaterThan(sidsteBaand)

    // Foran båndene må markeringen ikke lægge farve på dataene: den har to
    // kanter og mærkatets plade, og intet felt hen over stablingen.
    const markering = container.querySelector('[data-buffer-state]')!
    expect(markering.querySelectorAll('line')).toHaveLength(2)
    const rects = Array.from(markering.querySelectorAll('rect'))
    expect(rects).toHaveLength(1)
    expect(rects[0]!.getAttribute('height')).toBe('14')
  })

  it('dæmper båndene inde i spændet i stedet for at tone dem røde', () => {
    const plan = aPlanWithBufferFault()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const spaend = container.querySelectorAll('svg g[clip-path]')
    expect(spaend.length).toBeGreaterThan(0)

    // Hvert spænd tegner begge beholdningers bånd om gennem dæmpningsfilteret.
    expect(container.querySelectorAll('[data-buffer-dimmed]')).toHaveLength(spaend.length * 2)
    for (const gruppe of container.querySelectorAll('svg g[filter]')) {
      expect(gruppe.getAttribute('filter')).toBe('url(#bufferstate-daempning)')
    }
  })

  it('lader begge dæmpninger gælde: spændet tager mætningen, valget dækningen', () => {
    const plan = aPlanWithBufferFault()
    const years = simulate(plan)
    const { container } = render(
      <WealthChart
        years={years}
        plan={plan}
        unit="Real"
        selected={{ kind: 'holding', id: 'anden-beholdning' }}
      />,
    )

    const valgt = container.querySelector('[data-buffer-dimmed="anden-beholdning"]')!
    const fravalgt = container.querySelector('[data-buffer-dimmed="free-assets"]')!
    expect(valgt.getAttribute('fill-opacity')).toBe('1')
    expect(fravalgt.getAttribute('fill-opacity')).toBe('0.28')

    // Det fravalgte bånd slukkes mod fladen først — ellers ville dets mættede
    // farve skinne igennem den halvgennemsigtige, dæmpede kopi.
    const slukning = container.querySelectorAll('svg g[clip-path] > path[fill="var(--flade)"]')
    expect(slukning.length).toBe(container.querySelectorAll('svg g[clip-path]').length)
  })

  it('navngiver aksernes enheder, så tallene ikke skal gættes', () => {
    const plan = aPlan({ balance: 1_000_000 })
    const years = simulate(plan)
    render(<WealthChart years={years} plan={plan} unit="Real" />)

    // Mærkaterne står i millioner, og enheden skal sige det samme.
    expect(screen.getByText('mio. kr.')).toBeTruthy()
    expect(screen.getByText('år')).toBeTruthy()
  })

  it('skriver y-aksens enhed i hele kroner, når formuen er under en million', () => {
    const plan = aPlan({ balance: 400_000 })
    const years = simulate(plan)
    render(<WealthChart years={years} plan={plan} unit="Real" />)

    expect(screen.getByText('kr.')).toBeTruthy()
    expect(screen.getByText('400.000')).toBeTruthy()
  })

  it('giver y-aksen margen nok til det længste mærkat, så intet ciffer klippes af', () => {
    // En stor formue giver de længste mærkater ("100,0 mio."), og de skal
    // stadig stå helt inde i viewBox'en. Tegnbredden er kendt: mærkaterne
    // sættes i monospace ved 10 px, hvor hvert tegn fylder 6 px.
    const plan = aPlan({ balance: 100_000_000 })
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const maerkater = Array.from(container.querySelectorAll('svg .formuegraf-akse-y text'))
    expect(maerkater.length).toBeGreaterThan(1)
    for (const maerkat of maerkater) {
      const hoejre = Number(maerkat.getAttribute('x'))
      expect(hoejre - maerkat.textContent!.length * 6).toBeGreaterThanOrEqual(0)
    }
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

  it('stabler frie midler nederst og skraverer de bundne beholdninger over dem', () => {
    // Husstandens egen rækkefølge sætter ratepensionen mellem de to frie
    // midler. Grafen stabler alligevel de frie nederst, så stablen kan læses
    // som "hvad er til rådighed" mod "hvad er bundet" — og skraveringen gør
    // skellet synligt uden at læse legenden.
    const plan = aPlan({
      balance: 1_000_000,
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          openedOn: { year: 2018, month: 1 },
          balance: 2_000_000,
          grossReturn: 0,
          annualCostRate: 0,
        },
        {
          id: 'anden-beholdning',
          name: 'Anden beholdning',
          variant: 'SavingsAccount',
          balance: 500_000,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const lag = Array.from(container.querySelectorAll('svg [data-holding]'))
    expect(lag.map((el) => el.getAttribute('data-holding'))).toEqual([
      'free-assets',
      'anden-beholdning',
      'ratepension',
    ])
    expect(lag.map((el) => el.getAttribute('data-free-assets'))).toEqual([
      'true',
      'true',
      'false',
    ])

    // Kun det bundne bånd bærer skraveringen, og den ligger oven på
    // beholdningens egen farve frem for at erstatte den.
    const skraverede = Array.from(container.querySelectorAll('svg [data-hatch]'))
    expect(skraverede.map((el) => el.getAttribute('data-hatch'))).toEqual(['ratepension'])
    const ratepension = lag[2]!
    expect(skraverede[0]!.getAttribute('d')).toBe(ratepension.getAttribute('d'))
    expect(ratepension.getAttribute('fill')).not.toBe(skraverede[0]!.getAttribute('fill'))
  })
})

