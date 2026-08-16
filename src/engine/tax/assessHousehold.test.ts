import { describe, expect, it } from 'vitest'
import type { Nominal } from '../plan'
import type { CivilStatus } from '../rates/rateYear'
import { rateYear2026 } from '../rates/rateYear2026'
import { assessHousehold, totalHouseholdTax, totalTaperBase } from './assessHousehold'
import { totalTax } from './assessTax'

/** Den sekundære testsøm: husstandens skat for ét simuleringsår, kaldbar uden
    at bygge en plan. Alt herunder er i løbende priser, jf. ADR-0001.

    Denne fil prøver det, der er husstandens eget — aktieindkomstens fælles
    progressionsgrænse og summen af det hele. Personens egne lag og fradrag
    prøves i `assessTax.test.ts`, gennem det samme søm. */

describe('husstandsskatteopgørelsen', () => {
  it('fører personens egen opgørelse og begge marginalskatter igennem', () => {
    const assessment = assessHousehold(
      {
        persons: [
          {
            tax: { earnedIncome: 500_000, municipalTaxRate: 0.22, churchTaxRate: 0 },
            shareIncome: 0,
          },
        ],
      },
      rateYear2026,
    )

    const person = assessment.persons[0]!

    expect(person.tax.personalIncome).toBeCloseTo(460_000, 6)
    // 460.000 kr. ligger under mellemskattegrænsen, og begge fradrag er i
    // loft ved 500.000 kr., så ingen af dem ændrer sig med den næste krone:
    // 8 % AM-bidrag + 92 % × (12,01 % bund + 22 % kommune) = 39,2892 %.
    expect(person.marginal.earnedIncome).toBeCloseTo(0.392892, 6)
    // Den næste krone pensionsindkomst bærer intet AM-bidrag og rører
    // ingen af de to arbejdsfradrag: 12,01 % + 22 % = 34,01 %.
    expect(person.marginal.pensionIncome).toBeCloseTo(0.3401, 6)
  })

  it('lader husstandens total være personens egen, når ingen har aktieindkomst', () => {
    const assessment = assessHousehold(
      {
        persons: [
          {
            tax: { earnedIncome: 500_000, municipalTaxRate: 0.22, churchTaxRate: 0 },
            shareIncome: 0,
          },
        ],
      },
      rateYear2026,
    )

    expect(totalHouseholdTax(assessment)).toBeCloseTo(totalTax(assessment.persons[0]!.tax), 6)
  })

  it('lagerbeskatter aktieindkomsten med 27 % til grænsen og 42 % derover', () => {
    // Kilde: docs/satser/2026.md — progressionsgrænsen er 79.400 kr. pr.
    // person. En enlig med 100.000 kr. i aktieindkomst ligger 20.600 kr. over.
    //   27 % af 79.400 = 21.438,00
    //   42 % af 20.600 =  8.652,00
    //                     ─────────
    //                     30.090,00
    const assessment = assessHousehold(
      {
        persons: [
          {
            tax: { earnedIncome: 0, municipalTaxRate: 0, churchTaxRate: 0 },
            shareIncome: 100_000,
          },
        ],
      },
      rateYear2026,
    )

    // Hvert lag står med sit eget grundlag og sin egen sats, så linjen kan
    // efterregnes i hånden — invarianten er `base * rate`, jf. `LayerAmount`.
    expect(assessment.shareIncomeTax.shareIncomeBelowThreshold).toEqual({
      base: 79_400,
      rate: 0.27,
      amount: expect.closeTo(21_438, 6),
    })
    expect(assessment.shareIncomeTax.shareIncomeAboveThreshold).toEqual({
      base: expect.closeTo(20_600, 6),
      rate: 0.42,
      amount: expect.closeTo(8_652, 6),
    })
    expect(totalHouseholdTax(assessment)).toBeCloseTo(30_090, 2)
  })

  it('udelader et lag uden indhold, så en tom linje ikke skal vises frem', () => {
    const assessment = assessHousehold(
      {
        persons: [
          {
            tax: { earnedIncome: 0, municipalTaxRate: 0, churchTaxRate: 0 },
            shareIncome: 50_000,
          },
        ],
      },
      rateYear2026,
    )

    expect(assessment.shareIncomeTax.shareIncomeBelowThreshold?.base).toBeCloseTo(50_000, 6)
    expect(assessment.shareIncomeTax.shareIncomeAboveThreshold).toBeUndefined()
  })

  it('facitcase: et par deler progressionsgrænsen på tværs', () => {
    // Kilde: docs/satser/2026.md — grænsen er 79.400 kr. pr. person og fælles
    // og overførbar mellem ægtefæller, så parret tilsammen har 158.800 kr. til
    // 27 %. Verificeret 2026-08-10.
    //
    // Delte de ikke grænsen, ville Jespers ubrugte rum gå tabt:
    //   40.000 × 27 % + 79.400 × 27 % + 60.600 × 42 % = 57.690,00
    // Med den fælles grænse prøves de samlede 180.000 kr. mod de samlede
    // 158.800 kr.:
    //   27 % af 158.800 = 42.876,00
    //   42 % af  21.200 =  8.904,00
    //                      ─────────
    //                      51.780,00
    const person = { earnedIncome: 0, municipalTaxRate: 0, churchTaxRate: 0 }
    const assessment = assessHousehold(
      {
        persons: [
          { tax: person, shareIncome: 40_000 },
          { tax: person, shareIncome: 140_000 },
        ],
      },
      rateYear2026,
    )

    expect(assessment.shareIncomeTax.shareIncomeBelowThreshold?.base).toBeCloseTo(158_800, 6)
    expect(assessment.shareIncomeTax.shareIncomeAboveThreshold?.base).toBeCloseTo(21_200, 6)
    expect(totalHouseholdTax(assessment)).toBeCloseTo(51_780, 2)
  })
})

