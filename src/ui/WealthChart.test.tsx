import { act, fireEvent, render, screen } from '@testing-library/react'
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
    hente den — ufuldstændig først, uholdbar når pengene er brugt.

    Horisonten stopper året før folkepensionsalderen. Folkepensionen kommer af
    sig selv og ville ellers gøre underskuddet indhenteligt igen, så planen
    knækkede tre gange frem for to — og det er de to, testen handler om. */
function aPlanWithBufferFault(): Plan {
  const base = aPlan({
    horizon: 69,
    holdings: aPlanWithSecondHolding().household.persons[0]!.holdings.slice(1),
  })
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

  it('gør ikke længere legenden klikbar — den navngiver kun farverne', () => {
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    render(<WealthChart years={years} plan={plan} unit="Real" />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('viser legend selv med kun én beholdning — grafens egen titel navngiver ikke beholdningen', () => {
    const plan = aPlan()
    const years = simulate(plan)
    render(<WealthChart years={years} plan={plan} unit="Real" />)

    expect(screen.getByText('Frie midler')).toBeTruthy()
  })

  it('ændrer stablingens geometri, når kronetypen skifter til fremtidskroner', () => {
    // Voksende saldo (afkast over inflationen), så fremtidskroner og
    // nutidskroner reelt tegner to forskellige grafer — ikke kun samme tal to
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

  it('navngiver aksernes enheder, så tallene ikke skal gættes', () => {
    const plan = aPlan({ balance: 1_000_000 })
    const years = simulate(plan)
    render(<WealthChart years={years} plan={plan} unit="Real" />)

    // Mærkaterne står i millioner, og enheden skal sige det samme.
    expect(screen.getByText('mio. kr.')).toBeTruthy()
    expect(screen.getByText('år')).toBeTruthy()
  })

  it('skriver y-aksens enhed i hele kroner, når formuen er under en million', () => {
    // Horisonten stopper året før folkepensionsalderen: folkepensionen kommer
    // af sig selv og ville lægge formuen over en million, som er netop det
    // skel, testen handler om.
    const plan = aPlan({ balance: 400_000, horizon: 69 })
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

    const maerkater = Array.from(container.querySelectorAll('svg .graf-akse-y text'))
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

  it('åbner forklar-året ved klik i et års kolonne, jf. Overskuddet og Fordelingen', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const onSelectYear = vi.fn()
    const { container } = render(
      <WealthChart years={years} plan={plan} unit="Real" onSelectYear={onSelectYear} />,
    )

    // Hele årets klikfelt er klikbart og ikke kun båndene selv — et tyndt
    // bånd tæt på nul har næsten ingen stabling at ramme.
    await user.click(container.querySelectorAll('svg .aarsfelt')[0]!)
    expect(onSelectYear).toHaveBeenCalledWith(years[0]!.year)
  })

  it('klikker ikke i mini-tilstand, hvor grafen bytter sig frem i stedet', () => {
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const onSelectYear = vi.fn()
    const { container } = render(
      <WealthChart years={years} plan={plan} unit="Real" onSelectYear={onSelectYear} mode="mini" />,
    )

    expect(container.querySelectorAll('svg .aarsfelt')).toHaveLength(0)
  })

  it('måler sin egen plads og tegner om, når containeren skifter størrelse', () => {
    const plan = aPlan()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const plot = container.querySelector('.graf-plot')!
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

    const plot = container.querySelector('.graf-plot')!
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
          payoutAge: 67,
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
    expect(lag.map((el) => el.getAttribute('data-pension-scheme'))).toEqual([
      'false',
      'false',
      'true',
    ])

    // Kun det bundne bånd bærer skraveringen, og den ligger oven på
    // beholdningens egen farve frem for at erstatte den.
    const skraverede = Array.from(container.querySelectorAll('svg [data-hatch]'))
    expect(skraverede.map((el) => el.getAttribute('data-hatch'))).toEqual(['ratepension'])
    const ratepension = lag[2]!
    expect(skraverede[0]!.getAttribute('d')).toBe(ratepension.getAttribute('d'))
    expect(ratepension.getAttribute('fill')).not.toBe(skraverede[0]!.getAttribute('fill'))
  })

  it('skraverer ikke aktiesparekontoen, selvom den ikke er frie midler', () => {
    // Aktiesparekontoen har et indskudsloft og er derfor ikke `FreeAssets`,
    // men den har ingen `PayoutAge` — ejeren hæver af den, når hun vil. Det
    // er `isPensionScheme`, der afgør skraveringen, ikke `isFreeAssets`, så
    // kontoen skal stå uskraveret ligesom de frie midler.
    const plan = aPlan({
      balance: 1_000_000,
      holdings: [
        {
          id: 'aktiesparekonto',
          name: 'Aktiesparekonto',
          variant: 'ShareSavingsAccount',
          balance: 300_000,
          grossReturn: 0,
          annualCostRate: 0,
        },
      ],
    })
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const skraverede = Array.from(container.querySelectorAll('svg [data-hatch]'))
    expect(skraverede).toHaveLength(0)
  })

  it('tegner ingen akse og ingen legend i mini-tilstand, jf. ADR-0033 — kun formen', () => {
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const { container } = render(
      <WealthChart years={years} plan={plan} unit="Real" mode="mini" />,
    )

    expect(container.querySelectorAll('.graf-akse-y, .graf-akse-x')).toHaveLength(0)
    expect(container.querySelector('.graf-legend')).toBeNull()
    expect(screen.queryByText('Frie midler')).toBeNull()

    // Formen — begge beholdningers bånd — står der stadig.
    expect(container.querySelectorAll('svg [data-holding]')).toHaveLength(2)
  })

  it('tegner en lodret stiplet markør ved det år, musen er over', () => {
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    expect(container.querySelector('.aarsmarkoer')).toBeNull()

    const felter = container.querySelectorAll('svg .aarsfelt')
    fireEvent.mouseEnter(felter[2]!)

    const markoer = container.querySelector('.aarsmarkoer')!
    expect(markoer).toBeTruthy()
    expect(markoer.getAttribute('x1')).toBe(markoer.getAttribute('x2'))
  })

  it('flytter markøren, når musen glider til et andet år, og fjerner den, når musen forlader plottet', () => {
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    const felter = container.querySelectorAll('svg .aarsfelt')
    fireEvent.mouseEnter(felter[0]!)
    const xVedFoerste = container.querySelector('.aarsmarkoer')!.getAttribute('x1')

    fireEvent.mouseEnter(felter[felter.length - 1]!)
    const xVedSidste = container.querySelector('.aarsmarkoer')!.getAttribute('x1')
    expect(xVedSidste).not.toBe(xVedFoerste)

    const plot = container.querySelector('.aarssoejler')!.parentElement!
    fireEvent.mouseLeave(plot)
    expect(container.querySelector('.aarsmarkoer')).toBeNull()
  })

  it('viser et dataglimt med beløb pr. beholdning i legendens rækkefølge, afsluttet med en sum-linje', () => {
    const plan = aPlanWithSecondHolding()
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" />)

    expect(container.querySelector('.dataglimt')).toBeNull()

    const felter = container.querySelectorAll('svg .aarsfelt')
    fireEvent.mouseEnter(felter[0]!)

    const raekker = Array.from(container.querySelectorAll('.dataglimt .dataglimt-raekke'))
    expect(raekker).toHaveLength(3)
    expect(raekker[0]!.textContent).toContain('Frie midler')
    expect(raekker[0]!.textContent).toContain('1.000.000')
    expect(raekker[1]!.textContent).toContain('Anden beholdning')
    expect(raekker[1]!.textContent).toContain('500.000')
    expect(raekker[2]!.textContent).toContain('1.500.000')

    const plot = container.querySelector('.aarssoejler')!.parentElement!
    fireEvent.mouseLeave(plot)
    expect(container.querySelector('.dataglimt')).toBeNull()
  })

  it('viser en beholdning på 0 kr. i dataglimtet i stedet for at udelade den', () => {
    // Bufferen tømmes med det samme, mens den anden beholdning står urørt —
    // dataglimtet skal stadig navngive bufferen med et 0-beløb.
    const plan = aPlanWithSecondHolding()
    const tom = {
      ...plan,
      household: {
        persons: [
          {
            ...plan.household.persons[0]!,
            holdings: [
              { ...plan.household.persons[0]!.holdings[0]!, balance: 0 },
              plan.household.persons[0]!.holdings[1]!,
            ],
          },
        ],
      },
    }
    const years = simulate(tom)
    const { container } = render(<WealthChart years={years} plan={tom} unit="Real" />)

    fireEvent.mouseEnter(container.querySelectorAll('svg .aarsfelt')[0]!)

    const raekker = Array.from(container.querySelectorAll('.dataglimt .dataglimt-raekke'))
    expect(raekker).toHaveLength(3)
    expect(raekker[0]!.textContent).toContain('Frie midler')
    expect(raekker[0]!.textContent).toContain('0 kr.')
  })

  it('følger dataglimtets beløb den valgte kronetype', () => {
    const plan = aPlan({ inflationAssumption: 0.02, grossReturn: 0.05 })
    const years = simulate(plan)

    const real = render(<WealthChart years={years} plan={plan} unit="Real" />)
    fireEvent.mouseEnter(real.container.querySelectorAll('svg .aarsfelt')[5]!)
    const vaerdiReal = real.container.querySelector('.dataglimt-raekke')!.textContent
    real.unmount()

    const nominal = render(<WealthChart years={years} plan={plan} unit="Nominal" />)
    fireEvent.mouseEnter(nominal.container.querySelectorAll('svg .aarsfelt')[5]!)
    const vaerdiNominal = nominal.container.querySelector('.dataglimt-raekke')!.textContent

    expect(vaerdiReal).not.toBe(vaerdiNominal)
  })

  it('lader mini-grafen fylde det meste af sin egen plads ud, uden en akses margen', () => {
    const plan = aPlan({ balance: 1_000_000 })
    const years = simulate(plan)
    const { container } = render(<WealthChart years={years} plan={plan} unit="Real" mode="mini" />)

    // Ingen mærkater at måle margenen på, så det stablede areal starter
    // næsten helt ude ved venstre kant — ikke ved hovedgrafens 58 px.
    const path = container.querySelector('path[data-holding]')!
    const forsteX = Number(path.getAttribute('d')!.match(/M([\d.]+)/)![1])
    expect(forsteX).toBeLessThan(20)
  })
})

