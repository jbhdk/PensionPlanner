import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Plan } from '../engine/plan'
import {
  aContribution,
  aPlan,
  aSalary,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import { simulateChecked } from '../engine/testing/simulateChecked'
import type { AmountUnit } from './real'
import { fireResize } from './testSetup'
import { CATEGORICAL_PALETTE, DEFICIT, SURPLUS } from './palette'
import { surplus } from './surplus'
import { YearTable } from './YearTable'
import { SurplusChart } from './SurplusChart'

/** En plan, der bærer sig selv hele forløbet: lønnen er rigeligt større end
    udgifterne, og horisonten slutter før erhvervsophøret, så lønnen aldrig
    når at stoppe. */
function aSurplusPlan(): Plan {
  return aPlan({
    horizon: 57,
    entries: [
      aSalary({ amountInRealKroner: 800_000 }),
      anExpense({ amountInRealKroner: 300_000 }),
    ],
  })
}

/** En plan, der holder op med at bære sig selv ved erhvervsophøret: lønnen
    stopper som 58, udgifterne bliver stående, og horisonten løber år nok
    videre til, at både raterne, folkepensionen og en overførsel når at komme
    ind — de bevægelser, der skiller `Surplus` fra det nettoresultat, det
    afløste. Beholdningerne forrenter sig, så afkastet og skatten af det
    heller ikke er nul. */
function aPlanThatTurnsNegative(): Plan {
  return aPlan({
    horizon: 80,
    balance: 400_000,
    grossReturn: 0.02,
    holdings: [
      {
        id: 'aktiedepot',
        name: 'Aktiedepot',
        variant: 'ShareDepot',
        balance: 2_000_000,
        grossReturn: 0.05,
        annualCostRate: 0.004,
      },
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        payoutAge: 67,
        balance: 1_500_000,
        grossReturn: 0.04,
        annualCostRate: 0.005,
        payout: { start: 67, duration: 15, principle: 'AnnuityPrinciple' },
      },
    ],
    entries: [
      aSalary({
        amountInRealKroner: 800_000,
        period: { anchor: 'PersonAge', to: 'WorkEndAge' },
      }),
      anExpense({ amountInRealKroner: 500_000 }),
    ],
    contributions: [
      aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.1 }),
    ],
    transfers: [
      aTransfer({ from: 'aktiedepot', to: 'free-assets', amountInRealKroner: 100_000 }),
    ],
  })
}

/** Et kronebeløb, som `kroner()` skrev det: dansk tusindtalsseparator, og et
    minustegn der ikke nødvendigvis er ASCII. */
function danskTal(tekst: string): number {
  const cifre = Number(tekst.replace(/[^\d]/g, ''))
  return /[-−]/.test(tekst) ? -cifre : cifre
}

/** Palettens hex, i den form jsdom skriver en inline farve tilbage i. */
function toRgb(hex: string): string {
  const tal = Number.parseInt(hex.slice(1), 16)
  return `rgb(${(tal >> 16) & 255}, ${(tal >> 8) & 255}, ${tal & 255})`
}

