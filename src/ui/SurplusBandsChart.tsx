import { scaleLinear } from 'd3-scale'
import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import {
  KroneAxisMarks,
  MARGIN,
  MINI_MARGIN,
  YearAxisMarks,
  ZeroLine,
  kroneAxis,
  useMeasuredPlot,
} from './chartFrame'
import { surplusBandColor } from './palette'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'
import { surplusBandOrder, surplusBands } from './surplusBands'

// Søjlen skal have luft til begge sider, så to nabosøjler læses som to år og
// ikke som ét sammenhængende bånd. Mini-grafen har ikke plads at give væk og
// fylder derfor sin plads mere ud.
const BAR_FILL = 0.7
const MINI_BAR_FILL = 0.85

/** Fordelingsgrafen: de otte bånd, `Surplus` består af — indtægtsposter,
    ydelser, udbetalinger og overførsler ind, mod skat, udgiftsposter,
    indbetalinger og overførsler ud — stablet divergerende om en nul-linje,
    jf. ADR-0026. Stod tidligere som det øverste af Overskudsgrafens to
    paneler; er nu sin egen graf med sin egen skala, jf. ADR-0033, så den kan
    indgå i hovedgraf/mini-graf-laget på egen ret og bytte plads uafhængigt
    af Overskuddets søjle.

    `mode` skelner hovedgraf fra mini-graf: en mini-graf har hverken akse,
    legend eller klik — kun formen, jf. ADR-0033. */
export function SurplusBandsChart({
  years,
  plan,
  unit,
  onSelectYear = () => {},
  mode = 'main',
  initialWidth = 900,
  initialHeight = 300,
}: {
  years: YearResult[]
  plan: Plan
  unit: AmountUnit
  onSelectYear?: (year: number) => void
  mode?: 'main' | 'mini'
  initialWidth?: number
  initialHeight?: number
}) {
  const { plotRef, width, height } = useMeasuredPlot(initialWidth, initialHeight)
  const M = mode === 'main' ? MARGIN : MINI_MARGIN

  const n = years.length
  const display = (amount: number, year: YearResult) =>
    toDisplayKroner(amount, year.year, plan, unit)

  // Båndene stables, mens de regnes: hvert bånd lægger sig på det forrige,
  // opad eller nedad efter sin retning, og året efterlader de to yderpunkter,
  // skalaen skal kunne rumme.
  const stacks = years.map((year) => {
    let up = 0
    let down = 0
    const bands = surplusBands(year, plan).map((band) => {
      const amount = display(band.amount, year)
      if (band.direction === 'Income') {
        const from = up
        up += amount
        return { ...band, from, to: up }
      }
      const from = down
      down -= amount
      return { ...band, from, to: down }
    })
    return { bands, up, down }
  })

  const bandSpan = span(
    stacks.map((stack) => stack.down).concat(stacks.map((stack) => stack.up)),
  )
  const axis = kroneAxis(bandSpan.bottom, bandSpan.top)
  // Mini-grafen har ingen mærkater at måle margenen på og bruger derfor sin
  // egen faste, minimale margen — `ZeroLine` læser sin venstrekant af
  // `axis.left` og skal derfor se den samme værdi som resten af grafen.
  const effectiveAxis = mode === 'main' ? axis : { ...axis, left: M.left }
  const left = effectiveAxis.left
  const right = width - M.right

  const y = scaleLinear()
    .domain([bandSpan.bottom, axis.domainTop === bandSpan.bottom ? 1 : axis.domainTop])
    .range([height - M.bottom, M.top])

  const bandWidth = n > 0 ? (right - left) / n : right - left
  const barWidth = Math.max(1, bandWidth * (mode === 'main' ? BAR_FILL : MINI_BAR_FILL))

  // Årstallet under aksen skal stå under sin egen søjle og ikke på et
  // pointskift, der er uafhængigt af pladsernes bredde.
  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([left + bandWidth / 2, left + (Math.max(1, n - 1) + 0.5) * bandWidth])

  return (
    <div className="graf fordelingsgraf" data-mode={mode}>
      <div className="graf-titel">
        <span className="navn">Fordelingen</span>
      </div>
      <div className="graf-plot" ref={plotRef}>
        <svg role="img" aria-label="Fordelingsgraf" viewBox={`0 0 ${width} ${height}`}>
          {mode === 'main' && <KroneAxisMarks axis={effectiveAxis} y={y} right={right} />}
          {years.map((year, i) => {
            const columnX0 = x(i) - bandWidth / 2
            const columnX1 = x(i) + bandWidth / 2
            const x0 = x(i) - barWidth / 2
            const x1 = x(i) + barWidth / 2
            return (
              <g
                key={year.year}
                className="aarssoejler"
                onClick={mode === 'main' ? () => onSelectYear(year.year) : undefined}
              >
                {/* Hele årets søjlefelt er klikbart og ikke kun båndene selv
                    — et år, hvor båndene næsten går lige op, har næsten
                    intet at ramme. Kun i hovedtilstand: mini-grafen bytter
                    sig frem ved klik i stedet, jf. ADR-0033. */}
                {mode === 'main' && (
                  <rect
                    className="aarsfelt"
                    x={columnX0}
                    y={M.top}
                    width={columnX1 - columnX0}
                    height={height - M.top - M.bottom}
                  />
                )}
                {stacks[i]!.bands.map((band, bandIndex) => (
                  <rect
                    key={band.name}
                    data-band={band.name}
                    data-direction={band.direction}
                    data-year={year.year}
                    x={x0}
                    y={Math.min(y(band.from), y(band.to))}
                    width={x1 - x0}
                    height={Math.abs(y(band.to) - y(band.from))}
                    fill={surplusBandColor(bandIndex)}
                  />
                ))}
              </g>
            )
          })}
          <ZeroLine axis={effectiveAxis} y={y} right={right} />
          {mode === 'main' && (
            <YearAxisMarks years={years} x={x} left={left} right={right} height={height} />
          )}
        </svg>
      </div>
      {mode === 'main' && (
        <ul className="graf-legend fordelingsgraf-legend">
          {surplusBandOrder.map((band, bandIndex) => (
            <li key={band.name} data-band={band.name}>
              <span className="svatch" style={{ background: surplusBandColor(bandIndex) }} />
              {band.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Span = { bottom: number; top: number }

/** Værdiernes udstrækning, altid med nul-linjen indenfor. */
function span(values: number[]): Span {
  return { bottom: Math.min(0, ...values), top: Math.max(0, ...values) }
}
