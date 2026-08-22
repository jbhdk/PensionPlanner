import { scaleLinear } from 'd3-scale'
import { area as d3Area, curveLinear } from 'd3-shape'
import type { Plan } from '../engine/plan'
import type { BufferState, YearResult } from '../engine/yearResult'
import { bufferStateClasses, bufferStateLabels } from './bufferState'
import {
  DataGlimpse,
  KroneAxisMarks,
  MARGIN,
  MINI_MARGIN,
  YearAxisMarks,
  YearCursor,
  kroneAxis,
  useMeasuredPlot,
  useYearCursor,
} from './chartFrame'
import { kroner } from './format'
import { holdingColor, orderedHoldings } from './palette'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'

// Båndene inde i et markeret spænd trækkes mod gråt og mørknes. Farve
// betyder "her holder planen", gråt at den ikke gør — og markeringen skal
// derfor ikke lægge en rød flade oven på dataene for at blive set.
const SPAN_SATURATION = 0.18
const SPAN_BRIGHTNESS = 0.7

// Spændets mærkat står i proportional skrift, hvor tegnbredden kun kan
// skønnes. Pladen under det må hellere være et hår for bred end for smal.
const SPAN_LABEL_CHAR_WIDTH = 5.3

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

    `mode` skelner hovedgraf fra mini-graf, jf. ADR-0033: en mini-graf har
    hverken akse, legend eller bufferspændets mærkatplade — kun formen. De
    to røde kant-streger og dæmpningen af båndene inde i spændet står der
    stadig, for de er en del af formen; det er kun teksten, der kræver en
    læsbar bredde, mini-grafen ikke har.

    Et klik hvor som helst i et års kolonne åbner forklar-året, samme
    mønster som Overskuddet og Fordelingen, jf. ADR-0038. Grafen har ikke
    længere sin egen valgmekanik — legenden navngiver stadig farverne, men
    reagerer ikke på klik, og grafen lytter ikke til et valg sat andre
    steder i fladen.

    Ingen fast højde eller bredde: grafen måles efter den plads,
    plotcontaineren faktisk har, og tegnes om ved vinduesskift og når
    inspektørskuffen åbner eller lukker, jf. `useMeasuredPlot`.
    `initialWidth`/`initialHeight` er kun det, der vises inden første
    måling. */