describe('SurplusChart', () => {
  it('tegner én søjle pr. simuleringsår, alle over nul-linjen i en plan der bærer sig selv', () => {
    const plan = aSurplusPlan()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    const soejler = Array.from(container.querySelectorAll('svg rect.overskudssoejle'))
    expect(soejler.map((soejle) => Number(soejle.getAttribute('data-year')))).toEqual(
      years.map((year) => year.year),
    )

    const nul = Number(container.querySelector('.basislinje')!.getAttribute('y1'))
    for (const soejle of soejler) {
      const top = Number(soejle.getAttribute('y'))
      const bund = top + Number(soejle.getAttribute('height'))
      expect(bund).toBeCloseTo(nul, 6)
      expect(top).toBeLessThan(nul)
    }
  })

  it('vender søjlen ned under nul-linjen i de år, planen ikke bærer sig selv', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    const nul = Number(container.querySelector('.basislinje')!.getAttribute('y1'))
    const overskudsaar: number[] = []
    const underskudsaar: number[] = []

    for (const soejle of container.querySelectorAll('svg rect.overskudssoejle')) {
      const aar = Number(soejle.getAttribute('data-year'))
      const top = Number(soejle.getAttribute('y'))
      const bund = top + Number(soejle.getAttribute('height'))
      const positiv = surplus(years.find((year) => year.year === aar)!, plan.buffer) > 0

      if (positiv) {
        expect(bund, `søjlen for ${aar} står ikke på nul-linjen`).toBeCloseTo(nul, 6)
        expect(top, `søjlen for ${aar} vender nedad`).toBeLessThan(nul)
        overskudsaar.push(aar)
      } else {
        expect(top, `søjlen for ${aar} hænger ikke i nul-linjen`).toBeCloseTo(nul, 6)
        expect(bund, `søjlen for ${aar} vender opad`).toBeGreaterThan(nul)
        underskudsaar.push(aar)
      }
    }

    // Testen prøver kun det, den siger, hvis planen faktisk skifter fortegn.
    expect(overskudsaar.length).toBeGreaterThan(0)
    expect(underskudsaar.length).toBeGreaterThan(0)
  })

  it('giver underskudsårene deres egen tone, hentet fra den validerede palette og ikke rød', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    const toner = { overskud: new Set<string>(), underskud: new Set<string>() }
    for (const soejle of container.querySelectorAll('svg rect.overskudssoejle')) {
      const aar = Number(soejle.getAttribute('data-year'))
      const positiv = surplus(years.find((year) => year.year === aar)!, plan.buffer) > 0
      toner[positiv ? 'overskud' : 'underskud'].add(soejle.getAttribute('fill')!)
    }

    // Én tone hver vej, og de to er ikke den samme — ellers kan fortegnet kun
    // ses ved at læse aksen.
    expect(toner.overskud.size).toBe(1)
    expect(toner.underskud.size).toBe(1)
    const [overskud] = toner.overskud
    const [underskud] = toner.underskud
    expect(underskud).not.toBe(overskud)

    // Begge er palettens egne. En niende farve ville ikke være valideret mod
    // fladens baggrund, hverken for kontrast eller for farveblindhed.
    expect(CATEGORICAL_PALETTE).toContain(overskud)
    expect(CATEGORICAL_PALETTE).toContain(underskud)

    // Rød er forbeholdt den negative buffer alene — palettens `#e66767` og
    // fladens `--neg`. Et underskud er ingen fejltilstand, men det beløb, der
    // mangler at blive flyttet, jf. ADR-0026.
    expect(['#e66767', '#e2685c']).not.toContain(underskud)
  })

  it('måler søjlerne mod årstabellens Overskud-kolonne, så de to ikke kan vise forskellige tal', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)

    const graf = render(<SurplusChart years={years} plan={plan} unit="Real" />)
    const nul = Number(graf.container.querySelector('.basislinje')!.getAttribute('y1'))
    // Søjlens fortegn ligger i, hvilken ende der hænger i nul-linjen, og
    // ikke i højden — SVG kender ikke negativ højde.
    const soejlehoejder = new Map<number, number>()
    for (const soejle of graf.container.querySelectorAll('svg rect.overskudssoejle')) {
      const top = Number(soejle.getAttribute('y'))
      const hoejde = Number(soejle.getAttribute('height'))
      const opad = Math.abs(top + hoejde - nul) < 1e-9
      soejlehoejder.set(Number(soejle.getAttribute('data-year')), opad ? hoejde : -hoejde)
    }
    graf.unmount()

    const tabel = render(
      <YearTable years={years} plan={plan} unit="Real" onSelectYear={() => {}} />,
    )
    const overskrifter = Array.from(tabel.container.querySelectorAll('thead th'))
    const kolonne = overskrifter.findIndex((th) => th.textContent === 'Overskud')
    expect(kolonne).toBeGreaterThan(-1)

    const tabeltal = new Map<number, number>()
    for (const raekke of tabel.container.querySelectorAll('tbody tr')) {
      const celler = raekke.querySelectorAll('td')
      tabeltal.set(danskTal(celler[0]!.textContent!), danskTal(celler[kolonne]!.textContent!))
    }

    // Grafen og tabellen er tegnet i hver sin enhed — pixels og kroner — så
    // det, de kan sammenlignes på, er forholdet. Skalaen tages af det år, der
    // fylder mest, og skal så passe på hvert eneste af de andre.
    const stoerste = [...tabeltal.entries()].reduce((a, b) =>
      Math.abs(b[1]) > Math.abs(a[1]) ? b : a,
    )
    const skala = soejlehoejder.get(stoerste[0])! / stoerste[1]

    expect(tabeltal.size).toBe(years.length)
    for (const [aar, kroner] of tabeltal) {
      expect(soejlehoejder.get(aar), `søjlen for ${aar} måler ikke tabellens tal`).toBeCloseTo(
        kroner * skala,
        1,
      )
    }
  })

  it('viser Overskud og Underskud i sin egen legend, i søjlernes egne farver', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    const signatur = Array.from(container.querySelectorAll('.overskudsgraf-legend li'))
    expect(signatur.map((punkt) => punkt.textContent)).toEqual(['Overskud', 'Underskud'])

    // jsdom normaliserer inline farver til rgb(), så hex sammenlignes i
    // samme form.
    const farver = signatur.map(
      (punkt) => (punkt.querySelector('.svatch') as HTMLElement).style.background,
    )
    expect(farver[0]).toBe(toRgb(SURPLUS))
    expect(farver[1]).toBe(toRgb(DEFICIT))
  })

  it('åbner forklar-året ved klik på en søjle', async () => {
    const user = userEvent.setup()
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const onSelectYear = vi.fn()
    const { container } = render(
      <SurplusChart years={years} plan={plan} unit="Real" onSelectYear={onSelectYear} />,
    )

    await user.click(container.querySelector('svg rect.overskudssoejle[data-year="2032"]')!)
    expect(onSelectYear).toHaveBeenCalledWith(2032)

    // Hele årets søjlefelt er klikbart og ikke kun selve søjlen — et år med
    // et overskud tæt på nul har næsten ingen søjle at ramme.
    await user.click(container.querySelectorAll('svg .aarsfelt')[0]!)
    expect(onSelectYear).toHaveBeenCalledWith(years[0]!.year)
  })

  it('måler sin egen plads og tegner om, når containeren skifter størrelse', () => {
    // Resultatspalten bliver netop smallere, når inspektørskuffen åbner. En
    // viewBox, der stadig påstod den oprindelige bredde, ville nedskalere hele
    // tegningen — og aksernes fontstørrelse med den.
    const plan = aSurplusPlan()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    const plot = container.querySelector('.graf-plot')!
    const foer = container.querySelector('svg')!.getAttribute('viewBox')

    act(() => {
      fireResize(plot, { width: 480, height: 555 })
    })

    const efter = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')
    expect(efter[2]).toBe('480')
    expect(efter[3]).toBe('555')
    expect(efter.join(' ')).not.toBe(foer)
  })

  it('navngiver aksens enhed og giver y-margenen plads til det længste mærkat', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    // Overskuddene løber i hundredtusinder og ikke i millioner, så aksen står
    // i hele kroner.
    expect(screen.getByText('kr.')).toBeTruthy()
    expect(screen.getByText('år')).toBeTruthy()

    const maerkater = Array.from(container.querySelectorAll('.graf-akse-y text')) as SVGTextElement[]
    const tal = maerkater.map((maerkat) => maerkat.textContent!)

    // Aksen spænder over begge fortegn, når planen gør, og nul står på den.
    expect(tal).toContain('0')
    expect(tal.some((tekst) => /[-−]/.test(tekst))).toBe(true)

    // Intet ciffer klippes af viewBox'ens venstre kant. Mærkaterne sættes i
    // monospace ved 10 px, hvor hvert tegn fylder 6 px.
    for (const maerkat of container.querySelectorAll('.graf-akse-y text')) {
      const hoejre = Number(maerkat.getAttribute('x'))
      expect(hoejre - maerkat.textContent!.length * 6).toBeGreaterThanOrEqual(0)
    }

    // X-aksen bærer årstallene: første og sidste år er altid med.
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText(String(years.at(-1)!.year))).toBeTruthy()
  })

  it('tegner en anden graf i fremtidskroner end i nutidskroner', () => {
    // Posterne reguleres ikke, mens priserne stiger to procent om året: målt
    // i nutidskroner skrumper overskuddet år for år, målt i fremtidskroner
    // står det stille. To forskellige grafer af de samme år, jf. ADR-0001.
    const plan = aPlan({
      horizon: 62,
      inflationAssumption: 0.02,
      entries: [
        aSalary({ amountInRealKroner: 800_000 }),
        anExpense({ amountInRealKroner: 300_000 }),
      ],
    })
    const years = simulateChecked(plan)

    const hoejder = (unit: AmountUnit) => {
      const visning = render(<SurplusChart years={years} plan={plan} unit={unit} />)
      const maal = Array.from(visning.container.querySelectorAll('svg rect.overskudssoejle')).map(
        (soejle) => soejle.getAttribute('height'),
      )
      visning.unmount()
      return maal
    }

    expect(hoejder('Real')).not.toEqual(hoejder('Nominal'))
  })

  it('gentager ikke bufferens tonede spænd — de bliver i formuegrafen', () => {
    // Bufferen er tom fra første år, mens der står rigelig likviditet på den
    // anden beholdning uden en overførsel til at hente den: planen knækker,
    // og formuegrafen markerer det. Overskudsgrafen svarer på et andet
    // spørgsmål og gentager det ikke, jf. ADR-0026.
    const plan = aPlan({
      balance: 0,
      horizon: 69,
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
      entries: [anExpense({ amountInRealKroner: 40_000 })],
    })
    const years = simulateChecked(plan)
    expect(years.some((year) => year.bufferState)).toBe(true)

    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    expect(container.querySelectorAll('[data-buffer-state]')).toHaveLength(0)
    expect(screen.queryByText(/Ufuldstændig/)).toBeNull()
    expect(screen.queryByText(/Uholdbar/)).toBeNull()

    // Årene er der stadig — de er bare tegnet som det, de er.
    expect(container.querySelectorAll('svg rect.overskudssoejle')).toHaveLength(years.length)
  })

  it('tegner en tom akse om nul, når ingen år bevæger sig', () => {
    // En plan uden poster og uden saldo: hvert år går præcis i nul. Aksen har
    // ingen udstrækning at trappe og må hverken finde på en eller vise et
    // mærkat, der er rundet op fra en halv krone. Horisonten stopper året før
    // folkepensionsalderen, som ellers kommer af sig selv.
    const plan = aPlan({ balance: 0, horizon: 69 })
    const years = simulateChecked(plan)
    expect(years.every((year) => surplus(year, plan.buffer) === 0)).toBe(true)

    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    const maerkater = Array.from(container.querySelectorAll('.graf-akse-y text')).map(
      (maerkat) => maerkat.textContent,
    )
    expect(maerkater).toEqual(['kr.', '0'])

    // Søjlerne står på nul-linjen uden at rage nogen vej.
    for (const soejle of container.querySelectorAll('svg rect.overskudssoejle')) {
      expect(Number(soejle.getAttribute('height'))).toBe(0)
    }
  })

  it('tegner en lodret stiplet markør ved det år, musen er over', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    expect(container.querySelector('.aarsmarkoer')).toBeNull()

    const felter = container.querySelectorAll('svg .aarsfelt')
    fireEvent.mouseEnter(felter[2]!)

    const markoer = container.querySelector('.aarsmarkoer')!
    expect(markoer).toBeTruthy()
    expect(markoer.getAttribute('x1')).toBe(markoer.getAttribute('x2'))
  })

  it('flytter markøren, når musen glider til et andet år, og fjerner den, når musen forlader plottet', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

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

  it('viser et dataglimt med årets Overskud, mærket efter fortegn, uden en sum-linje', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    expect(container.querySelector('.dataglimt')).toBeNull()

    const felter = container.querySelectorAll('svg .aarsfelt')
    const positivtIndeks = years.findIndex((year) => surplus(year, plan.buffer) > 0)
    const negativtIndeks = years.findIndex((year) => surplus(year, plan.buffer) < 0)
    expect(positivtIndeks).toBeGreaterThan(-1)
    expect(negativtIndeks).toBeGreaterThan(-1)

    fireEvent.mouseEnter(felter[positivtIndeks]!)
    let raekker = Array.from(container.querySelectorAll('.dataglimt .dataglimt-raekke'))
    expect(raekker).toHaveLength(1)
    expect(container.querySelector('.dataglimt-sum')).toBeNull()
    expect(raekker[0]!.textContent).toContain('Overskud')
    expect(danskTal(raekker[0]!.textContent!)).toBeCloseTo(
      surplus(years[positivtIndeks]!, plan.buffer),
      0,
    )

    fireEvent.mouseEnter(felter[negativtIndeks]!)
    raekker = Array.from(container.querySelectorAll('.dataglimt .dataglimt-raekke'))
    expect(raekker).toHaveLength(1)
    expect(raekker[0]!.textContent).toContain('Underskud')

    const plot = container.querySelector('.aarssoejler')!.parentElement!
    fireEvent.mouseLeave(plot)
    expect(container.querySelector('.dataglimt')).toBeNull()
  })

  it('tegner ingen akse og ingen legend i mini-tilstand, jf. ADR-0033 — kun formen', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const onSelectYear = vi.fn()
    const { container } = render(
      <SurplusChart years={years} plan={plan} unit="Real" onSelectYear={onSelectYear} mode="mini" />,
    )

    // Ingen mærkater — hverken kroner eller år. Nul-linjen selv står der
    // stadig, ligesom bufferspændets kant-streger i formuegrafen: den er en
    // del af formen og ikke en tekst, der kræver en læsbar bredde.
    expect(container.querySelectorAll('.graf-akse-y text, .graf-akse-x text')).toHaveLength(0)
    expect(container.querySelector('.graf-legend')).toBeNull()

    // Formen — én søjle pr. år — står der stadig.
    expect(container.querySelectorAll('svg rect.overskudssoejle')).toHaveLength(years.length)

    // Men intet klik: mini-grafen bytter sig frem i stedet, jf. ADR-0033.
    container.querySelector('.aarssoejler')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    expect(onSelectYear).not.toHaveBeenCalled()
  })
})
