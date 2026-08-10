import { describe, expect, it } from 'vitest'
import { rateYear2026 } from '../rates/rateYear2026'
import { assessTax } from './assessTax'
import type { TaxAssessmentInput } from './assessTax'

/** Den sekundære testsøm: skatten for ét simuleringsår og én person, kaldbar
    uden at bygge en plan. Alt herunder er i løbende priser, jf. ADR-0001. */

/** Opgør skatten med kun det sat, som testen handler om. Nul i kommune- og
    kirkeskat er ikke en realistisk plan, men det holder hvert lag isoleret,
    indtil det er lagets egen tur. */
function assess(input: Partial<TaxAssessmentInput>) {
  return assessTax(
    { earnedIncome: 0, municipalTaxRate: 0, churchTaxRate: 0, ...input },
    rateYear2026,
  )
}

describe('skatteopgørelsen', () => {
  it('beregner AM-bidrag af arbejdsindkomsten', () => {
    expect(assess({ earnedIncome: 500_000 }).layers.labourMarketContribution).toBeCloseTo(
      40_000,
      6,
    )
  })

  it('opgør den personlige indkomst som arbejdsindkomsten efter AM-bidrag', () => {
    // Alle progressionsgrænser måles på indkomsten efter AM-bidrag — det er
    // den kolonne, § 20 regulerer. Bytter man de to om, flytter topskattens
    // start sig med 67.600 kr.
    expect(assess({ earnedIncome: 500_000 }).personalIncome).toBeCloseTo(460_000, 6)
  })

  it('beregner bundskat af den personlige indkomst efter personfradrag', () => {
    // 500.000 − 8 % = 460.000 i personlig indkomst. Fratrukket personfradraget
    // på 54.100 giver 405.900, og deraf 12,01 %.
    expect(assess({ earnedIncome: 500_000 }).layers.bottomBracketTax).toBeCloseTo(
      48_748.59,
      2,
    )
  })

  it('beregner kommuneskat efter planens sats af indkomsten efter personfradrag', () => {
    // Kommuneskatteprocenten er husstandens egen og står på planen — den er
    // ikke satsdata, fordi den afhænger af, hvor man bor.
    const assessment = assess({ earnedIncome: 500_000, municipalTaxRate: 0.254 })

    expect(assessment.layers.municipalTax).toBeCloseTo(103_098.6, 2)
  })

  it('beregner kirkeskat på samme grundlag som kommuneskatten', () => {
    const assessment = assess({ earnedIncome: 500_000, churchTaxRate: 0.0074 })

    expect(assessment.layers.churchTax).toBeCloseTo(3_003.66, 2)
  })

  it('lader ikke personfradraget give negativ skat i et lag', () => {
    // 40.000 kr. i løn giver 36.800 i personlig indkomst — under
    // personfradraget på 54.100. Et lag med et ubrugt fradrag bidrager med
    // nul, ikke med en negativ skat, der ville betale for de andre lag.
    const assessment = assess({
      earnedIncome: 40_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    })

    expect(assessment.layers.bottomBracketTax).toBe(0)
    expect(assessment.layers.municipalTax).toBe(0)
    expect(assessment.layers.churchTax).toBe(0)

    // AM-bidraget har intet personfradrag — det betales fra første krone.
    expect(assessment.layers.labourMarketContribution).toBeCloseTo(3_200, 6)
  })

  it('beregner mellemskat af den personlige indkomst over mellemskattegrænsen', () => {
    // 800.000 − 8 % = 736.000 i personlig indkomst, hvoraf 94.800 ligger over
    // mellemskattegrænsen på 641.200. Progressionslagene har intet
    // personfradrag — det hører til bundskatten og kommuneskatten.
    expect(assess({ earnedIncome: 800_000 }).layers.middleBracketTax).toBeCloseTo(
      7_110,
      2,
    )
  })

  it('lægger topskat oven i mellemskatten over topskattegrænsen', () => {
    // 900.000 − 8 % = 828.000. Mellemskat af 828.000 − 641.200 = 186.800, og
    // topskat af 828.000 − 777.900 = 50.100. De to lag overlapper med vilje:
    // kronen over topskattegrænsen bærer begge satser.
    const assessment = assess({ earnedIncome: 900_000 })

    expect(assessment.layers.middleBracketTax).toBeCloseTo(14_010, 2)
    expect(assessment.layers.topBracketTax).toBeCloseTo(3_757.5, 2)
  })

  it('lægger top-topskat oven i de to andre over top-topskattegrænsen', () => {
    // 3.000.000 − 8 % = 2.760.000. De tre lag ligger oven på hinanden:
    // mellemskat af 2.118.800, topskat af 1.982.100 og top-topskat af
    // 167.300 — hver med sin egen sats, aldrig som én.
    const assessment = assess({ earnedIncome: 3_000_000 })

    expect(assessment.layers.middleBracketTax).toBeCloseTo(158_910, 2)
    expect(assessment.layers.topBracketTax).toBeCloseTo(148_657.5, 2)
    expect(assessment.layers.additionalTopBracketTax).toBeCloseTo(8_365, 2)
  })

  it('nedsætter progressionslagets sats, når det skrå skatteloft binder', () => {
    // Bundskat 12,01 + mellemskat 7,50 + kommuneskat 25,40 = 44,91 % — 0,34
    // procentpoint over loftets første trin på 44,57 %. Andet trin ligger
    // 0,34 over på samme måde, så begge lag regnes med 7,16 % i stedet for
    // 7,50 %. 828.000 i personlig indkomst: 186.800 × 7,16 % i mellemskat og
    // 50.100 × 7,16 % i topskat.
    const assessment = assess({ earnedIncome: 900_000, municipalTaxRate: 0.254 })

    expect(assessment.layers.middleBracketTax).toBeCloseTo(13_374.88, 2)
    expect(assessment.layers.topBracketTax).toBeCloseTo(3_587.16, 2)
  })

  it('regner loftet uden AM-bidrag og kirkeskat', () => {
    // Kirkeskatten indgår ikke i den sats, trinene måles på. Havde den gjort,
    // ville de 0,74 % have skubbet overskridelsen fra 0,34 til 1,08
    // procentpoint. AM-bidraget står udenfor på samme måde — var de 8 % med,
    // lå selv første trin 8 procentpoint over loftet ved enhver kommunesats.
    const withoutChurchTax = assess({
      earnedIncome: 900_000,
      municipalTaxRate: 0.254,
    })
    const withChurchTax = assess({
      earnedIncome: 900_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    })

    expect(withChurchTax.layers.middleBracketTax).toBeCloseTo(
      withoutChurchTax.layers.middleBracketTax,
      6,
    )
    expect(withChurchTax.layers.topBracketTax).toBeCloseTo(
      withoutChurchTax.layers.topBracketTax,
      6,
    )
  })

  it('lader loftet nedsætte en sats, men aldrig løfte den', () => {
    // 12,01 + 7,50 + 22,00 = 41,51 % er under loftets første trin. En
    // kommune under referencesatsen får de fulde 7,50 % — ikke mere.
    const assessment = assess({ earnedIncome: 900_000, municipalTaxRate: 0.22 })

    expect(assessment.layers.middleBracketTax).toBeCloseTo(14_010, 2)
    expect(assessment.layers.topBracketTax).toBeCloseTo(3_757.5, 2)
  })

  it('måler mellemskattegrænsen på indkomsten efter AM-bidrag', () => {
    // 690.000 brutto ligger over de 641.200 — men brutto er ikke den form,
    // § 20 regulerer. Efter AM-bidrag er den personlige indkomst 634.800, og
    // der er derfor ingen mellemskat overhovedet. Læses grænsen på
    // bruttolønnen i stedet, opstår her en skat på 3.660 kr., der ikke findes.
    expect(assess({ earnedIncome: 690_000 }).layers.middleBracketTax).toBe(0)
  })

  it('stempler hvilket satsgrundlag opgørelsen er regnet på', () => {
    // Planen pinner ikke satserne, jf. ADR-0005 — derfor er stemplet det
    // eneste sted, det står, hvad tallene faktisk er regnet efter.
    expect(assess({ earnedIncome: 500_000 }).rateYear).toBe(2026)
  })
})
