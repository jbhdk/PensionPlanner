import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgeBound, Holding, PayoutSchedule, Period, Plan } from '../engine/plan'
import {
  aContribution,
  aHolding,
  aHoldingContribution,
  aPlan,
  aPensionIncome,
  aSalary,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import { exportPlan } from '../persistence/planFile'
import { STORAGE_KEY, loadPlan } from '../persistence/planStorage'
import { App } from './App'
import { defaultPlan } from './defaultPlan'

/** Fixturens buffer plus én beholdning til, så en overførsel har et sted at
    flytte penge hen. */
function aPlanWithSecondHolding(): Plan {
  return aPlan({ holdings: [aFreeHolding('anden-beholdning', 'Anden beholdning')] })
}

/** Som ovenfor, men med en tredje beholdning, så "Fra" og "Til" hver har
    mere end ét lovligt valg tilbage, når den anden er udelukket. */
function aPlanWithThreeHoldings(): Plan {
  return aPlan({
    holdings: [
      aFreeHolding('anden-beholdning', 'Anden beholdning'),
      aFreeHolding('tredje-beholdning', 'Tredje beholdning'),
    ],
  })
}

/** En aldersopsparing med pensionsudbetalingsalderen 60 år. Fixturens person
    er født i juni 1973 og når den i 2033. */
function anOldAgeSavings(id: string, name: string, balance = 500_000): Holding {
  return {
    id,
    name,
    variant: 'OldAgeSavings',
    payoutAge: 60,
    balance,
    grossReturn: 0,
    annualCostRate: 0,
  }
}

/** Valgmulighederne i en af skuffens lister, i den rækkefølge de står. */
function optionsOf(label: string): string[] {
  return Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map(
    (option) => option.value,
  )
}

function aFreeHolding(id: string, name: string): Holding {
  return { id, name, variant: 'SavingsAccount', balance: 0, grossReturn: 0, annualCostRate: 0 }
}

/** Fixturens buffer, en ordning og endnu en beholdning med frie midler — i
    den rækkefølge, så ordningen står som husstandens anden beholdning. En
    overførsel, der tager de to første beholdninger den ligger i, rammer
    ordningen her, og listerne har noget at udelade. */
function aPlanWithPensionBetweenFreeHoldings(): Plan {
  return aPlan({
    holdings: [
      aPensionHolding('ratepension', 'Ratepension'),
      aFreeHolding('anden-beholdning', 'Anden beholdning'),
    ],
  })
}

/** Husstanden med to personer, som hver har en løn og en ratepension — så
    en indbetalings to ender kan flyttes fra den ene person til den anden.
    Bidraget går fra Jespers løn til Jespers ordning. */
function aPlanWithSpouse(): Plan {
  const base = aPlan({
    holdings: [aPensionHolding('ratepension', 'Ratepension')],
    entries: [aSalary({ amountInRealKroner: 600_000 })],
    contributions: [
      aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
    ],
  })
  const jesper = base.household.persons[0]!
  return {
    ...base,
    entries: [
      ...base.entries,
      { ...aSalary({ amountInRealKroner: 400_000, owner: 'maria' }), id: 'marias-loen' },
    ],
    household: {
      persons: [
        jesper,
        {
          ...jesper,
          id: 'maria',
          name: 'Maria',
          holdings: [
            aFreeHolding('marias-frie-midler', 'Marias frie midler'),
            aPensionHolding('marias-ratepension', 'Marias ratepension'),
          ],
        },
      ],
    },
  }
}

function aPensionHolding(id: string, name: string): Holding {
  return {
    id,
    name,
    variant: 'InstalmentPension',
    payoutAge: 67,
    balance: 0,
    grossReturn: 0,
    annualCostRate: 0,
  }
}

/** En aktiesparekonto. Personen kan kun have én, og en lønpost kan ikke være
    dens kilde — så listerne i skuffen har noget at udelade, når den står i
    planen. */
function aShareSavingsAccount(balance = 0): Holding {
  return {
    id: 'aktiesparekonto',
    name: 'Aktiesparekonto',
    variant: 'ShareSavingsAccount',
    balance,
    grossReturn: 0,
    annualCostRate: 0,
  }
}

/** Valgmulighederne i skuffens typeliste, som de står lige nu. */
function typeOptions(): string[] {
  const type = screen.getByLabelText(/Type/) as HTMLSelectElement
  return Array.from(type.options).map((option) => option.value)
}

/** Fixturens buffer plus en ratepension, så skuffen har en pensionsbeholdning
    at vise. */
function aPlanWithPension(): Plan {
  return aPlan({
    holdings: [
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        payoutAge: 67,
        balance: 2_000_000,
        grossReturn: 0.07,
        annualCostRate: 0.005,
      },
    ],
  })
}

/** Etiketterne i et afsnit i skuffen, i den rækkefølge de står. */
function sectionLabels(title: string): string[] {
  const section = Array.from(document.querySelectorAll('.afsnit')).find(
    (element) => element.querySelector('h3')?.textContent === title,
  )
  if (!section) throw new Error(`Skuffen har intet afsnit med overskriften ${title}.`)
  return Array.from(section.querySelectorAll('.felt')).map(
    (felt) => felt.querySelector('label, .etiket')?.textContent ?? '',
  )
}

/** Et udledt eller låst felt i skuffen. Det har ingen kontrol at pege på og
    kan derfor ikke findes med `getByLabelText`. */
function lockedField(label: string): HTMLElement {
  const felt = Array.from(document.querySelectorAll('.felt')).find(
    (element) => element.querySelector('.etiket')?.textContent === label,
  )
  if (!felt) throw new Error(`Skuffen har intet felt med etiketten ${label}.`)
  return felt as HTMLElement
}

/** Etiketten på det første felt i Perioden-afsnittet — til at fastslå
    rækkefølgen af felter i skuffen. */
function firstPeriodenFelt(container: HTMLElement): string | null | undefined {
  const overskrift = Array.from(container.querySelectorAll('h3')).find(
    (h) => h.textContent === 'Perioden',
  )
  const felt = overskrift?.parentElement?.querySelector('.felt label, .felt .etiket')
  return felt?.textContent
}

/** Cellen under en navngiven kolonne i en årstabelrække. Kolonnen slås op på
    sin overskrift frem for på et indekstal — tabellen får flere kolonner hen
    ad etaperne, og et tal ville pege på noget andet, hver gang den gør. */
function yearCell(rowIndex: number, column: string): string | null {
  const rows = within(screen.getByRole('table')).getAllByRole('row')
  const headers = within(rows[0]!)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  return within(rows[rowIndex]!).getAllByRole('cell')[headers.indexOf(column)]!.textContent
}

/** Åbner forklar-året for et bestemt simuleringsår. Året slås op på sin
    egen celle frem for på et rækkenummer — en plan, der får et år mere,
    ville ellers flytte hver eneste test. */
async function explainYear(user: ReturnType<typeof userEvent.setup>, year: number) {
  await user.click(within(screen.getByRole('table')).getAllByRole('row')[yearRow(year)]!)
}

/** Rækkenummeret for et simuleringsår i årstabellen. Årstallet bærer en
    stjerne i de fremskrevne år, og cellen sammenlignes derfor på sin
    begyndelse. */
function yearRow(year: number): number {
  const index = within(screen.getByRole('table'))
    .getAllByRole('row')
    .findIndex((candidate) =>
      candidate.querySelector('td')?.textContent?.startsWith(String(year)),
    )
  if (index < 0) throw new Error(`Årstabellen har ingen række for ${year}.`)
  return index
}

/** Årstabellen ligger bag sin egen fane, med Planlæggeren som standardfane. */
async function showYearTable(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Årstabellen' }))
}

/** Overskudsblokken i forklar-året — skærmens rygrad, som båndene og deres
    linjer hænger i. */
function surplusBlock(): HTMLElement {
  return screen
    .getByRole('heading', { name: 'Årets overskud', level: 3 })
    .closest('.blok') as HTMLElement
}

/** Åbner et bånds fold og giver den frem. Båndet er skærmens rygrad, og
    linjerne under det er de poster, rater, ydelser, overførsler og
    indbetalinger, året faktisk indeholdt. */
async function openBand(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<HTMLElement> {
  const summary = [...surplusBlock().querySelectorAll<HTMLElement>('summary')].find(
    (candidate) => candidate.querySelector('.m')?.textContent === label,
  )
  if (!summary) throw new Error(`Overskudsblokken har intet foldbart bånd for ${label}.`)
  await user.click(summary)
  const details = summary.closest('details') as HTMLDetailsElement
  expect(details.open, `${label} åbnede ikke`).toBe(true)
  return details
}

/** Etiketterne i overskudsblokkens stribe, i den rækkefølge de står, uden
    slutsummen. */
function surplusBandLabels(): (string | null)[] {
  return bandPosts().map((post) => post.querySelector('.m')?.textContent ?? null)
}

/** Båndenes beløb som tal, så striben kan lægges sammen og holdes op mod
    slutsummen — præcis den regning, brugeren selv ville lave. */
function surplusBandTotal(): number {
  return bandPosts().reduce(
    (total, post) => total + parseKroner(post.querySelector('.v')?.textContent ?? ''),
    0,
  )
}

function bandPosts(): HTMLElement[] {
  // Kun båndenes egne linjer: et bånd står enten som en stribelinje for sig
  // eller som hovedet på sin fold, og linjerne inde i folden er ikke bånd.
  return [
    ...surplusBlock().querySelectorAll<HTMLElement>(
      ':scope > .stribepost:not(.total), :scope > .baand > summary > .stribepost',
    ),
  ]
}

/** Et beløb som det står på skærmen, læst tilbage til et tal. */
function parseKroner(text: string): number {
  return Number(text.replace(/\./g, '').replace('−', '-'))
}

/** Et beløb i en af forklar-årets regnestriber, slået op på sin etiket. */
function stripeAmount(container: HTMLElement, label: string): string | null | undefined {
  return Array.from(container.querySelectorAll('.stribepost'))
    .find((post) => post.querySelector('.m')?.textContent === label)
    ?.querySelector('.v')?.textContent
}

/** Lofttabellens rækker i forklar-året, celle for celle. */
function capRows(): (string | null)[][] {
  const lofterne = screen
    .getByRole('heading', { name: 'Lofterne', level: 3 })
    .closest('.blok')!
    .querySelector('table.lofttabel') as HTMLElement
  return within(lofterne)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    )
}

/** Satsen i et skattelags egen linje i forklar-året. Lagtabellen har fire
    kolonner — lag, grundlag, sats, beløb — og det er den tredje. */
function lagSats(label: string): string {
  const table = document.querySelector('table.lagtabel') as HTMLElement
  const row = within(table)
    .getAllByRole('row')
    .find((candidate) => candidate.querySelector('td')?.textContent === label)
  if (!row) throw new Error(`Lagtabellen har ingen linje for ${label}.`)
  return row.querySelectorAll('td')[2]!.textContent ?? ''
}

/** Et objekts navn findes flere steder som en klikbar knap: navigatorrækken,
    formuegrafens legend for en beholdning, og tidslinjens boks for alt, der
    får en, jf. ADR-0036 — de skal kunne skelnes, ikke kun den ene findes.
    Denne henter navigatorens, som de fleste tests handler om. */
function navigatorButton(name: string | RegExp) {
  const navigatorspalte = document.querySelector('.navigatorspalte') as HTMLElement
  return within(navigatorspalte).getByRole('button', { name })
}

/** En plan, hvis allerførste år rører alle otte bånd: løn og en fast
    udgift, en ratepension der udbetaler, en livrente der omsættes med det
    samme, et lønkildet bidrag, og en overførsel i hver retning med bufferen
    i den ene ende. Pensionsudbetalingsalderen er tastet til 53 — den alder,
    ejeren fylder i 2026 — så året kan læses uden at rulle fjorten år frem.

    Fixturens `aPlanWithEveryBufferFlow` rører også dem alle, men aldrig i
    samme år: dens overførsler skifter retning ved erhvervsophøret. */
function aPlanWithEveryBand(): Plan {
  return aPlan({
    startYear: 2026,
    birthYear: 1973,
    horizon: 55,
    balance: 1_000_000,
    holdings: [
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        payoutAge: 53,
        balance: 1_000_000,
        grossReturn: 0,
        annualCostRate: 0,
        payout: { start: 53, duration: 10, principle: 'SerialPrinciple' },
      },
      {
        id: 'livrente',
        name: 'Livrente',
        variant: 'LifeAnnuity',
        payoutAge: 53,
        balance: 1_000_000,
        grossReturn: 0,
        annualCostRate: 0,
        quotedReserve: 1_000_000,
        quotedAnnualBenefit: 51_200,
        bonusRate: 0.01,
        payout: { start: 53 },
      },
      { ...aFreeHolding('opsparing', 'Opsparing'), balance: 500_000 },
      aFreeHolding('aktiedepot', 'Aktiedepot'),
    ],
    entries: [
      aSalary({ amountInRealKroner: 800_000 }),
      anExpense({ amountInRealKroner: 400_000 }),
    ],
    contributions: [
      aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.1 }),
    ],
    transfers: [
      aTransfer({
        id: 'hjemtagning',
        name: 'Ud af opsparingen',
        from: 'opsparing',
        to: 'free-assets',
        amountInRealKroner: 50_000,
      }),
      aTransfer({
        id: 'opsparing',
        name: 'Ind i aktiedepotet',
        from: 'free-assets',
        to: 'aktiedepot',
        amountInRealKroner: 30_000,
      }),
    ],
  })
}

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

/** En plan med en ratepension, der må udbetales fra planens allerførste år.
    Pensionsudbetalingsalderen er tastet til 53 — den alder, ejeren fylder i
    2026 — så udbetalingen kan ses uden at rulle fjorten år frem. Uden en
    udbetalingsplan bliver ordningen stående; med serieprincippet over ti år
    giver den en tiendedel af saldoen det første år. */
function aPlanWithRatepension(payout?: PayoutSchedule) {
  return aPlan({
    startYear: 2026,
    birthYear: 1973,
    horizon: 55,
    balance: 500_000,
    holdings: [
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
        payoutAge: 53,
        balance: 1_000_000,
        grossReturn: 0,
        annualCostRate: 0,
        ...(payout === undefined ? {} : { payout }),
      },
    ],
  })
}

/** Den samme plan med serieprincippet over ti år. */
function aPlanWithPayoutFromStart() {
  return aPlanWithRatepension({ start: 53, duration: 10, principle: 'SerialPrinciple' })
}

/** En plan med en livrente, der omsættes i planens allerførste år.
    Pensionsudbetalingsalderen er tastet til 53 — den alder, ejeren fylder i
    2026 — så omsætningen kan ses uden at rulle fjorten år frem.

    Selskabet oplyser et depot på 1.000.000 kr. og en årlig ydelse på 51.200
    kr.: kvotienten er 5,12 %, og på det fremskrevne depot på 1.000.000 kr.
    giver den en livsvarig ydelse på 51.200 kr. */
function aPlanWithLifeAnnuity(payout?: { start: AgeBound }) {
  return aPlan({
    startYear: 2026,
    birthYear: 1973,
    horizon: 55,
    balance: 500_000,
    holdings: [
      {
        id: 'livrente',
        name: 'Livrente',
        variant: 'LifeAnnuity',
        payoutAge: 53,
        balance: 1_000_000,
        grossReturn: 0,
        annualCostRate: 0,
        quotedReserve: 1_000_000,
        quotedAnnualBenefit: 51_200,
        bonusRate: 0.01,
        ...(payout === undefined ? {} : { payout }),
      },
    ],
  })
}

