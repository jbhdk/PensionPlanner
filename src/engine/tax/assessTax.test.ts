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

  it('stempler hvilket satsgrundlag opgørelsen er regnet på', () => {
    // Planen pinner ikke satserne, jf. ADR-0005 — derfor er stemplet det
    // eneste sted, det står, hvad tallene faktisk er regnet efter.
    expect(assess({ earnedIncome: 500_000 }).rateYear).toBe(2026)
  })
})
