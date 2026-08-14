import { describe, expect, it } from 'vitest'
import { rateYear2026 } from '../rates/rateYear2026'
import { assessHousehold } from './assessHousehold'
import type { TaxAssessmentInput } from './assessTax'

/** Den sekundære testsøm er husstandens skat for ét simuleringsår, jf.
    ADR-0014. Denne fil prøver de regler, der er den enkelte persons — lagene,
    fradragene og marginalskatten — og når dem gennem husstandssømmet frem
    for udenom. Alt herunder er i løbende priser, jf. ADR-0001. */

/** En husstand på én person med kun det sat, som testen handler om. Nul i
    kommune- og kirkeskat er ikke en realistisk plan, men det holder hvert lag
    isoleret, indtil det er lagets egen tur. */
function household(input: Partial<TaxAssessmentInput>) {
  return assessHousehold(
    {
      persons: [
        {
          tax: { earnedIncome: 0, municipalTaxRate: 0, churchTaxRate: 0, ...input },
          shareIncome: 0,
        },
      ],
    },
    rateYear2026,
  ).persons[0]!
}

/** Personens egen skatteopgørelse. */
function assess(input: Partial<TaxAssessmentInput>) {
  return household(input).tax
}

/** Personens egen marginalskat. */
function marginal(input: Partial<TaxAssessmentInput>) {
  return household(input).marginalTaxRate
}

