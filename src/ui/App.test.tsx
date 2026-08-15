import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Holding, PayoutSchedule, Plan } from '../engine/plan'
import {
  aContribution,
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

function aPensionHolding(id: string, name: string): Holding {
  return {
    id,
    name,
    variant: 'InstalmentPension',
    openedOn: { year: 2018, month: 1 },
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
        openedOn: { year: 2018, month: 1 },
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

/** Årstabellen ligger bag sin egen fane, med Formuen som standardfane. */
async function showYearTable(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Årstabellen' }))
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

/** En beholdnings navn findes både som navigatorrække og som knap i
    grafens legend — de to skal kunne skelnes, ikke kun den ene fjernes.
    Denne henter navigatorens, som de fleste tests handler om. */
function navigatorButton(name: string | RegExp) {
  const navigatorspalte = document.querySelector('.navigatorspalte') as HTMLElement
  return within(navigatorspalte).getByRole('button', { name })
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
    Den bevarede udbetalingsalder er 53 — den alder, ejeren fylder i 2026 —
    så udbetalingen kan ses uden at rulle fjorten år frem. Uden en
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
        openedOn: { year: 2018, month: 1 },
        payoutAgeOverride: 53,
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

  it('viser én række i årstabellen pr. simuleringsår, i dagens kroner', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

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
      'Jesper',
      'Indtægter',
      'Indbetalinger',
      'Udbetalinger',
      'Afkast',
      'Skat',
      'Udgifter',
      'Nettoresultat',
      'Buffer',
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

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect(screen.queryByLabelText(/Skattebehandling/)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Løn/ }))
    expect(screen.getByLabelText(/Skattebehandling/)).toBeTruthy()

    // Bruttolønnen er ikke det tal, folk kalder deres løn — feltet må sige
    // det selv, jf. ADR-0007. Ordet står på selve etiketten og ikke kun i
    // noten: taster brugeren nettolønnen og lægger et bidrag oveni, går alle
    // tal op og er alligevel forkerte, og ingen invariant fanger det.
    expect(screen.getByText(/brutto inklusive arbejdsgiverbidrag/i)).toBeTruthy()
    expect(screen.getByLabelText('Beløb, brutto (dagens kroner)')).toBeTruthy()

    // En skattefri indtægt har intet arbejdsgiverbidrag i sig, og etiketten
    // lover det ikke.
    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect(screen.getByLabelText('Beløb (dagens kroner)')).toBeTruthy()
  })

  it('gør en udgiftspost til en indtægtspost, og skattebehandlingen følger med', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    await user.selectOptions(screen.getByLabelText(/Retning/), 'Indtægt')

    const behandling = screen.getByLabelText(/Skattebehandling/) as HTMLSelectElement
    expect(behandling.value).toBe('Arbejdsindkomst')
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

    await user.click(screen.getByRole('button', { name: /Løn/ }))
    await user.selectOptions(screen.getByLabelText(/Skattebehandling/), 'Pensionsindkomst')

    // Løftet om arbejdsgiverbidrag hører til arbejdsindkomsten alene — en
    // pensionsudbetaling har intet i sig.
    expect(screen.getByLabelText('Beløb (dagens kroner)')).toBeTruthy()
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

  it('møder brugeren med en skattekolonne, der ikke længere er nul', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={defaultPlan()} />)
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

  it('lader en beholdnings type vælges mellem de seks, med deres danske navne', async () => {
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

    await user.click(navigatorButton(/Frie midler → Aktiesparekonto/))
    const kilde = screen.getByLabelText(/Kilde/) as HTMLSelectElement

    expect(Array.from(kilde.options).map((option) => option.value)).toEqual([
      'Frie midler · Jesper',
    ])
    // Og gruppen står ikke tom tilbage: en overskrift uden noget under sig
    // ville se ud som en liste, der mangler at blive fyldt.
    expect(kilde.querySelector('optgroup[label="Lønposter"]')).toBeNull()
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

    await user.click(navigatorButton(/Løn.*Ratepension/))
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
      'Saldo (dagens kroner)',
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

  it('viser ordningens udbetalingsregime og den alder, det giver, som udledte felter', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Ratepension/))

    // Ordningen er oprettet i januar 2018, og ejeren er født i 1973 og har
    // folkepensionsalder 70. Det nyeste regime giver tre år før — 67.
    const regime = lockedField('Udbetalingsregime')
    expect(regime.querySelector('.laast')!.textContent).toBe('1. januar 2018 eller senere')
    expect(regime.textContent).toContain('udledt')

    const alder = lockedField('Pensionsudbetalingsalder')
    expect(alder.querySelector('.laast')!.textContent).toBe('67 år')
    expect(alder.textContent).toContain('udledt')
  })

  it('flytter begge udledte felter, når oprettelsesåret skifter regime', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Ratepension/))
    const aar = screen.getByLabelText('Oprettet (år)')
    await user.clear(aar)
    await user.type(aar, '2005')

    // Før 1. maj 2007 er alderen fast 60 og ser ikke på ejeren overhovedet.
    expect(lockedField('Udbetalingsregime').querySelector('.laast')!.textContent).toBe(
      'Før 1. maj 2007',
    )
    expect(lockedField('Pensionsudbetalingsalder').querySelector('.laast')!.textContent).toBe(
      '60 år',
    )
  })

  it('lader en bevaret udbetalingsalder slå igennem på det viste tal', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(navigatorButton(/Ratepension/))
    await user.type(screen.getByLabelText('Bevaret udbetalingsalder'), '60')

    // Regimet står stadig — det er jo det, ordningen blev oprettet under —
    // men alderen er den bevarede.
    expect(lockedField('Udbetalingsregime').querySelector('.laast')!.textContent).toBe(
      '1. januar 2018 eller senere',
    )
    expect(lockedField('Pensionsudbetalingsalder').querySelector('.laast')!.textContent).toBe(
      '60 år',
    )
  })

  it('viser hverken oprettelsestidspunkt eller udbetalingsalder på en aktiesparekonto', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan({ holdings: [aShareSavingsAccount()] })} />)

    await user.click(navigatorButton(/Aktiesparekonto/))

    // Kontoen har intet regime: ejeren hæver af den, når hun vil, og et felt
    // om en udbetalingsalder ville påstå en lovregel, der ikke findes.
    expect(screen.queryByLabelText('Oprettet (år)')).toBeNull()
    expect(
      Array.from(document.querySelectorAll('.etiket')).map((e) => e.textContent),
    ).not.toContain('Pensionsudbetalingsalder')
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

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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
    await user.click(entryRender.getByRole('button', { name: /Faste udgifter/ }))
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
    await user.click(
      transferRender.getByRole('button', { name: /Frie midler.*Anden beholdning/ }),
    )
    expect(firstPeriodenFelt(transferRender.container)).toBe('Gentagelse')
  })

  it('lader forankringen vælges, og periodefelterne skifter mellem årstal og aldre', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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

    await user.click(screen.getByRole('button', { name: /Løn/ }))

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

    await user.click(screen.getByRole('button', { name: /Løn/ }))
    const regulering = screen.getByLabelText(/Reguleringssats/) as HTMLInputElement
    expect(regulering.value).toBe('3')

    await user.click(screen.getByRole('button', { name: /Ophør som 58/ }))
    expect((screen.getByLabelText(/Inflation/) as HTMLInputElement).value).toBe('2')

    await user.click(screen.getByRole('button', { name: /Løn/ }))
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

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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

    // Født 1973, erhvervsophør 60 falder i 2033. Posten har intet fra-endepunkt
    // og løber derfor fra planens start.
    expect(screen.getByText(/Posten løber 2026–2033\./)).toBeTruthy()
  })

  it('lægger erhvervsophør-tilvalget på sin egen linje, ikke i enhedskolonnen', async () => {
    // Enhedskolonnen er 56px og deles af hvert felt i skuffen. Lå
    // afkrydsningen i den, sprængte "erhvervsophør" bredden, og aldersfeltets
    // input stod forskudt fra alle andre felter i sektionen.
    const user = userEvent.setup()
    render(
      <App
        initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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

    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
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

    await user.click(navigatorButton(/Frie midler → Anden beholdning/))
    await user.click(screen.getByRole('button', { name: /Fjern overførsel/ }))

    expect(screen.queryByRole('button', { name: /Frie midler → Anden beholdning/ })).toBeNull()
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
    const beholdninger = screen.getByRole('button', { name: /Beholdninger/ })
    expect(within(beholdninger).getByText('1')).toBeTruthy()
  })

  it('flytter en post til en anden ejer via ejer-vælgeren', async () => {
    const user = userEvent.setup()
    render(
      <App initialPlan={aPlan({ entries: [anExpense({ amountInRealKroner: 40_000 })] })} />,
    )

    await user.click(screen.getByRole('button', { name: '+ Person' }))
    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))

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

    const indtaegter = screen.getByRole('button', { name: /Indtægter/ })
    const udgifter = screen.getByRole('button', { name: /Udgifter/ })

    // Grupperne viser kun deres antal — ikke en sum, der ville blive
    // misvisende af poster med begrænset periode eller gentagelse. De
    // nøjagtige tal står i årstabellen i stedet.
    expect(within(indtaegter).getByText('1')).toBeTruthy()
    expect(within(udgifter).getByText('1')).toBeTruthy()

    expect(screen.getByRole('button', { name: /Faste udgifter/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Løn/ })).toBeTruthy()
  })

  it('viser overførsler som sin egen gruppe i navigatoren, med fra- og til-navn i rækken', () => {
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

    const gruppe = screen.getByRole('button', { name: /Overførsler/ })
    expect(within(gruppe).getByText('1')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }),
    ).toBeTruthy()
  })

  it('viser indbetalinger som sin egen gruppe i navigatoren, med kilde → destination i rækken', () => {
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

    const gruppe = screen.getByRole('button', { name: /Indbetalinger/ })
    expect(within(gruppe).getByText('1')).toBeTruthy()
    // Ingen sum i gruppen: en procent af en lønpost har intet kronebeløb, før
    // året er regnet, og navigatoren viser kun planen.
    expect(navigatorButton(/Løn.*Ratepension/)).toBeTruthy()
    expect(within(navigatorButton(/Løn.*Ratepension/)).getByText('8,00 %')).toBeTruthy()
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

    await user.click(navigatorButton(/Løn.*Ratepension/))

    expect(sectionLabels('Indbetalingen')).toEqual(['Kilde', 'Destination'])
    expect(sectionLabels('Beløb')).toEqual(['Angives som', 'Procent'])

    // Begge former er synlige uden at åbne noget, jf. fladekortet — en vælger
    // ville skjule den ene bag et klik.
    expect(screen.getByRole('button', { name: 'Procent af posten', pressed: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fast beløb', pressed: false })).toBeTruthy()

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

    await user.click(navigatorButton(/Frie midler.*Ratepension/))

    expect(sectionLabels('Indbetalingen')).toEqual(['Kilde', 'Destination'])
    // Kun den ene beløbsform: en procent skal have en post at måle af, og
    // kontakten "Angives som" ville være et valg, der aldrig kan træffes.
    expect(sectionLabels('Beløb')).toEqual(['Fast beløb (dagens kroner)'])
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
    await user.click(navigatorButton(/Løn.*Ratepension/))
    expect(screen.getByRole('heading', { name: 'Følger Løn' })).toBeTruthy()

    // Vælgeren har begge slags kilder at tilbyde, i hver sin gruppe.
    const kilde = screen.getByLabelText('Kilde')
    expect(within(kilde).getByRole('group', { name: 'Lønposter' })).toBeTruthy()
    expect(within(kilde).getByRole('group', { name: 'Beholdninger' })).toBeTruthy()

    await user.selectOptions(kilde, 'Frie midler · Jesper')

    expect(screen.queryByRole('heading', { name: /^Følger/ })).toBeNull()
    expect(sectionLabels('Beløb')).toEqual(['Fast beløb (dagens kroner)'])
    expect(sectionLabels('Perioden')).toEqual([
      'Gentagelse',
      'Forankring',
      'Fra (år)',
      'Til (år)',
      'Forfald',
    ])
  })

  it('viser begge indbetalingsformer i navigatorens gruppe, kendelige på kilden', () => {
    // Læseren skal kunne se, hvilken udgave en række er, uden at åbne den.
    // Navnet er kilde → destination i begge, og kilden siger det selv.
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
                    openedOn: { year: 2018, month: 1 },
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
            aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
            {
              ...aHoldingContribution({
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

    const gruppe = screen.getByRole('button', { name: /Indbetalinger/ })
    expect(within(gruppe).getByText('2')).toBeTruthy()
    expect(within(navigatorButton(/Løn.*Ratepension/)).getByText('8,00 %')).toBeTruthy()
    expect(
      within(navigatorButton(/Frie midler.*Aldersopsparing/)).getByText('64.200'),
    ).toBeTruthy()
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

    await user.click(navigatorButton(/Løn.*Ratepension/))
    expect(screen.getByRole('heading', { name: 'Følger Løn' })).toBeTruthy()
  })

  it('tilføjer en indbetaling i en husstand uden lønpost — kilden er så en beholdning', async () => {
    // Formen findes netop for de år, hvor der ingen løn er. Var knappen
    // skjult uden en lønpost, kunne aldersopsparingens vindue efter
    // erhvervsophør slet ikke skrives, jf. ADR-0016.
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPension()} />)

    await user.click(screen.getByRole('button', { name: '+ Indbetaling' }))

    await user.click(navigatorButton(/Frie midler.*Ratepension/))
    expect(sectionLabels('Beløb')).toEqual(['Fast beløb (dagens kroner)'])
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

    expect(navigatorButton(/Frie midler.*Aktiesparekonto/)).toBeTruthy()
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
    await user.click(navigatorButton(/Løn.*Ratepension/))

    await user.click(screen.getByRole('button', { name: 'Fast beløb' }))

    // De to former er hvert sit felt, ikke to værdier i ét: procenten er væk,
    // og der spørges nu om kroner.
    expect(sectionLabels('Beløb')).toEqual(['Angives som', 'Fast beløb (dagens kroner)'])
    expect(screen.getByLabelText('Fast beløb (dagens kroner)')).toBeTruthy()
    expect(screen.queryByLabelText('Procent')).toBeNull()
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

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Frie midler')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect((screen.getByLabelText(/Beløb/) as HTMLInputElement).value).toBe('50000')

    const beloeb = screen.getByLabelText(/Beløb/)
    await user.clear(beloeb)
    await user.type(beloeb, '75000')

    await user.click(screen.getByRole('button', { name: /Luk inspektøren/ }))
    expect(
      screen.getByRole('button', { name: /Frie midler.*Anden beholdning.*75.000/ }),
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

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))

    const fra = screen.getByLabelText('Fra') as HTMLSelectElement
    expect(Array.from(fra.options).map((option) => option.value)).toEqual([
      'Frie midler',
      'Anden beholdning',
    ])

    await user.selectOptions(fra, 'Anden beholdning')

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Frie midler')

    await user.click(screen.getByRole('button', { name: /Luk inspektøren/ }))
    expect(
      screen.getByRole('button', { name: /Anden beholdning.*Frie midler.*50.000/ }),
    ).toBeTruthy()
  })

  it('mærker en ufuldstændig og en uholdbar buffer forskelligt i årstabellen', async () => {
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
    // Enhedsfælden, fladekortet fandt: en note i løbende priser ved siden af
    // et beløb i dagens kroner, jf. ADR-0001. Forklar-året er i dagens
    // kroner hele vejen, og noten skal følge den samme omregning som
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

    await user.click(navigatorButton(/Løn.*Ratepension/))

    expect(screen.queryByText('Loft')).toBeNull()
    expect(screen.queryByText('Med fradragsret')).toBeNull()
  })

  it('tilføjer en beholdning via beholdningsgruppen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlan()} />)

    expect(screen.queryByRole('button', { name: /^Beholdning 2/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: '+ Beholdning' }))

    expect(navigatorButton(/^Beholdning 2/)).toBeTruthy()
    const beholdninger = screen.getByRole('button', { name: /Beholdninger/ })
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

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))
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

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))

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

  it('viser kun beholdninger med frie midler i en overførsels to lister', async () => {
    // En overførsel flytter penge mellem husstandens frie midler. Stod
    // ordningen i listen, kunne ét klik skrive en plan, `validatePlan`
    // afviser — og hele resultatspalten forsvandt, jf. ADR-0016.
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

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))

    const valg = (label: string) =>
      Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map(
        (option) => option.value,
      )

    expect(valg('Fra')).toEqual(['Frie midler', 'Anden beholdning'])
    expect(valg('Til')).toEqual(['Frie midler', 'Anden beholdning'])
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

    await user.click(screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ }))

    await user.selectOptions(screen.getByLabelText('Til'), 'Frie midler')

    expect((screen.getByLabelText('Fra') as HTMLSelectElement).value).toBe('Anden beholdning')
    expect((screen.getByLabelText('Til') as HTMLSelectElement).value).toBe('Frie midler')
    expect(screen.queryByText(/kan ikke simuleres/i)).toBeNull()
  })

  it('tilføjer en overførsel mellem to beholdninger med frie midler, når ordningen står imellem dem', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithPensionBetweenFreeHoldings()} />)

    await user.click(screen.getByRole('button', { name: '+ Overførsel' }))

    expect(navigatorButton(/Frie midler.*Anden beholdning/)).toBeTruthy()
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

    const raekke = screen.getByRole('button', { name: /Frie midler.*Anden beholdning/ })
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
    expect(screen.getByText(/findes-ikke/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('viser en forklarende besked frem for en tom flade, når en gemt plan ikke kunne indlæses', () => {
    render(<App initialPlan={aPlan()} loadError="Den gemte plan er ikke gyldig JSON." />)

    expect(screen.getByText(/ikke indlæses/i)).toBeTruthy()
    expect(screen.getByText('Den gemte plan er ikke gyldig JSON.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(document.querySelector('.navigatorspalte')).toBeNull()
  })

  it('slår årstabellen om til løbende priser, uden at røre inputfeltet i skuffen', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    expect(screen.getByRole('button', { name: 'Dagens kroner', pressed: true })).toBeTruthy()
    const udgifter2028 = () => yearCell(3, 'Udgifter')
    expect(udgifter2028()).toBe('-40.000')

    await user.click(screen.getByRole('button', { name: 'Løbende priser' }))

    expect(screen.getByRole('button', { name: 'Løbende priser', pressed: true })).toBeTruthy()
    // 40.000 kr. fremskrevet to år med 2 % — planens inflation, som posten
    // her følger 1:1.
    expect(udgifter2028()).toBe('-41.616')

    // Inputfeltet i skuffen er og bliver i dagens kroner, jf. issue #12.
    await user.click(screen.getByRole('button', { name: /Faste udgifter/ }))
    expect((screen.getByLabelText(/Beløb/) as HTMLInputElement).value).toBe('40000')
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

  it('viser årets udbetalinger i deres egen kolonne i årstabellen', async () => {
    // Kolonnen er beholdningernes rater lagt sammen. Ligesom indbetalingerne
    // er de penge, husstanden stadig har — de er blot flyttet — og de indgår
    // derfor ikke i nettoresultatet.
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

  it('viser Formuen som standardfane, og skifter til Årstabellen ved klik', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)

    expect(screen.getByRole('button', { name: 'Formuen', pressed: true })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Formuegraf' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Årstabellen' }))

    expect(screen.getByRole('button', { name: 'Årstabellen', pressed: true })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Formuegraf' })).toBeNull()
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

  it('viser balancestriben for det valgte år, i dagens kroner', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aThreeYearPlan()} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026 — startåret, hvor dagens kroner og løbende priser er ét

    const stribe = document.querySelector('.balancestribe') as HTMLElement
    const post = (label: string) =>
      Array.from(stribe.querySelectorAll('.stribepost')).find(
        (el) => el.querySelector('.m')?.textContent === label,
      )!.querySelector('.v')!.textContent

    expect(post('Formue primo')).toBe('1.000.000')
    expect(post('Indtægter')).toBe('0')
    expect(post('Afkast')).toBe('0')
    expect(post('Skat')).toBe('0')
    expect(post('Udgifter')).toBe('-40.000')
    expect(post('Formue ultimo')).toBe('960.000')
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
    const post = (label: string) =>
      within(blok).getByText(label).closest('.stribepost')!.querySelector('.v')!.textContent

    // Pensionsindkomsten lægges til efter AM-bidraget, ikke før: bidraget
    // måles af lønnen alene. 600.000 − 48.000 + 200.000 = 752.000.
    expect(post('Løn og skattepligtige poster')).toBe('600.000')
    expect(post('AM-bidrag, 8,00 %')).toBe('-48.000')
    expect(post('Pensionsindkomst')).toBe('200.000')
    expect(post('Personlig indkomst')).toBe('752.000')

    // 752.000 ligger over mellemskattegrænsen, og Hvidovres 25,40 % lader
    // trappens første trin binde ved 44,57 %. Pensionskronen koster det plus
    // kirkeskatten; lønkronen koster 8 % AM-bidrag og 92 % af det samme.
    expect(post('Marginalskat, pensionsindkomst')).toBe('45,29 %')
    expect(post('Marginalskat, arbejdsindkomst')).toBe('49,67 %')
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
    const post = (label: string) =>
      within(blok).getByText(label).closest('.stribepost')!.querySelector('.v')!.textContent

    // 700.000 − 56.000 − 64.400 = 579.600. Det er de 64.400, der landede, og
    // ikke de 70.000, der forlod lønnen: AM-bidraget måles af bruttolønnen.
    // Bidraget er holdt under ratepensionens loft, så linjen her viser
    // fradragsretten alene — loftlinjen har sin egen test.
    expect(post('Løn og skattepligtige poster')).toBe('700.000')
    expect(post('AM-bidrag, 8,00 %')).toBe('-56.000')
    expect(post('Indbetaling med fradragsret')).toBe('-64.400')
    expect(post('Personlig indkomst')).toBe('579.600')
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

    // Jævnt forfald vejer overførslen halvt: 200.000 bliver 100.000, negativt
    // hos afgiveren og positivt hos modtageren. Begge beholdninger har 0 %
    // nettoafkast i fixturen, så afkastet er 0 uanset grundlaget.
    expect(cells('Frie midler')).toEqual([
      'Frie midler',
      '1.000.000',
      '—',
      '-100.000',
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
          openedOn: { year: 2018, month: 1 },
          balance: 1_000_000,
          grossReturn: 0.07,
          annualCostRate: 0.005,
        },
      ],
    })
    render(<App initialPlan={plan} />)
    await showYearTable(user)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026 — startåret, hvor dagens kroner og løbende priser er ét

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

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    await user.click(rows[1]!) // 2026

    const posterTable = document.querySelector('table.postertabel') as HTMLElement
    const cells = (name: string) =>
      within(within(posterTable).getByText(name).closest('tr') as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)

    expect(cells('Løn')).toEqual(['Løn', '600.000', 'Jævnt fordelt', '50,00 %'])
    // Juni-forfald: (12 − 6 + 1) / 12 = 58,33 %. Udgiften vises negativ, som i
    // navigatoren og balancestriben.
    expect(cells('Faste udgifter')).toEqual(['Faste udgifter', '-40.000', 'Juni', '58,33 %'])
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
    const cells = within(within(table).getByText(/Løn.*Ratepension/).closest('tr') as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)

    // Begge beløb, så det kan ses, hvor AM-bidraget blev af. Differencen står
    // ikke i sin egen kolonne — den er allerede personens AM-lag ovenfor.
    expect(cells).toEqual(['Løn → Ratepension', '48.000', '44.160'])
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

  it('åbner inspektøren for beholdningen, når der klikkes på grafens legend', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(<App initialPlan={plan} />)

    // "Anden beholdning" findes både i navigatoren og i grafens legend —
    // afgrænset til grafen, som er den, testen handler om.
    const graf = screen.getByRole('img', { name: 'Formuegraf' }).closest('.formuegraf')!
    await user.click(within(graf as HTMLElement).getByRole('button', { name: 'Anden beholdning' }))

    const skuffe = screen.getByRole('complementary', { name: 'Inspektør' })
    expect(within(skuffe).getByText('Anden beholdning')).toBeTruthy()

    // Den valgte beholdnings bånd holder fuld styrke, mens den anden dæmpes.
    const andenBaand = graf.querySelector('path[data-holding="anden-beholdning"]')!
    const bufferBaand = graf.querySelector('path[data-holding="free-assets"]')!
    expect(andenBaand.getAttribute('fill-opacity')).toBe('1')
    expect(bufferBaand.getAttribute('fill-opacity')).toBe('0.28')
  })

  it('lukker inspektøren igen, når der klikkes på den samme legend en gang til', async () => {
    const user = userEvent.setup()
    const plan = aPlanWithSecondHolding()
    render(<App initialPlan={plan} />)

    const graf = screen.getByRole('img', { name: 'Formuegraf' }).closest('.formuegraf')!
    const legendKnap = within(graf as HTMLElement).getByRole('button', { name: 'Anden beholdning' })

    await user.click(legendKnap)
    expect(screen.getByRole('complementary', { name: 'Inspektør' })).toBeTruthy()

    await user.click(legendKnap)
    expect(screen.queryByRole('complementary', { name: 'Inspektør' })).toBeNull()

    // Med intet valgt skal alle bånd stå med samme styrke igen.
    const andenBaand = graf.querySelector('path[data-holding="anden-beholdning"]')!
    const bufferBaand = graf.querySelector('path[data-holding="free-assets"]')!
    expect(andenBaand.getAttribute('fill-opacity')).toBe('1')
    expect(bufferBaand.getAttribute('fill-opacity')).toBe('1')
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

    it('lader brugeren starte forfra, og rører først det gemte da', async () => {
      // Det gemte må ikke overskrives, før brugeren har taget stilling. Er
      // fejlen en nyere skemaversion, er planen ikke ødelagt — blot ulæselig
      // for denne udgave af værktøjet, jf. issue #16 — og et automatisk
      // gem ovenpå den ville tage den fra en, der bare åbnede den forkerte
      // fane.
      const user = userEvent.setup()
      localStorage.setItem(STORAGE_KEY, 'ikke json{')
      render(<App initialPlan={defaultPlan()} loadError="Det gemte er ikke gyldig JSON." />)

      expect(localStorage.getItem(STORAGE_KEY)).toBe('ikke json{')

      await user.click(screen.getByRole('button', { name: /Start forfra/ }))

      expect(screen.queryByText(/ikke indlæses/i)).toBeNull()
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
