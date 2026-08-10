import { describe, expect, it } from 'vitest'
import { kroner } from './format'

describe('kroner', () => {
  it('skriver dansk tusindtalsseparator og ingen decimaler', () => {
    expect(kroner(1_234_567)).toBe('1.234.567')
    expect(kroner(41_615.87)).toBe('41.616')
  })

  it('sætter minus foran negative beløb frem for parentes', () => {
    expect(kroner(-60_000)).toBe('-60.000')
  })

  it('skriver nul uden fortegn, også når det kommer fra et negeret nul', () => {
    expect(kroner(-0)).toBe('0')
    expect(kroner(-0.2)).toBe('0')
  })
})
