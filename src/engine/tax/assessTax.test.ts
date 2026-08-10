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

  it('beregner kommuneskat efter planens sats af den skattepligtige indkomst', () => {
    // Kommuneskatteprocenten er husstandens egen og står på planen — den er
    // ikke satsdata, fordi den afhænger af, hvor man bor.
    // Personlig indkomst      220.000 − 8 %          = 202.400
    // Beskæftigelsesfradrag   12,75 % af 220.000     =  28.050
    // Skattepligtig indkomst  202.400 − 28.050       = 174.350
    // Efter personfradrag     174.350 − 54.100       = 120.250
    const assessment = assess({ earnedIncome: 220_000, municipalTaxRate: 0.254 })

    expect(assessment.layers.municipalTax).toBeCloseTo(30_543.5, 2)
  })

  it('beregner kirkeskat på samme grundlag som kommuneskatten', () => {
    const assessment = assess({ earnedIncome: 220_000, churchTaxRate: 0.0074 })

    expect(assessment.layers.churchTax).toBeCloseTo(889.85, 2)
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

  it('nedsætter kun den skattepligtige indkomst med beskæftigelsesfradraget', () => {
    // Fradraget er 12,75 % af grundlaget for arbejdsmarkedsbidrag — altså
    // arbejdsindkomsten *før* AM-bidrag, jf. LL § 9 J. Det er en anden form
    // end den, progressionsgrænserne læses i, og de to må ikke bytte plads.
    // Beskæftigelsesfradrag  12,75 % af 200.000 =  25.500
    // Personlig indkomst     200.000 − 8 %      = 184.000
    // Skattepligtig indkomst 184.000 − 25.500   = 158.500
    const assessment = assess({ earnedIncome: 200_000, municipalTaxRate: 0.254 })

    expect(assessment.allowances.employmentAllowance).toBeCloseTo(25_500, 2)
    expect(assessment.taxableIncome).toBeCloseTo(158_500, 2)

    // Kommuneskatten falder med fradraget: (158.500 − 54.100) × 25,40 %.
    expect(assessment.layers.municipalTax).toBeCloseTo(26_517.6, 2)

    // Bundskatten står urørt. Et ligningsmæssigt fradrag rører kun den
    // skattepligtige indkomst, aldrig den personlige.
    expect(assessment.layers.bottomBracketTax).toBeCloseTo(15_600.99, 2)
  })

  it('stopper beskæftigelsesfradraget ved sit maksimum', () => {
    // Skat.dk siger, at det fulde fradrag nås ved 496.471 kr. Det er samtidig
    // satsårets selvkontrol: 63.300 ÷ 12,75 % = 496.470,59, og de to tal er
    // hentet hver for sig. Lige under grænsen er fradraget procenten af
    // lønnen; lige over står det stille.
    expect(assess({ earnedIncome: 496_000 }).allowances.employmentAllowance).toBeCloseTo(
      63_240,
      2,
    )
    expect(assess({ earnedIncome: 496_471 }).allowances.employmentAllowance).toBeCloseTo(
      63_300,
      2,
    )
    expect(assess({ earnedIncome: 900_000 }).allowances.employmentAllowance).toBeCloseTo(
      63_300,
      2,
    )
  })

  it('giver jobfradrag af arbejdsindkomsten over bundgrænsen', () => {
    // Jobfradraget måles på samme grundlag som beskæftigelsesfradraget, jf.
    // LL § 9 K, men kun af det, der ligger over bundgrænsen på 235.200.
    // 4,50 % af (250.000 − 235.200) = 666
    expect(assess({ earnedIncome: 235_200 }).allowances.jobAllowance).toBe(0)
    expect(assess({ earnedIncome: 250_000 }).allowances.jobAllowance).toBeCloseTo(
      666,
      2,
    )
  })

  it('stopper jobfradraget ved sit maksimum', () => {
    // Maksimum nås ved 235.200 + 3.100 ÷ 4,50 % = 304.088,89. Lige under er
    // fradraget stadig procenten af det, der ligger over bundgrænsen.
    const job = (earnedIncome: number) =>
      assess({ earnedIncome }).allowances.jobAllowance

    expect(job(304_000)).toBeCloseTo(3_096, 2)
    expect(job(900_000)).toBeCloseTo(3_100, 2)
  })

  it('lader de ligningsmæssige fradrag stå uden for den personlige indkomst', () => {
    // Grænsen mellem de to indkomster er hele pointen med et ligningsmæssigt
    // fradrag: det nedsætter kommune- og kirkeskattens grundlag og intet
    // andet. Flyttede fradragene ind i den personlige indkomst, ville både
    // bundskatten og progressionslagene falde med dem.
    const assessment = assess({ earnedIncome: 900_000 })

    expect(assessment.personalIncome).toBeCloseTo(828_000, 2)
    expect(assessment.taxableIncome).toBeCloseTo(761_600, 2)

    // 7,50 % af (828.000 − 641.200) — målt på den personlige indkomst.
    expect(assessment.layers.middleBracketTax).toBeCloseTo(14_010, 2)
  })

  it('giver ekstra pensionsfradrag af indbetalingen med den lave sats', () => {
    // LL § 9 L: 12 % indtil det 15. indkomstår før det år, personen når
    // folkepensionsalderen. 12 % af 50.000 = 6.000.
    const assessment = assess({
      earnedIncome: 500_000,
      contribution: { amount: 50_000, yearsToStatePensionAge: 20 },
    })

    expect(assessment.allowances.extraPensionAllowance).toBeCloseTo(6_000, 2)
  })

  it('skifter til den høje sats fra og med det 15. år før folkepensionsalderen', () => {
    // "Fra og med det 15. indkomstår før det indkomstår, hvor personen når
    // folkepensionsalderen" — grænsen er inklusiv, så året med 15 år tilbage
    // er det første med 32 %. 32 % af 50.000 = 16.000.
    const pension = (yearsToStatePensionAge: number) =>
      assess({
        earnedIncome: 500_000,
        contribution: { amount: 50_000, yearsToStatePensionAge },
      }).allowances.extraPensionAllowance

    expect(pension(16)).toBeCloseTo(6_000, 2)
    expect(pension(15)).toBeCloseTo(16_000, 2)
  })

  it('lofter grundlaget for det ekstra pensionsfradrag, ikke fradraget selv', () => {
    // § 20-tabellens linje hedder ordret "Maksimalt grundlag for ekstra
    // pensionsfradrag (§ 9 L, stk. 1)": de 87.800 er loftet over den
    // indbetaling, procenten regnes af — ikke over fradraget. Derfor bliver
    // det største fradrag 12 % × 87.800 = 10.536 og 32 % × 87.800 = 28.096,
    // og det er præcis de to tal, sekundære kilder angiver som maksimum.
    const pension = (yearsToStatePensionAge: number) =>
      assess({
        earnedIncome: 900_000,
        contribution: { amount: 120_000, yearsToStatePensionAge },
      }).allowances.extraPensionAllowance

    expect(pension(20)).toBeCloseTo(10_536, 2)
    expect(pension(10)).toBeCloseTo(28_096, 2)
  })

  it('giver intet ekstra pensionsfradrag i et år uden indbetaling', () => {
    // Fradraget følger indbetalingen og ikke personen: et år uden
    // indbetaling har intet fradrag, uanset hvor tæt folkepensionsalderen er.
    expect(assess({ earnedIncome: 500_000 }).allowances.extraPensionAllowance).toBe(0)
  })

  it('lægger positiv kapitalindkomst til bundskattens grundlag', () => {
    // Ingen arbejdsindkomst isolerer laget: bundskat af personlig indkomst er
    // nul, så hele beløbet kommer fra kapitalindkomsten. 50.000 kr. ligger
    // under bundfradraget i topskat, så kun bundskattens sats rammer den.
    // 50.000 × 12,01 % = 6.005.
    expect(assess({ capitalIncome: 50_000 }).layers.bottomBracketTax).toBeCloseTo(6_005, 2)
  })

  it('lægger topskat på den del af kapitalindkomsten, der overstiger dens egen bundfradragsgrænse', () => {
    // 80.000 kr. kapitalindkomst: bundfradraget i topskat er 55.000, så
    // 25.000 kr. bærer topskattens 7,5 % oven i bundskattens 12,01 %.
    // Bundskat  80.000 × 12,01 %       =  9.608,00
    // Topskat   25.000 ×  7,50 %       =  1.875,00
    const assessment = assess({ capitalIncome: 80_000 })

    expect(assessment.layers.bottomBracketTax).toBeCloseTo(9_608, 2)
    expect(assessment.layers.topBracketTax).toBeCloseTo(1_875, 2)
  })

  it('lofter kapitalindkomstens kombinerede sats til 42 %, uafhængigt af det skrå skatteloft', () => {
    // Bund + kommune alene: 12,01 + 28 = 40,01 %, under loftet — bundskatten
    // står urørt. Læg topskatten oven i: 40,01 + 7,50 = 47,51 %, 5,51
    // procentpoint over loftet, så topskattens andel sættes ned til 1,99 %.
    // Loftet rammer altså kun laget over grænsen, ikke laget under.
    // Bundskat  200.000 × 12,01 %  = 24.020,00
    // Topskat   145.000 ×  1,99 %  =  2.885,50
    const assessment = assess({ capitalIncome: 200_000, municipalTaxRate: 0.28 })

    expect(assessment.layers.bottomBracketTax).toBeCloseTo(24_020, 2)
    expect(assessment.layers.topBracketTax).toBeCloseTo(2_885.5, 2)
  })

  it('nedsætter skattepligtig indkomst med negativ kapitalindkomst uden at udløse bund- eller topskat', () => {
    const assessment = assess({ earnedIncome: 500_000, capitalIncome: -30_000 })

    expect(assessment.taxableIncome).toBeCloseTo(460_000 - 66_400 - 30_000, 2)
    expect(assessment.layers.bottomBracketTax).toBeCloseTo(
      assess({ earnedIncome: 500_000 }).layers.bottomBracketTax,
      2,
    )
  })

  it('lægger kapitalindkomsten til skattepligtig indkomst, så kommune- og kirkeskatten stiger', () => {
    // Arbejdsindkomst nok til at løfte skattepligtig indkomst over
    // personfradraget i begge tilfælde, så tilføjelsen slår igennem krone for
    // krone og ikke delvis sluges af fradraget.
    const withCapitalIncome = assess({
      earnedIncome: 500_000,
      capitalIncome: 50_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    })
    const without = assess({
      earnedIncome: 500_000,
      municipalTaxRate: 0.254,
      churchTaxRate: 0.0074,
    })

    expect(withCapitalIncome.taxableIncome).toBeCloseTo(without.taxableIncome + 50_000, 2)
    expect(withCapitalIncome.layers.municipalTax).toBeCloseTo(
      without.layers.municipalTax + 50_000 * 0.254,
      2,
    )
  })
})