/** En pensionist og hendes indkomster, formet så en aftrapningsprøve kan
    skrives på én linje. Kommunesatsen er den samme i alle prøverne herunder:
    aftrapningen sker før skatten og rører sig ikke med den. */
function aPensioner(of: {
  civilStatus: CivilStatus
  pensionIncome?: Nominal
  capitalIncome?: Nominal
  shareIncome?: Nominal
  earnedIncome?: Nominal
}) {
  return {
    tax: {
      earnedIncome: of.earnedIncome ?? 0,
      municipalTaxRate: 0.22,
      churchTaxRate: 0,
      pensionIncome: of.pensionIncome ?? 0,
      capitalIncome: of.capitalIncome ?? 0,
    },
    shareIncome: of.shareIncome ?? 0,
    statePension: { civilStatus: of.civilStatus },
  }
}

/** Aftrapningen af pensionstillægget — den ene beregning i værktøjet, der
    ikke kan deles i to uafhængige personberegninger, og derfor den, der
    afgør, at sømmet er husstandens, jf. ADR-0014.

    Alle kronebeløb er satsårets, jf. docs/satser/2026.md: en enlig har et
    fuldt tillæg på 104.748 kr., et fradragsbeløb på 99.200 kr. og en
    aftrapning på 30,9 %, og dermed bortfald ved 438.200 kr. En gift har
    53.604 kr., 198.800 kr. og 32 % mod en ikke-pensionist eller 16 % mod en
    pensionist. */
