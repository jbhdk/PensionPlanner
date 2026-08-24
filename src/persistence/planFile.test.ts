import { describe, expect, it } from 'vitest'
import { simulate } from '../engine/simulate'
import {
  aContribution,
  aHolding,
  aHoldingContribution,
  aPlan,
  aSalary,
  aTransfer,
} from '../engine/testing/planFixture'
import { exportPlan, importPlan } from './planFile'

/** En plan, hvis overførsel henter fra en aldersopsparing i 2030, ti år før
    dens dør: ejeren er født i juni 1973, og pensionsudbetalingsalderen er 67. */
function planWithEarlyTransfer() {
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
        period: { anchor: 'CalendarYear', from: 2030 },
      }),
    ],
  })
}

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

  it('beder planlæggeren efterse lønposterne, når en plan fra før skiftet åbnes', () => {
    // Migrationsleddet kan ikke gøre arbejdet færdigt: det lader tallet stå,
    // og uden en besked står lønnen 12 % for højt, uden at hverken en
    // invariant eller en test fanger det.
    const result = importPlan(JSON.stringify({ schemaVersion: 13, plan: aPlan() }))

    expect(result.kind).toBe('Loaded')
    expect((result as { notice?: string }).notice).toMatch(/lønposter/i)
  })

  it('lader en plan fra den nuværende version stå uden besked', () => {
    const result = importPlan(exportPlan(aPlan()))

    expect((result as { notice?: string }).notice).toBeUndefined()
  })

  it('reparerer en importeret fil på den nuværende skemaversion frem for at afvise den', () => {
    // Trinnet er ikke et migrationsled. En importeret fil kan komme fra hvor
    // som helst og bære tilstanden på den nuværende skemaversion, hvor en
    // migration kun ville fange planer gemt før sit eget nummer.
    const result = importPlan(exportPlan(planWithEarlyTransfer()))

    expect(result.kind).toBe('Loaded')
    expect((result as { notice?: string }).notice).toMatch(/Tømning begyndte i 2030/)
  })

  it('siger både om lønposterne og om det klemte, når en gammel fil bærer begge dele', () => {
    // De to beskeder deler én kanal, og en fil fra før ADR-0040 kan udmærket
    // også bære en periode, fladen ville have klemt. Tabte den ene den
    // anden, ville planlæggeren aldrig få det at vide.
    const result = importPlan(
      JSON.stringify({ schemaVersion: 13, plan: planWithEarlyTransfer() }),
    )

    expect(result.kind).toBe('Loaded')
    expect((result as { notice?: string }).notice).toMatch(/lønposter/i)
    expect((result as { notice?: string }).notice).toMatch(/Tømning/)
  })

  it('afviser stadig en fil, hvis overførsel henter fra en beholdning, der ikke findes', () => {
    // Reparationen udvider ikke sit hverv til pegerne: en hængende peger får
    // motoren til at lyve eller styrte, og den skal stoppes ved indgangen.
    const plan = planWithEarlyTransfer()
    const result = importPlan(
      exportPlan({ ...plan, transfers: [{ ...plan.transfers[0]!, from: 'findes-ikke' }] }),
    )

    expect(result.kind).toBe('Failed')
  })

  it('bærer en plan med de fire pensionsvarianter hele vejen rundt', () => {
    // En udvidet union er bagudkompatibel: en gemt plan fra etape 1 kender
    // ingen af de tre og skal indlæses uændret, og en plan der gør, skal
    // kunne gemmes og hentes igen med sine egne felter i behold.
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 67,
          balance: 2_000_000,
          grossReturn: 0.06,
          annualCostRate: 0.005,
        },
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          payoutAge: 67,
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
          payoutAge: 67,
          balance: 300_000,
          grossReturn: 0.07,
          annualCostRate: 0.006,
        },
        {
          id: 'kapitalpension',
          name: 'Kapitalpension',
          variant: 'CapitalPension',
          payoutAge: 60,
          balance: 250_000,
          grossReturn: 0.05,
          annualCostRate: 0.005,
        },
      ],
    })

    const result = importPlan(exportPlan(plan))

    expect(result).toEqual({ kind: 'Loaded', plan })
    // Tallet er hårdkodet med vilje: flytter det sig, skal det være, fordi
    // noget faktisk krævede et led i kæden. At varianterne kom til, gjorde
    // det ikke — heller ikke kapitalpensionen, som ingen gemt plan
    // indeholder, og som derfor ikke er noget, en ældre plan skal føres frem
    // til. Det gjorde derimod v5 → v6, hvor overstyringen af
    // folkepensionsalderen forsvandt, v6 → v7, hvor planen fik sine
    // indbetalinger, v7 → v8, hvor de tre ordninger fik det
    // oprettelsestidspunkt, deres udbetalingsalder udledes af, v8 → v9, hvor
    // satsreguleringen kom til at hedde det, den løfter, v9 → v10, hvor
    // overførslens periode blev en fuld periode, v10 → v11, hvor livrenten
    // fik sine omsætningsfelter, v11 → v12, hvor overførslen og
    // indbetalingen fik hver sit navn, og v12 → v13, hvor
    // oprettelsestidspunktet blev til en tastet pensionsudbetalingsalder,
    // jf. ADR-0032, v13 → v14, hvor lønpostens beløb holdt op med at være
    // brutto, jf. ADR-0040, og v14 → v15, hvor pensionsaftalen fik sit gebyr
    // og sin forsikringspræmie, jf. ADR-0042.
    expect(JSON.parse(exportPlan(plan)).schemaVersion).toBe(15)
  })

  it('bærer en lønpost med sin pensionsaftale hele vejen rundt', () => {
    // Aftalen ligger i det gemte skema og skal krydse en maskine som alt
    // andet i planen: en fordeling, der tabte sin form undervejs, ville
    // flytte pengene uden at nogen kunne se hvorfor.
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 67,
          balance: 0,
          grossReturn: 0.04,
          annualCostRate: 0.005,
        },
      ],
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          regulationRate: 0.03,
          pensionAgreement: {
            employerContribution: { percentageOfEntry: 0.12 },
            employeeContribution: { amountInRealKroner: 30_000 },
            allocation: [{ to: 'ratepension', form: 'Remainder' }],
          },
        }),
      ],
    })

    const result = importPlan(exportPlan(plan))

    expect(result).toEqual({ kind: 'Loaded', plan })
    expect(simulate((result as { plan: typeof plan }).plan)).toEqual(simulate(plan))
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
          payoutAge: 67,
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
          payoutAge: 67,
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
