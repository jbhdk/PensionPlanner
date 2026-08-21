import { render, screen, within } from '@testing-library/react'
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
