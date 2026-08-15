// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { rateYear2026 } from './rateYear2026'

/** Læser kommunetabellen af docs/satser/2026.md, så testen bruger dokumentet
    som facit i stedet for at gentage tallene som en separat liste her.
    `rateYear2026.ts`'s egen kommentar siger det ligeud: retter man et tal i
    dokumentet, retter man det begge steder — denne test er den kontrol af
    at det faktisk sker. */
function municipalTaxFromDoc(): Record<string, { municipalTaxRate: number; churchTaxRate: number }> {
  const doc = readFileSync(
    fileURLToPath(new URL('../../../docs/satser/2026.md', import.meta.url)),
    'utf8',
  )
  const section = doc.split('## Kommune- og kirkeskatteprocenter')[1]!.split(/\n## /)[0]!
  const rowPattern = /^\| (.+) \| ([\d,]+) % \| ([\d,]+) % \|$/gm

  const result: Record<string, { municipalTaxRate: number; churchTaxRate: number }> = {}
  for (const match of section.matchAll(rowPattern)) {
    const [, name, municipalPct, churchPct] = match
    if (name === 'Kommune') continue
    result[name!] = {
      municipalTaxRate: Math.round((Number(municipalPct!.replace(',', '.')) / 100) * 10_000) / 10_000,
      churchTaxRate: Math.round((Number(churchPct!.replace(',', '.')) / 100) * 10_000) / 10_000,
    }
  }
  return result
}

/** Amortisationsrenten læst af docs/satser/2026.md, af samme grund som
    kommunetabellen: dokumentet er forlægget, og satsårsfilen er en afskrift
    af det. Renten er Finans Danmarks og hverken en § 20-grænse eller en
    skattesats — den har sin egen kilde og sin egen tabel i dokumentet. */
function amortisationRateFromDoc(): number {
  const doc = readFileSync(
    fileURLToPath(new URL('../../../docs/satser/2026.md', import.meta.url)),
    'utf8',
  )
  const section = doc.split('## Amortisationsrenten')[1]!.split(/\n## /)[0]!
  const match = /\| Amortisationsrente \| ([\d,]+) % \|/.exec(section)!
  return Number(match[1]!.replace(',', '.')) / 100
}

/** Satsårets egen selvkontrol, jf. docs/satser/2026.md.

    Bortfaldsgrænsen er ikke et selvstændigt tal, men en konsekvens af de tre
    andre: når pensionstillægget aftrappes med en fast procent af indtægten
    over fradragsbeløbet, er tillægget netop væk ved fradragsbeløbet plus
    ydelsen divideret med procenten. Holder den relation ikke, er mindst ét af
    de fire tal skrevet forkert af — og det er den fejl, der ellers først
    dukker op som et forkert pensionstillæg tredive år inde i en fremskrivning. */

describe('satsår 2026', () => {
  it('udleder pensionstillæggets bortfaldsgrænse af ydelse, fradragsbeløb og procent', () => {
    for (const taper of rateYear2026.statePension.taper) {
      const derived = taper.allowance + taper.pensionSupplement / taper.rate

      // De offentliggjorte procenter er rundet til én decimal, så relationen
      // lukker sig ikke på kronen. Under hundrede kroner på et interval på
      // et kvart million er den bekræftelse, tallene kan give hinanden.
      expect(
        Math.abs(derived - taper.cutOff),
        `${taper.civilStatus}: ydelsen og procenten peger på bortfald ved ` +
          `${Math.round(derived)}, men satsåret siger ${taper.cutOff}`,
      ).toBeLessThan(100)
    }
  })

  it('lader loftets trin ligge præcis progressionslagenes egne satser fra hinanden', () => {
    // Trappens anden selvkontrol, jf. docs/satser/2026.md: 44,57 + 7,50 =
    // 52,07 og 52,07 + 5,00 = 57,07. Relationen er grunden til, at højst ét
    // trin kan binde — er første trin først bragt ned på loftet, rammer de
    // næste præcis deres eget. `taxCeilingRelief` hviler på det og tager
    // nedslaget i det første trin, der binder. Skrives et satsår, hvor
    // trinene ligger anderledes, skal nedslaget tænkes om, og det er den
    // fejl, denne test fanger.
    const { bracketTaxRates, taxCeiling } = rateYear2026

    expect(taxCeiling.atTopBracket - taxCeiling.atMiddleBracket).toBeCloseTo(
      bracketTaxRates.topBracketTax,
      10,
    )
    expect(taxCeiling.atAdditionalTopBracket - taxCeiling.atTopBracket).toBeCloseTo(
      bracketTaxRates.additionalTopBracketTax,
      10,
    )
  })

  it('lader kapitalindkomstens loft kun kunne binde i topskattelaget', () => {
    // Kapitalindkomstens loft er ét tal og ikke en trappe, så nedslaget
    // tages i det første lag, der bryder det. Bundskat plus den højeste
    // kommuneskat er 12,01 + 26,30 = 38,31 % og når ikke de 42 % — kun
    // topskattelaget kan altså binde. Kom en kommunesats over 29,99 %,
    // ville begge lag bryde loftet, og de har hvert sit grundlag; nedslaget
    // skal da tænkes om.
    const { bracketTaxRates, taxCeiling, municipalTax } = rateYear2026

    for (const [name, { municipalTaxRate }] of Object.entries(municipalTax.rates)) {
      expect(
        bracketTaxRates.bottomBracketTax + municipalTaxRate,
        `${name}: bundskat og kommuneskat bryder kapitalindkomstens loft alene`,
      ).toBeLessThanOrEqual(taxCeiling.capitalIncome)
    }
  })

  it('bærer en kilde på hver blok og holder de ⚠︎-mærkede tal ude fra de bekræftede', () => {
    const blocks = Object.entries(rateYear2026).flatMap(([name, value]) =>
      typeof value === 'object' && value !== null ? [[name, value] as const] : [],
    )

    expect(blocks.length).toBeGreaterThan(0)
    for (const [name, block] of blocks) {
      expect(block.source, `blokken ${name} har ingen kilde`).toMatch(/^https:\/\//)
    }

    // Folkepensionens ydelser er krydstjekket mellem sekundære kilder, men
    // ikke fundet i en officiel tabel. Mærket følger med ind i dataene, så et
    // ubekræftet tal ikke kan nå ind i en facitcase ubemærket.
    expect(rateYear2026.statePension.unconfirmed).toContain('basicAmount')

    // § 20-tabellen er Skatteministeriets egen, de fire lag på personlig
    // indkomst står på skat.dk selv, og fradragsprocenterne står dels på
    // skat.dk, dels i ligningsloven. Intet i de tre blokke er ⚠︎.
    expect(rateYear2026.thresholds.unconfirmed).toEqual([])
    expect(rateYear2026.bracketTaxRates.unconfirmed).toEqual([])
    expect(rateYear2026.allowanceRates.unconfirmed).toEqual([])

    // Kommune- og kirkeskatteprocenterne er læst direkte af Skatteministeriets
    // egen Excel-eksport, ikke krydstjekket sekundært, så heller ikke den er ⚠︎.
    expect(rateYear2026.municipalTax.unconfirmed).toEqual([])
  })

  it('bærer amortisationsrenten med samme tal som docs/satser/2026.md', () => {
    // Renten er ikke beholdningens nettoafkast, og de to må ikke bytte plads.
    // Den fastsættes af Finans Danmark for hvert udbetalingsår efter PBL
    // § 11 A, stk. 3, og hører derfor i satsåret.
    expect(rateYear2026.amortisationRate.rate).toBeCloseTo(0.0322, 10)
    expect(rateYear2026.amortisationRate.rate).toBeCloseTo(amortisationRateFromDoc(), 10)
  })

  it('slår op for alle ca. 98 kommuner, og med samme tal som docs/satser/2026.md', () => {
    const fromDoc = municipalTaxFromDoc()

    expect(Object.keys(fromDoc).length).toBeGreaterThan(90)
    expect(rateYear2026.municipalTax.rates).toEqual(fromDoc)
  })
})
