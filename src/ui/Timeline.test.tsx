import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Plan } from '../engine/plan'
import { aHolding, aPlan, aSalary, anExpense, aTaxFreeIncome } from '../engine/testing/planFixture'
import { Timeline } from './Timeline'
import { timelineLayout } from './timelineLayout'

/** To personer med hver sin levetid: Jesper til 2063 (født 1973, horisont
    90), Anne til 2055 (født 1975, horisont 80) — så et årstal mellem de to
    grænser kan bruges til at bevise, at aldersrækken er blank efter Annes
    horisont, mens Jespers stadig viser en alder. */
function aTwoPersonPlan(): Plan {
  return {
    name: 'To personer',
    startYear: 2026,
    inflationAssumption: 0,
    section20ProjectionAssumption: 0,
    statePensionProjectionAssumption: 0,
    buffer: 'jespers-konto',
    entries: [],
    transfers: [],
    contributions: [],
    household: {
      persons: [
        {
          id: 'jesper',
          name: 'Jesper',
          birthYear: 1973,
          birthMonth: 6,
          workEndAge: 58,
          horizon: 90,
          municipality: 'Hvidovre',
          churchMember: true,
          holdings: [
            aHolding({ id: 'jespers-konto', name: 'Frie midler', variant: 'SavingsAccount', balance: 0 }),
          ],
        },
        {
          id: 'anne',
          name: 'Anne',
          birthYear: 1975,
          birthMonth: 3,
          workEndAge: 62,
          horizon: 80,
          municipality: 'Hvidovre',
          churchMember: true,
          holdings: [
            aHolding({ id: 'annes-konto', name: 'Frie midler', variant: 'SavingsAccount', balance: 0 }),
          ],
        },
      ],
    },
  }
}