describe('skatteopgørelsen', () => {
  it('beregner AM-bidrag af arbejdsindkomsten', () => {
    expect(
      assess({ earnedIncome: 500_000 }).layers.labourMarketContribution.amount,
    ).toBeCloseTo(40_000, 6)
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
    expect(assess({ earnedIncome: 500_000 }).layers.bottomBracketTax.amount).toBeCloseTo(
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

    expect(assessment.layers.municipalTax.amount).toBeCloseTo(30_543.5, 2)
  })

  it('beregner kirkeskat på samme grundlag som kommuneskatten', () => {
    const assessment = assess({ earnedIncome: 220_000, churchTaxRate: 0.0074 })

    expect(assessment.layers.churchTax.amount).toBeCloseTo(889.85, 2)
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

    expect(assessment.layers.bottomBracketTax.amount).toBe(0)
    expect(assessment.layers.municipalTax.amount).toBe(0)
    expect(assessment.layers.churchTax.amount).toBe(0)

    // AM-bidraget har intet personfradrag — det betales fra første krone.
    expect(assessment.layers.labourMarketContribution.amount).toBeCloseTo(3_200, 6)
  })

  it('beregner mellemskat af den personlige indkomst over mellemskattegrænsen', () => {
    // 800.000 − 8 % = 736.000 i personlig indkomst, hvoraf 94.800 ligger over
    // mellemskattegrænsen på 641.200. Progressionslagene har intet
    // personfradrag — det hører til bundskatten og kommuneskatten.
    expect(assess({ earnedIncome: 800_000 }).layers.middleBracketTax.amount).toBeCloseTo(
      7_110,
      2,
    )
  })

  it('lægger topskat oven i mellemskatten over topskattegrænsen', () => {
    // 900.000 − 8 % = 828.000. Mellemskat af 828.000 − 641.200 = 186.800, og
    // topskat af 828.000 − 777.900 = 50.100. De to lag overlapper med vilje:
    // kronen over topskattegrænsen bærer begge satser.
    const assessment = assess({ earnedIncome: 900_000 })

    expect(assessment.layers.middleBracketTax.amount).toBeCloseTo(14_010, 2)
    expect(assessment.layers.topBracketTax.amount).toBeCloseTo(3_757.5, 2)
  })

  it('lægger top-topskat oven i de to andre over top-topskattegrænsen', () => {
    // 3.000.000 − 8 % = 2.760.000. De tre lag ligger oven på hinanden:
    // mellemskat af 2.118.800, topskat af 1.982.100 og top-topskat af
    // 167.300 — hver med sin egen sats, aldrig som én.
    const assessment = assess({ earnedIncome: 3_000_000 })

    expect(assessment.layers.middleBracketTax.amount).toBeCloseTo(158_910, 2)
    expect(assessment.layers.topBracketTax.amount).toBeCloseTo(148_657.5, 2)
    expect(assessment.layers.additionalTopBracketTax.amount).toBeCloseTo(8_365, 2)
  })

  it('lægger loftnedslaget i sit eget lag og lader progressionslagene stå med lovsatserne', () => {
    // Bundskat 12,01 + mellemskat 7,50 + kommuneskat 25,40 = 44,91 % — 0,34
    // procentpoint over loftets første trin på 44,57 %. Nedslaget er de 0,34
    // procentpoint af mellemskattens grundlag, og det er staten, der giver
    // afkald: 828.000 i personlig indkomst giver 186.800 i mellemskattens
    // grundlag og 50.100 i topskattens.
    const { layers } = assess({ earnedIncome: 900_000, municipalTaxRate: 0.254 })

    expect(layers.middleBracketTax.rate).toBeCloseTo(0.075, 6)
    expect(layers.middleBracketTax.amount).toBeCloseTo(14_010, 2)
    expect(layers.topBracketTax.rate).toBeCloseTo(0.075, 6)
    expect(layers.topBracketTax.amount).toBeCloseTo(3_757.5, 2)

    expect(layers.taxCeilingRelief.base).toBeCloseTo(186_800, 2)
    expect(layers.taxCeilingRelief.rate).toBeCloseTo(-0.0034, 6)
    expect(layers.taxCeilingRelief.amount).toBeCloseTo(-635.12, 2)
  })

  it('lader lovsatserne stå i enhver kommune og bærer forskellen i loftnedslaget', () => {
    // Mellemskat, topskat og top-topskat er faste satser: de står i loven med
    // 7,50 %, 7,50 % og 5,00 %, og trappen rører dem ikke, hvor højt
    // kommunesatsen end ligger. Nedslaget bærer hele forskellen, og det
    // bærer den én gang — grundlaget er mellemskattens, som er det lag,
    // trappen rammer først.
    for (const municipalTaxRate of [0.256, 0.253, 0.263]) {
      const { layers } = assess({ earnedIncome: 3_000_000, municipalTaxRate })

      expect(layers.middleBracketTax.rate).toBeCloseTo(0.075, 6)
      expect(layers.topBracketTax.rate).toBeCloseTo(0.075, 6)
      expect(layers.additionalTopBracketTax.rate).toBeCloseTo(0.05, 6)

      expect(layers.taxCeilingRelief.base).toBeCloseTo(layers.middleBracketTax.base, 2)
      expect(layers.taxCeilingRelief.rate).toBeCloseTo(
        0.4457 - 0.1201 - 0.075 - municipalTaxRate,
        6,
      )
    }
  })

  it('holder grundlag × sats = beløb i loftnedslagets egen linje', () => {
    // Nedslaget er et lag som de andre og skal kunne efterregnes af sin egen
    // linje alene, jf. `LayerAmount`.
    const { base, rate, amount } = assess({
      earnedIncome: 900_000,
      municipalTaxRate: 0.254,
    }).layers.taxCeilingRelief

    expect(amount).toBeCloseTo(base * rate, 6)
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

    expect(withChurchTax.layers.taxCeilingRelief.rate).toBeCloseTo(
      withoutChurchTax.layers.taxCeilingRelief.rate,
      6,
    )
    expect(withChurchTax.layers.taxCeilingRelief.amount).toBeCloseTo(
      withoutChurchTax.layers.taxCeilingRelief.amount,
      6,
    )
  })

  it('lader loftnedslaget stå tomt, når loftet ikke binder, og aldrig blive et tillæg', () => {
    // 12,01 + 7,50 + 22,00 = 41,51 % er under loftets første trin. Laget
    // udebliver ikke — det er der altid, ligesom de tre progressionslag — det
    // er bare nul. En kommune under referencesatsen får de fulde 7,50 %,
    // ikke mere: loftet kan sætte en sats ned, aldrig løfte den.
    const { layers } = assess({ earnedIncome: 900_000, municipalTaxRate: 0.22 })

    expect(layers.middleBracketTax.amount).toBeCloseTo(14_010, 2)
    expect(layers.topBracketTax.amount).toBeCloseTo(3_757.5, 2)
    expect(layers.taxCeilingRelief.rate).toBe(0)
    expect(layers.taxCeilingRelief.amount).toBe(0)
  })

  it('måler mellemskattegrænsen på indkomsten efter AM-bidrag', () => {
    // 690.000 brutto ligger over de 641.200 — men brutto er ikke den form,
    // § 20 regulerer. Efter AM-bidrag er den personlige indkomst 634.800, og
    // der er derfor ingen mellemskat overhovedet. Læses grænsen på
    // bruttolønnen i stedet, opstår her en skat på 3.660 kr., der ikke findes.
    expect(assess({ earnedIncome: 690_000 }).layers.middleBracketTax.amount).toBe(0)
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
    expect(assessment.layers.municipalTax.amount).toBeCloseTo(26_517.6, 2)

    // Bundskatten står urørt. Et ligningsmæssigt fradrag rører kun den
    // skattepligtige indkomst, aldrig den personlige.
    expect(assessment.layers.bottomBracketTax.amount).toBeCloseTo(15_600.99, 2)
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
    expect(assessment.layers.middleBracketTax.amount).toBeCloseTo(14_010, 2)
  })

  it('holder indbetalingen med fradragsret uden for den personlige indkomst, men ikke uden for AM-bidraget', () => {
    // Lønmodtageren fra ADR-0007: 700.000 kr. brutto, hvoraf 105.000 kr.
    // forlader lønnen som arbejdsgiverbidrag, så der lander 105.000 × 0,92 =
    // 96.600 kr. på ordningen. Loven måler AM-bidraget af hele bruttolønnen
    // og fradragsretten af det, der landede — de to former må ikke bytte
    // plads, jf. docs/satser/2026.md.
    //   AM-bidrag           8,00 % af 700.000 = 56.000
    //   Personlig indkomst  644.000 − 96.600  = 547.400
    const assessment = assess({
      earnedIncome: 700_000,
      contribution: { withDeductibility: 96_600, yearsToStatePensionAge: 12 },
    })

    expect(assessment.layers.labourMarketContribution.base).toBeCloseTo(700_000, 2)
    expect(assessment.layers.labourMarketContribution.amount).toBeCloseTo(56_000, 2)
    expect(assessment.personalIncome).toBeCloseTo(547_400, 2)
  })

  it('lader fradragsretten slå igennem i hvert lag oven på den personlige indkomst', () => {
    // Samme løn to gange, kun indbetalingen skiftet til og fra. Hvert lag,
    // der måler på den personlige indkomst, får sit grundlag sænket med
    // præcis indbetalingen — det er dét, der skiller fradragsretten fra et
    // ligningsmæssigt fradrag, som kun ville ramme kommune- og kirkeskatten.
    // Lønnen er valgt så høj, at alle tre progressionslag er i brug.
    const without = assess({ earnedIncome: 3_000_000 })
    const withContribution = assess({
      earnedIncome: 3_000_000,
      contribution: { withDeductibility: 100_000, yearsToStatePensionAge: 20 },
    })

    const above = [
      'bottomBracketTax',
      'middleBracketTax',
      'topBracketTax',
      'additionalTopBracketTax',
    ] as const
    for (const layer of above) {
      expect(
        without.layers[layer].base - withContribution.layers[layer].base,
        layer,
      ).toBeCloseTo(100_000, 2)
    }

    // AM-bidraget måler på bruttolønnen og rører sig ikke.
    expect(withContribution.layers.labourMarketContribution.base).toBeCloseTo(
      without.layers.labourMarketContribution.base,
      2,
    )
  })

  it('lader beskæftigelses- og jobfradragets grundlag være upåvirket af indbetalingen', () => {
    // De to måler på grundlaget for arbejdsmarkedsbidrag — arbejdsindkomsten
    // **før** AM-bidrag, jf. LL § 9 J og § 9 K — og indbetalingen rører den
    // form slet ikke. Lønnen er 300.000 kr., under begge lofter — 12,75 % af
    // 300.000 = 38.250 og 4,50 % af (300.000 − 235.200) = 2.916 — så et fald
    // ville kunne ses; i loft ville de stå stille uanset. Trak vi
    // indbetalingen fra to gange, var det her, det ville vise sig.
    const without = assess({ earnedIncome: 300_000 })
    const withContribution = assess({
      earnedIncome: 300_000,
      contribution: { withDeductibility: 50_000, yearsToStatePensionAge: 20 },
    })

    expect(withContribution.allowances.employmentAllowance).toBeCloseTo(
      without.allowances.employmentAllowance,
      2,
    )
    expect(withContribution.allowances.jobAllowance).toBeCloseTo(
      without.allowances.jobAllowance,
      2,
    )
    // Og de er ikke bare ens fordi de begge står i loft.
    expect(withContribution.allowances.employmentAllowance).toBeLessThan(63_300)
    expect(withContribution.allowances.jobAllowance).toBeLessThan(3_100)
  })

  it('giver ekstra pensionsfradrag af indbetalingen med den lave sats', () => {
    // LL § 9 L: 12 % indtil det 15. indkomstår før det år, personen når
    // folkepensionsalderen. 12 % af 50.000 = 6.000.
    const assessment = assess({
      earnedIncome: 500_000,
      contribution: { withDeductibility: 50_000, yearsToStatePensionAge: 20 },
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
        contribution: { withDeductibility: 50_000, yearsToStatePensionAge },
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
        contribution: { withDeductibility: 120_000, yearsToStatePensionAge },
      }).allowances.extraPensionAllowance

    expect(pension(20)).toBeCloseTo(10_536, 2)
    expect(pension(10)).toBeCloseTo(28_096, 2)
  })

  it('giver intet ekstra pensionsfradrag i et år uden indbetaling', () => {
    // Fradraget følger indbetalingen og ikke personen: et år uden
    // indbetaling har intet fradrag, uanset hvor tæt folkepensionsalderen er.
    expect(assess({ earnedIncome: 500_000 }).allowances.extraPensionAllowance).toBe(0)
  })

  it('lægger positiv kapitalindkomst til bundskattens grundlag, som sit eget lag', () => {
    // Ingen arbejdsindkomst isolerer laget: bundskat af personlig indkomst er
    // nul, så hele beløbet kommer fra kapitalindkomsten, som eget lag ved
    // siden af `layers` — ikke smeltet sammen med den personlige indkomsts
    // bundskat, jf. `capitalIncomeContribution`. 50.000 kr. ligger under
    // bundfradraget i topskat, så kun bundskattens sats rammer den.
    // 50.000 × 12,01 % = 6.005.
    const assessment = assess({ capitalIncome: 50_000 })

    expect(assessment.layers.bottomBracketTax.amount).toBe(0)
    expect(assessment.capitalIncomeContribution?.bottomBracketTax?.amount).toBeCloseTo(6_005, 2)
  })

  it('lægger topskat på den del af kapitalindkomsten, der overstiger dens egen bundfradragsgrænse', () => {
    // 80.000 kr. kapitalindkomst: bundfradraget i topskat er 55.000, så
    // 25.000 kr. bærer topskattens 7,5 % oven i bundskattens 12,01 %.
    // Bundskat  80.000 × 12,01 %       =  9.608,00
    // Topskat   25.000 ×  7,50 %       =  1.875,00
    const assessment = assess({ capitalIncome: 80_000 })

    expect(assessment.capitalIncomeContribution?.bottomBracketTax?.amount).toBeCloseTo(9_608, 2)
    expect(assessment.capitalIncomeContribution?.topBracketTax?.amount).toBeCloseTo(1_875, 2)
  })

  it('lofter kapitalindkomstens kombinerede sats til 42 %, uafhængigt af det skrå skatteloft', () => {
    // Bund + kommune alene: 12,01 + 28 = 40,01 %, under loftet — bundskatten
    // står urørt. Læg topskatten oven i: 40,01 + 7,50 = 47,51 %, 5,51
    // procentpoint over loftet, så topskattens andel sættes ned til 1,99 %.
    // Loftet rammer altså kun laget over grænsen, ikke laget under.
    // Bundskat  200.000 × 12,01 %  = 24.020,00
    // Topskat   145.000 ×  1,99 %  =  2.885,50
    const assessment = assess({ capitalIncome: 200_000, municipalTaxRate: 0.28 })

    expect(assessment.capitalIncomeContribution?.bottomBracketTax?.amount).toBeCloseTo(24_020, 2)
    expect(assessment.capitalIncomeContribution?.topBracketTax?.amount).toBeCloseTo(2_885.5, 2)
  })

  it('nedsætter skattepligtig indkomst med negativ kapitalindkomst uden at udløse bund- eller topskat', () => {
    const assessment = assess({ earnedIncome: 500_000, capitalIncome: -30_000 })

    expect(assessment.taxableIncome).toBeCloseTo(460_000 - 66_400 - 30_000, 2)
    expect(assessment.capitalIncomeContribution).toBeUndefined()
    expect(assessment.layers.bottomBracketTax.amount).toBeCloseTo(
      assess({ earnedIncome: 500_000 }).layers.bottomBracketTax.amount,
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
    expect(withCapitalIncome.layers.municipalTax.amount).toBeCloseTo(
      without.layers.municipalTax.amount + 50_000 * 0.254,
      2,
    )
  })
})

describe('lagenes grundlag og sats', () => {
  it('lader hvert lag efterregnes som grundlag gange sats', () => {
    // 500.000 − 8 % = 460.000 i personlig indkomst, fratrukket personfradraget
    // på 54.100 giver 405.900 i bundskattens grundlag, til 12,01 %.
    const { base, rate, amount } = assess({ earnedIncome: 500_000 }).layers.bottomBracketTax

    expect(base).toBeCloseTo(405_900, 2)
    expect(rate).toBeCloseTo(0.1201, 4)
    expect(amount).toBeCloseTo(base * rate, 6)
  })

  it('viser mellemskattens lovsats, også når det skrå skatteloft binder', () => {
    // Satsen i lagets egen linje er lovens 7,50 % og flytter sig ikke med
    // kommunen. Det, loftet koster, står i sit eget lag — se
    // "lægger loftnedslaget i sit eget lag ..." ovenfor.
    const { base, rate, amount } = assess({
      earnedIncome: 900_000,
      municipalTaxRate: 0.254,
    }).layers.middleBracketTax

    expect(rate).toBeCloseTo(0.075, 6)
    expect(amount).toBeCloseTo(base * rate, 6)
  })

  it('lader personlig indkomst og kapitalindkomst bidrage til bundskat hver for sig, med hver sin sats', () => {
    // Ingen af facitcasene blander de to i samme lag — men et år kan sagtens
    // have begge dele. Kapitalindkomstens loft på 42 % er uafhængigt af det
    // skrå skatteloft, personlig indkomst måles på, så de to satser må ikke
    // antages ens, og de to bidrag må derfor stå hver for sig.
    const assessment = assess({ earnedIncome: 900_000, capitalIncome: 50_000 })
    const personal = assessment.layers.bottomBracketTax
    const capital = assessment.capitalIncomeContribution?.bottomBracketTax

    expect(capital).toBeDefined()
    expect(personal.amount).toBeCloseTo(personal.base * personal.rate, 6)
    expect(capital!.amount).toBeCloseTo(capital!.base * capital!.rate, 6)
    expect(capital!.base).toBeCloseTo(50_000, 2)

    // De to lægger sammen til det, én samlet bundskat ville have været, hvis
    // indkomsterne var regnet hver for sig og lagt sammen bagefter.
    const combined =
      assess({ earnedIncome: 900_000 }).layers.bottomBracketTax.amount +
      assess({ capitalIncome: 50_000 }).capitalIncomeContribution!.bottomBracketTax!.amount
    expect(personal.amount + capital!.amount).toBeCloseTo(combined, 2)
  })

  it('udelader kapitalindkomstens bidrag, når kapitalindkomsten er nul', () => {
    expect(assess({ earnedIncome: 500_000 }).capitalIncomeContribution).toBeUndefined()
  })
})

describe('marginalTaxRate', () => {
  it('regner den sammensatte marginalskat som skatten af én krone mere lønindkomst', () => {
    // 900.000 kr. i løn ligger over begge fradragslofter (jf. "stopper
    // beskæftigelsesfradraget/jobfradraget ved sit maksimum" ovenfor) og over
    // både mellem- og topskattegrænsen, uden at det skrå skatteloft binder
    // ved 22 % kommuneskat — jf. "lader loftet nedsætte en sats, men aldrig
    // løfte den". Ingen fradrag eller lofttrin ændrer sig derfor med den
    // næste krone, og marginalskatten er præcis summen af de nominelle
    // satser på det, der er tilbage efter AM-bidrag:
    // 8 % AM-bidrag + 92 % × (12,01 % bund + 7,50 % mellem + 7,50 % top + 22 % kommune)
    // = 8 % + 92 % × 49,01 % = 53,0892 %.
    const rate = marginal({ earnedIncome: 900_000, municipalTaxRate: 0.22, churchTaxRate: 0 })

    expect(rate).toBeCloseTo(0.530892, 6)
  })

  it('lader marginalskatten stige, når en ekstra krone krydser ind i et nyt progressionslag', () => {
    // 641.199 kr. i personlig indkomst (697.999,89 i løn) ligger lige under
    // mellemskattegrænsen; én krone mere krydser den. Marginalskatten skal
    // derfor være højere end AM-bidraget plus bundskatten alene.
    const belowThreshold = marginal({ earnedIncome: 600_000, municipalTaxRate: 0.254, churchTaxRate: 0.0074 })
    const acrossThreshold = marginal({ earnedIncome: 750_000, municipalTaxRate: 0.254, churchTaxRate: 0.0074 })

    expect(acrossThreshold).toBeGreaterThan(belowThreshold)
  })

  it('lander marginalskatten præcis på det lofttrin, indkomsten når op i', () => {
    // Det er den invariant, trappen er: binder loftet, er marginalskatten
    // trinnet selv — hverken over eller under. AM-bidraget står uden for
    // loftet og lægges oven på de 92 %, der er tilbage af kronen.
    // Regnes nedslaget af de nominelle satser i stedet for af de nedsatte,
    // gives det én gang pr. lag, og de to øverste trin rammes for lavt.
    const ceiling = (step: number) => 0.08 + 0.92 * step

    // 690.000 i personlig indkomst — over mellemskattegrænsen, under
    // topskattens.
    expect(marginal({ earnedIncome: 750_000, municipalTaxRate: 0.254, churchTaxRate: 0 })).toBeCloseTo(
      ceiling(0.4457),
      6,
    )
    // 874.000 — over topskattegrænsen, under top-topskattens.
    expect(marginal({ earnedIncome: 950_000, municipalTaxRate: 0.254, churchTaxRate: 0 })).toBeCloseTo(
      ceiling(0.5207),
      6,
    )
    // 2.760.000 — over top-topskattegrænsen.
    expect(
      marginal({ earnedIncome: 3_000_000, municipalTaxRate: 0.254, churchTaxRate: 0 }),
    ).toBeCloseTo(ceiling(0.5707), 6)
  })
})
