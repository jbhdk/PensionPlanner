const kroneFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 })
const procentFormat = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Kronebeløb uden decimaler, med dansk tusindtalsseparator og minus foran.

    Nul skrives uden fortegn: et negeret nul — skat af ingenting — ville ellers
    stå som −0 og ligne et beløb. */
export function kroner(amount: number): string {
  const rounded = Math.round(amount)
  return kroneFormat.format(rounded === 0 ? 0 : rounded)
}

/** Satser med to decimaler, fordi satserne har dem — 12,01 % er ikke 12 %. */
export function procent(rate: number): string {
  return procentFormat.format(rate * 100)
}