describe('fladen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('gemmer planen automatisk i localStorage ved ændring, uden en gem-knap', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    await user.click(navigatorButton(/Frie midler/))
    const balance = screen.getByLabelText(/Saldo/)
    await user.clear(balance)
    await user.type(balance, '2000000')

    const result = loadPlan()
    expect(result.kind).toBe('Loaded')
    expect((result as { plan: Plan }).plan.household.persons[0]!.holdings[0]!.balance).toBe(
      2_000_000,
    )
    expect(screen.queryByRole('button', { name: /gem/i })).toBeNull()
  })

  it('viser én række i årstabellen pr. simuleringsår, i nutidskroner', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')

    expect(rows).toHaveLength(1 + 3)
    expect(within(rows[1]!).getByText('2026')).toBeTruthy()
    expect(within(rows[3]!).getByText('2028')).toBeTruthy()

    // Udgiften er tastet i nutidskroner og står derfor uændret år efter år,
    // selv om motoren fremskriver den med inflationen bag facaden.
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    const udgifter = headers.indexOf('Udgifter')
    expect(headers).toEqual([
      'År',
      'Jesper',
      'Indtægter',
      'Indbetalinger',
      'Udbetalinger',
      'Afkast',
      'Skat',
      'Udgifter',
      'Overskud',
      'Buffer',
      'Formue',
    ])

    for (const row of rows.slice(1)) {
      const cells = within(row).getAllByRole('cell')
      expect(cells[udgifter]!.textContent).toBe('-40.000')
    }
  })

  it('viser årets overskud i sin egen kolonne, deflateret som de øvrige beløb', async () => {
    // Planen har ingen indtægt og ingen skat: året koster de 40.000, og det
    // er dem, der mangler at blive flyttet. Beløbet står i nutidskroner år
    // efter år, selv om motoren løfter udgiften med inflationen bag facaden.
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const overskud = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
      .indexOf('Overskud')

    for (const row of rows.slice(1)) {
      expect(within(row).getAllByRole('cell')[overskud]!.textContent).toBe('-40.000')
    }
  })

  it('regner årstabellen om, når saldoen rettes i skuffen — uden en beregn-knap', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    await user.click(navigatorButton(/Frie midler/))
    const balance = screen.getByLabelText(/Saldo/)
    await user.clear(balance)
    await user.type(balance, '2000000')

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // Bufferen er husstandens eneste beholdning her, så Buffer- og
    // Formue-kolonnen viser samme tal.
    expect(within(rows[1]!).getAllByText('1.960.000')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /beregn/i })).toBeNull()
  })

  it('kalder folkepensionens fremskrivning ved sit rette navn i planens skuffe', async () => {
    // Feltet løfter folkepensionens grundbeløb og pensionstillæg og intet
    // andet — ATP bærer sin egen sats som enhver anden indtægtspost, jf.
    // ADR-0023. Hed det stadig satsregulering, lovede navnet mere, end det
    // holder.
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ startYear: 2026 })} />)

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))

    const felt = screen.getByLabelText(/Folkepensionsregulering/) as HTMLInputElement
    expect(screen.queryByLabelText(/Satsregulering/)).toBeNull()

    await user.clear(felt)
    await user.type(felt, '2,5')
    expect((screen.getByLabelText(/Folkepensionsregulering/) as HTMLInputElement).value).toBe(
      '2,5',
    )
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

    await user.click(navigatorButton(/Faste udgifter/))
    expect(screen.queryByLabelText(/Skattebehandling/)).toBeNull()
    // Retningen vælges af den knap, posten blev skabt med, og kan ikke
    // skiftes bagefter: de to er to slags poster og ikke to tilstande af én.
    expect(screen.queryByLabelText(/Retning/)).toBeNull()

    await user.click(navigatorButton(/Løn/))
    expect(screen.getByLabelText(/Skattebehandling/)).toBeTruthy()
    expect(screen.queryByLabelText(/Retning/)).toBeNull()

    // Beløbet er lønsedlens løn, jf. ADR-0040. Feltet hedder det samme som
    // enhver anden posts — det er ikke længere en undtagelse — og noten
    // siger, hvor arbejdsgiverbidraget så hører hjemme.
    expect(screen.getByText(/lønsedlen kalder løn/i)).toBeTruthy()
    expect(screen.getByLabelText('Beløb')).toBeTruthy()

    // En udgiftspost har ingen firmaordning at nævne, og noten står ikke.
    await user.click(navigatorButton(/Faste udgifter/))
    expect(screen.queryByText(/lønsedlen kalder løn/i)).toBeNull()
  })

  it('lader en indtægtspost skifte til pensionsindkomst, og brutto-etiketten falder væk', async () => {
    // ATP skrives sådan her: en almindelig indtægtspost med den tredje
    // skattebehandling. Der er ingen ydelsesfigur at vælge i stedet, jf.
    // ADR-0023.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          inflationAssumption: 0,
          entries: [aSalary({ amountInRealKroner: 400_000 })],
        })}
      />,
    )

    await user.click(navigatorButton(/Løn/))
    await user.selectOptions(screen.getByLabelText(/Skattebehandling/), 'Pensionsindkomst')

    // Løftet om arbejdsgiverbidrag hører til arbejdsindkomsten alene — en
    // pensionsudbetaling har intet i sig.
    expect(screen.getByLabelText('Beløb')).toBeTruthy()
    expect(screen.queryByText(/brutto inklusive arbejdsgiverbidrag/i)).toBeNull()

    // Og skatten følger med: 400.000 uden AM-bidrag og uden arbejdsfradrag
    // koster 131.892 kr., hvor de samme 400.000 i løn koster 133.395.
    await showYearTable(user)
    expect(yearCell(1, 'Skat')).toBe('-131.892')
  })

  it('sætter kommune og kirkemedlemskab i personens inspektør, og årstabellen følger med', async () => {
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
    await showYearTable(user)

    const skat = () => yearCell(1, 'Skat')

    // Fixturens Jesper bor i Hvidovre og er medlem af folkekirken.
    expect(skat()).toBe('-220.506')

    await user.click(screen.getByRole('button', { name: /^Jesper/ }))
    await user.selectOptions(screen.getByLabelText(/Kommune/), 'København')

    // 431.500 kr. i skattepligtig indkomst efter personfradrag: 23,39 % i
    // kommuneskat og 0,80 % i kirkeskat i København, mod Hvidovres 25,40 %
    // og 0,72 %, jf. docs/satser/2026.md.
    expect(skat()).toBe('-212.178')

    await user.click(screen.getByLabelText(/Medlem af folkekirken/))
    expect(skat()).toBe('-208.726')
  })

  it('lister kommunerne alfabetisk i kommunevælgeren', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)
    await user.click(screen.getByRole('button', { name: /^Jesper/ }))

    const options = within(screen.getByLabelText(/Kommune/) as HTMLSelectElement)
      .getAllByRole('option')
      .map((option) => option.textContent)

    expect(options).toEqual([...options].sort((a, b) => a!.localeCompare(b!, 'da')))
  })

  it('viser en skattekolonne, der ikke er nul, når husstanden har en løn', async () => {
    // Posten står i testen og ikke i minimumsplanen: den plan, brugeren
    // møder, har ingen indtægt, og skattekolonnen er nul indtil hun skriver
    // en ind. Det er skatten af lønnen, der prøves her.
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })} />)
    await showYearTable(user)

    const skat = yearCell(1, 'Skat')

    expect(skat).not.toBe('0')
    expect(Number(skat!.replace(/\D/g, ''))).toBeGreaterThan(0)
  })

  it('viser nettoafkastet udledt af bruttoafkast og ÅOP i beholdningens inspektør', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({ grossReturn: 0.07, annualCostRate: 0.005 })}
      />,
    )

    await user.click(navigatorButton(/Frie midler/))

    // Komma er decimaltegnet i felterne, som det er det i `parseNumber`.
    expect((screen.getByLabelText(/Bruttoafkast/) as HTMLInputElement).value).toBe('7')
    expect((screen.getByLabelText(/ÅOP/) as HTMLInputElement).value).toBe('0,5')
    expect(screen.getByText('6,50 %')).toBeTruthy()
  })

  it('opdaterer nettoafkastet, når bruttoafkastet rettes i skuffen', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({ grossReturn: 0.07, annualCostRate: 0.005 })}
      />,
    )

    await user.click(navigatorButton(/Frie midler/))
    const bruttoafkast = screen.getByLabelText(/Bruttoafkast/)
    await user.clear(bruttoafkast)
    await user.type(bruttoafkast, '10')

    expect(screen.getByText('9,50 %')).toBeTruthy()
  })

  it('lader et decimaltal tastes i bruttoafkast og ÅOP', async () => {
    // Kommaet er decimaltegnet, jf. `parseNumber`. Feltet må ikke skrive
    // brugerens tekst om, mens der tastes: "7," parser til 7, og skrev feltet
    // sig selv tilbage til "7", ville kommaet blive ædt ved hvert tastetryk,
    // og en sats med decimaler kunne aldrig indtastes.
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ grossReturn: 0.07, annualCostRate: 0.005 })} />)

    await user.click(navigatorButton(/Frie midler/))
    const bruttoafkast = screen.getByLabelText(/Bruttoafkast/) as HTMLInputElement
    await user.clear(bruttoafkast)
    await user.type(bruttoafkast, '7,5')

    expect(bruttoafkast.value).toBe('7,5')

    const aaop = screen.getByLabelText(/ÅOP/) as HTMLInputElement
    await user.clear(aaop)
    await user.type(aaop, '0,25')

    expect(aaop.value).toBe('0,25')
    expect(screen.getByText('7,25 %')).toBeTruthy()
  })

  it('skriver talfeltet rent, når det forlades', async () => {
    // Teksten er kun sandheden, mens feltet har fokus. "7," parser til 7, og
    // bliver feltet stående med kommaet, viser skuffen noget andet end det,
    // planen indeholder.
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ grossReturn: 0.07 })} />)

    await user.click(navigatorButton(/Frie midler/))
    const bruttoafkast = screen.getByLabelText(/Bruttoafkast/) as HTMLInputElement
    await user.clear(bruttoafkast)
    await user.type(bruttoafkast, '7,')

    expect(bruttoafkast.value).toBe('7,')

    await user.tab()

    expect(bruttoafkast.value).toBe('7')
  })

  it('viser den nye beholdnings sats, når en anden beholdning vælges', async () => {
    // Modstykket til testen ovenfor: talfeltet holder på sin egen tekst, mens
    // der tastes, og må derfor ikke blive stående med den forrige beholdnings
    // sats, når navigatoren peger et nyt sted hen.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(navigatorButton(/Frie midler/))
    const bruttoafkast = () => screen.getByLabelText(/Bruttoafkast/) as HTMLInputElement
    await user.clear(bruttoafkast())
    await user.type(bruttoafkast(), '7,5')

    await user.click(navigatorButton(/Anden beholdning/))

    expect(bruttoafkast().value).toBe('0')
  })

  it('lader en beholdnings type vælges mellem de syv, med deres danske navne', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(navigatorButton(/Anden beholdning/))
    const type = screen.getByLabelText(/Type/) as HTMLSelectElement

    // Fixturens beholdning er en opsparingskonto. Ordningerne står først og de
    // frie midler til sidst, samme rækkefølge som varianttabellen — og intet
    // engelsk identifier når skærmen.
    expect(type.value).toBe('Opsparingskonto')
    expect(Array.from(type.options).map((option) => option.value)).toEqual([
      'Ratepension',
      'Livrente',
      'Aldersopsparing',
      'Kapitalpension',
      'Aktiesparekonto',
      'Aktiedepot',
      'Opsparingskonto',
    ])

    // Valget skriver en plan, motoren kan regne på: resultatspalten viser
    // stadig årstabellen og ikke beskeden om, at planen ikke kan simuleres.
    await user.selectOptions(type, 'Aktiesparekonto')
    expect(type.value).toBe('Aktiesparekonto')
    await showYearTable(user)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
  })

  it('giver en ny kapitalpension en pensionsudbetalingsalder, brugeren taster', async () => {
    // Ordningen er en `PensionScheme` som de tre øvrige: uden en
    // pensionsudbetalingsalder var planen ikke fuldt beskrevet. Feltet
    // lander på nul, og brugeren taster det, selskabet oplyser, i feltet
    // ved siden af.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(navigatorButton(/Anden beholdning/))
    await user.selectOptions(screen.getByLabelText(/Type/), 'Kapitalpension')

    const alder = screen.getByLabelText('Pensionsudbetalingsalder')
    expect((alder as HTMLInputElement).value).toBe('0')

    await user.clear(alder)
    await user.type(alder, '60')

    // Og planen kan så regnes: resultatspalten viser årstabellen og ikke
    // beskeden om, at planen ikke kan simuleres.
    await showYearTable(user)
    expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
  })

  it('udelader Aktiesparekonto i typelisten, når personen allerede har en anden', async () => {
    // ASKL § 3 tillader kun én pr. person, og `validatePlan` afviser to. Stod
    // varianten i listen, kunne ét klik lade hele resultatspalten forsvinde,
    // mens brugeren ledte efter, hvad de gjorde galt, jf. ADR-0020.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          holdings: [aShareSavingsAccount(), aFreeHolding('anden-beholdning', 'Anden beholdning')],
        })}
      />,
    )

    await user.click(navigatorButton(/Anden beholdning/))

    expect(typeOptions()).not.toContain('Aktiesparekonto')

    // Kontoen selv skal blive ved med at vise sin egen værdi. Faldt den ud af
    // sin egen liste, stod feltet tomt, og beholdningen kunne ikke redigeres.
    await user.click(navigatorButton(/Aktiesparekonto/))

    expect((screen.getByLabelText(/Type/) as HTMLSelectElement).value).toBe('Aktiesparekonto')
    expect(typeOptions()).toContain('Aktiesparekonto')
  })

  it('tilbyder stadig Aktiesparekonto i ægtefællens typeliste, når den ene har en', async () => {
    // Modprøve på, at reglen er personens og ikke husstandens — samme skel
    // som loftets, jf. ADR-0018. En filtrering, der talte husstandens
    // beholdninger, ville lukke for en konto, ægtefællen har lov til at have,
    // og den ville se lige så rigtig ud som den rigtige uden denne test.
    const user = userEvent.setup()
    const base = aPlan({ holdings: [aShareSavingsAccount()] })
    const jesper = base.household.persons[0]!
    render(
      <App
        initialPlan={{
          ...base,
          household: {
            persons: [
              jesper,
              {
                ...jesper,
                id: 'maria',
                name: 'Maria',
                holdings: [aFreeHolding('marias-frie-midler', 'Marias frie midler')],
              },
            ],
          },
        }}
      />,
    )

    await user.click(navigatorButton(/Marias frie midler/))

    expect(typeOptions()).toContain('Aktiesparekonto')
  })

  it('tilbyder ikke ordningerne som type for bufferen', async () => {
    // Bufferen skal være frie midler, jf. ADR-0004: årets restpost lander på
    // den, og en ordning kan ikke tage imod frit forbrug. Bufferradioen bærer
    // allerede reglen fra sin ende, men typelisten gjorde ikke — og ét klik
    // kunne gøre bufferen til en ordning. Den plan kan hverken simuleres
    // eller indlæses igen, og fladen skal bære reglen, så afvisningen aldrig
    // nås, jf. ADR-0020.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Frie midler/))

    expect(typeOptions()).toEqual(['Aktiedepot', 'Opsparingskonto'])

    // Modprøve på, at reglen gælder bufferen og ikke enhver beholdning. En
    // filtrering, der lukkede for meget, ville gøre enhver beholdning
    // uomdannelig og se lige så grøn ud som den rigtige.
    await user.click(navigatorButton(/Ratepension/))

    expect(typeOptions()).toContain('Ratepension')
  })

  it('tilbyder ikke lønposterne som kilde, når indbetalingen går til en aktiesparekonto', async () => {
    // Der findes ingen arbejdsgiveradministreret aktiesparekonto, og en
    // lønkildet indbetaling til den kan derfor ikke ske, jf. ADR-0020. Stod
    // lønposten i listen, kunne ét klik skrive en plan, `validatePlan`
    // afviser, og hele resultatspalten forsvandt.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          holdings: [aShareSavingsAccount()],
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'aktiesparekonto',
              amountInRealKroner: 20_000,
            }),
          ],
        })}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))
    const kilde = screen.getByLabelText(/Kilde/) as HTMLSelectElement

    expect(Array.from(kilde.options).map((option) => option.value)).toEqual([
      'Frie midler · Jesper',
    ])
    // Og gruppen står ikke tom tilbage: en overskrift uden noget under sig
    // ville se ud som en liste, der mangler at blive fyldt.
    expect(kilde.querySelector('optgroup[label="Lønposter"]')).toBeNull()
  })

  it('flytter destinationen med, når kilden skifter til ægtefællens lønpost', async () => {
    // En lønkildet indbetaling skal ende i lønmodtagerens egen ordning, jf.
    // ADR-0028. Skiftede kilden alene, blev bidraget stående på Jespers
    // ordning med Marias løn som kilde — en plan `validatePlan` afviser — og
    // destinationsfeltet viste tilmed Marias ordning, fordi planens egen
    // faldt ud af listen.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSpouse()} />)

    await user.click(navigatorButton(/Indbetalingen/))
    await user.selectOptions(screen.getByLabelText(/Kilde/), 'Løn · Maria')

    expect((screen.getByLabelText(/Destination/) as HTMLSelectElement).value).toBe(
      'Marias ratepension',
    )
    expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
  })

  it('tilbyder ikke ægtefællens lønpost som kilde, når ægtefællen ingen ordning har', async () => {
    // Der er ingen destination at flytte med over, og valget kunne kun ende
    // i en plan, motoren afviser. Så står posten ikke i listen, jf. ADR-0020.
    const user = userEvent.setup()
    const withoutMariasPension = (plan: Plan): Plan => ({
      ...plan,
      household: {
        persons: [
          plan.household.persons[0]!,
          { ...plan.household.persons[1]!, holdings: [aFreeHolding('marias-frie', 'Marias frie')] },
        ],
      },
    })
    render(<App initialPlan={withoutMariasPension(aPlanWithSpouse())} />)

    await user.click(navigatorButton(/Indbetalingen/))

    // Hendes frie midler står der derimod: de må betale til Jespers ordning,
    // jf. ADR-0028 — det er kun lønnen, der er bundet til sin egen ejer.
    expect(optionsOf('Kilde')).toEqual([
      'Løn · Jesper',
      'Frie midler · Jesper',
      'Marias frie · Maria',
    ])
  })

  it('udelader kapitalpensionen fra indbetalingens destinationsliste', async () => {
    // Ordningen har været lukket for indbetaling siden udgangen af 2012, og
    // et valg her ville kun blive afvist bagefter, jf. ADR-0020.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          holdings: [
            aPensionHolding('ratepension', 'Ratepension'),
            aHolding({
              id: 'kapitalpension',
              name: 'Kapitalpension',
              variant: 'CapitalPension',
              payoutAge: 60,
              balance: 0,
              grossReturn: 0,
              annualCostRate: 0,
            }),
          ],
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        })}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))

    expect(optionsOf('Destination')).not.toContain('Kapitalpension')
  })

  it('viser planens egen destination, når den ligger hos en anden person', async () => {
    // Modprøve på, at feltet ikke lyver. En plan, hvor de to ender er faldet
    // fra hinanden, skal kunne rettes: vises listens første i stedet for
    // planens egen, står skuffen og siger noget andet end fejlbeskeden, og
    // det rigtige valg kan ikke træffes, fordi det allerede står i feltet.
    const user = userEvent.setup()
    const plan = aPlanWithSpouse()
    render(
      <App
        initialPlan={{
          ...plan,
          contributions: [
            aContribution({ source: 'marias-loen', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))

    expect((screen.getByLabelText(/Destination/) as HTMLSelectElement).value).toBe('Ratepension')

    // Og valget er der: ægtefællens egen ordning står i listen ved siden af.
    await user.selectOptions(screen.getByLabelText(/Destination/), 'Marias ratepension')

    expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
  })

  it('lader bufferen betale til ægtefællens aktiesparekonto', async () => {
    // Alt årets overskud lander på bufferen, og den har én ejer. Kunne et
    // beholdningskildet bidrag ikke krydse ejerskellet, kunne ingen ordning
    // hos den anden person nås uden en mellemstation af frie midler, jf.
    // ADR-0028.
    const user = userEvent.setup()
    const base = aPlanWithSpouse()
    const maria = base.household.persons[1]!
    render(
      <App
        initialPlan={{
          ...base,
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'ratepension',
              amountInRealKroner: 20_000,
            }),
          ],
          household: {
            persons: [
              base.household.persons[0]!,
              { ...maria, holdings: [...maria.holdings, aShareSavingsAccount()] },
            ],
          },
        }}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))
    await user.selectOptions(screen.getByLabelText(/Destination/), 'Aktiesparekonto')

    // Kilden bliver stående: den beholdningskildede udgave har ingen ejer at
    // følge med over.
    expect((screen.getByLabelText(/Kilde/) as HTMLSelectElement).value).toBe(
      'Frie midler · Jesper',
    )
    expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
  })

  it('flytter kilden til de frie midler, når destinationen skifter til en aktiesparekonto', async () => {
    // Aktiesparekontoen kan ikke tage imod en lønkildet indbetaling, og
    // destinationen kan alligevel vælges: bidraget skifter udgave med, som
    // det gør, når en gentagelse bliver til "Én gang" og forfaldet må følge
    // med. Ét klik, og planen kan fortsat simuleres.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          holdings: [aPensionHolding('ratepension', 'Ratepension'), aShareSavingsAccount()],
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        })}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))
    await user.selectOptions(screen.getByLabelText(/Destination/), 'Aktiesparekonto')

    expect((screen.getByLabelText(/Kilde/) as HTMLSelectElement).value).toBe('Frie midler · Jesper')
    expect((screen.getByLabelText(/Destination/) as HTMLSelectElement).value).toBe(
      'Aktiesparekonto',
    )
    expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
  })

  it('stiller typen øverst i beholdningens skuffe, lige under navnet', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(navigatorButton(/Anden beholdning/))

    // Typen afgør, hvad resten af felterne betyder, og står derfor før dem.
    expect(sectionLabels('Beholdningen')).toEqual([
      'Navn',
      'Type',
      'Ejer',
      'Saldo',
      'Buffer',
    ])
  })

  it('viser nettoafkastet udledt af bruttoafkast og ÅOP også for en pensionsbeholdning', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Ratepension/))

    // ÅOP'ens betydning bliver synlig, hvor beløbene er størst: 7 % minus
    // 0,5 % er 6,5 %, og feltet er udledt frem for tastet.
    const nettoafkast = lockedField('Nettoafkast')
    expect(nettoafkast.querySelector('.laast')!.textContent).toBe('6,50 %')
    expect(nettoafkast.textContent).toContain('udledt')
  })

  it('viser ordningens pensionsudbetalingsalder som et tastet felt', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Ratepension/))

    expect((screen.getByLabelText('Pensionsudbetalingsalder') as HTMLInputElement).value).toBe(
      '67',
    )
  })

  it('retter pensionsudbetalingsalderen, når brugeren taster et nyt tal', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Ratepension/))
    const alder = screen.getByLabelText('Pensionsudbetalingsalder')
    await user.clear(alder)
    await user.type(alder, '60')

    expect((alder as HTMLInputElement).value).toBe('60')
  })

  it('viser ingen pensionsudbetalingsalder på en aktiesparekonto', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ holdings: [aShareSavingsAccount()] })} />)

    await user.click(navigatorButton(/Aktiesparekonto/))

    // Kontoen har ingen: ejeren hæver af den, når hun vil, og et felt om en
    // udbetalingsalder ville påstå en lovregel, der ikke findes.
    expect(screen.queryByLabelText('Pensionsudbetalingsalder')).toBeNull()
  })

  it('lader ikke bufferen udpeges til en pensionsbeholdning, og siger hvorfor', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Ratepension/))
    const buffer = screen.getByLabelText(/Buffer/) as HTMLInputElement

    expect(buffer.checked).toBe(false)
    expect(buffer.disabled).toBe(true)
    // Reglen står i skuffen frem for at være et felt, der forsvandt.
    expect(screen.getByText(/Bufferen skal være frie midler/i)).toBeTruthy()

    await user.click(buffer)

    await user.click(navigatorButton(/Frie midler/))
    expect((screen.getByLabelText(/Buffer/) as HTMLInputElement).checked).toBe(true)
  })

  it('lader en posts forfald vælges som jævnt fordelt eller en bestemt måned', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    const forfald = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(forfald.value).toBe('Jævnt fordelt')

    await user.selectOptions(forfald, 'Juni')
    expect(forfald.value).toBe('Juni')
  })

  it('viser Gentagelse som det første felt i Perioden, både for poster og overførsler', async () => {
    const user = userEvent.setup()

    const entryRender = render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )
    await user.click(navigatorButton(/Faste udgifter/))
    expect(firstPeriodenFelt(entryRender.container)).toBe('Gentagelse')
    entryRender.unmount()

    const transferRender = render(
      <App
        initialPlan={{
          ...aPlanWithSecondHolding(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )
    await user.click(navigatorButton(/Overførslen/))
    expect(firstPeriodenFelt(transferRender.container)).toBe('Gentagelse')
  })

  it('lader forankringen vælges, og periodefelterne skifter mellem årstal og aldre', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    expect(screen.getByLabelText(/Fra \(år\)/)).toBeTruthy()
    expect(screen.queryByLabelText(/Fra \(alder\)/)).toBeNull()

    await user.selectOptions(screen.getByLabelText(/Forankring/), 'Alder')

    expect(screen.queryByLabelText(/Fra \(år\)/)).toBeNull()
    expect(screen.getByLabelText(/Fra \(alder\)/)).toBeTruthy()
  })

  it('spørger kun om N, når gentagelsen er "Hvert N. år"', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    expect(screen.queryByLabelText(/Hvert/)).toBeNull()

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Hvert N. år')
    expect(screen.getByLabelText(/Hvert/)).toBeTruthy()

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Én gang')
    expect(screen.queryByLabelText(/Hvert/)).toBeNull()
  })

  it('samler en engangsposts periode til ét årsfelt og fjerner "Jævnt fordelt" fra forfald', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          entries: [anExpense({ amountInRealKroner: 40_000, timing: 'Even' })],
        })}
      />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    expect(screen.getByLabelText(/Fra \(år\)/)).toBeTruthy()
    const forfaldFoer = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(
      Array.from(forfaldFoer.options).map((option) => option.value),
    ).toContain('Jævnt fordelt')

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Én gang')

    // Fra/Til er blevet til ét samlet årsfelt.
    expect(screen.queryByLabelText(/Fra \(år\)/)).toBeNull()
    expect(screen.queryByLabelText(/Til \(år\)/)).toBeNull()
    const aar = screen.getByLabelText('År') as HTMLInputElement
    expect(aar.value).toBe('2026')

    // "Jævnt fordelt" er ikke længere et gyldigt valg, og forfaldet er
    // rettet til et bestemt tidspunkt i stedet.
    const forfald = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(
      Array.from(forfald.options).map((option) => option.value),
    ).not.toContain('Jævnt fordelt')
    expect(forfald.value).toBe('Januar')
  })

  it('lader et halvskrevet tal stå i et periodefelt og skriver det rent ved blur', async () => {
    // Samme regel som i bruttoafkast. Periodefelterne rummer heltal, så et
    // komma er nonsens dér — men reglen om, hvornår teksten er sandheden, må
    // ikke afhænge af, hvilket af skuffens talfelter man står i.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          entries: [anExpense({ amountInRealKroner: 40_000 })],
        })}
      />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    const til = screen.getByLabelText(/Til \(år\)/) as HTMLInputElement
    await user.type(til, '2035,')

    expect(til.value).toBe('2035,')

    await user.tab()

    expect(til.value).toBe('2035')
  })

  it('regner postens note om, når satsen rettes i skuffen', async () => {
    // Notens indhold prøves i entryNote.test.ts. Denne prøver koblingen: at
    // en rettelse i skuffen når hele vejen gennem simuleringen og tilbage til
    // noten uden en beregn-knap. 100.000 × 1,05^10 = 162.889 kr. i 2036,
    // mens planens inflation på 2 % ville have givet 121.899 kr.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          inflationAssumption: 0.02,
          entries: [
            aSalary({
              amountInRealKroner: 100_000,
              timing: 1,
              period: { anchor: 'CalendarYear', from: 2036, to: 2036 },
              recurrence: { kind: 'Once' },
              regulationRate: 0.05,
            }),
          ],
        })}
      />,
    )

    await user.click(navigatorButton(/Løn/))

    expect(screen.getByText(/Posten falder i 2036 med 162\.889 kr\./)).toBeTruthy()

    await user.clear(screen.getByLabelText(/Reguleringssats/))

    expect(screen.getByText(/Posten falder i 2036 med 100\.000 kr\./)).toBeTruthy()
  })

  it('lader indtægtens reguleringssats redigeres uafhængigt af planens inflation', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          inflationAssumption: 0.02,
          entries: [aSalary({ amountInRealKroner: 40_000, regulationRate: 0.03 })],
        })}
      />,
    )

    await user.click(navigatorButton(/Løn/))
    const regulering = screen.getByLabelText(/Reguleringssats/) as HTMLInputElement
    expect(regulering.value).toBe('3')

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))
    expect((screen.getByLabelText(/Inflation/) as HTMLInputElement).value).toBe('2')

    await user.click(navigatorButton(/Løn/))
    await user.clear(screen.getByLabelText(/Reguleringssats/))
    await user.type(screen.getByLabelText(/Reguleringssats/), '5')
    expect((screen.getByLabelText(/Reguleringssats/) as HTMLInputElement).value).toBe('5')

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))
    expect((screen.getByLabelText(/Inflation/) as HTMLInputElement).value).toBe('2')
  })

  it('lader et periodeendepunkt sættes til erhvervsophør via afkrydsningsfeltet', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          birthYear: 1973,
          workEndAge: 60,
          entries: [anExpense({ amountInRealKroner: 40_000 })],
        })}
      />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    await user.selectOptions(screen.getByLabelText(/Forankring/), 'Alder')

    const til = screen.getByLabelText(/Til \(alder\)/) as HTMLInputElement
    // "Fra" og "Til" har hver sit afkrydsningsfelt — "Til" er det andet.
    const [, tilErhvervsophoer] = screen.getAllByRole('checkbox', {
      name: /erhvervsophør/i,
    })
    await user.click(tilErhvervsophoer!)

    // Feltet er skrivebeskyttet og viser erhvervsophørsalderen frem for at
    // stå tomt — alderen er det, spørgsmålet handler om, og den skal kunne
    // læses uden at klikke tilvalget fra igen.
    expect(til.readOnly).toBe(true)
    expect(til.value).toBe('60')

    // Født 1973, erhvervsophør 60 falder i 2033, men `Til` regner det år
    // ikke med. Posten har intet fra-endepunkt og løber derfor fra planens
    // start.
    expect(screen.getByText(/Posten løber 2026–2032\./)).toBeTruthy()
  })

  it('lægger erhvervsophør-tilvalget på sin egen linje, ikke i enhedskolonnen', async () => {
    // Enhedskolonnen er 40px og deles af hvert felt i skuffen. Lå
    // afkrydsningen i den, sprængte "erhvervsophør" bredden, og aldersfeltets
    // input stod forskudt fra alle andre felter i sektionen.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })}
      />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    await user.selectOptions(screen.getByLabelText(/Forankring/), 'Alder')

    const fra = screen.getByLabelText(/Fra \(alder\)/)
    const vaerdi = fra.closest('.vaerdi') as HTMLElement

    expect(vaerdi.querySelector('input[type="checkbox"]')).toBeNull()
    expect(within(vaerdi).getByText('år')).toBeTruthy()

    // Afkrydsningen er der stadig — den er bare flyttet ud af rækken.
    expect(
      screen.getAllByRole('checkbox', { name: /erhvervsophør/i }).length,
    ).toBe(2)
  })

  it('lader et halvskrevet tal stå i et aldersfelt og viser erhvervsophøret ved tilvalg', async () => {
    // Aldersfeltet er den tredje slags værdi: en alder, ingenting, eller en
    // henvisning til erhvervsophøret. Reglen om teksten er den samme, og
    // henvisningen er ikke et tal, brugeren har tastet — den vises som
    // ejerens alder og viger, når tilvalget fjernes igen.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })}
      />,
    )

    await user.click(navigatorButton(/Faste udgifter/))
    await user.selectOptions(screen.getByLabelText(/Forankring/), 'Alder')

    const fra = () => screen.getByLabelText(/Fra \(alder\)/) as HTMLInputElement
    await user.type(fra(), '62,')

    expect(fra().value).toBe('62,')

    await user.tab()

    expect(fra().value).toBe('62')

    // Fixturens ejer ophører som 58-årig.
    const tilvalg = () => screen.getAllByRole('checkbox', { name: /erhvervsophør/i })[0]!
    await user.click(tilvalg())
    expect(fra().value).toBe('58')

    await user.click(tilvalg())
    expect(fra().value).toBe('')
  })

  it('tilføjer person nummer to via husstandsgruppen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    // Navigatorens gruppehoved for Husstanden viser også personnavnene i sit
    // resumé, så rækken findes med et anker i starten af navnet — ellers
    // rammer forespørgslen begge knapper.
    expect(screen.queryByRole('button', { name: /^Person 2/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: '+ Person' }))

    expect(screen.getByRole('button', { name: /^Person 2/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ Person' })).toBeNull()
  })

  it('fjerner person nummer to igen fra dennes inspektør', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: '+ Person' }))
    await user.click(screen.getByRole('button', { name: /^Person 2/ }))
    await user.click(screen.getByRole('button', { name: /Fjern person/ }))

    expect(screen.queryByRole('button', { name: /^Person 2/ })).toBeNull()
    expect(screen.getByRole('button', { name: '+ Person' })).toBeTruthy()
    // Skuffen lukker, fordi den viste person ikke findes mere.
    expect(screen.queryByLabelText(/Fjern person/)).toBeNull()
  })

  it('kan ikke fjerne den sidste person i husstanden', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: /^Jesper/ }))
    expect(screen.queryByRole('button', { name: /Fjern person/ })).toBeNull()
  })

  it('fjerner en beholdning igen fra dennes inspektør', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(navigatorButton(/Anden beholdning/))
    await user.click(screen.getByRole('button', { name: /Fjern beholdning/ }))

    expect(screen.queryByRole('button', { name: /Anden beholdning/ })).toBeNull()
    // Skuffen lukker, fordi den viste beholdning ikke findes mere.
    expect(screen.queryByLabelText(/Fjern beholdning/)).toBeNull()
  })

  it('fjerner en indtægt igen fra dennes inspektør', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ entries: [aSalary({ amountInRealKroner: 400_000 })] })} />)

    await user.click(navigatorButton(/Løn/))
    await user.click(screen.getByRole('button', { name: /Fjern indtægt/ }))

    expect(screen.queryByRole('button', { name: /Løn/ })).toBeNull()
  })

  it('fjerner en overførsel igen fra dennes inspektør', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 1_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))
    await user.click(screen.getByRole('button', { name: /Fjern overførsel/ }))

    expect(screen.queryByRole('button', { name: /Overførslen/ })).toBeNull()
  })

  it('flytter en beholdning til en anden ejer via ejer-vælgeren', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: '+ Person' }))
    await user.click(navigatorButton(/Frie midler/))

    const ejer = screen.getByLabelText(/Ejer/) as HTMLSelectElement
    expect(ejer.value).toBe('Jesper')
    expect(Array.from(ejer.options).map((option) => option.value)).toEqual([
      'Jesper',
      'Person 2',
    ])

    await user.selectOptions(ejer, 'Person 2')

    expect(ejer.value).toBe('Person 2')
    // Beholdningen er flyttet, ikke duplikeret.
    const beholdninger = navigatorButton(/Beholdninger/)
    expect(within(beholdninger).getByText('1')).toBeTruthy()
  })

  it('flytter en post til en anden ejer via ejer-vælgeren', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: '+ Person' }))
    await user.click(navigatorButton(/Faste udgifter/))

    const ejer = screen.getByLabelText(/Ejer/) as HTMLSelectElement
    expect(ejer.value).toBe('Jesper')
    expect(Array.from(ejer.options).map((option) => option.value)).toEqual([
      'Jesper',
      'Person 2',
    ])

    await user.selectOptions(ejer, 'Person 2')
    expect(ejer.value).toBe('Person 2')
  })

  it('viser folkepensionsalderen udledt af fødselsdatoen, og markerer et skøn som sådan', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ birthYear: 1985, birthMonth: 6 })} />)

    await user.click(screen.getByRole('button', { name: /^Jesper/ }))

    expect(screen.getByText('72,5 år')).toBeTruthy()
    expect(screen.getByText(/skøn/i)).toBeTruthy()
  })

  it('tilbyder ingen overstyring af folkepensionsalderen — tabellen er eneste kilde', async () => {
    // Skønnet for et ikke-vedtaget trin er det bedste tal, der findes, og
    // det bruges som det er. Vedtager Folketinget noget andet, rettes
    // datagrundlaget, og alderen flytter sig i enhver plan af sig selv.
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ birthYear: 1985, birthMonth: 6 })} />)

    await user.click(screen.getByRole('button', { name: /^Jesper/ }))

    expect(screen.queryByLabelText(/Overstyr/i)).toBeNull()
    expect(screen.getByText('72,5 år')).toBeTruthy()
  })

  it('viser hver persons alder i årstabellen, én kolonne pr. person', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    const alder = headers.indexOf('Jesper')

    // Startår 2026, født 1973.
    expect(within(rows[1]!).getAllByRole('cell')[alder]!.textContent).toBe('53')
    expect(within(rows[3]!).getAllByRole('cell')[alder]!.textContent).toBe('55')
  })

  it('får en ekstra alderskolonne, når husstanden får person nummer to', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    await user.click(screen.getByRole('button', { name: '+ Person' }))

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)

    expect(headers).toContain('Jesper')
    expect(headers).toContain('Person 2')
  })

  it('deler posterne i Indtægter og Udgifter i navigatoren', () => {
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

    const indtaegter = navigatorButton(/Indtægter/)
    const udgifter = navigatorButton(/Udgifter/)

    // Grupperne viser kun deres antal — ikke en sum, der ville blive
    // misvisende af poster med begrænset periode eller gentagelse. De
    // nøjagtige tal står i årstabellen i stedet.
    expect(within(indtaegter).getByText('1')).toBeTruthy()
    expect(within(udgifter).getByText('1')).toBeTruthy()

    expect(navigatorButton(/Faste udgifter/)).toBeTruthy()
    expect(navigatorButton(/Løn/)).toBeTruthy()
  })

  it('viser overførsler som sin egen gruppe i navigatoren, med flytningens navn i rækken', () => {
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          transfers: [
            aTransfer({
              name: 'Tømning af opsparingen',
              from: 'free-assets',
              to: 'anden-beholdning',
              amountInRealKroner: 50_000,
            }),
          ],
        }}
      />,
    )

    const gruppe = navigatorButton(/Overførsler/)
    expect(within(gruppe).getByText('1')).toBeTruthy()
    // Rækken viser flytningens eget navn og ikke dens to ender: en etikette,
    // der læste sig selv af beholdningerne, ville skifte under brugeren,
    // hver gang en ende blev valgt om.
    expect(navigatorButton(/Tømning af opsparingen/)).toBeTruthy()
  })

  it('viser indbetalinger som sin egen gruppe i navigatoren, med bidragets navn i rækken', () => {
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({
              name: 'Firmapension',
              source: 'salary',
              to: 'ratepension',
              percentageOfEntry: 0.08,
            }),
          ],
        }}
      />,
    )

    const gruppe = navigatorButton(/Indbetalinger/)
    expect(within(gruppe).getByText('1')).toBeTruthy()
    // Ingen sum i gruppen: en procent af en lønpost har intet kronebeløb, før
    // året er regnet, og navigatoren viser kun planen.
    expect(navigatorButton(/Firmapension/)).toBeTruthy()
    expect(within(navigatorButton(/Firmapension/)).getByText('8,00 %')).toBeTruthy()
  })

  it('viser i indbetalingens skuffe destination og beløb, og ikke de felter bidraget ikke har', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))

    expect(sectionLabels('Indbetalingen')).toEqual(['Navn', 'Kilde', 'Destination'])
    // Ét beløbsfelt og ikke to: formen er feltets enhed og ikke et spørgsmål
    // ved siden af det, så kontakten står, hvor enheden ellers stod.
    expect(sectionLabels('Beløb')).toEqual(['Beløb'])

    // Begge former er synlige uden at åbne noget, jf. fladekortet — en vælger
    // ville skjule den ene bag et klik.
    expect(screen.getByRole('button', { name: '%', pressed: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'kr.', pressed: false })).toBeTruthy()

    // Periode, forankring, gentagelse og forfald hører til lønposten. Bidraget
    // har dem ikke — hverken som felter eller som grå felter — og ruden siger
    // i stedet, hvorfra de arves.
    expect(screen.queryByLabelText('Forankring')).toBeNull()
    expect(screen.queryByLabelText('Gentagelse')).toBeNull()
    expect(screen.queryByLabelText('Forfald')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Følger Løn' })).toBeTruthy()
  })

  it('viser i det beholdningskildede bidrags skuffe de felter, det bærer selv', async () => {
    // Samme figur i to udgaver, ikke to slags: kilden er det eneste, der
    // skiller dem. En beholdning har ingen periode at låne ud, så bidraget
    // bærer den selv — og kan til gengæld aldersforankres, hvor overførslen
    // ikke kan, fordi destinationen har en ejer.
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'ratepension',
              amountInRealKroner: 50_000,
            }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))

    expect(sectionLabels('Indbetalingen')).toEqual(['Navn', 'Kilde', 'Destination'])
    // Kun den ene beløbsform: en procent skal have en post at måle af, og
    // enheden står derfor som ren tekst frem for som en kontakt, der ville
    // være et valg, der aldrig kan træffes.
    expect(sectionLabels('Beløb')).toEqual(['Beløb'])
    expect(screen.queryByRole('button', { name: '%' })).toBeNull()
    expect(sectionLabels('Perioden')).toEqual([
      'Gentagelse',
      'Forankring',
      'Fra (år)',
      'Til (år)',
      'Forfald',
    ])
    // Der er ingen post at følge — arvelinjen hører til den anden udgave.
    expect(screen.queryByRole('heading', { name: /^Følger/ })).toBeNull()
  })

  it('omdøber en indbetaling fra skuffen', async () => {
    // Navnefeltet står med bidragets navn som en beholdnings — almindelig
    // tekst, der bliver stående, mens der rettes i den.
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'ratepension',
              amountInRealKroner: 50_000,
            }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))
    const navn = screen.getByLabelText('Navn') as HTMLInputElement
    expect(navn.value).toBe('Indbetalingen')

    await user.clear(navn)
    await user.type(navn, 'Efterlønsindskud')

    expect(navigatorButton(/Efterlønsindskud/)).toBeTruthy()
    expect((screen.getByLabelText('Navn') as HTMLInputElement).value).toBe(
      'Efterlønsindskud',
    )
  })

  it('skifter indbetalingens rude, når kilden skifter fra en lønpost til en beholdning', async () => {
    // Kilden er ét spørgsmål, og ruden skifter form efter svaret. Arvelinjen
    // forsvinder sammen med posten, og felterne, bidraget nu bærer selv,
    // træder frem i stedet — samme figur i to udgaver, ikke to dialoger.
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        }}
      />,
    )
    await user.click(navigatorButton(/Indbetalingen/))
    expect(screen.getByRole('heading', { name: 'Følger Løn' })).toBeTruthy()

    // Vælgeren har begge slags kilder at tilbyde, i hver sin gruppe.
    const kilde = screen.getByLabelText('Kilde')
    expect(within(kilde).getByRole('group', { name: 'Lønposter' })).toBeTruthy()
    expect(within(kilde).getByRole('group', { name: 'Beholdninger' })).toBeTruthy()

    await user.selectOptions(kilde, 'Frie midler · Jesper')

    expect(screen.queryByRole('heading', { name: /^Følger/ })).toBeNull()
    expect(sectionLabels('Beløb')).toEqual(['Beløb'])
    expect(sectionLabels('Perioden')).toEqual([
      'Gentagelse',
      'Forankring',
      'Fra (år)',
      'Til (år)',
      'Forfald',
    ])
  })

  it('viser begge indbetalingsformer i navigatorens gruppe, hver med sit navn', () => {
    // De to udgaver står i den samme gruppe og læses som ét slags objekt.
    // Hver bærer sit eget navn, præcis som en beholdning gør.
    const plan = aPlanWithPension()
    const person = plan.household.persons[0]!
    render(
      <App
        initialPlan={{
          ...plan,
          household: {
            persons: [
              {
                ...person,
                holdings: [
                  ...person.holdings,
                  {
                    id: 'aldersopsparing',
                    name: 'Aldersopsparing',
                    variant: 'OldAgeSavings',
                    payoutAge: 67,
                    balance: 0,
                    grossReturn: 0,
                    annualCostRate: 0,
                  },
                ],
              },
            ],
          },
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({
              name: 'Lønbidrag',
              source: 'salary',
              to: 'ratepension',
              percentageOfEntry: 0.08,
            }),
            {
              ...aHoldingContribution({
                name: 'Højt loft',
                source: 'free-assets',
                to: 'aldersopsparing',
                amountInRealKroner: 64_200,
              }),
              id: 'fra-frie-midler',
            },
          ],
        }}
      />,
    )

    const gruppe = navigatorButton(/Indbetalinger/)
    expect(within(gruppe).getByText('2')).toBeTruthy()
    expect(within(navigatorButton(/Lønbidrag/)).getByText('8,00 %')).toBeTruthy()
    expect(within(navigatorButton(/Højt loft/)).getByText('64.200')).toBeTruthy()
  })

  it('tilføjer en indbetaling via indbetalingsgruppen, og dens inspektør kan åbnes', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{ ...plan, entries: [aSalary({ amountInRealKroner: 600_000 })] }}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ Indbetaling' }))

    await user.click(navigatorButton(/Indbetaling 1/))
    expect(screen.getByRole('heading', { name: 'Følger Løn' })).toBeTruthy()
  })

  it('tilføjer en indbetaling i en husstand uden lønpost — kilden er så en beholdning', async () => {
    // Formen findes netop for de år, hvor der ingen løn er. Var knappen
    // skjult uden en lønpost, kunne aldersopsparingens vindue efter
    // erhvervsophør slet ikke skrives, jf. ADR-0016.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(screen.getByRole('button', { name: '+ Indbetaling' }))

    await user.click(navigatorButton(/Indbetaling 1/))
    expect(sectionLabels('Beløb')).toEqual(['Beløb'])
  })

  it('tilføjer en indbetaling fra de frie midler, når husstandens eneste ordning er en aktiesparekonto', async () => {
    // Lønposten kommer først, når knappen vælger sit par — men den kan ikke
    // være kilde her, og ét klik må ikke skrive en plan, `validatePlan`
    // afviser, jf. ADR-0020. Parret springer den over og tager de frie
    // midler i stedet.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          holdings: [aShareSavingsAccount()],
          entries: [aSalary({ amountInRealKroner: 600_000 })],
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ Indbetaling' }))

    expect(navigatorButton(/Indbetaling 1/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
  })

  it('skjuler "+ Indbetaling", når husstanden ingen ordning har at betale ind i', () => {
    // Alle beholdninger er frie midler: der er ikke noget, en indbetaling kan
    // gå til — så ville det være en overførsel, jf. ADR-0016.
    render(
      <App
        initialPlan={aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })}
      />,
    )

    expect(screen.queryByRole('button', { name: '+ Indbetaling' })).toBeNull()
  })

  it('viser årets indbetalinger som sin egen kolonne i årstabellen', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          startYear: 2026,
          household: {
            persons: [{ ...plan.household.persons[0]!, birthYear: 1973, horizon: 53 }],
          },
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        }}
      />,
    )
    await showYearTable(user)

    // Kolonnen er, hvad der landede i ordningerne — det, der faktisk blev lagt
    // til side. Bruttobeløbet og AM-delen står i forklar-året.
    expect(screen.getByRole('columnheader', { name: 'Indbetalinger' })).toBeTruthy()
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]!).getByText('44.160')).toBeTruthy()
  })

  it('skifter indbetalingens beløbsform mellem procent og fast beløb', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        }}
      />,
    )
    await user.click(navigatorButton(/Indbetalingen/))
    expect((screen.getByLabelText('Beløb') as HTMLInputElement).value).toBe('8')

    await user.click(screen.getByRole('button', { name: 'kr.' }))

    // Formen er feltets enhed, så etiketten bliver stående — men de to former
    // er hver sin værdi og ikke ét tal med to enheder: procenten er væk, og
    // der spørges nu om kroner fra nul.
    expect(sectionLabels('Beløb')).toEqual(['Beløb'])
    expect(screen.getByRole('button', { name: 'kr.', pressed: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: '%', pressed: false })).toBeTruthy()
    expect((screen.getByLabelText('Beløb') as HTMLInputElement).value).toBe('0')
  })

  it('redigerer en overførsels fra-beholdning, beløb og forfald i skuffen', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Frie midler')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect((screen.getByLabelText(/Beløb/) as HTMLInputElement).value).toBe('50000')

    const beloeb = screen.getByLabelText(/Beløb/)
    await user.clear(beloeb)
    await user.type(beloeb, '75000')

    await user.tab()
    expect(
      screen.getByRole('button', { name: /Overførslen.*75.000/ }),
    ).toBeTruthy()
  })

  it('bytter en overførsels to ender om, når den ene sættes til den anden', async () => {
    // Med præcis to beholdninger er der ét lovligt valg i hver liste, hvis
    // den anden ende udelades — og retningen er dermed låst fra oprettelsen.
    // At vælge "fra" den beholdning, der allerede er "til", kan kun betyde
    // én ting: den anden vej.
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    const fra = screen.getByLabelText('Fra') as HTMLSelectElement
    expect(Array.from(fra.options).map((option) => option.value)).toEqual([
      'Frie midler',
      'Anden beholdning',
    ])

    await user.selectOptions(fra, 'Anden beholdning')

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Frie midler')

    // Rækken i navigatoren bærer flytningens navn og ikke dens ender, så
    // byttet ses i skuffens to vælgere ovenfor. Rækken skal stadig stå der
    // med sit beløb.
    await user.tab()
    expect(
      screen.getByRole('button', { name: /Overførslen.*50.000/ }),
    ).toBeTruthy()
  })

  it('mærker en ufuldstændig og en uholdbar buffer forskelligt i årstabellen', async () => {
    // Horisonten stopper året før folkepensionsalderen. Folkepensionen kommer
    // af sig selv og ville gøre underskuddet indhenteligt igen, så det sidste
    // år stod ufuldstændigt frem for uholdbart.
    const base = aPlan({
      horizon: 69,
      holdings: [aFreeHolding('anden-beholdning', 'Anden beholdning')],
    })
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
    const user = userEvent.setup()
    render(<App initialPlan={plan} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const ufuldstaendigRow = rows[1]!
    expect(within(ufuldstaendigRow).getByText('Ufuldstændig')).toBeTruthy()
    expect(ufuldstaendigRow.className).toContain('ufuldstaendig')

    // Anden beholdning tømmes efter to år, hvorefter der intet er at hente.
    const uholdbarRow = rows.at(-1)!
    expect(within(uholdbarRow).getByText('Uholdbar')).toBeTruthy()
    expect(uholdbarRow.className).toContain('uholdbar')
  })

  it('markerer et brudt loft i årstabellen, uden at låne bufferens mærkat', async () => {
    // De to markeringer skal kunne skelnes: rød er forbeholdt den negative
    // buffer, og et brudt loft er ikke en fejltilstand — det er en
    // oplysning om, at en del af indbetalingen ikke virkede.
    //
    // Fladen markerer fra det ene felt på årsresultatet og sammenligner
    // ikke selv indbetalt med loft, jf. ADR-0012.
    const base = aPlanWithPension()
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...base,
          entries: [aSalary({ amountInRealKroner: 700_000 })],
          contributions: [
            aContribution({
              source: 'salary',
              to: 'ratepension',
              amountInRealKroner: 105_000,
            }),
          ],
        }}
      />,
    )
    await showYearTable(user)

    const row = within(screen.getByRole('table')).getAllByRole('row')[1]!

    expect(within(row).getByText('Fradrag tabt')).toBeTruthy()
    expect(row.className).toContain('fradragtabt')
    expect(row.className).not.toContain('ufuldstaendig')
    expect(row.className).not.toContain('uholdbar')
  })

  it('markerer ikke årets række, når et indskud blev afkortet', async () => {
    // Kontoen står allerede over sit loft, så hele årets indskud på 50.000
    // blev afvist og blev liggende i kilden. Der er intet brud at markere:
    // markeringen siger, at en del af indbetalingen ikke virkede, og her
    // forlod pengene aldrig kilden, jf. ADR-0019.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          balance: 1_000_000,
          holdings: [aShareSavingsAccount(200_000)],
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'aktiesparekonto',
              amountInRealKroner: 50_000,
            }),
          ],
        })}
      />,
    )
    await showYearTable(user)

    const row = within(screen.getByRole('table')).getAllByRole('row')[1]!

    expect(within(row).queryByText('Fradrag tabt')).toBeNull()
    expect(within(row).queryByText('Afgiftspligtigt')).toBeNull()
    expect(row.className).not.toContain('fradragtabt')
    expect(row.className).not.toContain('afgiftspligtigt')

    // Afkortningen ses i stedet på loftlinjen, og der står den også, når der
    // ikke kom en krone ind: året bad om noget.
    await user.click(row)
    expect(capRows()).toEqual([
      [
        'Aktiesparekonto (Jesper)',
        '50.000',
        '174.200',
        '–',
        'primo 200.000 kr. · råderum -25.800 kr. · indskudt 0 kr.',
      ],
    ])
  })

  it('deflaterer loftlinjens note på samme måde som dens beløb', async () => {
    // Enhedsfælden, fladekortet fandt: en note i fremtidskroner ved siden af
    // et beløb i nutidskroner, jf. ADR-0001. Forklar-året er i nutidskroner
    // hele vejen, og noten skal følge den samme omregning som
    // kolonnerne — ellers ville primosaldoen stå på sine nominelle 174.200
    // mod et loft, der også viser 174.200, og et råderum på nul, mens der
    // alligevel stod 3.416 kr. indskudt ved siden af.
    //
    // Kontoen fyldes helt op i 2026, så det er § 20-fremskrivningen alene,
    // der giver plads i 2027: loftet er 177.684 nominelt mod en primosaldo
    // på 174.200. Deflateret er de tre tal 174.200, 170.784 og 3.416, og de
    // går stadig op mod hinanden.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          balance: 1_000_000,
          inflationAssumption: 0.02,
          section20ProjectionAssumption: 0.02,
          holdings: [aShareSavingsAccount(150_000)],
          contributions: [
            aHoldingContribution({
              source: 'free-assets',
              to: 'aktiesparekonto',
              amountInRealKroner: 50_000,
            }),
          ],
        })}
      />,
    )
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[2]!) // 2027

    expect(capRows()).toEqual([
      [
        'Aktiesparekonto (Jesper)',
        '50.000',
        '174.200',
        '–',
        'primo 170.784 kr. · råderum 3.416 kr. · indskudt 3.416 kr.',
      ],
    ])

  })

  it('holder skattelagenes satser faste i forklar-året og lægger loftets virkning i sit eget lag', async () => {
    // Lagenes satser er lovens og flytter sig ikke med kommunen. Binder det
    // skrå skatteloft, står det i loftnedslagets linje — og det var netop
    // det, der før flyttede sig, når kommunen blev skiftet i skuffen.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          entries: [aSalary({ amountInRealKroner: 950_000 })],
        })}
      />,
    )
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!)

    // Fixturens Hvidovre har 25,40 % og lægger trappens første trin fri.
    expect(lagSats('Mellemskat')).toBe('7,50 %')
    expect(lagSats('Topskat')).toBe('7,50 %')
    expect(lagSats('Loftnedslag')).toBe('-0,34 %')

    // Albertslund ligger 0,20 procentpoint højere. Kun nedslaget rører sig.
    await user.click(navigatorButton(/^Jesper/))
    await user.selectOptions(screen.getByLabelText('Kommune'), 'Albertslund')

    expect(lagSats('Mellemskat')).toBe('7,50 %')
    expect(lagSats('Topskat')).toBe('7,50 %')
    expect(lagSats('Loftnedslag')).toBe('-0,54 %')

    // Gladsaxes 23,60 % er under loftets referencesats: intet nedslag.
    await user.selectOptions(screen.getByLabelText('Kommune'), 'Gladsaxe')

    expect(lagSats('Mellemskat')).toBe('7,50 %')
    expect(lagSats('Loftnedslag')).toBe('0,00 %')
  })

  it('viser kapitalindkomstens eget loftnedslag som sin egen linje i forklar-året', async () => {
    // Kapitalindkomstens loft er 42 % og har intet med trappen at gøre. De
    // to nedslag har hvert sit grundlag og står derfor hver for sig.
    // 1.000.000 til 7 % giver 70.000 i kapitalindkomst, hvoraf 15.000 ligger
    // over kapitalindkomstens egen bundfradragsgrænse på 55.000.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          inflationAssumption: 0,
          balance: 1_000_000,
          grossReturn: 0.07,
        })}
      />,
    )
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!)

    // 25,40 + 12,01 + 7,50 = 44,91 %, altså 2,91 procentpoint over de 42 %.
    expect(lagSats('Topskat af kapitalindkomst')).toBe('7,50 %')
    expect(lagSats('Loftnedslag af kapitalindkomst')).toBe('-2,91 %')
  })

  it('viser loftlinjen med sine tre tal i forklar-året', async () => {
    // Tre tal på samme linje — indbetalt, loft, fradragsberettiget — så den
    // kan efterregnes uden at finde tal andre steder på siden. De 96.600 kr.
    // landede, loftet var 68.700, og resten mistede sin fradragsret.
    const base = aPlanWithPension()
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...base,
          startYear: 2026,
          entries: [aSalary({ amountInRealKroner: 700_000 })],
          contributions: [
            aContribution({
              source: 'salary',
              to: 'ratepension',
              amountInRealKroner: 105_000,
            }),
          ],
        }}
      />,
    )
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!)

    // Notekolonnen står tom: `PerYear`-formens tre tal står i deres egne
    // kolonner, og der er intet, de ikke kan sige.
    expect(capRows()).toEqual([['Ratepension (Jesper)', '96.600', '68.700', '68.700', '']])
  })

  it('tegner begge loftformer i samme år, med aktiesparekontoens fem tal', async () => {
    // Ratepensionen har et `PerYear`-loft: pengene landede, og linjen viser
    // hvad der kom ind, loftet og den del, der beholdt sin fradragsret.
    // Aktiesparekontoen har et `OnBalance`-loft, og dens fem tal kan
    // efterregnes af hinanden: 174.200 − 150.000 er råderummet på 24.200, og
    // de 50.000, året bad om, blev afkortet til netop det. Fradragsret har
    // ordningen ingen af, jf. ADR-0019.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          balance: 1_000_000,
          holdings: [aPensionHolding('ratepension', 'Ratepension'), aShareSavingsAccount(150_000)],
          entries: [aSalary({ amountInRealKroner: 700_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', amountInRealKroner: 105_000 }),
            {
              ...aHoldingContribution({
                source: 'free-assets',
                to: 'aktiesparekonto',
                amountInRealKroner: 50_000,
              }),
              id: 'contribution-2',
            },
          ],
        })}
      />,
    )
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!)

    expect(capRows()).toEqual([
      ['Ratepension (Jesper)', '96.600', '68.700', '68.700', ''],
      [
        'Aktiesparekonto (Jesper)',
        '50.000',
        '174.200',
        '–',
        'primo 150.000 kr. · råderum 24.200 kr. · indskudt 24.200 kr.',
      ],
    ])
  })

  it('holder loftlinjen ude af inspektørskuffen', async () => {
    // Skuffen viser planen, aldrig et årsafhængigt resultat. Loftet er ikke
    // en egenskab ved indbetalingen — det er en egenskab ved året.
    const base = aPlanWithPension()
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...base,
          entries: [aSalary({ amountInRealKroner: 700_000 })],
          contributions: [
            aContribution({
              source: 'salary',
              to: 'ratepension',
              amountInRealKroner: 105_000,
            }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Indbetalingen/))

    expect(screen.queryByText('Loft')).toBeNull()
    expect(screen.queryByText('Med fradragsret')).toBeNull()
  })

  it('tilføjer en beholdning via beholdningsgruppen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    expect(screen.queryByRole('button', { name: /^Beholdning 2/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: '+ Beholdning' }))

    expect(navigatorButton(/^Beholdning 2/)).toBeTruthy()
    const beholdninger = navigatorButton(/Beholdninger/)
    expect(within(beholdninger).getByText('2')).toBeTruthy()
  })

  it('tilføjer en indtægt og en udgift via deres grupper', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    await user.click(screen.getByRole('button', { name: '+ Indtægt' }))
    expect(navigatorButton(/^Indtægt 1/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '+ Udgift' }))
    expect(navigatorButton(/^Udgift 1/)).toBeTruthy()
  })

  it('lader "+ Beholdning" gøre "+ Overførsel" muligt, når husstanden kun havde én beholdning', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    expect(screen.queryByRole('button', { name: '+ Overførsel' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '+ Beholdning' }))

    expect(screen.getByRole('button', { name: '+ Overførsel' })).toBeTruthy()
  })

  it('samler en engangsoverførsels periode til ét årsfelt og fjerner "Jævnt fordelt" fra forfald', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(
      <App
        initialPlan={{
          ...plan,
          startYear: 2026,
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))
    expect(screen.getByLabelText(/Fra \(år\)/)).toBeTruthy()

    await user.selectOptions(screen.getByLabelText(/Gentagelse/), 'Én gang')

    expect(screen.queryByLabelText(/Fra \(år\)/)).toBeNull()
    expect(screen.queryByLabelText(/Til \(år\)/)).toBeNull()
    expect((screen.getByLabelText('År') as HTMLInputElement).value).toBe('2026')

    const forfald = screen.getByLabelText(/Forfald/) as HTMLSelectElement
    expect(
      Array.from(forfald.options).map((option) => option.value),
    ).not.toContain('Jævnt fordelt')
  })

  it('lader en overførsels to ender aldrig pege på den samme beholdning', async () => {
    // Invarianten er, at de to ender er forskellige — ikke at et valg mangler
    // i listen. Udeladelsen var den gamle mekanisme, og den låste retningen:
    // med præcis to beholdninger stod der ét valg tilbage i hver liste, og
    // det var det, der allerede var valgt.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlanWithThreeHoldings(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    const ender = () => [
      (screen.getByLabelText('Fra') as HTMLSelectElement).value,
      (screen.getByLabelText('Til') as HTMLSelectElement).value,
    ]

    // En fri ende flytter sig til det valgte og rører ikke den anden.
    await user.selectOptions(screen.getByLabelText('Til'), 'Tredje beholdning')
    expect(ender()).toEqual(['Frie midler', 'Tredje beholdning'])

    // Vælges den beholdning, der allerede er den anden ende, bytter de to
    // plads frem for at mødes.
    await user.selectOptions(screen.getByLabelText('Til'), 'Frie midler')
    expect(ender()).toEqual(['Tredje beholdning', 'Frie midler'])

    await user.selectOptions(screen.getByLabelText('Fra'), 'Frie midler')
    expect(ender()).toEqual(['Frie midler', 'Tredje beholdning'])
  })

  it('holder en ratepension ude af begge en overførsels lister', async () => {
    // Ratepensionens udbetaling er personlig indkomst og skal gennem en
    // udbetalingsplan. Stod den i listen, kunne ét klik skrive en plan,
    // `validatePlan` afviser, jf. ADR-0022.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlanWithPensionBetweenFreeHoldings(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    expect(optionsOf('Fra')).toEqual(['Frie midler', 'Anden beholdning'])
    expect(optionsOf('Til')).toEqual(['Frie midler', 'Anden beholdning'])
  })

  it('tilbyder de skattefri ordninger i afgiverlisten, men ikke i modtagerlisten', async () => {
    // Aldersopsparingen og aktiesparekontoen tømmes af en overførsel, jf.
    // ADR-0022 — men vejen ind i dem er en indbetaling, og de står derfor
    // kun i den ene liste.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlan({
            holdings: [
              anOldAgeSavings('aldersopsparing', 'Aldersopsparing'),
              aShareSavingsAccount(),
            ],
          }),
          transfers: [
            aTransfer({
              from: 'aldersopsparing',
              to: 'free-assets',
              amountInRealKroner: 50_000,
              period: { anchor: 'CalendarYear', from: 2040 },
            }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    expect(optionsOf('Fra')).toEqual([
      'Frie midler',
      'Aldersopsparing',
      'Aktiesparekonto',
    ])
    expect(optionsOf('Til')).toEqual(['Frie midler'])
  })

  it('bytter ikke enderne om, når modtageren ikke kan bære afgiverens plads', async () => {
    // Byttet er stadig svaret mellem to frie midler. Men en aldersopsparing
    // kan ikke være destination — vejen ind i den er en indbetaling — og
    // enderne skal derfor blive, hvor de er.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlan({
            holdings: [
              anOldAgeSavings('aldersopsparing', 'Aldersopsparing'),
              aFreeHolding('anden-beholdning', 'Anden beholdning'),
            ],
          }),
          transfers: [
            aTransfer({
              from: 'aldersopsparing',
              to: 'free-assets',
              amountInRealKroner: 50_000,
              period: { anchor: 'CalendarYear', from: 2040 },
            }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))
    await user.selectOptions(screen.getByLabelText('Fra'), 'Frie midler')

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Frie midler')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect(screen.queryByText(/kan ikke simuleres/i)).toBeNull()
  })

  it('tilbyder "+ Overførsel", når husstandens eneste anden beholdning er en aldersopsparing', async () => {
    // Musefælden fra etape 2 den anden vej rundt: kunne fladen ikke skrive
    // tømningen, ville pengene stå bundet, uanset hvad motoren tillod. Den
    // tilføjede begynder ved døren, så planen er regnelig i samme klik.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          holdings: [anOldAgeSavings('aldersopsparing', 'Aldersopsparing')],
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ Overførsel' }))

    await user.click(navigatorButton(/Overførsel 1/))
    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Aldersopsparing')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Frie midler')
    // Ordningen er oprettet før maj 2007, så døren går op, når personen
    // fylder 60 i 2033.
    expect((screen.getByLabelText('Fra (år)') as HTMLInputElement).value).toBe('2033')
    expect(screen.queryByText(/kan ikke simuleres/i)).toBeNull()
  })

  it('kalder en overførsel ud af en ordning en udbetaling', async () => {
    // Det er det, den er i virkeligheden — man beder selskabet udbetale sin
    // aldersopsparing. En etiket og ikke et begreb: figuren hedder stadig en
    // overførsel i glossaret og i koden, jf. ADR-0022.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlan({ holdings: [anOldAgeSavings('aldersopsparing', 'Aldersopsparing')] }),
          transfers: [
            aTransfer({
              from: 'aldersopsparing',
              to: 'free-assets',
              amountInRealKroner: 50_000,
              period: { anchor: 'CalendarYear', from: 2040 },
            }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    expect(screen.getByText('Udbetaling')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Fjern udbetaling/ })).toBeTruthy()
  })

  it('kalder en overførsel mellem to frie midler en overførsel', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlanWithSecondHolding(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    expect(screen.getByText('Overførsel')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Fjern overførsel/ })).toBeTruthy()
  })

  it('omdøber en overførsel fra skuffen, og enderne rører ikke navnet', async () => {
    // Navnet står i navigatoren og i skuffens hoved, så de to steder ikke
    // kan komme til at sige hver sit. Skiftes en ende bagefter, bliver
    // navnet stående: det er brugerens og ikke en etikette, fladen udleder.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlanWithSecondHolding(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))
    const navn = screen.getByLabelText('Navn') as HTMLInputElement
    expect(navn.value).toBe('Overførslen')

    await user.clear(navn)
    await user.type(navn, 'Tømning af opsparingen')

    // Tre steder: navigatorens række, skuffens hoved og tidslinjens boks.
    expect(navigatorButton(/Tømning af opsparingen/)).toBeTruthy()
    expect(screen.getAllByText('Tømning af opsparingen')).toHaveLength(3)

    await user.selectOptions(screen.getByLabelText('Fra'), 'Anden beholdning')

    expect(navigatorButton(/Tømning af opsparingen/)).toBeTruthy()
  })

  it('bytter en overførsels ender om, også når listerne kun rummer frie midler', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlanWithPensionBetweenFreeHoldings(),
          transfers: [
            aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 50_000 }),
          ],
        }}
      />,
    )

    await user.click(navigatorButton(/Overførslen/))

    await user.selectOptions(screen.getByLabelText('Til'), 'Frie midler')

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Frie midler')
    expect(screen.queryByText(/kan ikke simuleres/i)).toBeNull()
  })

  it('tilføjer en overførsel mellem to beholdninger med frie midler, når ordningen står imellem dem', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPensionBetweenFreeHoldings()} />)

    await user.click(screen.getByRole('button', { name: '+ Overførsel' }))

    // Den nye flytning nummereres som en beholdning og ikke efter sine
    // ender: de er valgt af `addTransfer` og ikke af brugeren endnu.
    expect(navigatorButton(/Overførsel 1/)).toBeTruthy()
    expect(screen.queryByText(/kan ikke simuleres/i)).toBeNull()
  })

  it('skjuler "+ Overførsel", når husstanden kun har én beholdning med frie midler', () => {
    render(<App initialPlan={aPlanWithPension()} />)

    expect(screen.queryByRole('button', { name: '+ Overførsel' })).toBeNull()
  })

  it('tilføjer en overførsel via overførselsgruppen, og dens inspektør kan åbnes', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(screen.getByRole('button', { name: '+ Overførsel' }))

    const raekke = navigatorButton(/Overførsel 1/)
    expect(raekke).toBeTruthy()

    await user.click(raekke)
    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Frie midler')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Anden beholdning')
  })

  it('skjuler "+ Overførsel", når husstanden kun har én beholdning', () => {
    render(<App initialPlan={aPlan()} />)

    expect(screen.queryByRole('button', { name: '+ Overførsel' })).toBeNull()
  })

  it('viser en forklarende besked frem for en tom tabel, når bufferpegeren ikke rammer en beholdning', () => {
    render(<App initialPlan={{ ...aPlan(), buffer: 'findes-ikke' }} />)

    expect(screen.getByText(/kan ikke simuleres/i)).toBeTruthy()
    // Beskeden siger hvad der er galt uden at vise pegeren selv: id'et er
    // motorens, og resultatspalten skriver til den, der planlægger.
    expect(screen.getByText(/buffer peger på en beholdning, der ikke findes/i)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('viser en forklarende besked frem for en tom flade, når en gemt plan ikke kunne indlæses', () => {
    render(<App initialPlan={aPlan()} loadError="Den gemte plan er ikke gyldig JSON." />)

    expect(screen.getByText(/ikke indlæses/i)).toBeTruthy()
    expect(screen.getByText('Den gemte plan er ikke gyldig JSON.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(document.querySelector('.navigatorspalte')).toBeNull()
  })

  it('slår årstabellen om til fremtidskroner, uden at røre inputfeltet i skuffen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    expect(screen.getByRole('button', { name: 'Nutidskroner', pressed: true })).toBeTruthy()
    const udgifter2028 = () => yearCell(3, 'Udgifter')
    expect(udgifter2028()).toBe('-40.000')

    await user.click(screen.getByRole('button', { name: 'Fremtidskroner' }))

    expect(screen.getByRole('button', { name: 'Fremtidskroner', pressed: true })).toBeTruthy()
    // 40.000 kr. fremskrevet to år med 2 % — planens inflation, som posten
    // her følger 1:1.
    expect(udgifter2028()).toBe('-41.616')

    // Inputfeltet i skuffen er og bliver i nutidskroner, jf. issue #12.
    await user.click(navigatorButton(/Faste udgifter/))
    expect((screen.getByLabelText(/Beløb/) as HTMLInputElement).value).toBe('40000')
  })

  describe('pensionen på lønposten', () => {
    /** En ratepension at fordele til, og en løn at hænge aftalen på. */
    function aPlanWithSalaryAndPension() {
      return aPlan({
        startYear: 2026,
        birthYear: 1973,
        horizon: 55,
        balance: 500_000,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            payoutAge: 53,
            balance: 0,
            grossReturn: 0,
            annualCostRate: 0,
          },
          // Den anden ordning, en fordeling kan dele sig til. Tom og uden
          // afkast, så den ikke rører noget, før en linje peger på den.
          {
            id: 'aldersopsparing',
            name: 'Aldersopsparing',
            variant: 'OldAgeSavings',
            payoutAge: 53,
            balance: 0,
            grossReturn: 0,
            annualCostRate: 0,
          },
        ],
        entries: [aSalary({ amountInRealKroner: 600_000 })],
      })
    }

    /** Den samme plan med firmaordningen skrevet på lønnen: 12 % fra
        arbejdsgiveren og 5 % af egen løn, det hele til ratepensionen. */
    function aPlanWithAgreement() {
      const plan = aPlanWithSalaryAndPension()
      const salary = plan.entries[0]!
      return {
        ...plan,
        entries: [
          {
            ...salary,
            direction: 'Income' as const,
            taxTreatment: 'EarnedIncome' as const,
            regulationRate: 0,
            pensionAgreement: {
              employerContribution: { percentageOfEntry: 0.12 },
              employeeContribution: { percentageOfEntry: 0.05 },
              fee: 1_200,
              insurancePremium: 4_800,
              allocation: [{ to: 'ratepension', form: 'Remainder' as const }],
            },
          },
        ],
      }
    }

    it('slår sektionen til på en lønpost og fra igen, og aftalens tal er væk', async () => {
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithSalaryAndPension()} />)
      await user.click(navigatorButton(/Løn/))

      expect(sectionLabels('Pension')).toEqual([])

      await user.click(screen.getByRole('button', { name: '+ Tilføj' }))

      // Listen er udtømmende, og det er dét, der holder kurtagen ude: den er
      // depotets og ligger i beholdningens omkostningssats, hvor den sænker
      // afkastet. Skrives handelsomkostninger begge steder, betales de to
      // gange, og forskellen vokser med saldoen, mens gebyret står stille.
      // Bidragene er ét felt hver og ikke to: formen er feltets enhed, så
      // kontakten står, hvor "%" ellers stod, og ikke som et spørgsmål ovenover.
      expect(sectionLabels('Pension')).toEqual([
        'Arbejdsgiverbidrag',
        'Arbejdstagerbidrag',
        'Gebyr',
        'Forsikringspræmie',
        'Ordning',
        'Andel',
      ])

      // Slås sektionen fra, er aftalen væk med sine tal — der er ingen
      // afbryder, der lader dem stå.
      await user.click(screen.getByRole('button', { name: 'Fjern pension' }))

      expect(sectionLabels('Pension')).toEqual([])
    })

    it('lægger en ordning mere i fordelingen og fjerner den igen', async () => {
      // Fordelingen er en liste: hver linje peger på sin ordning og bærer sin
      // andel. Restlinjen bliver stående nederst — præcis én linje er resten,
      // og det er dét, der får fordelingen til at gå op i hvert eneste år —
      // og den har hverken en form at vælge eller en knap at fjerne den med.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithSalaryAndPension()} />)
      await user.click(navigatorButton(/Løn/))
      await user.click(screen.getByRole('button', { name: '+ Tilføj' }))

      await user.click(screen.getByRole('button', { name: '+ Tilføj ordning' }))

      // Den nye linje står over resten og er en procent, indtil andet
      // vælges — den ene form, der ikke kan skrive et beløb, aftalen ikke har.
      expect(sectionLabels('Pension').slice(4)).toEqual([
        'Ordning',
        'Andelen er',
        'Andel',
        'Ordning',
        'Andel',
      ])
      expect(
        screen.getAllByLabelText('Ordning').map((felt) => (felt as HTMLSelectElement).value),
      ).toEqual(['Aldersopsparing', 'Ratepension'])

      await user.click(screen.getByRole('button', { name: 'Fjern Aldersopsparing' }))

      expect(sectionLabels('Pension').slice(4)).toEqual(['Ordning', 'Andel'])
    })

    it('skriver en fordelingslinje som en procent af det, der er at fordele', async () => {
      // Procenten måler indbetalingen efter arbejdsmarkedsbidraget, gebyret
      // og præmien — de 87.840 og ikke lønnen: 25 % er 21.960, og resten,
      // 65.880, går til den ordning, restlinjen peger på.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithAgreement()} />)
      await user.click(navigatorButton(/Løn/))
      await user.click(screen.getByRole('button', { name: '+ Tilføj ordning' }))

      // Restlinjens andel er et udledt felt uden en kontrol at taste i, så
      // det ene "Andel" med en etiket er den nye linjes.
      await user.clear(screen.getByLabelText('Andel'))
      await user.type(screen.getByLabelText('Andel'), '25')

      await showYearTable(user)
      await explainYear(user, 2026)

      const indbetalinger = await openBand(user, 'Indbetalinger')
      const aftale = indbetalinger.querySelector('.aftaletabel') as HTMLElement
      const celler = [...aftale.querySelectorAll('tbody td')].map((td) => td.textContent)
      expect(celler.slice(6)).toEqual([
        'Aldersopsparing',
        '21.960',
        '21.960',
        'Ratepension',
        '65.880',
        '65.880',
      ])
    })

    it('skriver en fordelingslinje op til ordningens loft', async () => {
      // Formen beder om det, der faktisk er tilbage under loftet i netop det
      // år — aldersopsparingens 9.900 — og resten går til den ordning,
      // restlinjen peger på: 87.840 − 9.900 = 77.940.
      //
      // Der er intet tal at taste. Hvad linjen beder om, er årets svar og
      // ikke planlæggerens, og andelen står derfor som et udledt felt,
      // ligesom restlinjens.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithAgreement()} />)
      await user.click(navigatorButton(/Løn/))
      await user.click(screen.getByRole('button', { name: '+ Tilføj ordning' }))

      await user.click(screen.getByRole('button', { name: 'Op til loftet' }))

      expect(sectionLabels('Pension').slice(4)).toEqual([
        'Ordning',
        'Andelen er',
        'Andel',
        'Ordning',
        'Andel',
      ])

      await showYearTable(user)
      await explainYear(user, 2026)

      const indbetalinger = await openBand(user, 'Indbetalinger')
      const aftale = indbetalinger.querySelector('.aftaletabel') as HTMLElement
      const celler = [...aftale.querySelectorAll('tbody td')].map((td) => td.textContent)
      expect(celler.slice(6)).toEqual([
        'Aldersopsparing',
        '9.900',
        '9.900',
        'Ratepension',
        '77.940',
        '77.940',
      ])
    })

    it('lader en linje op til loftet falde tilbage, når ordningen skiftes til en uden loft', async () => {
      // Livrenten har intet loft at fylde ud, og formen tilbydes derfor ikke
      // på den. Skiftes ordningen under en linje, der allerede står på
      // formen, falder den tilbage til en procent på nul — ét klik må ikke
      // skrive en plan, indgangskontrollen afviser.
      const base = aPlanWithAgreement()
      const salary = base.entries[0]!
      const plan = {
        ...base,
        household: {
          persons: [
            {
              ...base.household.persons[0]!,
              holdings: [
                ...base.household.persons[0]!.holdings,
                {
                  id: 'livrente',
                  name: 'Livrente',
                  variant: 'LifeAnnuity' as const,
                  payoutAge: 53,
                  balance: 0,
                  grossReturn: 0,
                  annualCostRate: 0,
                  quotedReserve: 0,
                  quotedAnnualBenefit: 0,
                  bonusRate: 0,
                },
              ],
            },
          ],
        },
        entries: [
          {
            ...salary,
            direction: 'Income' as const,
            taxTreatment: 'EarnedIncome' as const,
            regulationRate: 0,
            pensionAgreement: {
              ...salary.pensionAgreement!,
              allocation: [
                { to: 'aldersopsparing', form: 'UpToCap' as const },
                { to: 'ratepension', form: 'Remainder' as const },
              ],
            },
          },
        ],
      }

      const user = userEvent.setup()
      render(<App initialPlan={plan} />)
      await user.click(navigatorButton(/Løn/))

      expect(screen.getByRole('button', { name: 'Op til loftet' })).toBeTruthy()

      await user.selectOptions(screen.getAllByLabelText('Ordning')[0]!, 'Livrente')

      expect(screen.queryByRole('button', { name: 'Op til loftet' })).toBeNull()
      expect((screen.getByLabelText('Andel') as HTMLInputElement).value).toBe('0')
    })

    it('lægger arbejdsgiverbidraget til indtægten og aftalens penge i indbetalingerne', async () => {
      // De 12 %, der står på lønsedlen, måler lønnen selv: 72.000 kr. Med de
      // 5 % fra lønnen er indbetalingen 102.000 kr., og efter AM-bidraget,
      // gebyret og præmien lander der 87.840 i ordningen — men kun
      // arbejdsgiverens del løfter indtægten.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithAgreement()} />)

      await showYearTable(user)

      expect(yearCell(1, 'Indtægter')).toBe('672.000')
      // Cellen bærer også årets loftmarkering: de 87.840 ligger over
      // ratepensionens loft, og aftalens penge tælles med i den opgørelse
      // som enhver anden indbetalings.
      expect(yearCell(1, 'Indbetalinger')).toBe('87.840Fradrag tabt')
    })

    it('lægger aftalens gebyr og præmie i årstabellens udgifter', async () => {
      // Planen har ingen udgiftspost, og kolonnen står alligevel med 6.000:
      // de to forlader husstanden uden at blive til formue, og
      // balanceinvarianten har kun det ene led tilbage til dem. Kolonnens
      // forklaring gør rede for det — ellers er der et tal på skærmen,
      // planen ikke kan gøre rede for.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithAgreement()} />)

      await showYearTable(user)

      expect(yearCell(1, 'Udgifter')).toBe('-6.000')
    })

    it('viser aftalens hele regnestykke i forklar-året', async () => {
      // Linjen skal kunne efterregnes af sig selv, jf. ADR-0041: 72.000 +
      // 30.000 − 8.160 − 1.200 − 4.800 = 87.840. Gebyret og præmien står
      // her og ingen andre steder — de er ingen udgiftspost, jf. ADR-0042.
      // Og arbejdsgiverbidraget står som sin egen linje under
      // indtægtsposterne, så folden går op med det bånd, den ligger under —
      // det er dér, forskellen mellem lønnen og indtægten kommer fra, jf.
      // ADR-0040.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithAgreement()} />)

      await showYearTable(user)
      await explainYear(user, 2026)

      const indbetalinger = await openBand(user, 'Indbetalinger')
      const aftale = indbetalinger.querySelector('.aftaletabel') as HTMLElement
      const celler = [...aftale.querySelectorAll('tbody td')].map((td) => td.textContent)
      expect(celler).toEqual([
        'Løn',
        '72.000',
        '30.000',
        '-8.160',
        '-1.200',
        '-4.800',
        'Ratepension',
        '87.840',
        '87.840',
      ])

      const indtaegter = await openBand(user, 'Indtægtsposter')
      expect(indtaegter.textContent).toContain('Løn · arbejdsgiverbidrag')
    })

    it('viser fordelingen linje for linje med både det ønskede og det landede', async () => {
      // Et magert år: 12.000 i bidrag, 960 i AM-bidrag og 2.000 i gebyr og
      // præmie giver 9.040 at fordele, hvor kronelinjen beder om 12.000. Den
      // afkortes, og resten bliver nul — og begge dele står, for en tavs
      // afkortning er den slags fejl, der aldrig viser sig.
      //
      // Aftalens eget regnestykke står én gang og gentages ikke på hver
      // destination: kilen mellem lønnen og ordningerne er den samme, uanset
      // hvor mange veje pengene siden går.
      const user = userEvent.setup()
      const plan = aPlan({
        startYear: 2026,
        birthYear: 1973,
        horizon: 55,
        balance: 500_000,
        holdings: [
          {
            id: 'ratepension',
            name: 'Ratepension',
            variant: 'InstalmentPension',
            payoutAge: 53,
            balance: 0,
            grossReturn: 0,
            annualCostRate: 0,
          },
          {
            id: 'aldersopsparing',
            name: 'Aldersopsparing',
            variant: 'OldAgeSavings',
            payoutAge: 53,
            balance: 0,
            grossReturn: 0,
            annualCostRate: 0,
          },
        ],
        entries: [
          aSalary({
            amountInRealKroner: 100_000,
            pensionAgreement: {
              employerContribution: { percentageOfEntry: 0.12 },
              employeeContribution: { amountInRealKroner: 0 },
              fee: 1_200,
              insurancePremium: 800,
              allocation: [
                { to: 'ratepension', form: 'Amount', amountInRealKroner: 12_000 },
                { to: 'aldersopsparing', form: 'Remainder' },
              ],
            },
          }),
        ],
      })
      render(<App initialPlan={plan} />)

      await showYearTable(user)
      await explainYear(user, 2026)

      const indbetalinger = await openBand(user, 'Indbetalinger')
      const aftale = indbetalinger.querySelector('.aftaletabel') as HTMLElement
      const celler = [...aftale.querySelectorAll('tbody td')].map((td) => td.textContent)
      expect(celler).toEqual([
        'Løn',
        '12.000',
        '0',
        '-960',
        '-1.200',
        '-800',
        'Ratepension',
        '12.000',
        '9.040',
        'Aldersopsparing',
        '0',
        '0',
      ])
    })

    it('giver aftalen hverken en kasse på tidslinjen eller en række i navigatoren', async () => {
      // Aftalen redigeres i lønpostens skuffe og tegner præcis samme
      // udstrækning som posten. En kasse og en række ville sige, at der var
      // to figurer at flytte rundt på.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithSalaryAndPension()} />)

      const rowsBefore = document.querySelectorAll('.nav-rk').length
      const boxesBefore = document.querySelectorAll('.tl-boks').length

      await user.click(navigatorButton(/Løn/))
      await user.click(screen.getByRole('button', { name: '+ Tilføj' }))

      expect(document.querySelectorAll('.nav-rk').length).toBe(rowsBefore)
      expect(document.querySelectorAll('.tl-boks').length).toBe(boxesBefore)
    })

    it('tilbyder ikke sektionen, når ejeren ingen ordning har at fordele til', async () => {
      // Ét klik må ikke skrive en plan, motoren afviser: har ejeren ingen
      // arbejdsgiveradministreret ordning, er der ingen destination at pege
      // på, og knappen står ikke.
      const user = userEvent.setup()
      render(
        <App
          initialPlan={aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })}
        />,
      )
      await user.click(navigatorButton(/Løn/))

      expect(sectionLabels('Pension')).toEqual([])
      expect(screen.queryByRole('button', { name: '+ Tilføj' })).toBeNull()
    })
  })

  describe('udbetalingsplanen i skuffen', () => {
    it('lægger en plan på en ratepension, der ingen har, og fjerner den igen', async () => {
      // Planen slås ikke til og fra: er den der, gælder den, og skal den væk,
      // slettes den — samme greb som en overførsel eller en indbetaling.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithRatepension()} />)
      await user.click(navigatorButton(/Ratepension/))

      expect(sectionLabels('Udbetalingsplan')).toEqual([])

      await user.click(screen.getByRole('button', { name: '+ Tilføj' }))

      // Den tidligste alder, loven tillader for netop denne ordning, og den
      // korteste lovlige varighed — det eneste sæt, der med sikkerhed er
      // lovligt, uanset hvornår ordningen må udbetales.
      expect((screen.getByLabelText('Start') as HTMLInputElement).value).toBe('53')
      expect((screen.getByLabelText('Varighed') as HTMLInputElement).value).toBe('10')
      expect((screen.getByLabelText('Princip') as HTMLSelectElement).value).toBe(
        'Serieprincippet',
      )

      // Planen regner med det samme: en tiendedel af saldoen i det første år.
      await showYearTable(user)
      expect(yearCell(1, 'Udbetalinger')).toBe('100.000')

      await user.click(navigatorButton(/Ratepension/))
      await user.click(screen.getByRole('button', { name: 'Fjern udbetalingsplan' }))

      expect(sectionLabels('Udbetalingsplan')).toEqual([])
      expect(yearCell(1, 'Udbetalinger')).toBe('0')
    })

    it('lader ikke felterne skrive en udbetalingsplan, loven afviser', async () => {
      // De tre lovregler står i motoren, fordi en importeret fil ikke er gået
      // gennem et felt. Felterne holder dem alligevel, så almindelig
      // indtastning ikke slår resultatspalten ud undervejs. Teksten bliver
      // stående, mens der tastes, og rettes, når feltet forlades — det er
      // planen bag den, der aldrig bliver ulovlig.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithPayoutFromStart()} />)
      await user.click(navigatorButton(/Ratepension/))

      // Ordningens pensionsudbetalingsalder er 53, og starten kan ikke sættes
      // før den.
      const start = screen.getByLabelText('Start') as HTMLInputElement
      await user.clear(start)
      await user.type(start, '40')
      await user.tab()
      expect(start.value).toBe('53')

      // Varigheden kan ikke sættes under ti år.
      const duration = screen.getByLabelText('Varighed') as HTMLInputElement
      await user.clear(duration)
      await user.type(duration, '5')
      await user.tab()
      expect(duration.value).toBe('10')

      // Og ikke så højt, at den sidste rate falder senere end tredive år
      // efter: udbetalingsåret er 2026, den sidste rate skal falde senest
      // 2056, og det er 31 år.
      await user.clear(duration)
      await user.type(duration, '40')
      await user.tab()
      expect(duration.value).toBe('31')

      // Resultatspalten er aldrig blevet slået ud undervejs.
      expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
    })

    it('viser start, varighed og princip for en ratepension, der har en plan', async () => {
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithPayoutFromStart()} />)
      await user.click(navigatorButton(/Ratepension/))

      expect(sectionLabels('Udbetalingsplan')).toEqual([
        'Start',
        ' Følger erhvervsophør',
        'Varighed',
        'Princip',
      ])
      expect((screen.getByLabelText('Start') as HTMLInputElement).value).toBe('53')
      expect((screen.getByLabelText('Varighed') as HTMLInputElement).value).toBe('10')
      expect((screen.getByLabelText('Princip') as HTMLSelectElement).value).toBe(
        'Serieprincippet',
      )
    })
  })

  describe('livrentens omsætning i skuffen', () => {
    it('lægger en udbetalingsstart på en livrente, der ingen har, og fjerner den igen', async () => {
      // Starten slås ikke til og fra: er den der, gælder den, og skal den
      // væk, slettes den — samme greb som ratepensionens plan. De to oplyste
      // tal står derimod altid, for de hører til ordningen og ikke til
      // beslutningen om, hvornår den skal omsættes.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithLifeAnnuity()} />)
      await user.click(navigatorButton(/Livrente/))

      expect(sectionLabels('Omsætning')).toEqual([
        'Oplyst depot',
        'Oplyst årlig ydelse',
        'Omsætningsfaktor',
        'Bonus',
      ])

      await user.click(screen.getByRole('button', { name: '+ Tilføj' }))

      // Den tidligste alder, loven tillader for netop denne ordning.
      expect(sectionLabels('Omsætning')).toEqual([
        'Udbetalingsstart',
        ' Følger erhvervsophør',
        'Oplyst depot',
        'Oplyst årlig ydelse',
        'Omsætningsfaktor',
        'Bonus',
      ])
      expect((screen.getByLabelText('Udbetalingsstart') as HTMLInputElement).value).toBe('53')

      // Planen regner med det samme: depotet forlader formuen, og ydelsen
      // står som en indtægt udefra.
      await showYearTable(user)
      expect(yearCell(1, 'Indtægter')).toBe('51.200')

      await user.click(navigatorButton(/Livrente/))
      await user.click(screen.getByRole('button', { name: 'Fjern udbetalingsstart' }))

      expect(sectionLabels('Omsætning')).toEqual([
        'Oplyst depot',
        'Oplyst årlig ydelse',
        'Omsætningsfaktor',
        'Bonus',
      ])
      expect(yearCell(1, 'Indtægter')).toBe('0')
    })

    it('udleder omsætningsfaktoren af de to oplyste tal', async () => {
      // Faktoren gemmes ikke: begge tal står på pensionsoverblikket, og det
      // er dét, der gør den efterprøvelig. Fladen læser den, hvor den
      // regnes, frem for at gentage divisionen.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithLifeAnnuity({ start: 53 })} />)
      await user.click(navigatorButton(/Livrente/))

      expect(lockedField('Omsætningsfaktor').textContent).toContain('5,12 %')

      const benefit = screen.getByLabelText('Oplyst årlig ydelse') as HTMLInputElement
      await user.clear(benefit)
      await user.type(benefit, '60000')
      await user.tab()

      expect(lockedField('Omsætningsfaktor').textContent).toContain('6,00 %')
    })

    it('starter ikke omsætningen før ordningens pensionsudbetalingsalder', async () => {
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithLifeAnnuity({ start: 53 })} />)
      await user.click(navigatorButton(/Livrente/))

      const start = screen.getByLabelText('Udbetalingsstart') as HTMLInputElement
      await user.clear(start)
      await user.type(start, '40')
      await user.tab()

      expect(start.value).toBe('53')
      expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
    })
  })

  it('viser årets udbetalinger i deres egen kolonne i årstabellen', async () => {
    // Kolonnen er beholdningernes rater lagt sammen. Ligesom indbetalingerne
    // er de penge, husstanden stadig har — de er blot flyttet — men de lander
    // på bufferen og løfter derfor årets overskud.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPayoutFromStart()} />)
    await showYearTable(user)

    expect(yearCell(1, 'Udbetalinger')).toBe('100.000')
    expect(yearCell(2, 'Udbetalinger')).toBe('100.000')
  })

  it('viser hver ordnings rate på dens egen linje i forklar-året', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPayoutFromStart()} />)
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!) // 2026

    const holdingsTable = document.querySelector('table.beholdningstabel') as HTMLElement
    const cells = (name: string) =>
      within(within(holdingsTable).getByText(name).closest('tr') as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)

    // Raten står ved siden af den primosaldo, den er regnet af — en tiendedel
    // af 1.000.000 over ti år. Den vejer halvt ind i afkastgrundlaget, som en
    // jævnt fordelt strøm gør, og står derfor som −50.000 i vægtet strøm.
    expect(cells('Ratepension')).toEqual([
      'Ratepension',
      '1.000.000',
      '100.000',
      '-50.000',
      '0,00 %',
      '0',
      '0',
    ])

    // En beholdning uden udbetalingsplan har en tom celle og ikke et nul: der
    // er ingen plan, ikke en plan der gav nul.
    expect(cells('Frie midler')[2]).toBe('—')
  })

  it('viser Planlæggeren som standardfane, med Formuen som hovedgraf, og skifter til Årstabellen ved klik', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    expect(screen.getByRole('button', { name: 'Planlæggeren', pressed: true })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Formuegraf' })).toBeTruthy()
    expect(document.querySelector('.hovedgraf-plads [aria-label="Formuegraf"]')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Årstabellen' }))

    expect(screen.getByRole('button', { name: 'Årstabellen', pressed: true })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Formuegraf' })).toBeNull()
  })

  it('viser Fordelingen og Overskuddet som mini-grafer ved siden af Formuen, kun to faner i alt', async () => {
    render(<App initialPlan={aThreeYearPlan()} />)

    const omskifter = document.querySelector('.omskifter')!
    expect(
      Array.from(omskifter.querySelectorAll('button')).map((knap) => knap.textContent),
    ).toEqual(['Planlæggeren', 'Årstabellen'])

    expect(screen.getByRole('img', { name: 'Fordelingsgraf' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Overskudsgraf' })).toBeTruthy()
    expect(document.querySelector('.mini-graferne [aria-label="Fordelingsgraf"]')).toBeTruthy()
    expect(document.querySelector('.mini-graferne [aria-label="Overskudsgraf"]')).toBeTruthy()
  })

  it('bytter Overskuddet ind som hovedgraf ved klik på mini-grafen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    const overskudKnap = document
      .querySelector('.mini-graferne')!
      .querySelector('[aria-label="Overskudsgraf"]')!
      .closest('button')!
    await user.click(overskudKnap)

    expect(document.querySelector('.hovedgraf-plads [aria-label="Overskudsgraf"]')).toBeTruthy()
    // Formuen står nu som mini i stedet, og Fordelingen rørte sig ikke.
    expect(document.querySelector('.mini-graferne [aria-label="Formuegraf"]')).toBeTruthy()
    expect(document.querySelector('.mini-graferne [aria-label="Fordelingsgraf"]')).toBeTruthy()
  })

  it('åbner forklar-året ved klik på en søjle i overskudsgrafen, når den er hovedgraf', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    const overskudKnap = document
      .querySelector('.mini-graferne')!
      .querySelector('[aria-label="Overskudsgraf"]')!
      .closest('button')!
    await user.click(overskudKnap)

    await user.click(document.querySelector('.hovedgraf-plads svg rect[data-year="2027"]')!)

    expect(screen.getByRole('heading', { name: '2027' })).toBeTruthy()
  })

  it('åbner forklar-året ved klik på en årsrække, og fører tilbage til tabellen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!)

    expect(screen.getByRole('heading', { name: '2026' })).toBeTruthy()
    // Ikke årstabellen — forklar-året har sine egne tabeller (skattelagene).
    expect(document.querySelector('.tabelramme')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Tilbage til tabellen' }))

    expect(document.querySelector('.tabelramme')).toBeTruthy()
  })

  it('skifter år frem og tilbage i forklar-året uden at gå om ad tabellen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />) // 2026–2028
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    expect(screen.queryByRole('button', { name: /2025/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: '2027 ›' }))
    expect(screen.getByRole('heading', { name: '2027' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '2028 ›' }))
    expect(screen.getByRole('heading', { name: '2028' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /2029/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: '‹ 2027' }))
    expect(screen.getByRole('heading', { name: '2027' })).toBeTruthy()
  })

  it('viser hver persons alder og satsåret i forklar-årets hoved', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const hoved = screen.getByRole('heading', { name: '2026' }).closest('.forklarhoved') as HTMLElement
    expect(within(hoved).getByText('Jesper 53 år')).toBeTruthy()
    expect(within(hoved).getByText('Satsår 2026')).toBeTruthy()
  })

  it('viser balancestriben for det valgte år, i nutidskroner', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026 — startåret, hvor nutidskroner og fremtidskroner er ét

    const stribe = document.querySelector('.balancestribe') as HTMLElement
    expect(stripeAmount(stribe, 'Formue primo')).toBe('1.000.000')
    expect(stripeAmount(stribe, 'Indtægter')).toBe('0')
    expect(stripeAmount(stribe, 'Afkast')).toBe('0')
    expect(stripeAmount(stribe, 'Skat')).toBe('0')
    expect(stripeAmount(stribe, 'Udgifter')).toBe('-40.000')
    expect(stripeAmount(stribe, 'Formue ultimo')).toBe('960.000')
  })

  it('viser årets overskud som ét tal i forklar-året, det samme som årstabellens', async () => {
    // Klikket i grafen eller i tabellen fører hertil, og skærmen skal bære
    // vægten af det klik: står der −40.000 i tabellens Overskud-kolonne, er
    // det dét tal, året skal kunne forklare. To udledninger af samme
    // størrelse, der kunne blive uenige, ville være værre end ingen.
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)
    expect(yearCell(1, 'Overskud')).toBe('-40.000')

    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!)

    const blok = surplusBlock()
    expect(stripeAmount(blok, 'Årets overskud')).toBe('-40.000')
  })

  it('deler overskuddet op i de otte bånd, grafen stabler, og lader dem summere til tallet', async () => {
    // Båndene er de samme otte som i grafen — faste, navngivne og i samme
    // rækkefølge — så et bånd kan følges fra graf til forklaring uden at
    // skifte navn undervejs. De fire opad står før de fire nedad, og lagt
    // sammen som de står, er de årets overskud.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithEveryBand()} />)
    await showYearTable(user)
    const overskud = yearCell(yearRow(2026), 'Overskud')

    await explainYear(user, 2026)

    expect(surplusBandLabels()).toEqual([
      'Indtægtsposter',
      'Ydelser',
      'Udbetalinger',
      'Overførsler ind',
      'Skat',
      'Udgiftsposter',
      'Indbetalinger',
      'Overførsler ud',
    ])
    expect(stripeAmount(surplusBlock(), 'Årets overskud')).toBe(overskud)
    expect(surplusBandTotal()).toBeCloseTo(parseKroner(overskud ?? ''), 0)
  })

  it('lader et bånd uden noget i falde helt væk frem for at vise et nul', async () => {
    // Planen har hverken indtægt, ordning, overførsel eller skat — kun den
    // faste udgift. Otte linjer, hvoraf de syv står på nul, ville påstå syv
    // slags bevægelser, året ikke havde, og skjule den ene det havde. Samme
    // greb som omsætningsposten i balancestriben.
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    await explainYear(user, 2026)

    expect(surplusBandLabels()).toEqual(['Udgiftsposter'])
    expect(stripeAmount(surplusBlock(), 'Årets overskud')).toBe('-40.000')
  })

  it('folder posterne ud under hvert sit bånd frem for i en blok for sig', async () => {
    // Posterne stod før i deres egen tabel nederst på skærmen, hvor de intet
    // sagde om, hvad de gjorde ved året. De hører under det bånd, de er en
    // del af — og de to retninger hører ikke under det samme.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithEveryBand()} />)
    await showYearTable(user)
    await explainYear(user, 2026)

    const indtaegter = await openBand(user, 'Indtægtsposter')
    expect(within(indtaegter).getByText('Løn')).toBeTruthy()
    expect(within(indtaegter).queryByText('Faste udgifter')).toBeNull()

    const udgifter = await openBand(user, 'Udgiftsposter')
    const linje = within(udgifter).getByText('Faste udgifter').closest('tr') as HTMLElement
    expect(within(linje).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Faste udgifter',
      '-400.000',
      'Jævnt fordelt',
      '0,00 %',
    ])

    expect(screen.queryByRole('heading', { name: 'Posterne', level: 3 })).toBeNull()
  })

  it('folder ydelserne ud under deres bånd, folkepensionen sammen med livrentens', async () => {
    // De to har intet med hinanden at gøre i planen — den ene læses af
    // satsåret, den anden af en omsætning — men de gør det samme ved året:
    // de lander på bufferbeholdningen uden en saldo bag sig. Båndet er
    // netop den lighed, og folden skal derfor føre dem begge.
    //
    // Personen er født i juni 1973 og fylder 70 i 2043, hvor både
    // folkepensionen og livrentens udbetaling begynder.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2043,
          balance: 500_000,
          holdings: [
            {
              id: 'livrente',
              name: 'Livrente',
              variant: 'LifeAnnuity',
              payoutAge: 67,
              balance: 1_000_000,
              grossReturn: 0,
              annualCostRate: 0,
              quotedReserve: 1_000_000,
              quotedAnnualBenefit: 51_200,
              bonusRate: 0,
              payout: { start: 70 },
            },
          ],
        })}
      />,
    )
    await showYearTable(user)
    await explainYear(user, 2043)

    const ydelser = await openBand(user, 'Ydelser')
    const names = within(ydelser)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0]!.textContent)
    expect(names).toEqual(['Folkepension', 'Livrente'])
    expect(within(ydelser).getByText('51.200')).toBeTruthy()

    expect(screen.queryByRole('heading', { name: 'Ydelserne', level: 3 })).toBeNull()
  })

  it('folder årets udbetalinger ud under deres bånd, én linje pr. ordning', async () => {
    // Båndets tal er summen af det, ordningerne tømte sig med. Står der ét
    // tal og to ordninger bag det, kan året ikke efterregnes — og det er
    // netop de år, hvor pengene kommer herfra, værktøjet findes for.
    //
    // Ratepensionen på en million tømmes over ti år efter serieprincippet
    // og giver en tiendedel det første år. Beholdninger uden en
    // udbetalingsplan har ingen linje.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithEveryBand()} />)
    await showYearTable(user)
    await explainYear(user, 2026)

    const udbetalinger = await openBand(user, 'Udbetalinger')
    expect(
      within(udbetalinger)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole('cell')
            .map((cell) => cell.textContent),
        ),
    ).toEqual([['Ratepension', '100.000']])
  })

  it('folder indbetalingerne ud under deres bånd og lader loftet stå for sig', async () => {
    //
    // Bidraget er ti procent af en løn på 800.000. De 80.000 forlader
    // lønnen, og 8 % arbejdsmarkedsbidrag senere lander 73.600 i ordningen.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithEveryBand()} />)
    await showYearTable(user)
    await explainYear(user, 2026)

    const indbetalinger = await openBand(user, 'Indbetalinger')
    const linje = within(indbetalinger)
      .getByText('Indbetalingen')
      .closest('tr') as HTMLElement
    expect(within(linje).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Indbetalingen',
      '80.000',
      '73.600',
    ])
    expect(screen.queryByRole('heading', { name: 'Indbetalingerne', level: 3 })).toBeNull()

    // Loftet følger ikke med ind i folden. Det findes, når året bad om
    // noget, og et indskud kan afkortes helt væk — så er båndet nul, folden
    // væk, og afkortningen usynlig. Blokken står derfor for sig.
    expect(within(indbetalinger).queryByRole('heading', { name: 'Lofterne' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Lofterne', level: 3 })).toBeTruthy()
  })

  it('deler overførslerne efter hvilken ende bufferbeholdningen står i', async () => {
    // En overførsel ind og en overførsel ud gør det modsatte ved året, og de
    // stod før i samme tabel, hvor kun pilen i navnet skilte dem. Under hvert
    // sit bånd siger retningen sig selv.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithEveryBand()} />)
    await showYearTable(user)
    await explainYear(user, 2026)

    const ind = await openBand(user, 'Overførsler ind')
    expect(within(ind).getByText('Ud af opsparingen')).toBeTruthy()
    expect(within(ind).queryByText('Ind i aktiedepotet')).toBeNull()

    const ud = await openBand(user, 'Overførsler ud')
    const linje = within(ud).getByText('Ind i aktiedepotet').closest('tr') as HTMLElement
    expect(within(linje).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Ind i aktiedepotet',
      '30.000',
      '30.000',
      '',
      '30.000',
    ])

    expect(screen.queryByRole('heading', { name: 'Overførslerne', level: 3 })).toBeNull()
  })

  it('lader en overførsel uden om bufferen stå i sin egen blok frem for at forsvinde', async () => {
    // Den flytter penge mellem to andre beholdninger og rører hverken det
    // ene bånd eller det andet — årets overskud er det samme med og uden
    // den. Uden en blok for sig ville den falde helt ud af skærmen, og en
    // afkortning af den ville være tavs, jf. ADR-0022.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          balance: 100_000,
          holdings: [
            { ...aFreeHolding('opsparing', 'Opsparing'), balance: 500_000 },
            aFreeHolding('aktiedepot', 'Aktiedepot'),
          ],
          transfers: [
            aTransfer({
              name: 'Uden om bufferen',
              from: 'opsparing',
              to: 'aktiedepot',
              amountInRealKroner: 100_000,
            }),
          ],
        })}
      />,
    )
    await showYearTable(user)
    await explainYear(user, 2026)

    expect(surplusBandLabels()).not.toContain('Overførsler ind')
    expect(surplusBandLabels()).not.toContain('Overførsler ud')

    const blok = screen
      .getByRole('heading', { name: 'Overførsler uden om bufferen', level: 3 })
      .closest('.blok') as HTMLElement
    expect(within(blok).getByText('Uden om bufferen')).toBeTruthy()
  })

  it('folder skatten ud, så skatten af afkastet kan læses uden at trække fra selv', async () => {
    // Den ene ting, brugeren garanteret undrer sig over: skattebåndet er
    // større, end de synlige indtægter kan forklare. Forskellen er skatten
    // af afkastet — en regning bufferbeholdningen betaler, mens afkastet
    // selv ikke tælles med i overskuddet, jf. ADR-0026.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          balance: 100_000,
          grossReturn: 0,
          entries: [aSalary({ amountInRealKroner: 800_000 })],
          holdings: [
            {
              id: 'depot',
              name: 'Aktiedepot',
              variant: 'ShareDepot',
              balance: 6_000_000,
              grossReturn: 0.05,
              annualCostRate: 0,
            },
          ],
        })}
      />,
    )
    await showYearTable(user)
    await explainYear(user, 2026)

    const skat = await openBand(user, 'Skat')
    const baand = parseKroner(stripeAmount(surplusBlock(), 'Skat') ?? '')
    const person = parseKroner(stripeAmount(skat, 'Jesper') ?? '')
    const aktieindkomst = parseKroner(stripeAmount(skat, 'Aktieindkomstskat') ?? '')
    const afkast = parseKroner(stripeAmount(skat, 'Heraf skat af afkast') ?? '')

    // Personens egen skat og husstandens aktieindkomstskat er tilsammen
    // båndet: beholdningsskatten passerer aldrig bufferbeholdningen.
    expect(person + aktieindkomst).toBeCloseTo(baand, 0)

    // Aktieindkomsten er afkast og intet andet, så hele dens skat er
    // afkastets — og lønnen står for resten.
    expect(afkast).toBeLessThanOrEqual(aktieindkomst)
    expect(afkast).toBeGreaterThan(baand)
  })

  it('forklarer omsætningsåret, så formuefaldet ikke ligner et tab', async () => {
    // Depotet forlader husstandens formue uden at være hverken en udgift
    // eller en skat. Striben ville ellers vise en formue, der falder med en
    // million, mens hverken skatten eller udgifterne kan forklare det.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithLifeAnnuity({ start: 53 })} />)
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!) // 2026

    const stribe = document.querySelector('.balancestribe') as HTMLElement
    expect(stripeAmount(stribe, 'Omsat livrentedepot')).toBe('-1.000.000')
    expect(stripeAmount(stribe, 'Indtægter')).toBe('51.200')
    expect(screen.getByText(/forlader formuen/)).toBeTruthy()

    // Ydelsen kommer udefra og står derfor ikke blandt planens poster. Uden
    // sin egen linje kunne indtægten i striben ikke føres tilbage til noget.
    const ydelser = await openBand(user, 'Ydelser')
    expect(within(ydelser).getByText('Livrente')).toBeTruthy()
    expect(within(ydelser).getAllByText('51.200').length).toBeGreaterThan(0)
  })

  it('lader striben stå uden omsætningsposten i de år, hvor intet omsættes', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithLifeAnnuity({ start: 53 })} />)
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[2]!) // 2027

    const stribe = document.querySelector('.balancestribe') as HTMLElement
    expect(stribe.textContent).not.toContain('Omsat livrentedepot')

    // Ydelsen bliver ved, reguleret med bonussatsen på 1 %.
    const ydelser = await openBand(user, 'Ydelser')
    expect(within(ydelser).getAllByText('51.712').length).toBeGreaterThan(0)
  })

  it('viser folkepensionens to beløb i forklar-året', async () => {
    // Hverken beløbene eller året står i planen: de læses af satsåret, og
    // året udledes af fødselsdatoen. Uden blokken kunne indtægten i striben
    // ikke føres tilbage til noget — der er ingen post og ingen beholdning
    // at finde den i.
    //
    // Fixturens person er født i juni 1973 og når folkepensionsalderen 70 i
    // 2043; planen begynder dér, så året står i den første række.
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ startYear: 2043 })} />)
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!) // 2043

    const folkepension = screen.getByRole('heading', {
      name: 'Folkepension og aftrapning af pensionstillæg',
      level: 3,
    }).parentElement as HTMLElement
    expect(within(folkepension).getByText('Jesper: grundbeløb')).toBeTruthy()
    expect(within(folkepension).getByText('90.528')).toBeTruthy()
    // Planen har ingen indkomst, så aftrapningen tager intet: det fulde og
    // det aftrappede tillæg er det samme beløb, og det står to gange.
    expect(within(folkepension).getAllByText('104.748').length).toBe(2)
  })

  it('viser ægtefællens andel af aftrapningsgrundlaget og hvad der ikke tæller med', async () => {
    // Aftrapningen er den ene beregning i værktøjet, der ikke kan deles i to
    // uafhængige personberegninger. Blokken skal derfor kunne vise, hvor
    // meget af den andens indkomst der kostede tillæg — og sige hvilke
    // indkomster der slet ikke tæller, for det er dem, en plan kan flytte
    // penge over i.
    const base = aPlan({ startYear: 2043 })
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...base,
          household: {
            persons: [
              ...base.household.persons,
              {
                id: 'anne',
                name: 'Anne',
                birthYear: 1974,
                birthMonth: 6,
                workEndAge: 60,
                horizon: 74,
                municipality: 'Hvidovre',
                churchMember: true,
                holdings: [
                  {
                    id: 'annes-frie-midler',
                    name: 'Annes frie midler',
                    variant: 'SavingsAccount',
                    balance: 0,
                    grossReturn: 0,
                    annualCostRate: 0,
                  },
                ],
              },
            ],
          },
        }}
      />,
    )
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!) // 2043

    const blok = screen.getByRole('heading', {
      name: 'Folkepension og aftrapning af pensionstillæg',
      level: 3,
    }).parentElement as HTMLElement

    // Anne er ikke folkepensionist i 2043, så der ses bort fra 54 % af
    // hendes indkomst — og satsen står på linjen i fladens sædvanlige form
    // med to decimaler, så de 46 % kan føres tilbage til hendes eget beløb i
    // hånden.
    expect(within(blok).getByText('Annes indkomst efter 54,00 % bortseelse')).toBeTruthy()
    expect(blok.textContent).toContain('Annes arbejdsindkomst indgår slet ikke')
  })

  it('lader folkepensionsblokken være væk i årene før folkepensionsalderen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)
    await user.click(within(screen.getByRole('table')).getAllByRole('row')[1]!) // 2026

    expect(
      screen.queryByRole('heading', {
        name: 'Folkepension og aftrapning af pensionstillæg',
        level: 3,
      }),
    ).toBeNull()
  })

  it('viser skattelagene pr. person som en lodret opstilling af grundlag, sats og beløb', async () => {
    // Samme lønindkomst som facitcasen "lønmodtager under
    // mellemskattegrænsen, 600.000 kr. brutto" i workedExamples.ts, men
    // kirkeskatten er nu Hvidovres egen sats, jf. docs/satser/2026.md.
    const user = userEvent.setup()
    const plan = aPlan({
      startYear: 2026,
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      municipality: 'Hvidovre',
      churchMember: true,
    })
    render(<App initialPlan={plan} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const blok = screen.getByRole('heading', { name: 'Jesper', level: 3 }).closest('.blok') as HTMLElement
    const rowFor = (label: string) =>
      within(blok)
        .getByText(label)
        .closest('tr') as HTMLElement

    const cells = (label: string) =>
      within(rowFor(label))
        .getAllByRole('cell')
        .map((cell) => cell.textContent)

    expect(cells('AM-bidrag')).toEqual(['AM-bidrag', '600.000', '8,00 %', '48.000'])
    expect(cells('Bundskat')).toEqual(['Bundskat', '497.900', '12,01 %', '59.798'])
    expect(cells('Kommuneskat')).toEqual(['Kommuneskat', '431.500', '25,40 %', '109.601'])
    expect(cells('Kirkeskat')).toEqual(['Kirkeskat', '431.500', '0,72 %', '3.107'])
    expect(cells('Skat i alt')).toEqual(['Skat i alt', '', '', '220.506'])

    // 8 % AM-bidrag + 92 % × (12,01 % bund + 25,40 % kommune + 0,72 % kirke)
    // — begge fradrag er i loft ved 600.000, og indkomsten ligger under
    // mellemskattegrænsen, så ingen af dem rører næste krone.
    expect(within(blok).getByText('Marginalskat, arbejdsindkomst')).toBeTruthy()
    expect(within(blok).getByText('43,08 %')).toBeTruthy()
  })

  it('viser en marginalskat pr. indkomstart, og pensionsindkomsten på vej til den personlige', async () => {
    // De to satser svarer på hvert sit spørgsmål, og forskellen er hele
    // grunden til, at der står to: skal den næste krone komme fra arbejde
    // eller fra en udbetaling, koster de ikke det samme. Begge står altid,
    // også i et rent arbejdsår — det er dér, spørgsmålet stilles.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          inflationAssumption: 0,
          entries: [
            aSalary({ amountInRealKroner: 600_000 }),
            aPensionIncome({ amountInRealKroner: 200_000 }),
          ],
        })}
      />,
    )
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const blok = screen
      .getByRole('heading', { name: 'Jesper', level: 3 })
      .closest('.blok') as HTMLElement
    // Pensionsindkomsten lægges til efter AM-bidraget, ikke før: bidraget
    // måles af lønnen alene. 600.000 − 48.000 + 200.000 = 752.000.
    expect(stripeAmount(blok, 'Løn og skattepligtige poster')).toBe('600.000')
    expect(stripeAmount(blok, 'AM-bidrag, 8,00 %')).toBe('-48.000')
    expect(stripeAmount(blok, 'Pensionsindkomst')).toBe('200.000')
    expect(stripeAmount(blok, 'Personlig indkomst')).toBe('752.000')

    // 752.000 ligger over mellemskattegrænsen, og Hvidovres 25,40 % lader
    // trappens første trin binde ved 44,57 %. Pensionskronen koster det plus
    // kirkeskatten; lønkronen koster 8 % AM-bidrag og 92 % af det samme.
    expect(stripeAmount(blok, 'Marginalskat, pensionsindkomst')).toBe('45,29 %')
    expect(stripeAmount(blok, 'Marginalskat, arbejdsindkomst')).toBe('49,67 %')
  })

  it('viser hvordan den personlige indkomst kommer fra bruttolønnen og indbetalingen', async () => {
    // Uden linjen kan brugeren ikke se forskel på et år, hvor indbetalingen
    // virkede, og et år, hvor den ikke gjorde. Fradragsretten står her og
    // ikke nede ved de ligningsmæssige fradrag, fordi den nedsætter den
    // personlige indkomst og dermed alle lag ovenpå — samme opstilling som
    // docs/mockup/flade.js.
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          startYear: 2026,
          entries: [aSalary({ amountInRealKroner: 700_000 })],
          contributions: [
            aContribution({
              source: 'salary',
              to: 'ratepension',
              amountInRealKroner: 70_000,
            }),
          ],
        }}
      />,
    )
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const blok = screen.getByRole('heading', { name: 'Jesper', level: 3 }).closest('.blok') as HTMLElement
    // 700.000 − 56.000 − 64.400 = 579.600. Det er de 64.400, der landede, og
    // ikke de 70.000, der forlod lønnen: AM-bidraget måles af bruttolønnen.
    // Bidraget er holdt under ratepensionens loft, så linjen her viser
    // fradragsretten alene — loftlinjen har sin egen test.
    expect(stripeAmount(blok, 'Løn og skattepligtige poster')).toBe('700.000')
    expect(stripeAmount(blok, 'AM-bidrag, 8,00 %')).toBe('-56.000')
    expect(stripeAmount(blok, 'Indbetaling med fradragsret')).toBe('-64.400')
    expect(stripeAmount(blok, 'Personlig indkomst')).toBe('579.600')
  })

  it('udelader linjen om fradragsret i et år uden en indbetaling, der har den', async () => {
    // En linje på nul ville sige, at der var en indbetaling uden virkning.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlan({ startYear: 2026, entries: [aSalary({ amountInRealKroner: 700_000 })] }),
        }}
      />,
    )
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const blok = screen.getByRole('heading', { name: 'Jesper', level: 3 }).closest('.blok') as HTMLElement
    expect(within(blok).queryByText('Indbetaling med fradragsret')).toBeNull()
    expect(
      within(blok).getByText('Personlig indkomst').closest('.stribepost')!.querySelector('.v')!
        .textContent,
    ).toBe('644.000')
  })

  it('viser primosaldo, vægtet strøm, nettoafkastsats og afkast pr. beholdning', async () => {
    const user = userEvent.setup()
    const plan: Plan = {
      ...aPlanWithSecondHolding(),
      startYear: 2026,
      transfers: [
        aTransfer({ from: 'free-assets', to: 'anden-beholdning', amountInRealKroner: 200_000 }),
      ],
    }
    render(<App initialPlan={plan} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const holdingsTable = document.querySelector('table.beholdningstabel') as HTMLElement
    const cells = (name: string) =>
      within(within(holdingsTable).getByText(name).closest('tr') as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)

    // Vægten er en egenskab ved enden, jf. ADR-0024: modtageren får de
    // 200.000 vejet halvt, mens bufferens ende giver nul, fordi overførslen
    // er jævn. Begge beholdninger har 0 % nettoafkast i fixturen, så
    // afkastet er 0 uanset grundlaget.
    expect(cells('Frie midler')).toEqual([
      'Frie midler',
      '1.000.000',
      '—',
      '0',
      '0,00 %',
      '0',
      '0',
    ])
    expect(cells('Anden beholdning')).toEqual([
      'Anden beholdning',
      '0',
      '—',
      '100.000',
      '0,00 %',
      '0',
      '0',
    ])
  })

  it('viser beholdningsskatten som sin egen kolonne ved siden af afkastet', async () => {
    // Afkastet står brutto, og skatten ved siden af, så de to kan efterregnes
    // hver for sig: ligger afvigelsen i afkastsatsen eller i skatten? Med ét
    // nettotal kunne brugeren ikke se det.
    const user = userEvent.setup()
    const plan = aPlan({
      startYear: 2026,
      balance: 1_000_000,
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 67,
          balance: 1_000_000,
          grossReturn: 0.07,
          annualCostRate: 0.005,
        },
      ],
    })
    render(<App initialPlan={plan} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026 — startåret, hvor nutidskroner og fremtidskroner er ét

    const holdingsTable = document.querySelector('table.beholdningstabel') as HTMLElement
    const cells = (name: string) =>
      within(within(holdingsTable).getByText(name).closest('tr') as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)

    // 6,5 % netto af 1.000.000 er 65.000, og PAL-skatten er 15,3 % af dem.
    // Den vises negativ: den er trukket af beholdningens egen saldo.
    expect(cells('Ratepension')).toEqual([
      'Ratepension',
      '1.000.000',
      '—',
      '0',
      '6,50 %',
      '65.000',
      '-9.945',
    ])
    // De frie midler har ingen beholdningsskat — deres afkast beskattes hos
    // personen i stedet, og satsen vælges ingen steder i fladen.
    expect(cells('Frie midler')).toEqual([
      'Frie midler',
      '1.000.000',
      '—',
      '0',
      '0,00 %',
      '0',
      '0',
    ])
  })

  it('viser årets poster med forfald og afkastvægt', async () => {
    const user = userEvent.setup()
    const plan = aPlan({
      startYear: 2026,
      entries: [
        aSalary({ amountInRealKroner: 600_000 }),
        anExpense({ amountInRealKroner: 40_000, timing: 6 }),
      ],
    })
    render(<App initialPlan={plan} />)
    await showYearTable(user)

    await explainYear(user, 2026)

    const cells = (fold: HTMLElement, name: string) =>
      within(within(fold).getByText(name).closest('tr') as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)

    // Lønnen er jævnt fordelt og lander på bufferen, hvor en jævn strøm
    // vejer nul — kolonnen skal vise det tal, motoren faktisk regnede med.
    expect(cells(await openBand(user, 'Indtægtsposter'), 'Løn')).toEqual([
      'Løn',
      '600.000',
      'Jævnt fordelt',
      '0,00 %',
    ])
    // Juni-forfald: (12 − 6 + 1) / 12 = 58,33 %. En dateret post beholder sin
    // vægt, også på bufferen. Udgiften vises negativ, som i navigatoren og
    // balancestriben.
    expect(cells(await openBand(user, 'Udgiftsposter'), 'Faste udgifter')).toEqual([
      'Faste udgifter',
      '-40.000',
      'Juni',
      '58,33 %',
    ])
  })

  it('viser indbetalingens to beløb i forklar-året', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithPension()
    render(
      <App
        initialPlan={{
          ...plan,
          startYear: 2026,
          entries: [aSalary({ amountInRealKroner: 600_000 })],
          contributions: [
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
          ],
        }}
      />,
    )
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const table = document.querySelector('table.indbetalingstabel') as HTMLElement
    const cells = within(within(table).getByText(/Indbetalingen/).closest('tr') as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)

    // Begge beløb, så det kan ses, hvor AM-bidraget blev af. Differencen står
    // ikke i sin egen kolonne — den er allerede personens AM-lag ovenfor.
    expect(cells).toEqual(['Indbetalingen', '48.000', '44.160'])
  })

  it('viser overførslens beløb i forklar-året, så en afkortning kan ses', async () => {
    // En tavs afkortning er den slags fejl, der aldrig viser sig: uden
    // linjen ville planen bede om 300.000 og flytte 200.000, uden at noget
    // på skærmen sagde det, jf. ADR-0022.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={{
          ...aPlan({
            startYear: 2033,
            holdings: [anOldAgeSavings('aldersopsparing', 'Aldersopsparing', 200_000)],
          }),
          transfers: [
            aTransfer({
              from: 'aldersopsparing',
              to: 'free-assets',
              amountInRealKroner: 300_000,
              period: { anchor: 'CalendarYear', from: 2033 },
            }),
          ],
        }}
      />,
    )
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2033

    const table = document.querySelector('table.overfoerselstabel') as HTMLElement
    const cells = within(
      within(table).getByText(/Overførslen/).closest('tr') as HTMLElement,
    )
      .getAllByRole('cell')
      .map((cell) => cell.textContent)

    expect(cells).toEqual(['Overførslen', '300.000', '200.000', '', '200.000'])
  })

  it('opdaterer forklar-året med det samme, når noget rettes i skuffen, mens forklaringen er åben', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const holdingsTable = document.querySelector('table.beholdningstabel') as HTMLElement
    expect(within(holdingsTable).getByText('1.000.000')).toBeTruthy()

    // Navigatoren og skuffen bliver stående, mens forklaringen er åben —
    // beholdningens inspektør kan stadig åbnes og rettes herfra.
    await user.click(navigatorButton(/Frie midler/))
    const balance = screen.getByLabelText(/Saldo/)
    await user.clear(balance)
    await user.type(balance, '2000000')

    expect(within(holdingsTable).getByText('2.000.000')).toBeTruthy()
  })

  it('tegner kapitalpensionen i formuegrafen og lægger den i årstabellens formue', async () => {
    // Ingen poster og ingen buffersaldo, så året er ordningens eget: 5 %
    // netto af 500.000 er 25.000, PAL-satsen tager 15,3 % af dem, og formuen
    // ender på 521.175. Beholdningen er hverken et bånd for sig eller en
    // kolonne for sig — den er en beholdning som de øvrige.
    const user = userEvent.setup()
    const plan = aPlan({
      balance: 0,
      holdings: [
        aHolding({
          id: 'kapitalpension',
          name: 'Kapitalpension',
          variant: 'CapitalPension',
          payoutAge: 60,
          balance: 500_000,
          grossReturn: 0.06,
          annualCostRate: 0.01,
        }),
      ],
    })
    render(<App initialPlan={plan} />)

    const graf = screen.getByRole('img', { name: 'Formuegraf' }).closest('.formuegraf')!
    expect(within(graf as HTMLElement).getByText('Kapitalpension')).toBeTruthy()
    expect(graf.querySelector('path[data-holding="kapitalpension"]')).toBeTruthy()

    await showYearTable(user)
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    const headers = within(rows[0]!)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    const cells = within(rows[1]!).getAllByRole('cell')

    expect(cells[headers.indexOf('Afkast')]!.textContent).toBe('25.000')
    expect(cells[headers.indexOf('Skat')]!.textContent).toBe('-3.825')
    expect(cells[headers.indexOf('Formue')]!.textContent).toBe('521.175')
  })

  it('åbner forklar-året ved klik i formuegrafens årskolonne, samme mønster som de to andre grafer', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    // Formuen er allerede hovedgraf som udgangspunkt.
    await user.click(document.querySelector('.hovedgraf-plads svg .aarsfelt')!)

    expect(screen.getByRole('heading', { name: '2026' })).toBeTruthy()
  })

  it('fører tilbage til planlæggeren, når forklar-året blev åbnet fra en graf, ikke til tabellen', async () => {
    // Klikket kom fra grafen — tabellen har slet ikke været vist i dette
    // forløb — og vejen tilbage skal gå til dét sted, ikke til et fast mål.
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    await user.click(document.querySelector('.hovedgraf-plads svg .aarsfelt')!)
    expect(screen.getByRole('heading', { name: '2026' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tilbage til planlæggeren' }))

    expect(document.querySelector('.graf-lag')).toBeTruthy()
    expect(document.querySelector('.tabelramme')).toBeNull()
  })

  it('bevarer vejen tilbage til planlæggeren, selvom man har bladret mellem årene undervejs', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />) // 2026–2028

    await user.click(document.querySelector('.hovedgraf-plads svg .aarsfelt')!)
    expect(screen.getByRole('heading', { name: '2026' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '2027 ›' }))
    expect(screen.getByRole('heading', { name: '2027' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tilbage til planlæggeren' }))
    expect(document.querySelector('.graf-lag')).toBeTruthy()
  })

  describe('klemningen, der siger hvorfor', () => {
    /** En aldersopsparing, der tømmes af en overførsel fra 2040. Ordningens
        pensionsudbetalingsalder er 60, og fixturens ejer er født i juni 1973
        — døren går op i 2033, og alt før det er den grænse, fladen skal
        klemme til. */
    function aPlanWithOldAgeSavingsPayout(period?: Period): Plan {
      return {
        ...aPlan({ holdings: [anOldAgeSavings('aldersopsparing', 'Aldersopsparing')] }),
        transfers: [
          aTransfer({
            from: 'aldersopsparing',
            to: 'free-assets',
            amountInRealKroner: 50_000,
            period: period ?? { anchor: 'CalendarYear', from: 2040 },
          }),
        ],
      }
    }

    it('lader ikke et tastet startår ligge før afgiverens pensionsudbetalingsalder', async () => {
      // Planen ville blive afvist af `transferEnds`, og hele resultatspalten
      // ville forsvinde, mens brugeren ledte efter, hvad hun gjorde galt.
      // Værdien snapper i stedet til det år, døren går op, jf. ADR-0045.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithOldAgeSavingsPayout()} />)

      await user.click(navigatorButton(/Overførslen/))
      const fra = () => screen.getByLabelText('Fra (år)') as HTMLInputElement
      await user.clear(fra())
      await user.type(fra(), '2030')
      await user.tab()

      expect(fra().value).toBe('2033')
      expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
    })

    it('siger hvilken grænse der greb ind, og nævner ordningen ved planens navn', async () => {
      // Væggen er usynlig: aksen har intet mærke for en ordnings
      // pensionsudbetalingsalder, og uden beskeden ville feltet blot rette
      // sig selv uden at sige hvorfor.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithOldAgeSavingsPayout()} />)

      await user.click(navigatorButton(/Overførslen/))
      await user.clear(screen.getByLabelText('Fra (år)'))
      await user.type(screen.getByLabelText('Fra (år)'), '2030')

      expect(
        screen.getByText('Beholdningen Aldersopsparing må tidligst udbetales i 2033.'),
      ).toBeTruthy()
    })

    it('siger det, når et skift af afgiver løfter starten til den nye dør', async () => {
      // Løftet er der i forvejen — uden det ville ét klik på afgiverlisten
      // gøre hele planen uregnelig. Det var bare tavst, og brugeren så et
      // årstal, hun ikke havde tastet, uden at få at vide hvorfor.
      const user = userEvent.setup()
      render(
        <App
          initialPlan={{
            ...aPlan({
              holdings: [
                aFreeHolding('anden-beholdning', 'Anden beholdning'),
                anOldAgeSavings('aldersopsparing', 'Aldersopsparing'),
              ],
            }),
            transfers: [
              aTransfer({
                from: 'anden-beholdning',
                to: 'free-assets',
                amountInRealKroner: 50_000,
                period: { anchor: 'CalendarYear', from: 2028, to: 2045 },
              }),
            ],
          }}
        />,
      )

      await user.click(navigatorButton(/Overførslen/))
      await user.selectOptions(screen.getByLabelText('Fra'), 'Aldersopsparing')

      expect((screen.getByLabelText('Fra (år)') as HTMLInputElement).value).toBe('2033')
      expect(
        screen.getByText('Beholdningen Aldersopsparing må tidligst udbetales i 2033.'),
      ).toBeTruthy()
      // Kun det, valget rørte, viger: slutåret står, hvor det stod.
      expect((screen.getByLabelText('Til (år)') as HTMLInputElement).value).toBe('2045')
    })

    it('svarer i alder, når overførslens periode er aldersforankret', async () => {
      // Grænsen er et kalenderår — 2033 — men feltet spørger om en alder, og
      // et årstal tastet ind i et aldersfelt ville være vrøvl. Jesper fylder
      // 60 i 2033, og alderen er dermed 60.
      const user = userEvent.setup()
      render(
        <App initialPlan={aPlanWithOldAgeSavingsPayout({ anchor: 'PersonAge', from: 62 })} />,
      )

      await user.click(navigatorButton(/Overførslen/))
      const fra = () => screen.getByLabelText('Fra (alder)') as HTMLInputElement
      await user.clear(fra())
      await user.type(fra(), '55')
      await user.tab()

      expect(fra().value).toBe('60')
      expect(screen.queryByRole('heading', { name: 'Planen kan ikke simuleres' })).toBeNull()
    })

    it('viser trækkets klemning i skuffen, fordi et greb også vælger figuren', async () => {
      // Boksen standser i den blå luft: aksen har intet mærke for ordningens
      // pensionsudbetalingsalder. Beskeden er derfor den eneste forklaring, og
      // den kan kun læses, hvis skuffen står åben på den figur, der blev
      // trukket i.
      render(
        <App
          initialPlan={aPlanWithOldAgeSavingsPayout({
            anchor: 'CalendarYear',
            from: 2035,
            to: 2045,
          })}
        />,
      )

      const handle = document.querySelector('.tl-haandtag.fra') as HTMLElement
      fireEvent.mouseDown(handle, { clientX: 0 })
      // Fem år tilbage på tidslinjens egen skala — 18 px pr. år.
      fireEvent.mouseMove(window, { clientX: -5 * 18 })
      fireEvent.mouseUp(window)

      expect(
        screen.getByText('Beholdningen Aldersopsparing må tidligst udbetales i 2033.'),
      ).toBeTruthy()
      expect((screen.getByLabelText('Fra (år)') as HTMLInputElement).value).toBe('2033')
    })

    it('lader klemningen overleve det klik, browseren fyrer, når boksen slippes', () => {
      // Et træk i kroppen begynder og ender på boksens egen knap, og
      // browseren fyrer derfor et klik oven på museslippet. Klikket vælger
      // figuren igen — den samme, den var — og ryddede det klemningen, ville
      // beskeden være væk i samme øjeblik, musen slap.
      render(
        <App
          initialPlan={aPlanWithOldAgeSavingsPayout({
            anchor: 'CalendarYear',
            from: 2035,
            to: 2045,
          })}
        />,
      )

      const boks = document.querySelector('.tl-boks') as HTMLElement
      fireEvent.mouseDown(boks, { clientX: 0 })
      fireEvent.mouseMove(window, { clientX: -5 * 18 })
      fireEvent.mouseUp(window)
      fireEvent.click(boks)

      expect(
        screen.getByText('Beholdningen Aldersopsparing må tidligst udbetales i 2033.'),
      ).toBeTruthy()
    })

    it('lader klemningen dø af sig selv fem sekunder efter, at boksen er sluppet', () => {
      // Beskeden hører til det ene øjeblik, hvor grænsen greb ind, og
      // brugeren står og ser på netop det, hun rørte. Den skal stå længe nok
      // til at blive læst efter et slip, og ikke længere.
      vi.useFakeTimers()
      try {
        render(
          <App
            initialPlan={aPlanWithOldAgeSavingsPayout({
              anchor: 'CalendarYear',
              from: 2035,
              to: 2045,
            })}
          />,
        )

        const handle = document.querySelector('.tl-haandtag.fra') as HTMLElement
        fireEvent.mouseDown(handle, { clientX: 0 })
        fireEvent.mouseMove(window, { clientX: -5 * 18 })
        fireEvent.mouseUp(window)

        act(() => void vi.advanceTimersByTime(4_000))
        expect(document.querySelector('.klemning')).toBeTruthy()

        act(() => void vi.advanceTimersByTime(1_500))
        expect(document.querySelector('.klemning')).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('lader klemningen dø, når næste redigering af feltet går igennem uklemt', async () => {
      // Beskeden hører til den ene redigering, den rettede. Blev den stående,
      // var den en Hint — og en Hint om noget, planen ikke længere siger.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithOldAgeSavingsPayout()} />)

      await user.click(navigatorButton(/Overførslen/))
      const fra = () => screen.getByLabelText('Fra (år)') as HTMLInputElement
      await user.clear(fra())
      await user.type(fra(), '2030')
      expect(document.querySelector('.klemning')).toBeTruthy()

      await user.clear(fra())
      await user.type(fra(), '2040')

      expect(document.querySelector('.klemning')).toBeNull()
    })

    it('lader klemningen dø, når valget skifter', async () => {
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithOldAgeSavingsPayout()} />)

      await user.click(navigatorButton(/Overførslen/))
      await user.clear(screen.getByLabelText('Fra (år)'))
      await user.type(screen.getByLabelText('Fra (år)'), '2030')
      expect(document.querySelector('.klemning')).toBeTruthy()

      await user.click(navigatorButton(/Aldersopsparing/))
      await user.click(navigatorButton(/Overførslen/))

      expect(document.querySelector('.klemning')).toBeNull()
    })

    it('lader et tømt Fra-felt falde tilbage på grænsen frem for at stå åbent', async () => {
      // Tomt betyder ellers "fra planens start" — og dét år ligger før døren.
      // Er endepunktet påkrævet, er grænsen det nærmeste gyldige svar, ganske
      // som i et aldersfelt med en nedre grænse.
      const user = userEvent.setup()
      render(<App initialPlan={aPlanWithOldAgeSavingsPayout()} />)

      await user.click(navigatorButton(/Overførslen/))
      const fra = () => screen.getByLabelText('Fra (år)') as HTMLInputElement
      await user.clear(fra())
      await user.tab()

      expect(fra().value).toBe('2033')
    })
  })

  describe('eksport og import', () => {
    let createdBlobs: Blob[]

    beforeEach(() => {
      createdBlobs = []
      URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlobs.push(blob)
        return 'blob:mock'
      }) as typeof URL.createObjectURL
      URL.revokeObjectURL = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('eksporterer planen som præcis den JSON, en import forventer', async () => {
      const user = userEvent.setup()
      const plan = aThreeYearPlan()
      render(<App initialPlan={plan} />)

      await user.click(screen.getByRole('button', { name: 'Eksporter' }))

      expect(createdBlobs).toHaveLength(1)
      const contents = await createdBlobs[0]!.text()
      expect(contents).toBe(exportPlan(plan))
    })

    it('erstatter planen med den importerede, når filen accepteres', async () => {
      const user = userEvent.setup()
      render(<App initialPlan={aThreeYearPlan()} />)

      const importeretPlan: Plan = { ...aPlan(), name: 'Importeret plan' }
      const file = new File([exportPlan(importeretPlan)], 'plan.json', {
        type: 'application/json',
      })

      await user.upload(screen.getByLabelText(/Importer/), file)

      expect(await screen.findByText('Importeret plan', { selector: '.plannavn' })).toBeTruthy()
    })

    it('afviser en ugyldig fil med en forklaring, uden at ændre den nuværende plan', async () => {
      const user = userEvent.setup()
      render(<App initialPlan={aThreeYearPlan()} />)

      const file = new File(['ikke json{'], 'plan.json', { type: 'application/json' })
      await user.upload(screen.getByLabelText(/Importer/), file)

      expect(await screen.findByText(/kan ikke importeres/i)).toBeTruthy()
      expect(screen.getByText('Ophør som 58', { selector: '.plannavn' })).toBeTruthy()
    })

    it('nævner en ukendt fremtidig skemaversion som sådan, når importen afvises', async () => {
      const user = userEvent.setup()
      render(<App initialPlan={aThreeYearPlan()} />)

      const file = new File(
        [JSON.stringify({ schemaVersion: 99, plan: aPlan() })],
        'plan.json',
        { type: 'application/json' },
      )
      await user.upload(screen.getByLabelText(/Importer/), file)

      expect(await screen.findByText(/nyere version/i)).toBeTruthy()
    })

    it('beder om at få lønposterne efterset, når en plan fra før lønskiftet importeres', async () => {
      // Migrationsleddet lader tallet stå — motoren kan ikke vide, hvor meget
      // af det gemte beløb der var arbejdsgiverens. Uden beskeden står lønnen
      // 12 % for højt, uden at hverken en invariant eller en test fanger det.
      const user = userEvent.setup()
      render(<App initialPlan={aThreeYearPlan()} />)

      const file = new File(
        [JSON.stringify({ schemaVersion: 13, plan: aPlan() })],
        'plan.json',
        { type: 'application/json' },
      )
      await user.upload(screen.getByLabelText(/Importer/), file)

      const besked = await screen.findByText(/lønposterne skal efterses/i)
      expect(besked).toBeTruthy()

      // Beskeden kan lukkes: den er læst, når planlæggeren siger, den er.
      await user.click(screen.getByRole('button', { name: 'Forstået' }))
      expect(screen.queryByText(/lønposterne skal efterses/i)).toBeNull()
    })
  })

  describe('slet alt', () => {
    let createdBlobs: Blob[]

    beforeEach(() => {
      createdBlobs = []
      URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlobs.push(blob)
        return 'blob:mock'
      }) as typeof URL.createObjectURL
      URL.revokeObjectURL = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    /** Topbjælkens knap og bekræftelsesskærmens svar hedder det samme —
        spørgsmålet og svaret bærer ét ord — så de skilles ad her. */
    function iTopbjaelken() {
      return within(document.querySelector('.topbjaelke')!)
    }

    function iBekraeftelsen() {
      return within(document.querySelector('.besked')!)
    }

    it('spørger, før noget kasseres, og lader det gemte stå urørt indtil da', async () => {
      // Der er ingen fortrydelse: autogemmet skriver ved hver ændring, så i
      // det sekund planen er erstattet, er det gemte skrevet over. Derfor
      // skal spørgsmålet stilles, før planen røres — ikke bagefter.
      const user = userEvent.setup()
      const plan = aThreeYearPlan()
      render(<App initialPlan={plan} />)

      await user.click(iTopbjaelken().getByRole('button', { name: 'Slet alt' }))

      expect(screen.getByText(/ingen fortrydelse/i)).toBeTruthy()
      expect(loadPlan()).toEqual({ kind: 'Loaded', plan })
      expect(screen.getByText('Ophør som 58', { selector: '.plannavn' })).toBeTruthy()
    })

    it('fører tilbage til resultatet, når bekræftelsen fortrydes', async () => {
      const user = userEvent.setup()
      const plan = aThreeYearPlan()
      render(<App initialPlan={plan} />)

      await user.click(iTopbjaelken().getByRole('button', { name: 'Slet alt' }))
      await user.click(screen.getByRole('button', { name: 'Fortryd' }))

      expect(screen.queryByText(/ingen fortrydelse/i)).toBeNull()
      expect(screen.getByRole('button', { name: 'Planlæggeren' })).toBeTruthy()
      expect(loadPlan()).toEqual({ kind: 'Loaded', plan })
    })

    it('efterlader minimumsplanen, når sletningen bekræftes', async () => {
      // Det tyndeste, `validatePlan` accepterer: én person og én
      // bufferbeholdning. En helt tom plan findes ikke — bufferen skal pege
      // på frie midler, der findes, jf. ADR-0013 — og resultatspalten skal
      // derfor tegne en graf bagefter og ikke sige, at planen ikke kan
      // simuleres.
      const user = userEvent.setup()
      render(<App initialPlan={aThreeYearPlan()} />)

      await user.click(iTopbjaelken().getByRole('button', { name: 'Slet alt' }))
      await user.click(iBekraeftelsen().getByRole('button', { name: 'Slet alt' }))

      expect(loadPlan()).toEqual({ kind: 'Loaded', plan: defaultPlan() })
      // Navigatoren står tilbage med bufferen og intet andet: posterne fra
      // den kasserede plan er væk, og der er ikke sat nye i stedet.
      const navigatoren = within(document.querySelector('.navigatorspalte')!)
      expect(navigatoren.getByText('Frie midler')).toBeTruthy()
      expect(navigatoren.queryByText('Faste udgifter')).toBeNull()
      expect(navigatoren.queryByText('Løn')).toBeNull()
      expect(screen.getByText('Min plan', { selector: '.plannavn' })).toBeTruthy()
      expect(screen.queryByText(/kan ikke simuleres/i)).toBeNull()
      expect(screen.queryByText(/ingen fortrydelse/i)).toBeNull()
    })

    it('giver planen som fil, uden at spørgsmålet er besvaret', async () => {
      // Der findes ingen fortrydelse, og en gemt fil er derfor den eneste vej
      // tilbage til den plan, der står nu. Udvejen gør spørgsmålet stumpt:
      // den, der er i tvivl, kan løse tvivlen uden at koste planen.
      const user = userEvent.setup()
      const plan = aThreeYearPlan()
      render(<App initialPlan={plan} />)

      await user.click(iTopbjaelken().getByRole('button', { name: 'Slet alt' }))
      await user.click(iBekraeftelsen().getByRole('button', { name: 'Eksporter først' }))

      expect(createdBlobs).toHaveLength(1)
      expect(await createdBlobs[0]!.text()).toBe(exportPlan(plan))
      expect(loadPlan()).toEqual({ kind: 'Loaded', plan })
      expect(screen.getByText(/ingen fortrydelse/i)).toBeTruthy()
    })

    it('lader skuffen falde tilbage på planens felter og forlader forklar-året, når planen er kasseret', async () => {
      // En markering på en post, der ikke længere findes, ville lade skuffen
      // blive stående på et objekt, der er væk, i stedet for at falde
      // tilbage på den nye plans egne felter, jf. ADR-0035; og forklar-året
      // ville forklare et år i en plan, der er væk — er året uden for den
      // nye horisont, er opslaget et nedbrud.
      const user = userEvent.setup()
      render(<App initialPlan={aThreeYearPlan()} />)

      await user.click(navigatorButton(/Faste udgifter/))
      expect(document.querySelector('.skuffe .titel')?.textContent).toContain('Faste udgifter')
      await showYearTable(user)
      await explainYear(user, 2027)

      await user.click(iTopbjaelken().getByRole('button', { name: 'Slet alt' }))
      await user.click(iBekraeftelsen().getByRole('button', { name: 'Slet alt' }))

      expect(document.querySelector('.skuffe .titel')?.textContent).toContain('Min plan')
      expect(screen.getByRole('button', { name: 'Planlæggeren', pressed: true })).toBeTruthy()
      expect(document.querySelector('.hovedgraf-plads [aria-label="Formuegraf"]')).toBeTruthy()
    })

    it('lader enheden stå: den er en aflæsningspræference og ikke plandata', async () => {
      // Alt andet på skærmen pegede på den plan, der forsvandt. Enheden gør
      // ikke — den siger, hvordan brugeren læser tal, ikke hvad planen
      // indeholder, og den er ikke en del af det gemte skema.
      const user = userEvent.setup()
      render(<App initialPlan={aThreeYearPlan()} />)

      await user.click(screen.getByRole('button', { name: 'Fremtidskroner' }))
      await user.click(iTopbjaelken().getByRole('button', { name: 'Slet alt' }))
      await user.click(iBekraeftelsen().getByRole('button', { name: 'Slet alt' }))

      expect(
        screen.getByRole('button', { name: 'Fremtidskroner', pressed: true }),
      ).toBeTruthy()
    })
  })

  describe('fejlskærmen', () => {
    let createdBlobs: Blob[]

    beforeEach(() => {
      createdBlobs = []
      URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlobs.push(blob)
        return 'blob:mock'
      }) as typeof URL.createObjectURL
      URL.revokeObjectURL = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('lader en fil føre ind i værktøjet igen, når det gemte ikke kunne indlæses', async () => {
      // Uden en vej ud er stopbeskeden en blindgyde: fladen viser den og
      // intet andet, og værktøjet er låst, indtil nogen tømmer localStorage
      // i browserens konsol. En eksporteret fil skal kunne låse det op.
      const user = userEvent.setup()
      localStorage.setItem(STORAGE_KEY, 'ikke json{')
      render(<App initialPlan={defaultPlan()} loadError="Det gemte er ikke gyldig JSON." />)

      const importeret: Plan = { ...aPlan(), name: 'Importeret plan' }
      await user.upload(
        screen.getByLabelText(/Importer/),
        new File([exportPlan(importeret)], 'plan.json', { type: 'application/json' }),
      )

      expect(await screen.findByText('Importeret plan', { selector: '.plannavn' })).toBeTruthy()
      expect(screen.queryByText(/ikke indlæses/i)).toBeNull()
      expect(loadPlan()).toEqual({ kind: 'Loaded', plan: importeret })
    })

    it('lader brugeren slette alt, og rører først det gemte da', async () => {
      // Det gemte må ikke overskrives, før brugeren har taget stilling. Er
      // fejlen en nyere skemaversion, er planen ikke ødelagt — blot ulæselig
      // for denne udgave af værktøjet, jf. issue #16 — og et automatisk
      // gem ovenpå den ville tage den fra en, der bare åbnede den forkerte
      // fane.
      //
      // Fejlskærmen er sin egen bekræftelse: den stiller allerede
      // spørgsmålet i prosa og har allerede en vej til at redde det gemte
      // ud. Et bekræftelsestrin mere ville være den samme skærm to gange.
      // Og det, der står tilbage, er minimumsplanen og ikke den plan, appen
      // tilfældigvis blev givet — handlingen betyder det samme begge steder.
      const user = userEvent.setup()
      localStorage.setItem(STORAGE_KEY, 'ikke json{')
      render(<App initialPlan={aThreeYearPlan()} loadError="Det gemte er ikke gyldig JSON." />)

      expect(localStorage.getItem(STORAGE_KEY)).toBe('ikke json{')

      await user.click(screen.getByRole('button', { name: 'Slet alt' }))

      expect(screen.queryByText(/ikke indlæses/i)).toBeNull()
      expect(screen.queryByText(/ingen fortrydelse/i)).toBeNull()
      expect(document.querySelector('.navigatorspalte')).toBeTruthy()
      expect(loadPlan()).toEqual({ kind: 'Loaded', plan: defaultPlan() })
    })

    it('giver det gemte som fil, præcis som det står, før det kasseres', async () => {
      // Det gemte er som regel læsbart nok til at kunne rettes i hånden og
      // importeres igen — én variant for meget, én peger for lidt. Uden
      // filen ville "Start forfra" koste hele planen for at komme videre, og
      // værktøjet må ikke stille brugeren over for det valg.
      //
      // Filen er råteksten og ikke en tolket plan: netop det gemte, fladen
      // ikke kunne læse, er det, der skal rettes i.
      const user = userEvent.setup()
      const gemt = '{"schemaVersion":99,"plan":{"name":"Min plan"}}'
      localStorage.setItem(STORAGE_KEY, gemt)
      render(<App initialPlan={defaultPlan()} loadError="Det gemte er fra en nyere version." />)

      await user.click(screen.getByRole('button', { name: /Hent det gemte/ }))

      expect(createdBlobs).toHaveLength(1)
      expect(await createdBlobs[0]!.text()).toBe(gemt)
      expect(localStorage.getItem(STORAGE_KEY)).toBe(gemt)
    })
  })

  it('viser husstandens aktieindkomstskat som sin egen blok med grundlag og sats', async () => {
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({
          startYear: 2026,
          birthYear: 1973,
          horizon: 55,
          balance: 1_000_000,
          inflationAssumption: 0,
          variant: 'ShareDepot',
          grossReturn: 0.1,
          annualCostRate: 0,
          entries: [],
        })}
      />,
    )
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    // Ikke i Jespers blok: grænsen er husstandens og kan ikke fordeles på
    // personer, jf. ADR-0014.
    const blok = screen
      .getByRole('heading', { name: 'Husstandens aktieindkomstskat' })
      .closest('.blok') as HTMLElement

    const lag = within(blok)
      .getAllByRole('row')
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      )

    // 100.000 kr. i afkast, 79.400 kr. til 27 % og 20.600 kr. til 42 %.
    expect(lag).toEqual([
      ['Til progressionsgrænsen', '79.400', '27,00 %', '21.438'],
      ['Over progressionsgrænsen', '20.600', '42,00 %', '8.652'],
    ])
  })
})

