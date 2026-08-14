const kroneFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 })
const procentFormat = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const millionFormat = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Kronebeløb uden decimaler, med dansk tusindtalsseparator og minus foran.

    Nul skrives uden fortegn: et negeret nul — skat af ingenting — ville ellers
    stå som −0 og ligne et beløb. */
export function kroner(amount: number): string {
  const rounded = Math.round(amount)
  return kroneFormat.format(rounded === 0 ? 0 : rounded)
}

/** Millionbeløb med én decimal — "1,5 mio.". Aksemærkater i hele kroner
    fylder mere, end grafens venstre margen har plads til, så snart formuen
    løber op i millioner. */
export function millioner(amount: number): string {
  return `${millionFormat.format(amount / 1_000_000)} mio.`
}

/** Satser med to decimaler, fordi satserne har dem — 12,01 % er ikke 12 %. */
export function procent(rate: number): string {
  return `${procentFormat.format(rate * 100)} %`
}