describe('Timeline', () => {
  it('tegner en periodepost som en boks i sin gruppe', () => {
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />)

    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.className).toContain('tl-boks')
  })

  it('positionerer boksen efter sine egne opløste år på tidslinjens egen pixel-pr.-år-skala', () => {
    // 18 px pr. år, jf. mock-uppens PXY — tidslinjens egen skala og ikke
    // graf-lagets, jf. ADR-0036. Planens start er 2026.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />)

    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.style.left).toBe(`${(2030 - 2026) * 18}px`)
    // Højre kant er `til` plus ét helt år, så sidste års boks dækker hele
    // året og ikke kun dets startpunkt.
    expect(box.style.width).toBe(`${(2035 - 2030 + 1) * 18}px`)
  })

  it('tegner en engangspost som et punkt uden udstrækning, ikke som en boks', () => {
    const plan = aPlan({
      entries: [
        aTaxFreeIncome({
          amountInRealKroner: 100_000,
          period: { anchor: 'CalendarYear', from: 2030 },
          recurrence: { kind: 'Once' },
        }),
      ],
    })

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />)

    const point = screen.getByRole('button', { name: 'Arv' })
    expect(point.className).toContain('tl-punkt')
    expect(point.className).not.toContain('tl-boks')
    // Et punkt har ingen udstrækning at sætte en bredde på.
    expect(point.style.width).toBe('')
  })

  it('kalder onSelect med postens Target, når man klikker en boks', async () => {
    const user = userEvent.setup()
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })
    const onSelect = vi.fn()

    render(<Timeline plan={plan} selected={null} onSelect={onSelect} onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Løn' }))

    expect(onSelect).toHaveBeenCalledWith({ kind: 'entry', id: 'salary' })
  })

  it('kalder onSelect med den rigtige Target, når man klikker et punkt', async () => {
    const user = userEvent.setup()
    const plan = aPlan({
      entries: [
        aTaxFreeIncome({
          amountInRealKroner: 100_000,
          period: { anchor: 'CalendarYear', from: 2030 },
          recurrence: { kind: 'Once' },
        }),
      ],
    })
    const onSelect = vi.fn()

    render(<Timeline plan={plan} selected={null} onSelect={onSelect} onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Arv' }))

    expect(onSelect).toHaveBeenCalledWith({ kind: 'entry', id: 'inheritance' })
  })

  it('bruger lagets egen farve på boksen frem for at udlede sin egen', () => {
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })
    const lagetsFarve = timelineLayout(plan)
      .find((g) => g.name === 'IncomeEntries')!
      .items[0]!.color

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />)

    // jsdom normaliserer en hex-farve til rgb(), når den læses tilbage fra
    // `style` — sammenligningen går derfor gennem samme normalisering i
    // stedet for at antage et format.
    const probe = document.createElement('div')
    probe.style.background = lagetsFarve

    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.style.background).toBe(probe.style.background)
  })

  it('tegner en "Hvert N. år"-post som en farveløs boks med en rombe pr. gentagelse, i stedet for en fyldt boks', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2028, to: 2044 },
          recurrence: { kind: 'EveryNYears', n: 8 },
        }),
      ],
    })

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.className).toContain('gentaget')
    expect(box.style.background).toBe('transparent')

    // 2028, 2036, 2044 — tre gentagelser, tre romber.
    expect(container.querySelectorAll('.tl-maerke')).toHaveLength(3)
  })

  it('tegner ingen romber for en post, der falder hvert år', () => {
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.className).not.toContain('gentaget')
    expect(container.querySelectorAll('.tl-maerke')).toHaveLength(0)
  })

  it('folder én gruppe ad gangen, uden at røre de andre', async () => {
    const user = userEvent.setup()
    const plan = aPlan({
      entries: [
        aSalary({ amountInRealKroner: 600_000 }),
        anExpense({ amountInRealKroner: 300_000 }),
      ],
    })

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Indtægter/ }))

    expect(screen.queryByRole('button', { name: 'Løn' })).toBeNull()
    // Udgifter er urørt af, at Indtægter er foldet sammen.
    expect(screen.getByRole('button', { name: 'Faste udgifter' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Indtægter/ }))
    expect(screen.getByRole('button', { name: 'Løn' })).toBeTruthy()
  })

  it('viser planens startår som mærke på kalenderårsrækken', () => {
    const plan = aPlan()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    const aarraekke = container.querySelector('.tl-akse-raekke.aar') as HTMLElement
    expect(within(aarraekke).getByText('2026')).toBeTruthy()
  })

  it('viser aldersrækken blank for en person efter hendes egen horisont, mens den anden persons stadig viser en alder', () => {
    const plan = aTwoPersonPlan()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    // 2058: Jesper (f. 1973) er 85 — inden for sin horisont på 90.
    // Anne (f. 1975) ville være 83, men hendes horisont stopper ved 80, så
    // hendes række skal være tom netop her.
    const jespersRaekke = container.querySelector('[data-person="jesper"]') as HTMLElement
    const annesRaekke = container.querySelector('[data-person="anne"]') as HTMLElement
    expect(within(jespersRaekke).getByText('85')).toBeTruthy()
    expect(within(annesRaekke).queryByText('85')).toBeNull()
  })

  it('placerer to overlappende poster i hver sin række, lodret adskilt', () => {
    // A og B overlapper i 2028-2030 og skal derfor stå i hver sin række, jf.
    // timelineLayout.ts's pakning — komponenten skal afspejle den række,
    // laget allerede har regnet, ikke selv beslutte den.
    const plan = aPlan({
      entries: [
        { ...aSalary({ amountInRealKroner: 1 }), id: 'a', name: 'A', period: { anchor: 'CalendarYear', from: 2026, to: 2030 } },
        { ...aSalary({ amountInRealKroner: 1 }), id: 'b', name: 'B', period: { anchor: 'CalendarYear', from: 2028, to: 2035 } },
      ],
    })

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />)

    const top = (name: string) => screen.getByRole('button', { name }).style.top
    expect(top('A')).not.toBe(top('B'))
  })

  it('viser et håndtag i hver ende af en boks, når begge endepunkter er frie', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    expect(container.querySelectorAll('.tl-haandtag')).toHaveLength(2)
  })

  it('viser intet håndtag på et endepunkt låst til erhvervsophør eller åbent', () => {
    // Lønnen løber fra planens start (åbent) til erhvervsophør (låst) — jf.
    // aPlanWithEveryBufferFlow's lønpost, samme forankring genskabt her.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'PersonAge', to: 'WorkEndAge' },
        }),
      ],
    })

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    expect(container.querySelectorAll('.tl-haandtag')).toHaveLength(0)
  })

  it('kalder onChange med det trukne from-endepunkt forskudt, når håndtaget trækkes 3 år', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-haandtag.fra') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    // 3 år á 18 px — tidslinjens egen skala.
    fireEvent.mouseMove(window, { clientX: 3 * 18 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0]
    expect(next.entries[0]).toMatchObject({ period: { from: 2033, to: 2035 } })
  })

  it('kalder ikke onChange, før musen har flyttet sig et helt snappet år', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-haandtag.fra') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    // Under halvdelen af et år på 18px-skalaen — runder til nul.
    fireEvent.mouseMove(window, { clientX: 8 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('holder op med at kalde onChange, efter museknappen er sluppet', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-haandtag.fra') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 18 })
    fireEvent.mouseUp(window)
    onChange.mockClear()
    fireEvent.mouseMove(window, { clientX: 36 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('flytter hele perioden, når kroppen trækkes på en boks med begge ender lukkede og frie', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const onChange = vi.fn()

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />)

    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.className).toContain('krop-fri')

    fireEvent.mouseDown(box, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 2 * 18 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0]
    expect(next.entries[0]).toMatchObject({ period: { from: 2032, to: 2037 } })
  })

  it('kan ikke flyttes som helhed, når mindst ét endepunkt er låst eller åbent', () => {
    // Lønnen løber fra planens start (åbent) til erhvervsophør (låst).
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'PersonAge', to: 'WorkEndAge' },
        }),
      ],
    })
    const onChange = vi.fn()

    render(<Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />)

    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.className).not.toContain('krop-fri')

    fireEvent.mouseDown(box, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 2 * 18 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('viser intet fra-håndtag på en ratepension, hvis udbetaling følger erhvervsophør, men lader til-håndtaget trække varigheden', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 67,
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
          payout: { start: 'WorkEndAge', duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    expect(container.querySelectorAll('.tl-haandtag.fra')).toHaveLength(0)
    const til = container.querySelector('.tl-haandtag.til') as HTMLElement
    expect(til).toBeTruthy()

    fireEvent.mouseDown(til, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 2 * 18 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const nextPlan = onChange.mock.calls[0]![0] as Plan
    const holding = nextPlan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')
    expect(holding).toMatchObject({ payout: { start: 'WorkEndAge', duration: 17 } })
  })

  it('opretter ingen ny post ved et træk på et tomt stykke af tidslinjen', () => {
    const plan = aPlan({ entries: [aSalary({ amountInRealKroner: 600_000 })] })
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const krop = container.querySelector('.tl-krop') as HTMLElement
    fireEvent.mouseDown(krop, { clientX: 500 })
    fireEvent.mouseMove(window, { clientX: 500 + 3 * 18 })
    fireEvent.mouseUp(window)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('viser ét erhvervsophørs-håndtag pr. person, placeret ved personens workEndAge', () => {
    const plan = aTwoPersonPlan()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    // Jesper: født 1973, ophør 58 → 2031. Anne: født 1975, ophør 62 → 2037.
    // Planens start er 2026, 18 px pr. år.
    const jesper = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    const anne = container.querySelector('.tl-ophoer-greb[data-person="anne"]') as HTMLElement
    expect(jesper.style.left).toBe(`${(2031 - 2026) * 18}px`)
    expect(anne.style.left).toBe(`${(2037 - 2026) * 18}px`)
  })

  it('kalder onChange via withPerson med den nye workEndAge, når erhvervsophørs-håndtaget trækkes', () => {
    const plan = aPlan()
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 3 * 18 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0] as Plan
    expect(next.household.persons[0]).toMatchObject({ workEndAge: 61 })
  })

  it('kalder ikke onChange for erhvervsophørs-håndtaget, før musen har flyttet sig et helt snappet år', () => {
    const plan = aPlan()
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    // Under halvdelen af et år på 18px-skalaen — runder til nul.
    fireEvent.mouseMove(window, { clientX: 8 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('flytter en post, hvis endepunkt er låst til erhvervsophør, når en efterfølgende genrendering viser den nye plan', () => {
    // Jesper: workEndAge 58, birthMonth 6 → 'to'-rollen løser til 2030 (året
    // før erhvervsophørsåret 2031, jf. ADR-0031). Lønnen løber fra planens
    // start (åbent) til erhvervsophør (låst).
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'PersonAge', to: 'WorkEndAge' },
        }),
      ],
    })
    const onChange = vi.fn()

    const { container, rerender } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 3 * 18 })

    const nextPlan = onChange.mock.calls[0]![0] as Plan
    rerender(<Timeline plan={nextPlan} selected={null} onSelect={() => {}} onChange={onChange} />)

    // Ny workEndAge 61 → 'to'-rollen løser til 2033.
    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.style.width).toBe(`${(2033 - 2026 + 1) * 18}px`)
  })

  it('lader en anden posts kalenderårsforankrede periode stå urørt, når erhvervsophørs-håndtaget trækkes', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const onChange = vi.fn()

    const { container, rerender } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 3 * 18 })

    const nextPlan = onChange.mock.calls[0]![0] as Plan
    expect(nextPlan.entries[0]).toMatchObject({ period: { from: 2030, to: 2035 } })

    rerender(<Timeline plan={nextPlan} selected={null} onSelect={() => {}} onChange={onChange} />)
    const box = screen.getByRole('button', { name: 'Løn' })
    expect(box.style.left).toBe(`${(2030 - 2026) * 18}px`)
  })

  it('viser én lodret erhvervsophørslinje pr. person, ved samme x-position som håndtaget', () => {
    const plan = aTwoPersonPlan()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={() => {}} />,
    )

    const lines = container.querySelectorAll('.tl-ophoer')
    expect(lines).toHaveLength(2)

    const jesperLine = container.querySelector('.tl-ophoer[data-person="jesper"]') as HTMLElement
    const jesperHandle = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    expect(jesperLine.style.left).toBe(jesperHandle.style.left)
  })

  it('holder op med at kalde onChange for erhvervsophørs-håndtaget, efter museknappen er sluppet', () => {
    const plan = aPlan()
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 18 })
    fireEvent.mouseUp(window)
    onChange.mockClear()
    fireEvent.mouseMove(window, { clientX: 36 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('klemmer erhvervsophøret til [0, horizon], ligesom Inspektørens Erhvervsophør-felt', () => {
    // Jesper: workEndAge 58, horizon 90 — et træk på 40 år ville give 98,
    // over horisonten.
    const plan = aPlan()
    const onChange = vi.fn()

    const { container } = render(
      <Timeline plan={plan} selected={null} onSelect={() => {}} onChange={onChange} />,
    )

    const handle = container.querySelector('.tl-ophoer-greb[data-person="jesper"]') as HTMLElement
    fireEvent.mouseDown(handle, { clientX: 0 })
    fireEvent.mouseMove(window, { clientX: 40 * 18 })

    const next = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as Plan
    expect(next.household.persons[0]).toMatchObject({ workEndAge: 90 })

    // Yderligere museflytning inden for det klemte område kalder ikke
    // onChange igen, fordi den opløste værdi ikke ændrer sig.
    onChange.mockClear()
    fireEvent.mouseMove(window, { clientX: 41 * 18 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('markerer den valgte post, men ingen af de andre', () => {
    const plan = aPlan({
      entries: [aSalary({ amountInRealKroner: 600_000 }), anExpense({ amountInRealKroner: 300_000 })],
    })

    render(
      <Timeline
        plan={plan}
        selected={{ kind: 'entry', id: 'salary' }}
        onSelect={() => {}}
        onChange={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Løn' }).className).toContain('valgt')
    expect(screen.getByRole('button', { name: 'Faste udgifter' }).className).not.toContain('valgt')
  })
})