describe('rækkefølgen flyttes i navigatoren', () => {
  /** Kassens rækker i den rækkefølge, de står. */
  function rowNames(title: string): string[] {
    const groups = [...document.querySelectorAll<HTMLElement>('.nav-gruppe')]
    const group = groups.find((section) =>
      section.querySelector('h3')?.textContent?.includes(title),
    )!
    return [...group.querySelectorAll('.nav-rk .navn')].map((navn) => navn.textContent ?? '')
  }

  /** Kassens indhold i den rækkefølge, det står — overskrifter og rækker
      mellem hinanden, så skellet mellem to ejere kan ses. */
  function boxLines(title: string): string[] {
    const groups = [...document.querySelectorAll<HTMLElement>('.nav-gruppe')]
    const group = groups.find((section) =>
      section.querySelector('h3')?.textContent?.includes(title),
    )!
    return [...group.querySelectorAll('.nav-underoverskrift, .nav-rk .navn')].map(
      (line) => line.textContent ?? '',
    )
  }

  /** Trækket, som browseren udfører det: grebet gribes, rækken løftes, og
      den slippes på en anden. Uden greb starter trækket ikke. */
  function dragOnto(from: HTMLElement, to: HTMLElement) {
    fireEvent.mouseDown(from.querySelector('.greb')!)
    fireEvent.dragStart(from)
    fireEvent.dragOver(to)
    fireEvent.drop(to)
  }

  /** To indbetalinger til den samme ordning. Deler de et loft, tager den
      første i listen sit fulde beløb, jf. ADR-0019 — rækkefølgen er derfor
      et greb om en prioritet og ikke en sortering. */
  function aPlanWithTwoContributions(): Plan {
    return aPlan({
      holdings: [aPensionHolding('ratepension', 'Ratepension')],
      entries: [aSalary({ amountInRealKroner: 600_000 })],
      contributions: [
        aContribution({
          id: 'foerst',
          name: 'Først',
          source: 'salary',
          to: 'ratepension',
          percentageOfEntry: 0.05,
        }),
        aContribution({
          id: 'dernaest',
          name: 'Dernæst',
          source: 'salary',
          to: 'ratepension',
          percentageOfEntry: 0.05,
        }),
      ],
    })
  }

  it('sætter ejerens navn over hver persons beholdninger', () => {
    // Kassen har altid vist begge personers beholdninger efter hinanden.
    // Uden overskriften var der intet at se skellet på — og skellet er
    // reelt: en beholdning kan ikke trækkes over til den anden person.
    render(<App initialPlan={aPlanWithSpouse()} />)

    expect(boxLines('Beholdninger')).toEqual([
      'Jesper',
      'Frie midler',
      'Ratepension',
      'Maria',
      'Marias frie midler',
      'Marias ratepension',
    ])
  })

  it('trækker en indbetaling op over den anden', () => {
    render(<App initialPlan={aPlanWithTwoContributions()} />)
    expect(rowNames('Indbetalinger')).toEqual(['Først', 'Dernæst'])

    dragOnto(navigatorButton(/Dernæst/), navigatorButton(/Først/))

    expect(rowNames('Indbetalinger')).toEqual(['Dernæst', 'Først'])
  })

  it('starter ikke et træk, når rækken gribes uden om grebet', () => {
    // Rækken er også en knap, der åbner skuffen. Kunne den bæres fra hvor
    // som helst, ville et skævt klik flytte planen.
    render(<App initialPlan={aPlanWithTwoContributions()} />)

    const dernaest = navigatorButton(/Dernæst/)
    fireEvent.dragStart(dernaest)
    fireEvent.dragOver(navigatorButton(/Først/))
    fireEvent.drop(navigatorButton(/Først/))

    expect(rowNames('Indbetalinger')).toEqual(['Først', 'Dernæst'])
  })

  it('flytter rækken med Alt og en piletast', () => {
    render(<App initialPlan={aPlanWithTwoContributions()} />)

    const foerst = navigatorButton(/Først/)
    foerst.focus()
    fireEvent.keyDown(foerst, { key: 'ArrowDown', altKey: true })

    expect(rowNames('Indbetalinger')).toEqual(['Dernæst', 'Først'])

    // Enden er enden: pilen ned igen har ingen plads at flytte til.
    fireEvent.keyDown(navigatorButton(/Først/), { key: 'ArrowDown', altKey: true })

    expect(rowNames('Indbetalinger')).toEqual(['Dernæst', 'Først'])
  })

  it('lader en piletast uden Alt være rækkens egen', () => {
    render(<App initialPlan={aPlanWithTwoContributions()} />)

    fireEvent.keyDown(navigatorButton(/Først/), { key: 'ArrowDown' })

    expect(rowNames('Indbetalinger')).toEqual(['Først', 'Dernæst'])
  })

  it('afviser et slip i den anden persons beholdninger', () => {
    // Ejerskabet har skattemæssige følger og skiftes i skuffen. Et træk må
    // ikke kunne gøre det i forbifarten.
    render(<App initialPlan={aPlanWithSpouse()} />)

    dragOnto(navigatorButton(/Marias ratepension/), navigatorButton(/Frie midler.*1.000.000/))

    expect(boxLines('Beholdninger')).toEqual([
      'Jesper',
      'Frie midler',
      'Ratepension',
      'Maria',
      'Marias frie midler',
      'Marias ratepension',
    ])
  })

  it('giver ikke en liste med én række et greb', () => {
    // Husstanden med én person har ingen plads at bytte med, og et greb, der
    // ikke kan flytte noget, er værre end intet greb. Pladsen holdes åben,
    // så rækkerne flugter ned gennem spalten.
    render(<App initialPlan={aPlanWithTwoContributions()} />)

    // Husstandens foldeknap bærer også navnet i sit resumé, så rækken hentes
    // i kassen og ikke på rollen.
    const husstanden = [...document.querySelectorAll<HTMLElement>('.nav-gruppe')].find(
      (group) => group.querySelector('h3')?.textContent?.includes('Husstanden'),
    )!

    expect(husstanden.querySelector('.nav-rk .greb')!.innerHTML).toBe('')
    expect(navigatorButton(/Først/).querySelector('.greb svg')).toBeTruthy()
  })

  it('husker rækkefølgen i det gemte og i en eksporteret fil', async () => {
    // Rækkefølgen er arrayets, og der er intet felt at gemme den i. Det er
    // netop derfor den skal prøves: knækkede den, ville den knække tavst.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithTwoContributions()} />)

    dragOnto(navigatorButton(/Dernæst/), navigatorButton(/Først/))

    const gemt = loadPlan()
    expect(gemt.kind).toBe('Loaded')
    const plan = (gemt as { kind: 'Loaded'; plan: Plan }).plan
    expect(plan.contributions.map((contribution) => contribution.id)).toEqual([
      'dernaest',
      'foerst',
    ])

    await user.upload(
      screen.getByLabelText(/Importer/),
      new File([exportPlan(plan)], 'plan.json', { type: 'application/json' }),
    )

    expect(await screen.findByRole('button', { name: /Dernæst/ })).toBeTruthy()
    expect(rowNames('Indbetalinger')).toEqual(['Dernæst', 'Først'])
  })
})
