import { describe, expect, it } from 'vitest'
import {
  aHolding,
  aHoldingContribution,
  aPlan,
  aTransfer,
  anExpense,
} from '../engine/testing/planFixture'
import type { Period } from '../engine/plan'
import { repairPlan } from './repairPlan'

/** En plan med en aldersopsparing, hvis dør er 2040 — ejeren er født i juni
    1973, og pensionsudbetalingsalderen er 67 — og en overførsel, der henter
    fra den i den periode, testen giver. */
function withTransferFrom(period: Period) {
  return aPlan({
    holdings: [
      aHolding({
        id: 'aldersopsparing',
        name: 'Aldersopsparing',
        variant: 'OldAgeSavings',
        payoutAge: 67,
        balance: 300_000,
      }),
    ],
    transfers: [
      aTransfer({
        name: 'Tømning',
        from: 'aldersopsparing',
        to: 'free-assets',
        amountInRealKroner: 50_000,
        period,
      }),
    ],
  })
}

describe('repairPlan', () => {
  it('siger hvilken figur, hvad den stod på, hvad den blev rettet til, og hvorfor', () => {
    // En tavs eller upræcis rettelse af brugerens egne tal er den slags fejl,
    // der aldrig viser sig, jf. ADR-0045.
    const repaired = repairPlan(withTransferFrom({ anchor: 'CalendarYear', from: 2030 }))

    expect(repaired.repairs).toEqual([
      'Overførslen Tømning begyndte i 2030 og er rettet til 2040. ' +
        'Beholdningen Aldersopsparing må tidligst udbetales i 2040.',
    ])
  })

  it('retter en aldersforankret periode i alder og lader forankringen stå', () => {
    // Grænsen svarer i endepunktets egen enhed, og reparationen skriver den,
    // som den fik den: et årstal i et aldersfelt ville flytte overførslen
    // halvandet årtusind frem.
    const repaired = repairPlan(withTransferFrom({ anchor: 'PersonAge', from: 60 }))

    expect(repaired.plan.transfers[0]!.period).toEqual({ anchor: 'PersonAge', from: 67 })
    expect(repaired.repairs).toEqual([
      'Overførslen Tømning begyndte ved alder 60 og er rettet til alder 67. ' +
        'Beholdningen Aldersopsparing må tidligst udbetales i 2040.',
    ])
  })

  it('erstatter et endepunkt, der fulgte erhvervsophøret, med grænsens egen alder', () => {
    // Fluebenet har kun to stillinger og kan ikke klemmes, og ved fladen
    // afvises redigeringen derfor. Ved indlæsningen er der ingen redigering
    // at afvise, og alternativet var fejlskærmen — netop den, trinnet findes
    // for at undgå. Beskeden gør til gengæld ændringen synlig: overførslen
    // følger ikke længere erhvervsophøret.
    const repaired = repairPlan(withTransferFrom({ anchor: 'PersonAge', from: 'WorkEndAge' }))

    expect(repaired.plan.transfers[0]!.period).toEqual({ anchor: 'PersonAge', from: 67 })
    expect(repaired.repairs).toEqual([
      'Overførslen Tømning fulgte erhvervsophøret og er rettet til alder 67. ' +
        'Beholdningen Aldersopsparing må tidligst udbetales i 2040.',
    ])
  })

  it('retter en post, hvis slutår ligger før dens startår, og siger det med postens eget navn', () => {
    // `validatePlan` afviser den plan, og uden dette trin ville en allerede
    // gemt plan give fejlskærmen ved næste indlæsning, uden at brugeren havde
    // rørt noget. Ved fladen viger det, brugeren rører; her har hun ikke rørt
    // noget, og endepunkterne måles i den rækkefølge, de står.
    const repaired = repairPlan(
      aPlan({
        entries: [
          anExpense({
            amountInRealKroner: 100_000,
            period: { anchor: 'CalendarYear', from: 2040, to: 2030 },
          }),
        ],
      }),
    )

    expect(repaired.plan.entries[0]!.period).toEqual({
      anchor: 'CalendarYear',
      from: 2030,
      to: 2030,
    })
    expect(repaired.repairs).toEqual([
      'Posten Faste udgifter begyndte i 2040 og er rettet til 2030. ' +
        'Perioden slutter i 2030 og kan ikke begynde efter.',
    ])
  })

  it('retter en beholdningskildet indbetalings omvendte periode', () => {
    const repaired = repairPlan(
      aPlan({
        holdings: [
          aHolding({
            id: 'aldersopsparing',
            name: 'Aldersopsparing',
            variant: 'OldAgeSavings',
            balance: 0,
          }),
        ],
        contributions: [
          aHoldingContribution({
            name: 'Opsparing',
            source: 'free-assets',
            to: 'aldersopsparing',
            amountInRealKroner: 10_000,
            period: { anchor: 'CalendarYear', from: 2040, to: 2030 },
          }),
        ],
      }),
    )

    expect(repaired.plan.contributions[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2030, to: 2030 },
    })
    expect(repaired.repairs).toEqual([
      'Indbetalingen Opsparing begyndte i 2040 og er rettet til 2030. ' +
        'Perioden slutter i 2030 og kan ikke begynde efter.',
    ])
  })

  it('lader en plan, der ikke bryder nogen grænse, stå uden en eneste rettelse', () => {
    const plan = withTransferFrom({ anchor: 'CalendarYear', from: 2045 })

    const repaired = repairPlan(plan)

    expect(repaired.plan).toEqual(plan)
    expect(repaired.repairs).toEqual([])
  })

  it('lader en overførsel, hvis afgiver ikke findes, stå urørt til afvisningen', () => {
    // Hvervet er klemning og intet andet. En hængende peger er ADR-0013's
    // slags fejl, og en reparation, der gættede en afgiver, ville skjule den.
    const plan = withTransferFrom({ anchor: 'CalendarYear', from: 2030 })
    const broken = {
      ...plan,
      transfers: [{ ...plan.transfers[0]!, from: 'findes-ikke' }],
    }

    const repaired = repairPlan(broken)

    expect(repaired.plan).toEqual(broken)
    expect(repaired.repairs).toEqual([])
  })

  it('lukker et åbent startpunkt op ved grænsen og siger, hvad det stod på', () => {
    // Et åbent `from` betyder planens start, ganske som i `transferEnds` — og
    // en overførsel, der løber hele horisonten fra en ordning med en dør, er
    // netop den plan, `addTransfer` i dag løfter ved oprettelsen.
    const repaired = repairPlan(withTransferFrom({ anchor: 'CalendarYear' }))

    expect(repaired.plan.transfers[0]!.period).toEqual({ anchor: 'CalendarYear', from: 2040 })
    expect(repaired.repairs).toEqual([
      'Overførslen Tømning begyndte ved planens start og er rettet til 2040. ' +
        'Beholdningen Aldersopsparing må tidligst udbetales i 2040.',
    ])
  })
})
