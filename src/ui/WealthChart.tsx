import { scaleLinear } from 'd3-scale'
import { area as d3Area, curveLinear } from 'd3-shape'
import { useEffect, useRef, useState } from 'react'
import type { Plan } from '../engine/plan'
import type { BufferState, YearResult } from '../engine/yearResult'
import { bufferStateClasses, bufferStateLabels } from './bufferState'
import { kroner } from './format'
import { holdingColor, orderedHoldings } from './holdingPalette'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'

const MARGIN = { top: 8, right: 8, bottom: 20, left: 58 }

type BandPoint = { y0: number; y1: number }

type BufferSpan = { state: BufferState; fromIndex: number; toIndex: number; fromYear: number }

/** Sammenhængende spænd af samme bufferState, jf. ADR-0008 — samme plan kan
    være `Incomplete` i de tidlige år og `Unsustainable` senere, så spændene
    skal splittes, når tilstanden skifter, ikke kun når bufferen bliver
    positiv igen. */
function bufferSpans(years: YearResult[]): BufferSpan[] {
  const spans: BufferSpan[] = []
  years.forEach((year, i) => {
    const state = year.bufferState
    if (!state) return
    const last = spans.at(-1)
    if (last && last.state === state && last.toIndex === i - 1) {
      last.toIndex = i
      return
    }
    spans.push({ state, fromIndex: i, toIndex: i, fromYear: year.year })
  })
  return spans
}

/** Formuegrafen: stablet areal pr. beholdning over hele horisonten, jf.
    ADR-0011 (råt SVG, `d3-scale`/`d3-shape`). Negative saldi gulves ved
    nul, før stablingen — en tom buffer er et hul i planen, ikke en
    beholdning med negativ udstrækning, jf. ADR-0011.

    Ingen fast højde eller bredde: grafen måles efter den plads,
    plotcontaineren faktisk har, og tegnes om ved vinduesskift og når
    inspektørskuffen åbner eller lukker. `viewBox` følger den målte bredde
    i stedet for et fast tal, så SVG'en aldrig skalerer sin tegning — og
    dermed heller ikke aksernes fontstørrelse — ned for at passe en smal
    spalte. `initialWidth`/`initialHeight` er kun det, der vises inden
    første måling. */
export function WealthChart({
  years,
  plan,
  unit,
  selected = null,
  onSelect = () => {},
  initialWidth = 900,
  initialHeight = 300,
}: {
  years: YearResult[]
  plan: Plan
  unit: AmountUnit
  selected?: Selection
  onSelect?: (selection: Selection) => void
  initialWidth?: number
  initialHeight?: number
}) {
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

  const holdings = orderedHoldings(plan.household)
  const n = years.length

  const bands: BandPoint[][] = holdings.map(() => [])
  let maxTop = 0
  for (let i = 0; i < n; i++) {
    let pos = 0
    const balances = years[i]!.holdings
    const displayYear = years[i]!.year
    holdings.forEach((holding, si) => {
      const balance = balances.find((h) => h.holding === holding.id)?.closingBalance ?? 0
      const value = Math.max(0, toDisplayKroner(balance, displayYear, plan, unit))
      bands[si]!.push({ y0: pos, y1: pos + value })
      pos += value
    })
    maxTop = Math.max(maxTop, pos)
  }
  if (maxTop === 0) maxTop = 1

  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([MARGIN.left, width - MARGIN.right])
  const y = scaleLinear()
    .domain([0, maxTop])
    .range([height - MARGIN.bottom, MARGIN.top])

  const areaGenerator = d3Area<BandPoint>()
    .x((_d, i) => x(i))
    .y0((d) => y(d.y0))
    .y1((d) => y(d.y1))
    .curve(curveLinear)

  // Halvdelen af årsafstanden, så spændets tonede baggrund dækker hele det
  // markerede år og ikke kun punktet midt i det.
  const halfStep = n > 1 ? (x(1) - x(0)) / 2 : 0

  // Y-aksens gitterlinjer trappes i pæne trin (en halv tierpotens ad
  // gangen), som mockuppens tegnFormuegraf().
  const yStep = 10 ** Math.floor(Math.log10(maxTop)) / 2
  const yTicks: number[] = []
  for (let v = 0; v <= maxTop; v += yStep) yTicks.push(v)

  // X-aksens årstal: hvert tiende år, plus altid første og sidste, så en
  // kort horisont ikke står uden en eneste årsmarkering.
  const xTickYears = new Set<number>()
  years.forEach((yearResult) => {
    if (yearResult.year % 10 === 0) xTickYears.add(yearResult.year)
  })
  if (n > 0) {
    xTickYears.add(years[0]!.year)
    xTickYears.add(years[n - 1]!.year)
  }
  const xTicks = Array.from(xTickYears).sort((a, b) => a - b)

  return (
    <div className="formuegraf">
      <div className="formuegraf-plot" ref={plotRef}>
        <svg role="img" aria-label="Formuegraf" viewBox={`0 0 ${width} ${height}`}>
          {bufferSpans(years).map((span) => {
            const x0 = Math.max(MARGIN.left, x(span.fromIndex) - halfStep)
            const x1 = Math.min(width - MARGIN.right, x(span.toIndex) + halfStep)
            return (
              <g
                key={`${span.state}-${span.fromIndex}`}
                className={`bufferstate-spaen ${bufferStateClasses[span.state]}`}
              >
                <rect
                  data-buffer-state={span.state}
                  x={x0}
                  y={MARGIN.top}
                  width={x1 - x0}
                  height={height - MARGIN.top - MARGIN.bottom}
                />
                <text x={x0 + 4} y={height - MARGIN.bottom - 6}>
                  {bufferStateLabels[span.state]} fra {span.fromYear}
                </text>
              </g>
            )
          })}
          <g className="formuegraf-akse-y">
            {yTicks.map((v) => (
              <g key={v}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(v)}
                  y2={y(v)}
                  className={v === 0 ? 'basislinje' : 'gitterlinje'}
                />
                <text x={MARGIN.left - 6} y={y(v) + 3.5} textAnchor="end">
                  {kroner(v)}
                </text>
              </g>
            ))}
          </g>
          {holdings.map((holding, si) => {
            const dimmed = selected?.kind === 'holding' && selected.id !== holding.id
            return (
              <path
                key={holding.id}
                data-holding={holding.id}
                d={areaGenerator(bands[si]!) ?? undefined}
                fill={holdingColor(si)}
                fillOpacity={dimmed ? 0.28 : 1}
                stroke="var(--flade)"
                strokeWidth={2}
              />
            )
          })}
          <g className="formuegraf-akse-x">
            {xTicks.map((yearTick) => {
              const index = yearTick - years[0]!.year
              // Tæt på højre kant ankres årstallet til højre i stedet for at
              // centreres, så det ikke rager ud over viewBox'en.
              const anchor = x(index) > width - MARGIN.right - 20 ? 'end' : 'middle'
              return (
                <text key={yearTick} x={x(index)} y={height - 6} textAnchor={anchor}>
                  {yearTick}
                </text>
              )
            })}
          </g>
        </svg>
      </div>
      <ul className="formuegraf-legend">
        {holdings.map((holding, si) => {
          const target: Target = { kind: 'holding', id: holding.id }
          return (
            <li key={holding.id}>
              <button
                type="button"
                className={sameSelection(selected, target) ? 'valgt' : undefined}
                onClick={() => onSelect(sameSelection(selected, target) ? null : target)}
              >
                <span className="svatch" style={{ background: holdingColor(si) }} />
                {holding.name}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
