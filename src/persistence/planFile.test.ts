import { describe, expect, it } from 'vitest'
import { simulate } from '../engine/simulate'
import {
  aContribution,
  aHoldingContribution,
  aPlan,
} from '../engine/testing/planFixture'
import { exportPlan, importPlan } from './planFile'

describe('planFile', () => {
  it('giver præcis den samme årsrække tilbage efter en eksport efterfulgt af en import', () => {
    const plan = aPlan()

    const result = importPlan(exportPlan(plan))

    expect(result).toEqual({ kind: 'Loaded', plan })
    expect(simulate((result as { plan: typeof plan }).plan)).toEqual(simulate(plan))
  })

  it('afviser en fil fra en nyere version af værktøjet, forklaret som sådan', () => {
    const result = importPlan(JSON.stringify({ schemaVersion: 99, plan: aPlan() }))

    expect(result.kind).toBe('Failed')
    expect((result as { reason: string }).reason).toMatch(/nyere version/i)
  })

  it('afviser en fil, der ikke er en gyldig plan', () => {
    const result = importPlan('ikke json{')

    expect(result.kind).toBe('Failed')
  })

  it('bærer en plan med de tre pensionsvarianter hele vejen rundt', () => {
    // En udvidet union er bagudkompatibel: en gemt plan fra etape 1 kender
    // ingen af de tre og skal indlæses uændret, og en plan der gør, skal
    // kunne gemmes og hentes igen med sine egne felter i behold.
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          openedOn: { year: 2018, month: 1 },
          balance: 2_000_000,
          grossReturn: 0.06,
          annualCostRate: 0.005,
        },
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          openedOn: { year: 2018, month: 1 },
          balance: 1_000_000,
          grossReturn: 0.05,
          annualCostRate: 0.004,
          quotedReserve: 1_000_000,
          quotedAnnualBenefit: 51_200,
          bonusRate: 0.01,
        },
        {
          id: 'aldersopsparing',
          name: 'Aldersopsparing',
          variant: 'OldAgeSavings',
          openedOn: { year: 2018, month: 1 },
          balance: 300_000,
          grossReturn: 0.07,
          annualCostRate: 0.006,
        },
      ],
    })

    const result = importPlan(exportPlan(plan))

    expect(result).toEqual({ kind: 'Loaded', plan })
    // Tallet er hårdkodet med vilje: flytter det sig, skal det være, fordi
    // noget faktisk krævede et led i kæden. At de tre varianter kom til,
    // gjorde det ikke — det gjorde derimod v5 → v6, hvor overstyringen af
    // folkepensionsalderen forsvandt, v6 → v7, hvor planen fik sine
    // indbetalinger, v7 → v8, hvor de tre ordninger fik det
    // oprettelsestidspunkt, deres udbetalingsalder udledes af, v8 → v9, hvor
    // satsreguleringen kom til at hedde det, den løfter, v9 → v10, hvor
    // overførslens periode blev en fuld periode, og v10 → v11, hvor
    // livrenten fik sine omsætningsfelter.
    expect(JSON.parse(exportPlan(plan)).schemaVersion).toBe(11)
  })

  it('bærer en plan med indbetalinger hele vejen rundt', () => {
    // Indbetalingen skal kunne krydse en maskine som alt andet i planen: den
    // er en figur på planen, ikke en visning motoren regner sig frem til.
    const plan = aPlan({
      entries: [
        {
          id: 'salary',
          name: 'Løn',
          amountInRealKroner: 600_000,
          owner: 'jesper',
          direction: 'Income',
          taxTreatment: 'EarnedIncome',
          timing: 'Even',
          period: { anchor: 'CalendarYear' },
          recurrence: { kind: 'Annual' },
          regulationRate: 0.03,
        },
      ],
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          openedOn: { year: 2018, month: 1 },
          balance: 500_000,
          grossReturn: 0.06,
          annualCostRate: 0.005,
        },
      ],
      contributions: [
        aContribution({ source: 'salary', to: 'ratepension', percentageOfEntry: 0.08 }),
      ],
    })

    const result = importPlan(exportPlan(plan))

    expect(result).toEqual({ kind: 'Loaded', plan })
    expect(simulate((result as { plan: typeof plan }).plan)).toEqual(simulate(plan))
  })

  it('bærer et beholdningskildet bidrags egen periode og forfald med over', () => {
    // Den beholdningskildede udgave bærer felter, den lønkildede ikke har.
    // De ligger i det gemte skema og skal derfor krydse en maskine ligesom
    // resten — en aldersforankret periode, der tabte sin forankring undervejs,
    // ville flytte indbetalingen uden at nogen kunne se hvorfor.
    const plan = aPlan({
      holdings: [
        {
          id: 'aldersopsparing',
          name: 'Aldersopsparing',
          variant: 'OldAgeSavings',
          openedOn: { year: 2018, month: 1 },
          balance: 0,
          grossReturn: 0.04,
          annualCostRate: 0.004,
        },
      ],
      contributions: [
        aHoldingContribution({
          source: 'free-assets',
          to: 'aldersopsparing',
          amountInRealKroner: 64_200,
          timing: 1,
          period: { anchor: 'PersonAge', from: 'WorkEndAge', to: 69 },
          recurrence: { kind: 'EveryNYears', n: 2 },
        }),
      ],
    })

    const result = importPlan(exportPlan(plan))

    expect(result).toEqual({ kind: 'Loaded', plan })
    expect(simulate((result as { plan: typeof plan }).plan)).toEqual(simulate(plan))
  })
})
