import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Entry, Holding, Plan } from '../engine/plan'
import {
  aContribution,
  aPlan,
  aSalary,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import { App } from './App'
import { fieldHelp } from './fieldHelp'

/** Dækningen er lovet total: hver etiket i skuffen og hver kolonneoverskrift
    i tabellerne kan forklares ved at pege på den, jf. `fieldHelp.ts`.
    Skuffens felter holdes af oversætteren — nøglen er et krævet prop — men
    to ting kan den ikke se: at komponenten rent faktisk skriver teksten ud
    på etiketten, og at en `<th>` overhovedet har fået en. Det er dem, der
    står her.

    Stilreglerne prøves også, men kun de mekaniske af dem. Om anden sætning
    svarer på "hvad betyder det for mig", må et menneske afgøre. */

/** En plan, der er rig nok til at tegne alle seks tabeller i forklar-året:
    aktieindkomst til husstandens skattetabel, en ordning med et loft, et
    lønkildet bidrag, og poster i begge retninger. */
function aRichPlan(): Plan {
  return aPlan({
    variant: 'ShareDepot',
    balance: 5_000_000,
    grossReturn: 0.05,
    annualCostRate: 0.004,
    holdings: [
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        openedOn: { year: 2018, month: 1 },
        balance: 1_000_000,
        grossReturn: 0.04,
        annualCostRate: 0.005,
      },
      {
        id: 'anden-beholdning',
        name: 'Anden beholdning',
        variant: 'SavingsAccount',
        balance: 100_000,
        grossReturn: 0.01,
        annualCostRate: 0,
      },
    ],
    entries: [
      aSalary({ amountInRealKroner: 800_000 }),
      anExpense({ amountInRealKroner: 300_000 }),
    ],
    contributions: [
      aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.1 }),
    ],
    transfers: [
      aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 10_000 }),
    ],
  })
}

/** Periodeafsnittets øvrige grene: en aldersforankret engangspost tegner
    *Alder* og tilvalget *Følger erhvervsophør*, som `aRichPlan`s
    kalenderårsforankrede årlige post aldrig når forbi. */
function anAgeAnchoredOnce(): Entry {
  return {
    id: 'engangsudgift',
    name: 'Nyt tag',
    amountInRealKroner: 200_000,
    owner: 'jesper',
    direction: 'Expense',
    timing: 6,
    period: { anchor: 'PersonAge', from: 'WorkEndAge' },
    recurrence: { kind: 'Once' },
  }
}

/** En aldersforankret post, der løber over flere år, så begge endepunkter
    står — *Fra (alder)* og *Til (alder)*. */
function anAgeAnchoredSpan(): Entry {
  return {
    id: 'broudgift',
    name: 'Broperiode',
    amountInRealKroner: 100_000,
    owner: 'jesper',
    direction: 'Expense',
    timing: 'Even',
    period: { anchor: 'PersonAge', from: 58, to: 67 },
    recurrence: { kind: 'EveryNYears', n: 2 },
  }
}

function aFreeHolding(): Holding {
  return {
    id: 'anden-beholdning',
    name: 'Anden beholdning',
    variant: 'SavingsAccount',
    balance: 100_000,
    grossReturn: 0,
    annualCostRate: 0,
  }
}

/** Alle etiketter i skuffen, som den står lige nu — både `<label>` og de
    `span.etiket`, som en låst værdi og en segmenteret kontakt bruger, hvor
    der ikke er én kontrol at pege på. */
function drawerLabels(): HTMLElement[] {
  const drawer = document.querySelector('.skuffe') ?? document.body
  return [...drawer.querySelectorAll<HTMLElement>('.felt label, .felt .etiket')]
}

/** Går navigatoren igennem og åbner hvert objekt i planen efter tur. En ny
    slags objekt bliver dermed dækket af sig selv. */
async function forEachDrawer(
  user: ReturnType<typeof userEvent.setup>,
  check: (name: string) => void,
) {
  const count = document.querySelectorAll('.nav-rk').length
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    // Genfundet hver gang: et klik tegner navigatoren om, og en gemt
    // knude peger på noget, der ikke længere står i dokumentet.
    const row = document.querySelectorAll<HTMLElement>('.nav-rk')[i]!
    const name = row.textContent ?? `række ${i}`
    await user.click(row)
    check(name)
  }
}

