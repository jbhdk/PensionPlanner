import { describe, expect, it } from 'vitest'
import { rateYear2026 } from './rateYear2026'

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
  })
})