export function WealthChart({
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

  const holdings = orderedHoldings(plan.household)
  const n = years.length
  const M = mode === 'main' ? MARGIN : MINI_MARGIN

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

  // Stablingen har ingen negativ side — en tom buffer gulves ved nul — så
  // kroneaksen løber fra nul og op.
  const axis = kroneAxis(0, maxTop)
  // Mini-grafen har ingen mærkater at måle margenen på og bruger derfor sin
  // egen faste, minimale margen frem for `axis.left`s beregnede bredde.
  const left = mode === 'main' ? axis.left : M.left
  const right = width - M.right

  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([left, right])
  const y = scaleLinear()
    .domain([0, axis.domainTop])
    .range([height - M.bottom, M.top])

  const areaGenerator = d3Area<BandPoint>()
    .x((_d, i) => x(i))
    .y0((d) => y(d.y0))
    .y1((d) => y(d.y1))
    .curve(curveLinear)

  // Halvdelen af årsafstanden, så spændets markering dækker hele det
  // markerede år og ikke kun punktet midt i det.
  const halfStep = n > 1 ? (x(1) - x(0)) / 2 : 0

  // Spændets to kanter regnes ét sted: klipfladen, dæmpningen og markeringens
  // egne streger skal stå præcis samme sted.
  const spans = bufferSpans(years).map((span) => {
    const key = `${span.state}-${span.fromIndex}`
    return {
      ...span,
      key,
      clipId: `bufferstate-klip-${key}`,
      x0: Math.max(left, x(span.fromIndex) - halfStep),
      x1: Math.min(right, x(span.toIndex) + halfStep),
    }
  })

  // Dataglimtets rækker: alle beholdninger, også dem på 0 kr., i samme
  // rækkefølge som legenden, afsluttet med en sum-linje for den samlede
  // formue. Kun regnet, når musen rent faktisk står over et år.
  const glimpseRows =
    hoveredIndex === null
      ? []
      : holdings.map((holding, si) => ({
          key: holding.id,
          label: holding.name,
          value: `${kroner(bands[si]![hoveredIndex]!.y1 - bands[si]![hoveredIndex]!.y0)} kr.`,
          color: holdingColor(si),
        }))
  const glimpseTotal =
    hoveredIndex === null
      ? undefined
      : {
          key: 'i-alt',
          label: 'I alt',
          value: `${kroner(bands.at(-1)?.[hoveredIndex]?.y1 ?? 0)} kr.`,
        }

  // Båndene tegnes op til to gange i et markeret spænd — i deres egne farver
  // og dæmpet ovenpå — så formen ligger ét sted.
  const bandPaths = holdings.map((holding, si) => ({
    holding,
    color: holdingColor(si),
    path: areaGenerator(bands[si]!) ?? undefined,
  }))

  return (
    <div className="graf formuegraf" data-mode={mode}>
      <div className="graf-titel">
        <span className="navn">Formuen</span>
        {mode === 'main' && (
          <DataGlimpse index={hoveredIndex} rows={glimpseRows} total={glimpseTotal} />
        )}
      </div>
      <div className="graf-plot" ref={plotRef}>
        <svg role="img" aria-label="Formuegraf" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            {/* Dæmpningen er et filter og ikke en farve: båndene beholder
                deres egne nuancer, de trækkes bare mod gråt. */}
            <filter id="bufferstate-daempning">
              <feColorMatrix type="saturate" values={`${SPAN_SATURATION}`} />
              <feComponentTransfer>
                <feFuncR type="linear" slope={SPAN_BRIGHTNESS} />
                <feFuncG type="linear" slope={SPAN_BRIGHTNESS} />
                <feFuncB type="linear" slope={SPAN_BRIGHTNESS} />
              </feComponentTransfer>
            </filter>
            {spans.map((span) => (
              <clipPath key={span.clipId} id={span.clipId}>
                <rect
                  x={span.x0}
                  y={M.top}
                  width={span.x1 - span.x0}
                  height={height - M.top - M.bottom}
                />
              </clipPath>
            ))}
          </defs>
          {mode === 'main' && <KroneAxisMarks axis={axis} y={y} right={right} />}
          {bandPaths.map((band) => (
            <g key={band.holding.id}>
              <path
                data-holding={band.holding.id}
                d={band.path}
                fill={band.color}
                stroke="var(--flade)"
                strokeWidth={2}
              />
            </g>
          ))}
          {/* Dæmpningen inde i spændet: båndene tegnes om gennem filteret,
              der trækker dem mod gråt. */}
          {spans.map((span) => (
            <g
              key={`daempning-${span.key}`}
              clipPath={`url(#${span.clipId})`}
              filter="url(#bufferstate-daempning)"
            >
              {bandPaths.map((band) => (
                <g key={band.holding.id}>
                  <path
                    data-buffer-dimmed={band.holding.id}
                    d={band.path}
                    fill={band.color}
                    stroke="var(--flade)"
                    strokeWidth={2}
                  />
                </g>
              ))}
            </g>
          ))}
          {/* Markeringen selv, foran båndene: to røde kanter og et mærkat.
              Ingen flade over dataene — den ville tone båndenes farver, og
              farven er beholdningens identitet. */}
          {spans.map((span) => {
            const label = `${bufferStateLabels[span.state]} fra ${span.fromYear}`
            const plateWidth = label.length * SPAN_LABEL_CHAR_WIDTH + 8
            // Et spænd helt ude ved højre kant får sin plade skubbet ind, så
            // mærkatet ikke rager ud over viewBox'en.
            const plateX = Math.min(span.x0 + 1, right - plateWidth)
            return (
              <g
                key={span.key}
                data-buffer-state={span.state}
                className={`bufferstate-spaen ${bufferStateClasses[span.state]}`}
              >
                <line className="kant" x1={span.x0} x2={span.x0} y1={M.top} y2={height - M.bottom} />
                <line className="kant" x1={span.x1} x2={span.x1} y1={M.top} y2={height - M.bottom} />
                {/* Rød skrift direkte på et bånd er ikke til at læse, heller
                    ikke på et dæmpet — og mini-grafen har slet ikke bredden
                    til den, jf. ADR-0033. */}
                {mode === 'main' && (
                  <>
                    <rect
                      className="maerkatplade"
                      x={plateX}
                      y={M.top + 3}
                      width={plateWidth}
                      height={14}
                      rx={2}
                    />
                    <text x={plateX + 4} y={M.top + 13}>
                      {label}
                    </text>
                  </>
                )}
              </g>
            )
          })}
          {mode === 'main' && (
            <YearAxisMarks years={years} x={x} left={left} right={right} height={height} />
          )}
          {/* Klik hvor som helst i et års kolonne åbner forklar-året, samme
              mønster som Overskuddet og Fordelingen, jf. ADR-0038. Kun i
              hovedtilstand: mini-grafen bytter sig frem ved klik i stedet,
              jf. ADR-0033. */}
          {mode === 'main' && (
            <g onMouseLeave={leave}>
              {years.map((year, i) => (
                <g
                  key={year.year}
                  className="aarssoejler"
                  onClick={() => onSelectYear(year.year)}
                  onMouseEnter={() => enter(i)}
                >
                  <rect
                    className="aarsfelt"
                    x={Math.max(left, x(i) - halfStep)}
                    y={M.top}
                    width={Math.min(right, x(i) + halfStep) - Math.max(left, x(i) - halfStep)}
                    height={height - M.top - M.bottom}
                  />
                </g>
              ))}
            </g>
          )}
          {mode === 'main' && (
            <YearCursor
              index={hoveredIndex}
              years={years}
              x={x}
              top={M.top}
              bottom={height - M.bottom}
              left={left}
              right={right}
            />
          )}
        </svg>
      </div>
      {mode === 'main' && (
        <ul className="graf-legend formuegraf-legend">
          {holdings.map((holding, si) => (
            <li key={holding.id}>
              <span className="svatch" style={{ background: holdingColor(si) }} />
              {holding.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
