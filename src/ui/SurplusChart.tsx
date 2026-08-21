import { scaleLinear } from 'd3-scale'
import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import {
  KroneAxisMarks,
  MARGIN,
  YearAxisMarks,
  ZeroLine,
  alignedAxes,
  kroneAxis,
  useMeasuredPlot,
} from './chartFrame'
import { surplusBandColor, surplusColor } from './palette'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'
import { surplus } from './surplus'
import { surplusBandOrder, surplusBands } from './surplusBands'

// Søjlen skal have luft til begge sider, så to nabosøjler læses som to år og
// ikke som ét sammenhængende bånd. Båndene deler bredden med søjlerne
// nedenunder: to paneler, hvis år var lige brede hvert sit sted, ville ikke
// kunne læses over hinanden.
const BAR_FILL = 0.7

// Sammensætningen får den største del af højden — den bærer otte bånd, hvor
// panelet nedenunder bærer én søjle — men overskuddet skal stadig have plads
// nok til, at et fortegnsskift kan ses.
const BAND_PANEL_SHARE = 0.62

// Luften mellem de to paneler rummer det nederste panels enhedsmærkat og er
// derfor lige så høj som topmargenen, der rummer det øverstes.
const PANEL_GAP = MARGIN.top

/** Overskudsgrafen: to paneler over den samme x-akse.

    Det øverste stabler de otte bånd, årets overskud består af, divergerende
    om en nul-linje. Det nederste tegner selve overskuddet som én søjle pr.
    simuleringsår. Søjler og ikke kurve, fordi `Surplus` tilhører et år og
    ikke findes midt i det — en kurve mellem to år ville påstå en
    mellemværdi, der ikke er nogen. Formuen er et niveau og tegnes som areal;
    overskuddet er en strøm.

    Delingen er svaret på den indvending, fladekortet forkastede formen på:
    et fortegnsskift i én størrelse er præcis det, en stabling af mange
    kategorier skjuler. Størrelsen har derfor sit eget panel med sin egen
    skala og kan ikke forsvinde i båndene, jf. ADR-0026. De to paneler deler
    venstremargen og x-skala, så samme år står lodret over hinanden.

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
  const display = (amount: number, year: YearResult) =>
    toDisplayKroner(amount, year.year, plan, unit)

  const surpluses = years.map((year) => display(surplus(year, plan.buffer), year))

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

  // Begge skalaer rummer altid nul-linjen, uanset om året skiftede fortegn:
  // en graf, hvis bund var det mindste overskud frem for nul, ville tegne et
  // magert år som ingenting og et underskud helt uden for billedet.
  const bandSpan = span(stacks.map((stack) => stack.down).concat(stacks.map((stack) => stack.up)))
  const surplusSpan = span(surpluses)
  const axes = alignedAxes([
    kroneAxis(bandSpan.bottom, bandSpan.top),
    kroneAxis(surplusSpan.bottom, surplusSpan.top),
  ])
  const bandAxis = axes[0]!
  const surplusAxis = axes[1]!

  const left = bandAxis.left
  const right = width - MARGIN.right

  const plotHeight = height - MARGIN.top - MARGIN.bottom - PANEL_GAP
  const bandPanel = { top: MARGIN.top, bottom: MARGIN.top + plotHeight * BAND_PANEL_SHARE }
  const surplusPanel = { top: bandPanel.bottom + PANEL_GAP, bottom: height - MARGIN.bottom }

  const bandY = panelScale(bandSpan, bandPanel)
  const surplusY = panelScale(surplusSpan, surplusPanel)

  // Søjlerne sidder i deres egen ligestore plads pr. år, ikke på selve
  // aksens yderpunkter. Sådan bliver hvert mellemrum ens, og både første
  // og sidste søjle holder sig selv inden for aksens bredde uden at blive
  // tyndere end de andre.
  const bandWidth = n > 0 ? (right - left) / n : right - left
  const barWidth = Math.max(1, bandWidth * BAR_FILL)
  const surplusZero = surplusY(0)

  // Årstallet under aksen skal stå under sin egen søjle og ikke på et
  // pointskift, der er uafhængigt af pladsernes bredde — samme funktion,
  // søjlerne selv bruger til at finde deres midte.
  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([left + bandWidth / 2, left + (Math.max(1, n - 1) + 0.5) * bandWidth])

  return (
    <div className="graf overskudsgraf">
      <div className="graf-plot" ref={plotRef}>
        <svg role="img" aria-label="Overskudsgraf" viewBox={`0 0 ${width} ${height}`}>
          <g className="baandpanel">
            <KroneAxisMarks axis={bandAxis} y={bandY} right={right} top={bandPanel.top} />
          </g>
          <g className="overskudspanel">
            <KroneAxisMarks
              axis={surplusAxis}
              y={surplusY}
              right={right}
              top={surplusPanel.top}
            />
          </g>
          {years.map((year, i) => {
            const columnX0 = x(i) - bandWidth / 2
            const columnX1 = x(i) + bandWidth / 2
            const x0 = x(i) - barWidth / 2
            const x1 = x(i) + barWidth / 2
            // Søjlen hænger i nul-linjen begge veje: et overskud står på
            // den, et underskud under den. Højden er afstanden, og fortegnet
            // bærer den ikke — SVG kender ikke negativ højde.
            const edge = surplusY(surpluses[i]!)
            return (
              <g
                key={year.year}
                className="aarssoejler"
                onClick={() => onSelectYear(year.year)}
              >
                {/* Klikfeltet dækker begge paneler i fuld højde og ikke kun
                    søjlen selv: et år, der går næsten lige op, har næsten
                    ingen søjle at ramme — og året skal kunne rammes fra
                    begge paneler. */}
                <rect
                  className="aarsfelt"
                  x={columnX0}
                  y={MARGIN.top}
                  width={columnX1 - columnX0}
                  height={height - MARGIN.top - MARGIN.bottom}
                />
                {stacks[i]!.bands.map((band, bandIndex) => (
                  <rect
                    key={band.name}
                    data-band={band.name}
                    data-direction={band.direction}
                    data-year={year.year}
                    x={x0}
                    y={Math.min(bandY(band.from), bandY(band.to))}
                    width={x1 - x0}
                    height={Math.abs(bandY(band.to) - bandY(band.from))}
                    fill={surplusBandColor(bandIndex)}
                  />
                ))}
                <rect
                  className="overskudssoejle"
                  data-year={year.year}
                  x={x0}
                  y={Math.min(edge, surplusZero)}
                  width={x1 - x0}
                  height={Math.abs(edge - surplusZero)}
                  fill={surplusColor(surpluses[i]!)}
                />
              </g>
            )
          })}
          {/* Nul er den ene linje, en søjlegraf ikke må miste under sine
              egne søjler — den tegnes derfor igen her, ovenpå. */}
          <ZeroLine axis={bandAxis} y={bandY} right={right} />
          <ZeroLine axis={surplusAxis} y={surplusY} right={right} />
          <YearAxisMarks years={years} x={x} left={left} right={right} height={height} />
        </svg>
      </div>
      {/* Legenden navngiver båndene i stablingens egen rækkefølge, så en
          farve på skærmen kan slås op uden at gætte. Rækkefølgen er båndenes
          egen og ikke planens: den er den samme i hver plan, og legenden
          kan derfor skrives uden at se på et årsresultat. */}
      <ul className="graf-legend overskudsgraf-legend">
        {surplusBandOrder.map((band, bandIndex) => (
          <li key={band.name} data-band={band.name}>
            <span className="svatch" style={{ background: surplusBandColor(bandIndex) }} />
            {band.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

type Span = { bottom: number; top: number }

/** Værdiernes udstrækning, altid med nul-linjen indenfor. */
function span(values: number[]): Span {
  return { bottom: Math.min(0, ...values), top: Math.max(0, ...values) }
}

/** Panelets egen y-skala. Panelerne har hver sin, og deres to nul-linjer
    falder derfor ikke sammen — det er netop dét, der holder overskuddets
    fortegnsskift fra at forsvinde i båndenes skala. */
function panelScale(values: Span, panel: { top: number; bottom: number }) {
  return scaleLinear()
    .domain([values.bottom, values.top === values.bottom ? 1 : values.top])
    .range([panel.bottom, panel.top])
}
