import { describe, expect, it } from 'vitest'
import { kroner, procent } from './format'

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

describe('procent', () => {
  it('skriver altid to decimaler, med dansk komma og procenttegn', () => {
    expect(procent(0.065)).toBe('6,50 %')
    expect(procent(0.1201)).toBe('12,01 %')
  })
})