describe('aftrapningen af pensionstillægget', () => {
  it('aftrapper pensionstillægget og beskatter det aftrappede beløb', () => {
    // Kilde: docs/satser/2026.md — en enlig har et fuldt tillæg på 104.748
    // kr., et fradragsbeløb på 99.200 kr. og en aftrapning på 30,9 %.
    //   200.000 − 99.200         = 100.800 over fradragsbeløbet
    //   30,9 % af 100.800        =  31.147,20 aftrappet
    //   104.748 − 31.147,20      =  73.600,80 tilbage af tillægget
    //
    // Aftrapningen sker før skatten: det er de 73.600,80 kr. — ikke de
    // 104.748 — der lægges til den personlige indkomst sammen med
    // grundbeløbet, jf. diagram 02.
    const assessment = assessHousehold(
      {
        persons: [
          {
            tax: {
              earnedIncome: 0,
              municipalTaxRate: 0.22,
              churchTaxRate: 0,
              pensionIncome: 200_000,
            },
            shareIncome: 0,
            statePension: { civilStatus: 'Single' },
          },
        ],
      },
      rateYear2026,
    )

    const { statePension, tax } = assessment.persons[0]!

    expect(statePension!.taper.fullSupplement).toBeCloseTo(104_748, 6)
    expect(statePension!.pensionSupplement).toBeCloseTo(73_600.8, 6)
    expect(tax.pensionIncome).toBeCloseTo(200_000 + 90_528 + 73_600.8, 6)
  })

  it('lader tillægget stå fuldt under fradragsbeløbet og forsvinde over bortfaldsgrænsen', () => {
    // De to ender af aftrapningen. Under fradragsbeløbet har indtægten intet
    // at aftrappe med; over bortfaldsgrænsen er der ikke mere tilbage at
    // tage af, og tillægget kan ikke blive negativt og begynde at trække
    // grundbeløbet med sig.
    const supplement = (pensionIncome: Nominal) =>
      assessHousehold(
        { persons: [aPensioner({ civilStatus: 'Single', pensionIncome })] },
        rateYear2026,
      ).persons[0]!.statePension!.pensionSupplement

    expect(supplement(50_000)).toBeCloseTo(104_748, 6)
    expect(supplement(99_200)).toBeCloseTo(104_748, 6)
    expect(supplement(438_200)).toBeCloseTo(0, 2)
    expect(supplement(2_000_000)).toBe(0)
  })
  it('tæller positiv kapitalindkomst og aktieindkomst med, og lader negativ kapitalindkomst være', () => {
    // Grundlaget er personlig indkomst med tillæg af positiv kapitalindkomst
    // og aktieindkomst, jf. PL § 29. Kapitalindkomsten tæller kun den ene
    // vej: en negativ nettokapitalindkomst nedsætter den skattepligtige
    // indkomst, men den lemper ikke aftrapningen.
    //   200.000 + 50.000 − 99.200 = 150.800 over fradragsbeløbet
    //   30,9 % af 150.800         =  46.597,20
    //   104.748 − 46.597,20       =  58.150,80
    const supplement = (of: { capitalIncome?: Nominal; shareIncome?: Nominal }) =>
      assessHousehold(
        {
          persons: [
            aPensioner({ civilStatus: 'Single', pensionIncome: 200_000, ...of }),
          ],
        },
        rateYear2026,
      ).persons[0]!.statePension!.pensionSupplement

    expect(supplement({ capitalIncome: 50_000 })).toBeCloseTo(58_150.8, 6)
    expect(supplement({ shareIncome: 50_000 })).toBeCloseTo(58_150.8, 6)

    // Uden kapitalindkomst er tillægget 73.600,80. En negativ på en halv
    // million flytter det ikke en krone.
    expect(supplement({ capitalIncome: -500_000 })).toBeCloseTo(73_600.8, 6)
  })
  it('lader ægtefællens øvrige indkomst tælle med 46 %, og hendes arbejdsindkomst slet ikke', () => {
    // Af en ægtefælles indtægt ses bort fra 54 %, jf. PL § 49, stk. 1, nr. 4
    // — en ren procent uden maksimumbeløb. Hendes arbejdsindkomst indgår
    // derimod slet ikke, hverken helt eller delvis.
    //
    // Jesper er gift med en ikke-pensionist: 53.604 kr. i fuldt tillæg,
    // 198.800 kr. i fradragsbeløb, 32 % aftrapning.
    //   Jesper                     150.000
    //   46 % af Annes 200.000       92.000
    //                              ───────
    //   grundlag                   242.000
    //   242.000 − 198.800 = 43.200 over fradragsbeløbet
    //   32 % af 43.200    = 13.824
    //   53.604 − 13.824   = 39.780
    const assessment = assessHousehold(
      {
        persons: [
          aPensioner({ civilStatus: 'WithNonPensioner', pensionIncome: 150_000 }),
          // Anne er ikke pensionist endnu og har derfor ingen civilstand at
          // slå op — kun en indkomst, der tæller i Jespers grundlag.
          {
            tax: {
              earnedIncome: 900_000,
              municipalTaxRate: 0.22,
              churchTaxRate: 0,
              pensionIncome: 200_000,
            },
            shareIncome: 0,
          },
        ],
      },
      rateYear2026,
    )

    const { taper, pensionSupplement } = assessment.persons[0]!.statePension!

    expect(taper.base.spouse).toBeCloseTo(92_000, 6)
    expect(totalTaperBase(taper.base)).toBeCloseTo(242_000, 6)
    expect(pensionSupplement).toBeCloseTo(39_780, 6)

    // Anne har ingen folkepension endnu, og hendes 900.000 kr. i løn rørte
    // ikke Jespers tillæg med en krone.
    expect(assessment.persons[1]!.statePension).toBeUndefined()
  })
  it('holder folkepensionen ude af sit eget grundlag, så to pensionister kan regnes i ét gennemløb', () => {
    // PL § 29, stk. 4, nr. 1: den sociale pension indgår ikke i sit eget
    // indtægtsgrundlag. Uden den regel ville Jespers tillæg afhænge af
    // Annes, og Annes af Jespers, og de to skulle findes med en
    // fikspunktsiteration. Med den afhænger hvert tillæg kun af den andens
    // *øvrige* indkomst, og ét gennemløb er nok.
    //
    // Begge er pensionister: 53.604 kr. i fuldt tillæg, 198.800 kr. i
    // fradragsbeløb, 16 % aftrapning og ingen bortseelse.
    //   grundlag begge veje  150.000 + 250.000 = 400.000
    //   400.000 − 198.800                      = 201.200
    //   16 % af 201.200                        =  32.192
    //   53.604 − 32.192                        =  21.412
    const assessment = assessHousehold(
      {
        persons: [
          aPensioner({ civilStatus: 'WithPensioner', pensionIncome: 150_000 }),
          aPensioner({ civilStatus: 'WithPensioner', pensionIncome: 250_000 }),
        ],
      },
      rateYear2026,
    )

    const [jesper, anne] = assessment.persons.map((person) => person.statePension!)

    expect(totalTaperBase(jesper!.taper.base)).toBeCloseTo(400_000, 6)
    expect(totalTaperBase(anne!.taper.base)).toBeCloseTo(400_000, 6)
    expect(jesper!.pensionSupplement).toBeCloseTo(21_412, 6)
    expect(anne!.pensionSupplement).toBeCloseTo(21_412, 6)

    // Grundlaget er de to udbetalinger og intet andet: hverken Jespers eget
    // grundbeløb og tillæg eller Annes indgår i det. Talte de med, ville
    // grundlaget være 400.000 + fire ydelser og tillægget markant lavere.
    expect(jesper!.taper.base.pensionIncome).toBeCloseTo(150_000, 6)
    expect(jesper!.taper.base.spouse).toBeCloseTo(250_000, 6)

    // Skatten regnes derimod af det hele — grundbeløbet og det aftrappede
    // tillæg oveni personens egne udbetalinger.
    expect(assessment.persons[0]!.tax.pensionIncome).toBeCloseTo(150_000 + 90_528 + 21_412, 6)
  })
  it('lægger aftrapningsleddet til marginalskatten inde i intervallet og ikke uden for det', () => {
    // Det tal, hele problemstillingen koger ned til. Inde i
    // aftrapningsintervallet koster den næste krone udbetaling både sin egen
    // skat og det tillæg, den tager væk:
    //
    //   m + rate × (1 − m)
    //
    // Uden for intervallet er der intet tillæg tilbage at miste, og kronen
    // koster kun sin skat.
    //
    // Ved 22 % kommuneskat, ingen kirkeskat og en personlig indkomst under
    // mellemskattegrænsen er m = 12,01 + 22 = 34,01 %. En enlig aftrapper
    // med 30,9 %:
    //   0,3401 + 0,309 × (1 − 0,3401) = 54,40091 %
    const marginal = (pensionIncome: Nominal) =>
      assessHousehold(
        { persons: [aPensioner({ civilStatus: 'Single', pensionIncome })] },
        rateYear2026,
      ).persons[0]!.marginal.pensionIncome

    expect(marginal(200_000)).toBeCloseTo(0.3401 + 0.309 * (1 - 0.3401), 6)

    // 500.000 kr. ligger over bortfaldsgrænsen på 438.200: tillægget er
    // allerede væk, og den næste krone kan ikke tage mere af det.
    expect(marginal(500_000)).toBeCloseTo(0.3401, 6)
  })
  it('tæller ægtefællens tabte tillæg med i marginalskatten, når begge er pensionister', () => {
    // Jf. ADR-0025. Uden bortseelse indgår Jespers krone fuldt ud i Annes
    // grundlag også, så begge tillæg falder med 16 øre. Den halvdel, der
    // lander i Annes navn, forsvinder ikke — den koster husstanden det
    // samme.
    //
    //   eget led:      0,16 × (1 − 0,3401) = 10,5584 %
    //   Annes led:     0,16 × (1 − 0,3401) = 10,5584 %
    //   marginalskat:  34,01 + 10,5584 + 10,5584 = 55,1268 %
    //
    // Målt på Jespers eget tillæg alene ville satsen sige 44,57 % om et
    // valg, der koster 55,13.
    const assessment = assessHousehold(
      {
        persons: [
          aPensioner({ civilStatus: 'WithPensioner', pensionIncome: 150_000 }),
          aPensioner({ civilStatus: 'WithPensioner', pensionIncome: 250_000 }),
        ],
      },
      rateYear2026,
    )

    const own = 0.16 * (1 - 0.3401)

    expect(assessment.persons[0]!.marginal.pensionIncome).toBeCloseTo(0.3401 + own + own, 6)
    expect(assessment.persons[0]!.marginal.pensionIncome).toBeGreaterThan(0.3401 + own)

    // Arbejdsindkomsten står uden for aftrapningsgrundlaget, også
    // ægtefællens: en løn på en million hos Jesper flytter hverken hans eget
    // eller Annes tillæg en krone.
    const withSalary = assessHousehold(
      {
        persons: [
          aPensioner({
            civilStatus: 'WithPensioner',
            pensionIncome: 150_000,
            earnedIncome: 1_000_000,
          }),
          aPensioner({ civilStatus: 'WithPensioner', pensionIncome: 250_000 }),
        ],
      },
      rateYear2026,
    )

    for (const index of [0, 1]) {
      expect(withSalary.persons[index]!.statePension!.pensionSupplement).toBeCloseTo(
        assessment.persons[index]!.statePension!.pensionSupplement,
        6,
      )
    }
  })
})