describe('feltforklaringerne', () => {
  it('giver hver etiket i hver af skuffens ruder en forklaring', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aRichPlan()} />)

    await forEachDrawer(user, (name) => {
      const labels = drawerLabels()
      expect(labels.length, `${name} har ingen felter`).toBeGreaterThan(0)
      for (const label of labels) {
        expect(label.title, `${name} › ${label.textContent}`).not.toBe('')
      }
    })
  })

  it('giver også periodeafsnittets aldersgrene og deres tilvalg en forklaring', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          holdings: [aFreeHolding()],
          entries: [anAgeAnchoredOnce(), anAgeAnchoredSpan()],
        })}
      />,
    )

    await forEachDrawer(user, (name) => {
      for (const label of drawerLabels()) {
        expect(label.title, `${name} › ${label.textContent}`).not.toBe('')
      }
    })

    // Tilvalget er sit eget spørgsmål og har sin egen tekst — den hænger på
    // afkrydsningsfeltets etiket og ikke på aldersfeltets.
    await user.click(screen.getByRole('button', { name: /Nyt tag/ }))
    const tilvalg = screen
      .getByLabelText('Følger erhvervsophør')
      .closest('label') as HTMLElement
    expect(tilvalg.title).toBe(fieldHelp['Period.followsWorkEnd'])
  })

  it('giver hver kolonneoverskrift i årstabellen en forklaring', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aRichPlan()} />)
    await user.click(screen.getByRole('button', { name: 'Årstabellen' }))

    // Ni faste kolonner plus én pr. person. Tallet står her, så løkken ikke
    // kan komme til at prøve ingenting.
    const headers = screen.getAllByRole('columnheader')
    expect(headers.length).toBe(10)
    for (const header of headers) {
      expect(header.title, `Årstabellen › ${header.textContent}`).not.toBe('')
    }
  })

  it('giver hver kolonneoverskrift i forklar-året en forklaring', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aRichPlan()} />)
    await user.click(screen.getByRole('button', { name: 'Årstabellen' }))
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!)

    // Alle seks tabeller skal stå, ellers prøver testen mindre, end den ser
    // ud til: uden aktieindkomst eller uden et loft udelades blokken helt.
    for (const overskrift of [
      'Husstandens aktieindkomstskat',
      'Posterne',
      'Indbetalingerne',
      'Lofterne',
      'Beholdningerne',
    ]) {
      expect(
        screen.getByRole('heading', { name: overskrift, level: 3 }),
        `${overskrift} mangler`,
      ).toBeTruthy()
    }

    const headers = screen.getAllByRole('columnheader')
    expect(headers.length).toBeGreaterThan(20)
    for (const header of headers) {
      expect(header.title, `Forklar-året › ${header.textContent}`).not.toBe('')
    }
  })

  describe('stilen', () => {
    const entries = Object.entries(fieldHelp)

    it.each(entries)('%s taler brugerens sprog og ikke kodens', (key, text) => {
      // Regel 4: ingen kodeord og ingen henvisninger indad. Et engelsk
      // identifier fra modellen røber sig på det store bogstav inde i ordet.
      expect(text, `${key} nævner et navn fra koden`).not.toMatch(/\b[a-zæøå]+[A-ZÆØÅ]/)
      expect(text, `${key} henviser til en ADR`).not.toMatch(/ADR-\d/)
      expect(text, `${key} bruger kodeformatering`).not.toContain('`')
    })

    it.each(entries)('%s skriver om tingen og ikke til brugeren', (key, text) => {
      // Regel 6: ingen imperativer, intet "du". Skrivemåden er den samme
      // som de `Hint`s, forklaringerne står ved siden af.
      expect(text, `${key} tiltaler brugeren`).not.toMatch(/\b(du|dig|din|dit|dine)\b/i)
    })

    it.each(entries)('%s er kort nok til at nå at blive læst', (key, text) => {
      // Regel 5: to til tre sætninger. Boblen forsvinder af sig selv, og en
      // fjerde sætning når ikke med — grænsen er sat på tegn, fordi
      // punktummer også står i "20.000 kr." og i "§ 20".
      expect(text.length, `${key} er ${text.length} tegn`).toBeLessThanOrEqual(330)
      expect(text.length, `${key} siger for lidt`).toBeGreaterThan(40)
    })
  })
})
