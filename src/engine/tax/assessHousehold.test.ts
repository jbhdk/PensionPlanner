import { describe, expect, it } from 'vitest'
import { rateYear2026 } from '../rates/rateYear2026'
import { assessHousehold, totalHouseholdTax } from './assessHousehold'
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
