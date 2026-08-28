import { describe, expect, it } from 'vitest'
import {
  aHolding,
  aHoldingContribution,
  aPlan,
  aSalary,
  aTransfer,
  anExpense,
  withSecondPerson,
} from '../engine/testing/planFixture'
import type { Entry, Plan } from '../engine/plan'
import { timelineLayout } from './timelineLayout'
import { applyTimelineDrag } from './timelineDrag'

describe('applyTimelineDrag', () => {
  it('rykker en kalenderårsforankret periodes frie from-endepunkt med det trukne antal år', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 3)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2033, to: 2035 },
    })
  })

  it('rykker kun to-endepunktet, når det er det, der trækkes', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', -2)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2030, to: 2033 },
    })
  })

  it('rykker begge endepunkter lige meget, når hele kroppen trækkes', () => {
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'body', 4)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2034, to: 2039 },
    })
  })

  it('standser to-håndtaget ved postens eget startår og siger hvorfor', () => {
    // En periode, der slutter før den begynder, falder i nul år, og boksen
    // ville tegnes med negativ bredde. Det, brugeren rører, er det, der viger,
    // jf. ADR-0045: trækket er i `to`, og det er `to`, der standser.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', -8)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2030, to: 2030 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.to',
      message: 'Perioden begynder i 2030 og kan ikke slutte før.',
    })
  })

  it('standser fra-håndtaget ved postens eget slutår og siger hvorfor', () => {
    // Den anden vej rundt: nu er det `from`, brugeren rører, og det er `from`,
    // der viger. Det urørte slutår står, hvor det stod — ellers ville to
    // felter bevæge sig af ét træk, jf. ADR-0045.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 8)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2035, to: 2035 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.from',
      message: 'Perioden slutter i 2035 og kan ikke begynde efter.',
    })
  })

  it('lader et træk i kroppen passere sin egen anden kant', () => {
    // Boksen flytter sig med sin længde i behold, og de to endepunkter kan
    // derfor ikke vende om. Måltes grænsen på den stående figur frem for på
    // den forskudte, ville trækket blive standset af den kant, det lige selv
    // havde flyttet lige så langt.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'body', 20)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2050, to: 2055 },
    })
    expect(next.clamp).toBeNull()
  })

  it('binder en aldersforankret overførsels endepunkter i kalenderår og svarer i alder', () => {
    // Grænsen er et opløst kalenderår — Jesper fylder 60 i 2033 — men
    // endepunktet er en alder, og svaret skal være i feltets egen enhed.
    // Beskeden siger året, ganske som dørens gør det, uanset forankring.
    const plan = aPlan({
      transfers: [
        aTransfer({
          name: 'Tømning',
          from: 'free-assets',
          to: 'free-assets',
          amountInRealKroner: 10_000,
          period: { anchor: 'PersonAge', from: 60, to: 65 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Transfers')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', -10)

    expect(next.plan.transfers[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 60, to: 60 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.to',
      message: 'Perioden begynder i 2033 og kan ikke slutte før.',
    })
  })

  it('standser et aldersforankret fra-håndtag ved alder 0 og siger hvorfor', () => {
    // `shiftBound` er ren addition, så kanten kunne trækkes negativ. En post
    // fra alder −4 er ingen fejl, motoren tager skade af — den beskriver bare
    // ingenting: en person kan ikke have et endepunkt før sin fødsel.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'PersonAge', from: 5, to: 62 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', -20)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 0, to: 62 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.from',
      message: 'Jesper er født i 1973 og har ingen alder før da.',
    })
  })

  it('standser et aldersforankret til-håndtag ved husstandens sidste år og ikke ved ejerens egen horisont', () => {
    // Jesper har horisont 95 og er født i 1973: husstanden regnes til og med
    // 2068. Maria er født i 1975 og har horisont 90, så hendes egen slutter i
    // 2065 — men udgiftsposten er husstandens og fortsætter til det fælles
    // sidste år, jf. ADR-0030. Loftet er derfor hendes alder i 2068, altså 93,
    // og ikke hendes horisont 90.
    const plan = aPlanWithMaria(
      anExpense({
        amountInRealKroner: 100_000,
        owner: 'maria',
        period: { anchor: 'PersonAge', from: 60, to: 80 },
      }),
    )
    const item = timelineLayout(plan).find((g) => g.name === 'ExpenseEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 20)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 60, to: 93 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.to',
      message: 'Husstandens forløb slutter i 2068.',
    })
  })

  it('rykker et fast alderendepunkt, der eksplicit navngiver en person, og bevarer navngivningen, jf. ADR-0051', () => {
    const plan = aPlanWithMaria(
      aSalary({
        amountInRealKroner: 600_000,
        period: { anchor: 'PersonAge', from: 45, to: { person: 'maria', age: 70 } },
      }),
    )
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 5)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 45, to: { person: 'maria', age: 75 } },
    })
    expect(next.clamp).toBeNull()
  })

  it('klemmer et navngivet fast alderendepunkt mod den navngivne persons egne grænser, ikke postens ejers, jf. ADR-0051', () => {
    // Jesper ejer posten, men "Til" er sat til at måle på Maria. Jespers
    // egen horisont (90) rammer husstandens sidste år i 2063; det er Marias
    // (95), som rammer det i 2070 og derfor er den reelle væg. Klemtes der
    // mod Jesper, ville alderen 95 fejlagtigt komme til at stå — den alder
    // Maria når 25 år efter husstandens sidste år.
    const plan = withSecondPerson(
      aPlan({
        horizon: 90,
        entries: [
          anExpense({
            amountInRealKroner: 100_000,
            period: { anchor: 'PersonAge', to: { person: 'maria', age: 80 } },
          }),
        ],
      }),
      { horizon: 95 },
    )
    const item = timelineLayout(plan).find((g) => g.name === 'ExpenseEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 30)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', to: { person: 'maria', age: 95 } },
    })
    expect(next.clamp).toEqual({
      field: 'Period.to',
      message: 'Husstandens forløb slutter i 2070.',
    })
  })

  it('lader fødselsmåneden bestemme, hvilken brøkalder der stadig ligger i husstandens sidste år', () => {
    // Loftet regnes i kalenderår og oversættes tilbage til alder, jf.
    // ADR-0045. Maria er nu født i januar 1975, og hun fylder 93½ i juli 2068
    // — husstandens sidste år, som Jespers horisont 95 sætter. Alderen 93,5 er
    // derfor stadig inden for forløbet, hvor et loft målt i aldre havde
    // standset ved 93 og gjort feltet strengere end året.
    const plan = aPlanWithMaria(
      anExpense({
        amountInRealKroner: 100_000,
        owner: 'maria',
        period: { anchor: 'PersonAge', from: 60, to: 92.5 },
      }),
      1,
    )
    const item = timelineLayout(plan).find((g) => g.name === 'ExpenseEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 1)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 60, to: 93.5 },
    })
    expect(next.clamp).toBeNull()

    // Ét år længere er 94½ i 2069, og dér er husstanden ikke længere. Væggen
    // står altså — den står bare et halvt år senere end aldrene antyder.
    const beyond = applyTimelineDrag(plan, item, 'to', 2)

    expect(beyond.plan.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 60, to: 93.5 },
    })
    expect(beyond.clamp).toEqual({
      field: 'Period.to',
      message: 'Husstandens forløb slutter i 2068.',
    })
  })

  it('standser et beholdningskildet bidrags fra-håndtag ved dets eget slutår', () => {
    const plan = aPlan({
      holdings: [
        aHolding({ id: 'aldersopsparing', name: 'Aldersopsparing', variant: 'OldAgeSavings', balance: 0 }),
      ],
      contributions: [
        aHoldingContribution({
          name: 'Opsparing',
          source: 'free-assets',
          to: 'aldersopsparing',
          amountInRealKroner: 10_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Contributions')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 9)

    expect(next.plan.contributions[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2035, to: 2035 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.from',
      message: 'Perioden slutter i 2035 og kan ikke begynde efter.',
    })
  })

  it('rykker et aldersforankret frit endepunkt ved at forskyde den faste alder, ikke det opløste årstal', () => {
    // Jesper er født i juni 1973 (jf. aPlan). Et fast alderendepunkt på 57 år
    // løses til 2030 — forskydes alderen med 3, giver det 60, som løses til 2033.
    const plan = aPlan({
      entries: [
        aSalary({
          amountInRealKroner: 600_000,
          period: { anchor: 'PersonAge', from: 57, to: 62 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'IncomeEntries')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 3)

    expect(next.plan.entries[0]).toMatchObject({
      period: { anchor: 'PersonAge', from: 60, to: 62 },
    })
  })

  it('rykker en overførsels periode på samme måde som en posts', () => {
    const plan = aPlan({
      transfers: [
        aTransfer({
          from: 'free-assets',
          to: 'free-assets',
          amountInRealKroner: 10_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Transfers')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'body', 2)

    expect(next.plan.transfers[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2032, to: 2037 },
    })
  })

  it('rykker et beholdningskildet bidrags periode på samme måde som en posts', () => {
    const plan = aPlan({
      holdings: [
        aHolding({ id: 'aldersopsparing', name: 'Aldersopsparing', variant: 'OldAgeSavings', balance: 0 }),
      ],
      contributions: [
        aHoldingContribution({
          source: 'free-assets',
          to: 'aldersopsparing',
          amountInRealKroner: 10_000,
          period: { anchor: 'CalendarYear', from: 2030, to: 2035 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Contributions')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 1)

    expect(next.plan.contributions[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2030, to: 2036 },
    })
  })

  it('rykker hele ratepensionens udbetalingsplan, når kroppen trækkes', () => {
    // Kroppen flytter planen og ændrer den ikke: samme varighed, senere
    // start. Det er dét, der skiller den fra fra-håndtaget, som holder højre
    // kant fast og forkorter perioden i stedet.
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
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'body', 2)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 69, duration: 15 } })
  })

  it('ændrer kun varigheden, når til-håndtaget trækkes, og lader starten stå', () => {
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
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'to', 3)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 67, duration: 18 } })
  })

  it('klemmer ratepensionens fra-håndtag til pensionsudbetalingsalderen, ikke længere ned', () => {
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
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    // Samme lovregel som livrentens, PBL § 11 A, stk. 1 — og derfor samme
    // klemning: fem år tilbage ville lande på 62, og trækket standser på 67.
    const next = applyTimelineDrag(plan, item, 'from', -5)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 67, duration: 15 } })
  })

  it('forkorter ratepensionens udbetalingsperiode, når fra-håndtaget trækkes ind', () => {
    // Boksens venstre kant er starten, dens højre er `start + duration − 1`.
    // Trækkes kanten ind, står den anden stille, og perioden bliver kortere —
    // som enhver anden boks på tidslinjen. Skal hele planen flytte sig med
    // samme længde, er det kroppen, man tager fat i.
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 60,
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 3)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 70, duration: 12 } })
    expect(next.clamp).toBeNull()
  })

  it('standser kroppen, før den sidste rate skubbes forbi trediveårsgrænsen', () => {
    // Kroppen flytter starten med varigheden i behold, og den sidste rate
    // flytter sig derfor med. Uden denne grænse kunne et træk skrive en plan,
    // `payoutSchedules` afviser, og hele resultatspalten ville forsvinde midt
    // i trækket. Jesper når 67 i 2040, sidste rate skal falde senest i 2070,
    // og en plan på 28 år må derfor tidligst begynde i 2043 — alder 70.
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
          payout: { start: 67, duration: 28, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'body', 5)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 70, duration: 28 } })
    expect(next.clamp).toEqual({
      field: 'PayoutSchedule.start',
      message:
        'Beholdningen Ratepension skal udbetale sin sidste rate senest i 2070, ' +
        '30 år efter pensionsudbetalingsalderen.',
    })
  })

  it('standser fra-håndtaget, når perioden ville blive kortere end ti år', () => {
    // Otte år ind ville give en varighed på syv. Væggen er tiårsreglen og
    // ikke døren: det er varigheden, kanten spiser af, når den anden står
    // stille.
    const plan = aPlan({
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 60,
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', 8)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 72, duration: 10 } })
    expect(next.clamp).toEqual({
      field: 'PayoutSchedule.start',
      message: 'En ratepension skal udbetales over mindst 10 år.',
    })
  })

  it('klemmer ratepensionens fra-håndtag til brøkalderens eget kalenderår, og siger hvorfor', () => {
    // Ejeren er født i marts 1968, og døren er 62,5 — altså kalenderåret
    // 2030. Alder 62 falder i det samme år og er lovlig; alder 61 gør ikke.
    // Skuffens Start-felt svarer 62 på det samme spørgsmål, fordi de to slår
    // op i den samme grænse. Væggen er usynlig — aksen har intet mærke for en
    // ordnings pensionsudbetalingsalder — og beskeden følger derfor med
    // trækket, jf. ADR-0045.
    const plan = aPlan({
      birthYear: 1968,
      birthMonth: 3,
      horizon: 90,
      holdings: [
        {
          id: 'ratepension',
          name: 'Ratepension',
          variant: 'InstalmentPension',
          payoutAge: 62.5,
          balance: 1_000_000,
          grossReturn: 0,
          annualCostRate: 0,
          payout: { start: 62, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', -1)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 62 } })
    expect(next.clamp).toEqual({
      field: 'PayoutSchedule.start',
      message: 'Beholdningen Ratepension må tidligst udbetales i 2030.',
    })
  })

  it('klemmer ratepensionens til-håndtag til ti års varighed, ikke kortere', () => {
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
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    // Ti år tilbage ville give en varighed på fem, og en ratepension skal
    // udbetales over mindst ti — den nedre grænse er feltets egen.
    const next = applyTimelineDrag(plan, item, 'to', -10)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 67, duration: 10 } })
    // Væggen er lige så usynlig som dørens: aksen har intet mærke for
    // tiårsreglen, og boksens højre kant standser i den blå luft.
    expect(next.clamp).toEqual({
      field: 'PayoutSchedule.duration',
      message: 'En ratepension skal udbetales over mindst 10 år.',
    })
  })

  it('klemmer ratepensionens til-håndtag, så sidste rate ikke falder efter trediveårsgrænsen', () => {
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
          payout: { start: 67, duration: 15, principle: 'SerialPrinciple' },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    // Jesper når 67 i 2040 (jf. aPlan), og sidste rate skal falde senest i
    // 2070. Starten står i 2040, så der er plads til 31 år — halvtreds år frem
    // klemmes derned og ikke til de 65, trækket bad om.
    const next = applyTimelineDrag(plan, item, 'to', 50)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'ratepension')!
    expect(holding).toMatchObject({ payout: { start: 67, duration: 31 } })
    expect(next.clamp).toEqual({
      field: 'PayoutSchedule.duration',
      message:
        'Beholdningen Ratepension skal udbetale sin sidste rate senest i 2070, ' +
        '30 år efter pensionsudbetalingsalderen.',
    })
  })

  it('rykker en livrentes omsætningstidspunkt, når boksens fra-håndtag trækkes', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          payoutAge: 67,
          balance: 800_000,
          grossReturn: 0,
          annualCostRate: 0,
          quotedReserve: 1_000_000,
          quotedAnnualBenefit: 50_000,
          bonusRate: 0,
          payout: { start: 68 },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    const next = applyTimelineDrag(plan, item, 'from', -1)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'livrente')!
    expect(holding).toMatchObject({ payout: { start: 67 } })
  })

  it('klemmer livrentens fra-håndtag til pensionsudbetalingsalderen, ikke længere ned', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          payoutAge: 67,
          balance: 800_000,
          grossReturn: 0,
          annualCostRate: 0,
          quotedReserve: 1_000_000,
          quotedAnnualBenefit: 50_000,
          bonusRate: 0,
          payout: { start: 68 },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    // Fem år tilbage ville lande på 63, men pensionsudbetalingsalderen er 67
    // — trækket klemmes, det bliver ikke afvist bagefter.
    const next = applyTimelineDrag(plan, item, 'from', -5)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'livrente')!
    expect(holding).toMatchObject({ payout: { start: 67 } })
  })

  it('klemmer en overførsels fra-håndtag til afgiverens pensionsudbetalingsalder og siger hvorfor', () => {
    // Væggen er usynlig på tidslinjen: aksen har intet mærke for en ordnings
    // pensionsudbetalingsalder, og boksen ville standse i den blå luft. Derfor
    // følger beskeden med trækket, jf. ADR-0045.
    const plan = aPlan({
      holdings: [
        aHolding({
          id: 'aldersopsparing',
          name: 'Aldersopsparing',
          variant: 'OldAgeSavings',
          balance: 500_000,
          payoutAge: 60,
        }),
      ],
      transfers: [
        aTransfer({
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 50_000,
          period: { anchor: 'CalendarYear', from: 2035, to: 2045 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Transfers')!.items[0]!

    // Jesper fylder 60 i 2033 (jf. aPlan), og fem år tilbage fra 2035 ville
    // lande i 2030 — trækket standser på døren.
    const next = applyTimelineDrag(plan, item, 'from', -5)

    expect(next.plan.transfers[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2033, to: 2045 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.from',
      message: 'Beholdningen Aldersopsparing må tidligst udbetales i 2033.',
    })
  })

  it('standser hele overførselsboksen ved døren, når det er kroppen, der trækkes', () => {
    // Et træk i kroppen flytter posten; det ændrer den ikke. Klemtes kun
    // `from`, ville boksen skrumpe af en bevægelse — og trækkes der langt nok,
    // ville den vende om og beskrive en periode, der slutter, før den
    // begynder. Det er bevægelsen, der standser ved væggen.
    const plan = aPlan({
      holdings: [
        aHolding({
          id: 'aldersopsparing',
          name: 'Aldersopsparing',
          variant: 'OldAgeSavings',
          balance: 500_000,
          payoutAge: 60,
        }),
      ],
      transfers: [
        aTransfer({
          from: 'aldersopsparing',
          to: 'free-assets',
          amountInRealKroner: 50_000,
          period: { anchor: 'CalendarYear', from: 2035, to: 2045 },
        }),
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'Transfers')!.items[0]!

    // Fem år tilbage ville lande på 2030, og døren er i 2033: der er kun to
    // års bevægelse at få, og de gælder begge ender.
    const next = applyTimelineDrag(plan, item, 'body', -5)

    expect(next.plan.transfers[0]).toMatchObject({
      period: { anchor: 'CalendarYear', from: 2033, to: 2043 },
    })
    expect(next.clamp).toEqual({
      field: 'Period.from',
      message: 'Beholdningen Aldersopsparing må tidligst udbetales i 2033.',
    })
  })

  it('klemmer livrentens fra-håndtag til ét år før ejerens horisont, ikke længere op', () => {
    const plan = aPlan({
      holdings: [
        {
          id: 'livrente',
          name: 'Livrente',
          variant: 'LifeAnnuity',
          payoutAge: 67,
          balance: 800_000,
          grossReturn: 0,
          annualCostRate: 0,
          quotedReserve: 1_000_000,
          quotedAnnualBenefit: 50_000,
          bonusRate: 0,
          payout: { start: 68 },
        },
      ],
    })
    const item = timelineLayout(plan).find((g) => g.name === 'HoldingPayouts')!.items[0]!

    // Tredive år frem ville lande på 98, men standardpersonens horisont er 90
    // — ét år før det, 89, er det seneste boksen selv kan vise uden at vende om.
    const next = applyTimelineDrag(plan, item, 'from', 30)

    const holding = next.plan.household.persons[0]!.holdings.find((h) => h.id === 'livrente')!
    expect(holding).toMatchObject({ payout: { start: 89 } })
  })
})

/** Fixturens Jesper med horisont 95, og Maria ved siden af ham med 90:
    husstanden regnes til og med 2068, hvor hendes egen slutter i 2065. */
function aPlanWithMaria(entry: Entry, birthMonth?: number): Plan {
  return withSecondPerson(aPlan({ horizon: 95, entries: [entry] }), { birthMonth })
}
