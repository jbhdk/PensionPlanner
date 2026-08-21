import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import {
  aContribution,
  aPlan,
  aPlanWithEveryBufferFlow,
  aSalary,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import { simulateChecked } from '../engine/testing/simulateChecked'
import type { AmountUnit } from './real'
import { fireResize } from './testSetup'
import { CATEGORICAL_PALETTE } from './palette'
import { surplus } from './surplus'
import { surplusBandOrder, surplusBands } from './surplusBands'
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

/** Årstabellens Overskud-kolonne, år for år i kroner. Grafen og tabellen
    læser det samme tal, og tabellen er den, der skriver det som kroner —
    derfor er den målestokken, når en pixelhøjde skal føres tilbage til et
    beløb. */
function surplusColumn(years: YearResult[], plan: Plan): Map<number, number> {
  const tabel = render(<YearTable years={years} plan={plan} unit="Real" onSelectYear={() => {}} />)
  const overskrifter = Array.from(tabel.container.querySelectorAll('thead th'))
  const kolonne = overskrifter.findIndex((th) => th.textContent === 'Overskud')
  expect(kolonne).toBeGreaterThan(-1)

  const tal = new Map<number, number>()
  for (const raekke of tabel.container.querySelectorAll('tbody tr')) {
    const celler = raekke.querySelectorAll('td')
    tal.set(danskTal(celler[0]!.textContent!), danskTal(celler[kolonne]!.textContent!))
  }
  tabel.unmount()
  return tal
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

    const nul = Number(container.querySelector('.overskudspanel .basislinje')!.getAttribute('y1'))
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

    const nul = Number(container.querySelector('.overskudspanel .basislinje')!.getAttribute('y1'))
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
    const nul = Number(graf.container.querySelector('.overskudspanel .basislinje')!.getAttribute('y1'))
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

  it('stabler båndene divergerende om nul-linjen i sit øverste panel', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    // Båndpanelet har sin egen nul-linje og sin egen skala: fortegnsskiftet
    // i overskuddet nedenunder må ikke kunne forsvinde i stablingen.
    const nul = Number(container.querySelector('.baandpanel .basislinje')!.getAttribute('y1'))

    for (const year of years) {
      const baand = Array.from(
        container.querySelectorAll(`rect[data-band][data-year="${year.year}"]`),
      )
      expect(baand.map((rect) => rect.getAttribute('data-band'))).toEqual([
        'IncomeEntries',
        'Benefits',
        'Payouts',
        'TransfersIn',
        'Tax',
        'ExpenseEntries',
        'Contributions',
        'TransfersOut',
      ])

      // Fire opad og fire nedad, og hvert bånd står på det forrige — en
      // stabling og ikke otte søjler oven i hinanden.
      let opad = nul
      let nedad = nul
      for (const rect of baand) {
        const top = Number(rect.getAttribute('y'))
        const bund = top + Number(rect.getAttribute('height'))
        if (rect.getAttribute('data-direction') === 'Income') {
          expect(bund, `${rect.getAttribute('data-band')} i ${year.year}`).toBeCloseTo(opad, 6)
          opad = top
        } else {
          expect(top, `${rect.getAttribute('data-band')} i ${year.year}`).toBeCloseTo(nedad, 6)
          nedad = bund
        }
      }
      expect(opad).toBeLessThanOrEqual(nul)
      expect(nedad).toBeGreaterThanOrEqual(nul)
    }
  })

  it('lader de otte bånd summere til søjlen i panelet nedenunder, år for år', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)

    // Summen kan kun prøves på en plan, hvor hvert bånd faktisk har et
    // beløb: et bånd, der er nul hele vejen, kan ikke gå fejl af sin kilde.
    for (const band of surplusBandOrder) {
      expect(
        years.some((year) => surplusBands(year, plan).find((b) => b.name === band.name)!.amount > 0),
        `${band.label} har intet beløb i noget år`,
      ).toBe(true)
    }

    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)
    const baandNul = Number(
      container.querySelector('.baandpanel .basislinje')!.getAttribute('y1'),
    )

    // Nettoet af båndene: hvor højt stablingen nåede over nul-linjen, minus
    // hvor langt den nåede under den. Målt på båndenes yderkanter, som er
    // det, øjet også aflæser.
    const netto = new Map<number, number>()
    for (const year of years) {
      const kanter = Array.from(
        container.querySelectorAll(`rect[data-band][data-year="${year.year}"]`),
      ).map((rect) => ({
        direction: rect.getAttribute('data-direction'),
        top: Number(rect.getAttribute('y')),
        bund: Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')),
      }))
      const opad = Math.min(baandNul, ...kanter.map((kant) => kant.top))
      const nedad = Math.max(baandNul, ...kanter.map((kant) => kant.bund))
      netto.set(year.year, baandNul - opad - (nedad - baandNul))
    }

    // Panelet har sin egen skala, og båndene måles derfor mod årstabellens
    // Overskud-kolonne gennem ét fælles forhold: passer det i det år, der
    // fylder mest, skal det passe i hvert eneste af de andre — ellers er der
    // et bånd, der ikke har talt det, det skulle.
    const tabeltal = surplusColumn(years, plan)
    const stoerste = [...tabeltal.entries()].reduce((a, b) =>
      Math.abs(b[1]) > Math.abs(a[1]) ? b : a,
    )
    const skala = netto.get(stoerste[0])! / stoerste[1]

    expect(tabeltal.size).toBe(years.length)
    for (const [aar, kroner] of tabeltal) {
      expect(netto.get(aar), `båndene i ${aar} summer ikke til årets overskud`).toBeCloseTo(
        kroner * skala,
        1,
      )
    }
  })

  it('lader de to paneler dele x-akse, så samme år står lodret over hinanden', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    for (const year of years) {
      const soejle = container.querySelector(`rect.overskudssoejle[data-year="${year.year}"]`)!
      const baand = Array.from(
        container.querySelectorAll(`rect[data-band][data-year="${year.year}"]`),
      )
      expect(baand.length).toBe(8)
      for (const rect of baand) {
        expect(rect.getAttribute('x'), `${year.year}`).toBe(soejle.getAttribute('x'))
        expect(rect.getAttribute('width'), `${year.year}`).toBe(soejle.getAttribute('width'))
      }
    }

    // Panelerne er to og ikke ét: hvert har sin egen nul-linje, og de ligger
    // ikke oven i hinanden.
    const baandNul = Number(container.querySelector('.baandpanel .basislinje')!.getAttribute('y1'))
    const soejleNul = Number(
      container.querySelector('.overskudspanel .basislinje')!.getAttribute('y1'),
    )
    expect(soejleNul).toBeGreaterThan(baandNul)
  })

  it('navngiver båndene i legenden med ord, der står i glossaret', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    const signatur = Array.from(container.querySelectorAll('.overskudsgraf-legend li'))
    expect(signatur.map((punkt) => punkt.textContent)).toEqual([
      'Indtægtsposter',
      'Ydelser',
      'Udbetalinger',
      'Overførsler ind',
      'Skat',
      'Udgiftsposter',
      'Indbetalinger',
      'Overførsler ud',
    ])

    // Intet ord på skærmen må mangle i CONTEXT.md. Et bånd, der hed noget
    // andet end det, husstanden faktisk taler om, ville være et begreb,
    // værktøjet havde fundet på undervejs.
    const glossar = readFileSync(resolve(process.cwd(), 'CONTEXT.md'), 'utf8').toLowerCase()
    for (const punkt of signatur) {
      for (const ord of punkt.textContent!.toLowerCase().split(' ')) {
        expect(glossar, `${ord} står ikke i CONTEXT.md`).toContain(ord)
      }
    }
  })

  it('giver hvert bånd sin egen farve fra den validerede palette og holder den horisonten igennem', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    // Ét bånd, én farve — det samme første år som sidste. Ellers kan et bånd
    // ikke følges med øjnene hen over horisonten.
    const farver = new Map<string, string>()
    for (const rect of container.querySelectorAll('rect[data-band]')) {
      const navn = rect.getAttribute('data-band')!
      const farve = rect.getAttribute('fill')!
      expect(farver.get(navn) ?? farve, `${navn} skifter farve undervejs`).toBe(farve)
      farver.set(navn, farve)
    }

    // Otte bånd, otte farver, og hver af dem palettens egen. En niende farve
    // ville ikke være valideret mod fladens baggrund.
    expect(farver.size).toBe(8)
    expect(new Set(farver.values()).size).toBe(8)
    for (const farve of farver.values()) expect(CATEGORICAL_PALETTE).toContain(farve)

    // Legenden viser de samme farver som stablingen.
    for (const punkt of container.querySelectorAll('.overskudsgraf-legend li')) {
      const svatch = punkt.querySelector('.svatch') as HTMLElement
      expect(svatch.style.background).toBeTruthy()
    }
  })

  it('åbner forklar-året fra begge paneler', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const onSelectYear = vi.fn()
    const { container } = render(
      <SurplusChart years={years} plan={plan} unit="Real" onSelectYear={onSelectYear} />,
    )

    // Et bånd i det øverste panel.
    await user.click(container.querySelector('rect[data-band][data-year="2040"]')!)
    expect(onSelectYear).toHaveBeenLastCalledWith(2040)

    // Søjlen i det nederste.
    await user.click(container.querySelector('rect.overskudssoejle[data-year="2045"]')!)
    expect(onSelectYear).toHaveBeenLastCalledWith(2045)
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

  it('navngiver begge aksers enhed og giver y-margenen plads til det længste mærkat', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusChart years={years} plan={plan} unit="Real" />)

    // Overskuddene løber i hundredtusinder og ikke i millioner, så aksen står
    // i hele kroner — og enheden siger det samme som mærkaterne. Hvert panel
    // har sin egen skala og navngiver derfor sin egen enhed; x-aksen er
    // fælles og navngives én gang.
    expect(screen.getAllByText('kr.')).toHaveLength(2)
    expect(screen.getByText('år')).toBeTruthy()

    const maerkater = Array.from(
      container.querySelectorAll('.overskudspanel .graf-akse-y text'),
    ) as SVGTextElement[]
    const tal = maerkater.map((maerkat) => maerkat.textContent!)

    // Aksen spænder over begge fortegn, når planen gør, og nul står på den.
    expect(tal).toContain('0')
    expect(tal.some((tekst) => /[-−]/.test(tekst))).toBe(true)

    // Intet ciffer klippes af viewBox'ens venstre kant — heller ikke i det
    // panel, hvis egne mærkater er de korteste: margenen er afstemt til det
    // bredeste af de to. Mærkaterne sættes i monospace ved 10 px, hvor hvert
    // tegn fylder 6 px.
    for (const maerkat of container.querySelectorAll('.graf-akse-y text')) {
      const hoejre = Number(maerkat.getAttribute('x'))
      expect(hoejre - maerkat.textContent!.length * 6).toBeGreaterThanOrEqual(0)
    }

    // X-aksen bærer årstallene: første og sidste år er altid med.
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText(String(years.at(-1)!.year))).toBeTruthy()
  })

  it('åbner forklar-året for netop det år, der klikkes på', async () => {
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

  it('tegner en anden graf i løbende priser end i dagens kroner', () => {
    // Posterne reguleres ikke, mens priserne stiger to procent om året: målt
    // i dagens kroner skrumper overskuddet år for år, målt i løbende priser
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

    for (const panel of ['.baandpanel', '.overskudspanel']) {
      const maerkater = Array.from(
        container.querySelectorAll(`${panel} .graf-akse-y text`),
      ).map((maerkat) => maerkat.textContent)
      expect(maerkater, panel).toEqual(['kr.', '0'])
    }

    // Søjlerne står på nul-linjen uden at rage nogen vej.
    for (const soejle of container.querySelectorAll('svg rect.overskudssoejle')) {
      expect(Number(soejle.getAttribute('height'))).toBe(0)
    }
  })
})
