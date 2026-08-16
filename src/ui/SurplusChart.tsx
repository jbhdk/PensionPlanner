import { scaleLinear } from 'd3-scale'
import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import { KroneAxisMarks, MARGIN, YearAxisMarks, kroneAxis, useMeasuredPlot } from './chartFrame'
import { surplusColor } from './palette'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'
import { surplus } from './surplus'

// Søjlen skal have luft til begge sider, så to nabosøjler læses som to år og
// ikke som ét sammenhængende bånd.
const BAR_FILL = 0.7

/** Overskudsgrafen: én søjle pr. simuleringsår om en nul-linje, jf.
    ADR-0026. Søjler og ikke kurve, fordi `Surplus` tilhører et år og ikke
    findes midt i det — en kurve mellem to år ville påstå en mellemværdi, der
    ikke er nogen. Formuen er et niveau og tegnes som areal; overskuddet er en
    strøm.

    Bufferens tonede spænd gentages ikke her. `Sustainable` svarer på, om
    husstanden havde noget at tage af, og det spørgsmål hører til
    formuegrafen; overskuddet svarer på, om året bar sig selv, jf. ADR-0008
    og ADR-0026. */
export function SurplusChart({
  years,
  plan,
  unit,
  onSelectYear = () => {},
  initialWidth = 900,
  initialHeight = 300,
}: {
  years: YearResult[]
  plan: Plan
  unit: AmountUnit
  onSelectYear?: (year: number) => void
  initialWidth?: number
  initialHeight?: number
}) {
  const { plotRef, width, height } = useMeasuredPlot(initialWidth, initialHeight)

  const n = years.length
  const values = years.map((year) =>
    toDisplayKroner(surplus(year, plan.buffer), year.year, plan, unit),
  )

  // Skalaen rummer altid nul-linjen, uanset om året skiftede fortegn: en
  // graf, hvis bund var det mindste overskud frem for nul, ville tegne et
  // magert år som ingenting og et underskud helt uden for billedet.
  const top = Math.max(0, ...values)
  const bottom = Math.min(0, ...values)
  const axis = kroneAxis(bottom, top)
  const right = width - MARGIN.right

  // X-skalaen er formuegrafens egen: samme år, samme sted. De to grafer skal
  // kunne lægges over hinanden om en delt x-akse, jf. ADR-0026.
  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([axis.left, right])
  const y = scaleLinear()
    .domain([bottom, top === bottom ? 1 : top])
    .range([height - MARGIN.bottom, MARGIN.top])

  const step = n > 1 ? x(1) - x(0) : right - axis.left
  const barWidth = Math.max(1, step * BAR_FILL)
  const zero = y(0)

  return (
    <div className="graf overskudsgraf">
      <div className="graf-plot" ref={plotRef}>
        <svg role="img" aria-label="Overskudsgraf" viewBox={`0 0 ${width} ${height}`}>
          <KroneAxisMarks axis={axis} y={y} right={right} />
          {years.map((year, i) => {
            // Søjlen hænger i nul-linjen begge veje: et overskud står på den,
            // et underskud under den. Højden er afstanden, og fortegnet bærer
            // den ikke — SVG kender ikke negativ højde.
            const edge = y(values[i]!)
            // Første og sidste søjle sidder på selve plotkanten og ville
            // ellers rage ud i margenen med sin halve bredde.
            const x0 = Math.max(axis.left, x(i) - barWidth / 2)
            const x1 = Math.min(right, x(i) + barWidth / 2)
            return (
              <g key={year.year} onClick={() => onSelectYear(year.year)}>
                {/* Klikfeltet er hele årets søjle i fuld højde og ikke kun
                    søjlen selv: et år, der går næsten lige op, har næsten
                    ingen søjle at ramme. */}
                <rect
                  className="aarsfelt"
                  x={x0}
                  y={MARGIN.top}
                  width={x1 - x0}
                  height={height - MARGIN.top - MARGIN.bottom}
                />
                <rect
                  data-year={year.year}
                  x={x0}
                  y={Math.min(edge, zero)}
                  width={x1 - x0}
                  height={Math.abs(edge - zero)}
                  fill={surplusColor(values[i]!)}
                />
              </g>
            )
          })}
          <YearAxisMarks years={years} x={x} left={axis.left} right={right} height={height} />
        </svg>
      </div>
    </div>
  )
}
