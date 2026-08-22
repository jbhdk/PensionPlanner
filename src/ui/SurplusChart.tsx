import { scaleLinear } from 'd3-scale'
import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import {
  DataGlimpse,
  KroneAxisMarks,
  MARGIN,
  MINI_MARGIN,
  YearAxisMarks,
  YearCursor,
  ZeroLine,
  kroneAxis,
  useMeasuredPlot,
  useYearCursor,
} from './chartFrame'
import { kroner } from './format'
import { DEFICIT, SURPLUS, surplusColor } from './palette'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'
import { surplus } from './surplus'

// Søjlen skal have luft til begge sider, så to nabosøjler læses som to år og
// ikke som ét sammenhængende bånd. Mini-grafen har ikke plads at give væk og
// fylder derfor sin plads mere ud.
const BAR_FILL = 0.7
const MINI_BAR_FILL = 0.85

/** Overskudsgrafen: én søjle pr. simuleringsår, `Surplus` selv, divergerende
    om en nul-linje. Søjler og ikke en kurve, fordi `Surplus` tilhører et år
    og ikke findes midt i det — en kurve mellem to år ville påstå en
    mellemværdi, der ikke er nogen.

    Stod tidligere som det nederste af to paneler i samme komponent som
    Fordelingens bånd; er nu sin egen graf med sin egen skala, jf. ADR-0026
    og ADR-0033, så den kan indgå i hovedgraf/mini-graf-laget på egen ret.

    `mode` skelner hovedgraf fra mini-graf: en mini-graf har hverken akse,
    legend eller klik — kun formen, jf. ADR-0033. */
export function SurplusChart({
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
  const { hoveredIndex, enter, leave } = useYearCursor()
  const M = mode === 'main' ? MARGIN : MINI_MARGIN

  const n = years.length
  const surpluses = years.map((year) =>
    toDisplayKroner(surplus(year, plan.buffer), year.year, plan, unit),
  )

  // Dataglimtets ene række: årets `Surplus`, mærket efter samme skel som
  // grafens egen farve på søjlen allerede viser. Ingen sum-linje — der er
  // kun det ene tal, jf. issue #65.
  const glimpseRows =
    hoveredIndex === null
      ? []
      : [
          {
            key: 'overskud',
            label: surpluses[hoveredIndex]! < 0 ? 'Underskud' : 'Overskud',
            value: `${kroner(Math.abs(surpluses[hoveredIndex]!))} kr.`,
            color: surplusColor(surpluses[hoveredIndex]!),
          },
        ]

  // Aksen rummer altid nul-linjen, uanset om året skiftede fortegn: en graf,
  // hvis bund var det mindste overskud frem for nul, ville tegne et magert
  // år som ingenting og et underskud helt uden for billedet.
  const surplusSpan = span(surpluses)
  const axis = kroneAxis(surplusSpan.bottom, surplusSpan.top)
  // Mini-grafen har ingen mærkater at måle margenen på og bruger derfor sin
  // egen faste, minimale margen — `ZeroLine` læser sin venstrekant af
  // `axis.left` og skal derfor se den samme værdi som resten af grafen.
  const effectiveAxis = mode === 'main' ? axis : { ...axis, left: M.left }
  const left = effectiveAxis.left
  const right = width - M.right

  const y = scaleLinear()
    .domain([surplusSpan.bottom, axis.domainTop === surplusSpan.bottom ? 1 : axis.domainTop])
    .range([height - M.bottom, M.top])

  const bandWidth = n > 0 ? (right - left) / n : right - left
  const barWidth = Math.max(1, bandWidth * (mode === 'main' ? BAR_FILL : MINI_BAR_FILL))
  const zero = y(0)

  // Årstallet under aksen skal stå under sin egen søjle og ikke på et
  // pointskift, der er uafhængigt af pladsernes bredde.
  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([left + bandWidth / 2, left + (Math.max(1, n - 1) + 0.5) * bandWidth])

  return (
    <div className="graf overskudsgraf" data-mode={mode}>
      <div className="graf-titel">
        <span className="navn">Overskuddet</span>
      </div>
      <div className="graf-plot" ref={plotRef}>
        <svg role="img" aria-label="Overskudsgraf" viewBox={`0 0 ${width} ${height}`}>
          {mode === 'main' && <KroneAxisMarks axis={effectiveAxis} y={y} right={right} />}
          <g onMouseLeave={mode === 'main' ? leave : undefined}>
            {years.map((year, i) => {
              const columnX0 = x(i) - bandWidth / 2
              const columnX1 = x(i) + bandWidth / 2
              const x0 = x(i) - barWidth / 2
              const x1 = x(i) + barWidth / 2
              // Søjlen hænger i nul-linjen begge veje: et overskud står på
              // den, et underskud under den. Højden er afstanden, og fortegnet
              // bærer den ikke — SVG kender ikke negativ højde.
              const edge = y(surpluses[i]!)
              return (
                <g
                  key={year.year}
                  className="aarssoejler"
                  onClick={mode === 'main' ? () => onSelectYear(year.year) : undefined}
                  onMouseEnter={mode === 'main' ? () => enter(i) : undefined}
                >
                  {/* Hele årets klikfelt dækker søjlens fulde højde og ikke
                      kun søjlen selv: et år med et overskud tæt på nul har
                      næsten ingen søjle at ramme. Kun i hovedtilstand. */}
                  {mode === 'main' && (
                    <rect
                      className="aarsfelt"
                      x={columnX0}
                      y={M.top}
                      width={columnX1 - columnX0}
                      height={height - M.top - M.bottom}
                    />
                  )}
                  <rect
                    className="overskudssoejle"
                    data-year={year.year}
                    x={x0}
                    y={Math.min(edge, zero)}
                    width={x1 - x0}
                    height={Math.abs(edge - zero)}
                    fill={surplusColor(surpluses[i]!)}
                  />
                </g>
              )
            })}
          </g>
          <ZeroLine axis={effectiveAxis} y={y} right={right} />
          {mode === 'main' && (
            <YearAxisMarks years={years} x={x} left={left} right={right} height={height} />
          )}
          {mode === 'main' && (
            <YearCursor index={hoveredIndex} x={x} top={M.top} bottom={height - M.bottom} />
          )}
          {mode === 'main' && (
            <DataGlimpse index={hoveredIndex} top={M.top} right={right} rows={glimpseRows} />
          )}
        </svg>
      </div>
      {mode === 'main' && (
        <ul className="graf-legend overskudsgraf-legend">
          <li>
            <span className="svatch" style={{ background: SURPLUS }} />
            Overskud
          </li>
          <li>
            <span className="svatch" style={{ background: DEFICIT }} />
            Underskud
          </li>
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
