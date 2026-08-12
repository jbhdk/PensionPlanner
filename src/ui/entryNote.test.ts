import { describe, expect, it } from 'vitest'
import { simulate } from '../engine/simulate'
import { aPlan, anExpense } from '../engine/testing/planFixture'
import { entryNote } from './entryNote'

describe('entryNote', () => {
  it('siger hvad en post koster i årets egne kroner, når den kun falder i ét år', () => {
    // 200.000 × 1,02^10 = 243.799 kr. i 2036. Beløbet er udledt: uden det er
    // forskellen på 2 % og 0 % usynlig, indtil året er nået i årstabellen.
    const entry = anExpense({
      amountInRealKroner: 200_000,
      period: { anchor: 'CalendarYear', from: 2036, to: 2036 },
      recurrence: { kind: 'Once' },
    })
    const plan = aPlan({ inflationAssumption: 0.02, entries: [entry] })

    expect(entryNote(simulate(plan), entry)).toMatch(/Posten falder i 2036 med 243\.799 kr\./)
  })

  it('siger første og sidste år, når posten falder i flere', () => {
    // Fixturens person er født i 1973 med horisont 90, så årsrækken slutter
    // i 2063. Posten løber hele vejen, og noten siger de to endepunkter —
    // ikke et beløb, som ikke er det samme i alle årene.
    const entry = anExpense({ amountInRealKroner: 200_000 })
    const plan = aPlan({ entries: [entry] })

    expect(entryNote(simulate(plan), entry)).toMatch(/Posten løber 2026–2063\./)
  })

  it('siger det, når posten falder uden for horisonten', () => {
    // Årsrækken slutter i 2063. Fladen tav før om det her og viste årstallet,
    // brugeren havde tastet, som om posten faldt — motoren så det aldrig.
    const entry = anExpense({
      amountInRealKroner: 200_000,
      period: { anchor: 'CalendarYear', from: 2099, to: 2099 },
      recurrence: { kind: 'Once' },
    })
    const plan = aPlan({ entries: [entry] })

    expect(entryNote(simulate(plan), entry)).toMatch(/Posten falder uden for horisonten\./)
  })

  it('klipper perioden mod horisonten frem for at gentage det tastede endepunkt', () => {
    // Til-året er 2099, men posten falder sidste gang i 2063. Noten siger
    // motorens svar, ikke feltets.
    const entry = anExpense({
      amountInRealKroner: 40_000,
      period: { anchor: 'CalendarYear', from: 2030, to: 2099 },
    })
    const plan = aPlan({ entries: [entry] })

    expect(entryNote(simulate(plan), entry)).toMatch(/Posten løber 2030–2063\./)
  })

  it('siger intet om perioden, når planen ikke kunne simuleres', () => {
    // En knækket bufferpeger giver en tom årsrække, mens skuffen står åben —
    // det er dér, fejlen rettes. Uden år er der intet udledt at sige, og
    // resultatspalten siger allerede højlydt hvorfor.
    const entry = anExpense({ amountInRealKroner: 200_000 })

    const note = entryNote([], entry)

    expect(note).not.toMatch(/Posten/)
    expect(note).toMatch(/dagens kroner/)
  })

  it('henviser ikke til et år, den ikke har nævnt', () => {
    // Engangspostens reguleringssætning lænede sig på, at perioden lige havde
    // sagt året: "følger planens inflation frem til det år". Uden årsrække er
    // der intet "det år" at pege på.
    const entry = anExpense({
      amountInRealKroner: 200_000,
      period: { anchor: 'CalendarYear', from: 2036, to: 2036 },
      recurrence: { kind: 'Once' },
    })

    expect(entryNote([], entry)).not.toMatch(/det år/)
  })

  it('viser en aldersforankret periode som de årstal, den falder i', () => {
    // Født 1973: alder 70 falder i 2043, alder 80 i 2053. Noten oversætter,
    // så alderen i felterne og årstallene i årstabellen kan holdes sammen.
    const entry = anExpense({
      amountInRealKroner: 40_000,
      period: { anchor: 'PersonAge', from: 70, to: 80 },
    })
    const plan = aPlan({ birthYear: 1973, entries: [entry] })

    expect(entryNote(simulate(plan), entry)).toMatch(/Posten løber 2043–2053\./)
  })
})
