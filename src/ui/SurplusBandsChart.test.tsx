import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
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
import { fireResize } from './testSetup'
import { CATEGORICAL_PALETTE } from './palette'
import { surplus } from './surplus'
import { surplusBandOrder, surplusBands } from './surplusBands'
import { YearTable } from './YearTable'
import { SurplusBandsChart } from './SurplusBandsChart'

/** En plan, der knækker begge veje: bufferen er tom fra første år, mens der
    står rigelig likviditet på den anden beholdning uden en overførsel til at
    hente den — ufuldstændig først, uholdbar når pengene er brugt. Beholdningen
    forrenter sig, så afkastet og skatten af det heller ikke er nul. */
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
        period: { anchor: 'PersonAge', to: { person: 'jesper' } },
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

/** Årstabellens Overskud-kolonne, år for år i kroner. */
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

describe('SurplusBandsChart', () => {
  it('stabler båndene divergerende om nul-linjen', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

    const nul = Number(container.querySelector('.basislinje')!.getAttribute('y1'))

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

  it('lader de otte bånd summere til årstabellens Overskud-kolonne, år for år', () => {
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

    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)
    const nul = Number(container.querySelector('.basislinje')!.getAttribute('y1'))

    // Nettoet af båndene: hvor højt stablingen nåede over nul-linjen, minus
    // hvor langt den nåede under den. Målt på båndenes yderkanter, som er
    // det, øjet også aflæser.
    const netto = new Map<number, number>()
    for (const year of years) {
      const kanter = Array.from(
        container.querySelectorAll(`rect[data-band][data-year="${year.year}"]`),
      ).map((rect) => ({
        top: Number(rect.getAttribute('y')),
        bund: Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')),
      }))
      const opad = Math.min(nul, ...kanter.map((kant) => kant.top))
      const nedad = Math.max(nul, ...kanter.map((kant) => kant.bund))
      netto.set(year.year, nul - opad - (nedad - nul))
    }

    // Grafen har sin egen skala og måles derfor mod årstabellens
    // Overskud-kolonne gennem ét fælles forhold: passer det i det år, der
    // fylder mest, skal det passe i hvert eneste af de andre.
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

  it('navngiver båndene i legenden med ord, der står i glossaret', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

    const signatur = Array.from(container.querySelectorAll('.fordelingsgraf-legend li'))
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
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

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
    for (const punkt of container.querySelectorAll('.fordelingsgraf-legend li')) {
      const svatch = punkt.querySelector('.svatch') as HTMLElement
      expect(svatch.style.background).toBeTruthy()
    }
  })

  it('tegner en lodret stiplet markør ved det år, musen er over', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

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
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

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

  it('viser et dataglimt med alle otte bånd i deres faste rækkefølge, uden en sum-linje', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

    expect(container.querySelector('.dataglimt')).toBeNull()

    const felter = container.querySelectorAll('svg .aarsfelt')
    fireEvent.mouseEnter(felter[0]!)

    const raekker = Array.from(container.querySelectorAll('.dataglimt .dataglimt-raekke'))
    expect(raekker).toHaveLength(8)
    expect(container.querySelector('.dataglimt-sum')).toBeNull()
    surplusBandOrder.forEach((band, i) => {
      expect(raekker[i]!.textContent).toContain(band.label)
    })

    const plot = container.querySelector('.aarssoejler')!.parentElement!
    fireEvent.mouseLeave(plot)
    expect(container.querySelector('.dataglimt')).toBeNull()
  })

  it('viser et bånd på 0 kr. i dataglimtet i stedet for at udelade det', () => {
    // Ingen poster, ingen saldo: hvert bånd står i 0 kr. hvert år.
    const plan = aPlan({ balance: 0, horizon: 69 })
    const years = simulateChecked(plan)
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

    fireEvent.mouseEnter(container.querySelectorAll('svg .aarsfelt')[0]!)

    const raekker = Array.from(container.querySelectorAll('.dataglimt .dataglimt-raekke'))
    expect(raekker).toHaveLength(8)
    expect(raekker[0]!.textContent).toContain(surplusBandOrder[0]!.label)
    expect(raekker[0]!.textContent).toContain('0 kr.')
  })

  it('åbner forklar-året ved klik på et bånd', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const onSelectYear = vi.fn()
    const { container } = render(
      <SurplusBandsChart years={years} plan={plan} unit="Real" onSelectYear={onSelectYear} />,
    )

    await user.click(container.querySelector('rect[data-band][data-year="2040"]')!)
    expect(onSelectYear).toHaveBeenLastCalledWith(2040)

    // Hele årets båndfelt er klikbart og ikke kun båndene selv.
    await user.click(container.querySelectorAll('svg .aarsfelt')[0]!)
    expect(onSelectYear).toHaveBeenLastCalledWith(years[0]!.year)
  })

  it('måler sin egen plads og tegner om, når containeren skifter størrelse', () => {
    const plan = aPlanThatTurnsNegative()
    const years = simulateChecked(plan)
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

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
    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

    // Beløbene løber i hundredtusinder og ikke i millioner, så aksen står i
    // hele kroner.
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

    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText(String(years.at(-1)!.year))).toBeTruthy()
  })

  it('tegner en tom akse om nul, når ingen år bevæger sig', () => {
    // En plan uden poster og uden saldo: hvert år går præcis i nul. Aksen har
    // ingen udstrækning at trappe og må hverken finde på en eller vise et
    // mærkat, der er rundet op fra en halv krone.
    const plan = aPlan({ balance: 0, horizon: 69 })
    const years = simulateChecked(plan)
    expect(years.every((year) => surplus(year, plan.buffer) === 0)).toBe(true)

    const { container } = render(<SurplusBandsChart years={years} plan={plan} unit="Real" />)

    const maerkater = Array.from(container.querySelectorAll('.graf-akse-y text')).map(
      (maerkat) => maerkat.textContent,
    )
    expect(maerkater).toEqual(['kr.', '0'])
  })

  it('tegner ingen akse og ingen legend i mini-tilstand, jf. ADR-0033 — kun formen', () => {
    const plan = aPlanWithEveryBufferFlow()
    const years = simulateChecked(plan)
    const onSelectYear = vi.fn()
    const { container } = render(
      <SurplusBandsChart years={years} plan={plan} unit="Real" onSelectYear={onSelectYear} mode="mini" />,
    )

    // Ingen mærkater — hverken kroner eller år. Nul-linjen selv står der
    // stadig, ligesom bufferspændets kant-streger i formuegrafen: den er en
    // del af formen og ikke en tekst, der kræver en læsbar bredde.
    expect(container.querySelectorAll('.graf-akse-y text, .graf-akse-x text')).toHaveLength(0)
    expect(container.querySelector('.graf-legend')).toBeNull()

    // Formen står der stadig — otte bånd pr. år.
    expect(container.querySelectorAll(`rect[data-band][data-year="${years[0]!.year}"]`)).toHaveLength(8)

    // Men intet klik: mini-grafen bytter sig frem i stedet, jf. ADR-0033.
    container.querySelector('.aarssoejler')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    expect(onSelectYear).not.toHaveBeenCalled()

    // Og heller ingen markør eller dataglimt: begge hører kun til
    // hovedgrafen, jf. ADR-0038.
    fireEvent.mouseEnter(container.querySelector('.aarssoejler')!)
    expect(container.querySelector('.aarsmarkoer')).toBeNull()
    expect(container.querySelector('.dataglimt')).toBeNull()
  })
})
