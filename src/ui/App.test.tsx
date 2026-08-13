import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Holding, Plan } from '../engine/plan'
import {
  aContribution,
  aPlan,
  aSalary,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import { exportPlan } from '../persistence/planFile'
import { loadPlan } from '../persistence/planStorage'
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

/** Fixturens buffer plus en ratepension, så skuffen har en pensionsbeholdning
    at vise. */
function aPlanWithPension(): Plan {
  return aPlan({
    holdings: [
      {
        id: 'ratepension',
        name: 'Ratepension',
        variant: 'InstalmentPension',
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

  it('lader en beholdnings type vælges mellem de fem, med deres danske navne', async () => {
    const user = userEvent.setup()
    render(<App initialPlan={aPlanWithSecondHolding()} />)

    await user.click(navigatorButton(/Anden beholdning/))
    const type = screen.getByLabelText(/Type/) as HTMLSelectElement

    // Fixturens beholdning er en opsparingskonto. Aktiesparekontoen står ikke
    // i listen — den findes først i etape 3 — og intet engelsk identifier når
    // skærmen.
    expect(type.value).toBe('Opsparingskonto')
    expect(Array.from(type.options).map((option) => option.value)).toEqual([
      'Ratepension',
      'Livrente',
      'Aldersopsparing',
      'Aktiedepot',
      'Opsparingskonto',
    ])

    await user.selectOptions(type, 'Ratepension')
    expect(type.value).toBe('Ratepension')
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

  it('udelukker den valgte fra-beholdning fra til-vælgeren og omvendt', async () => {
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

    const fra = screen.getByLabelText('Fra') as HTMLSelectElement
    const til = screen.getByLabelText('Til') as HTMLSelectElement

    // "Til" kan ikke vælges til det samme som "Fra" — og omvendt.
    expect(Array.from(fra.options).map((o) => o.value)).not.toContain('Anden beholdning')
    expect(Array.from(til.options).map((o) => o.value)).not.toContain('Frie midler')
    // Men det tredje valg er stadig muligt i begge.
    expect(Array.from(fra.options).map((o) => o.value)).toContain('Tredje beholdning')
    expect(Array.from(til.options).map((o) => o.value)).toContain('Tredje beholdning')

    await user.selectOptions(til, 'Tredje beholdning')
    expect(Array.from(fra.options).map((o) => o.value)).not.toContain('Tredje beholdning')
    expect(Array.from(fra.options).map((o) => o.value)).toContain('Anden beholdning')
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
    expect(within(blok).getByText('Marginalskat')).toBeTruthy()
    expect(within(blok).getByText('43,08 %')).toBeTruthy()
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
              amountInRealKroner: 105_000,
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

    // 700.000 − 56.000 − 96.600 = 547.400. Det er de 96.600, der landede, og
    // ikke de 105.000, der forlod lønnen: AM-bidraget måles af bruttolønnen.
    expect(post('Løn og skattepligtige poster')).toBe('700.000')
    expect(post('AM-bidrag, 8,00 %')).toBe('-56.000')
    expect(post('Indbetaling med fradragsret')).toBe('-96.600')
    expect(post('Personlig indkomst')).toBe('547.400')
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
      '-100.000',
      '0,00 %',
      '0',
      '0',
    ])
    expect(cells('Anden beholdning')).toEqual([
      'Anden beholdning',
      '0',
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
      '0',
      '6,50 %',
      '65.000',
      '-9.945',
    ])
    // De frie midler har ingen beholdningsskat — deres afkast beskattes hos
    // personen i stedet, og satsen vælges ingen steder i fladen.
    expect(cells('Frie midler')).toEqual(['Frie midler', '1.000.000', '0', '0,00 %', '0', '0'])
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
