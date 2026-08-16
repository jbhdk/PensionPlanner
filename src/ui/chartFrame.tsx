import type { ScaleLinear } from 'd3-scale'
import { useEffect, useRef, useState } from 'react'
import type { YearResult } from '../engine/yearResult'
import { kroner, millioner } from './format'

/** Grafernes fælles ramme: den målte plads, kroneaksen og årsaksen.

    Formuegrafen og overskudsgrafen svarer på hver sit spørgsmål og tegner
    hver sin slags form — et stablet areal mod søjler om en nul-linje — men
    de står i den samme ramme og skal blive ved med at gøre det. Trinnet på
    y-aksen, skiftet til millioner, venstremargenens udmåling og årstallene
    på x-aksen ligger derfor ét sted: to grafer, der trappede deres akser
    hver sin vej, ville ikke kunne læses ved siden af hinanden. */

// Top og bund har hver sin ekstra linje til aksens navn: enheden over
// y-mærkaterne, tidsenheden under årstallene. Uden dem er det tal på en akse,
// og læseren må gætte, hvad de tæller.
export const MARGIN = { top: 22, right: 8, bottom: 34, left: 58 }

// Aksemærkaterne står i monospace ved 10 px, hvor hvert tegn fylder 0,6 em.
// Margenen kan derfor udmåles af mærkatets længde frem for at måles i DOM'en.
const LABEL_CHAR_WIDTH = 6
const LABEL_GAP = 10

// Tidsenheden er simuleringsåret, og x-aksen tæller ét pr. punkt.
const X_AXIS_NAME = 'år'

/** Plotcontainerens faktiske størrelse. Ingen fast højde eller bredde:
    grafen måles efter den plads, den har, og tegnes om ved vinduesskift og
    når inspektørskuffen åbner eller lukker. `viewBox` følger den målte bredde
    i stedet for et fast tal, så SVG'en aldrig skalerer sin tegning — og
    dermed heller ikke aksernes fontstørrelse — ned for at passe en smal
    spalte. De to startværdier er kun det, der vises inden første måling. */
export function useMeasuredPlot(initialWidth: number, initialHeight: number) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(initialWidth)
  const [height, setHeight] = useState(initialHeight)

  useEffect(() => {
    const plot = plotRef.current
    if (!plot || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0) setWidth(rect.width)
      if (rect && rect.height > 0) setHeight(rect.height)
    })
    observer.observe(plot)
    return () => observer.disconnect()
  }, [])

  return { plotRef, width, height }
}

export type KroneAxis = {
  /** Gitterlinjernes værdier, nedefra og op. Nul er altid iblandt dem, når
      spændet rummer det. */
  ticks: number[]
  labels: string[]
  /** Enheden mærkaterne står i — `kr.` eller `mio. kr.`. */
  name: string
  /** Venstremargenen, udmålt efter det længste mærkat. */
  left: number
}

/** Kroneaksen for et spænd, der kan ligge på begge sider af nul.

    Gitterlinjerne trappes i pæne trin — en halv tierpotens ad gangen — målt
    på det største udslag til hver side, så trinnet er det samme over og under
    nul. Hele kroner fylder mere, end margenen har plads til, så snart tallene
    løber op i millioner, og aksen skifter derfor enhed frem for at klippe det
    yderste ciffer af viewBox'ens venstre kant.

    Hvilke kroner det er, dagens eller årets egne, står i omskifteren over
    grafen og gentages ikke på aksen. */
export function kroneAxis(bottom: number, top: number): KroneAxis {
  const magnitude = Math.max(Math.abs(bottom), Math.abs(top)) || 1
  const step = 10 ** Math.floor(Math.log10(magnitude)) / 2

  const ticks: number[] = []
  for (let k = Math.ceil(bottom / step); k * step <= top + step / 2; k++) {
    ticks.push(k * step)
  }

  const inMillions = magnitude >= 1_000_000
  const labels = ticks.map((value) => (inMillions ? millioner(value) : kroner(value)))
  const name = inMillions ? 'mio. kr.' : 'kr.'

  const longest = Math.max(0, ...[...labels, name].map((label) => label.length))
  const left = Math.max(MARGIN.left, longest * LABEL_CHAR_WIDTH + LABEL_GAP)

  return { ticks, labels, name, left }
}

/** Akser, hvis venstremargen er afstemt til den bredeste. To paneler over
    hinanden skal dele x-akse, og det gør de kun, hvis plotfladen begynder
    samme sted — ellers står det samme år to steder på skærmen, alt efter
    hvilket panel man læser. Trinnet og enheden er stadig hver akses egen:
    panelerne har hver sin skala, og det er dét, der holder et fortegnsskift
    fra at forsvinde i en stabling. */
export function alignedAxes(axes: KroneAxis[]): KroneAxis[] {
  const left = Math.max(...axes.map((axis) => axis.left))
  return axes.map((axis) => ({ ...axis, left }))
}

/** Kroneaksens mærker: enheden som overskrift over mærkatsøjlen, og en
    gitterlinje pr. trin med nul trukket frem som basislinje.

    `top` er panelets overkant og dermed den linje, enheden står over. Den
    er `MARGIN.top` i en graf med ét panel og panelets egen i en med to. */
export function KroneAxisMarks({
  axis,
  y,
  right,
  top = MARGIN.top,
}: {
  axis: KroneAxis
  y: ScaleLinear<number, number>
  right: number
  top?: number
}) {
  return (
    <g className="graf-akse-y">
      {/* Enheden står over mærkatsøjlen og er højrestillet som den, så den
          læses som søjlens overskrift. */}
      <text className="aksenavn" x={axis.left - 6} y={top - 8} textAnchor="end">
        {axis.name}
      </text>
      {axis.ticks.map((value, i) => (
        <g key={value}>
          <line
            x1={axis.left}
            x2={right}
            y1={y(value)}
            y2={y(value)}
            className={value === 0 ? 'basislinje' : 'gitterlinje'}
          />
          <text x={axis.left - 6} y={y(value) + 3.5} textAnchor="end">
            {axis.labels[i]}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Årsaksens mærker: hvert tiende år, plus altid første og sidste, så en kort
    horisont ikke står uden en eneste årsmarkering. */
export function YearAxisMarks({
  years,
  x,
  left,
  right,
  height,
}: {
  years: YearResult[]
  x: ScaleLinear<number, number>
  left: number
  right: number
  height: number
}) {
  const ticks = new Set<number>()
  years.forEach((year) => {
    if (year.year % 10 === 0) ticks.add(year.year)
  })
  if (years.length > 0) {
    ticks.add(years[0]!.year)
    ticks.add(years.at(-1)!.year)
  }

  return (
    <g className="graf-akse-x">
      {Array.from(ticks)
        .sort((a, b) => a - b)
        .map((yearTick) => {
          const index = yearTick - years[0]!.year
          // Tæt på højre kant ankres årstallet til højre i stedet for at
          // centreres, så det ikke rager ud over viewBox'en.
          const anchor = x(index) > right - 20 ? 'end' : 'middle'
          return (
            <text
              key={yearTick}
              x={x(index)}
              y={height - MARGIN.bottom + 14}
              textAnchor={anchor}
            >
              {yearTick}
            </text>
          )
        })}
      {/* Tidsenheden står midt under årstallene, hvor den ikke kan forveksles
          med et af dem. */}
      <text
        className="aksenavn"
        x={(left + right) / 2}
        y={height - 6}
        textAnchor="middle"
      >
        {X_AXIS_NAME}
      </text>
    </g>
  )
}
