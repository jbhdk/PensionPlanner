import { scaleLinear } from 'd3-scale'
import { area as d3Area, curveLinear } from 'd3-shape'
import { useEffect, useRef, useState } from 'react'
import { isFreeAssets } from '../engine/holdingVariant'
import type { Plan } from '../engine/plan'
import type { BufferState, YearResult } from '../engine/yearResult'
import { bufferStateClasses, bufferStateLabels } from './bufferState'
import { kroner, millioner } from './format'
import { holdingColor, orderedHoldings } from './holdingPalette'
import type { AmountUnit } from './real'
import { toDisplayKroner } from './real'
import type { Selection, Target } from './selection'
import { sameSelection } from './selection'

// Top og bund har hver sin ekstra linje til aksens navn: enheden over
// y-mærkaterne, tidsenheden under årstallene. Uden dem er det tal på en akse,
// og læseren må gætte, hvad de tæller.
const MARGIN = { top: 22, right: 8, bottom: 34, left: 58 }

// Aksemærkaterne står i monospace ved 10 px, hvor hvert tegn fylder 0,6 em.
// Margenen kan derfor udmåles af mærkatets længde frem for at måles i DOM'en.
const LABEL_CHAR_WIDTH = 6
const LABEL_GAP = 10

// Tidsenheden er simuleringsåret, og x-aksen tæller ét pr. punkt.
const X_AXIS_NAME = 'år'

// Et fravalgt bånd i legenden træder tilbage, men forsvinder ikke.
const DESELECTED_OPACITY = 0.28

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

  // Y-aksens gitterlinjer trappes i pæne trin (en halv tierpotens ad
  // gangen), som mockuppens tegnFormuegraf().
  const yStep = 10 ** Math.floor(Math.log10(maxTop)) / 2
  const yTicks: number[] = []
  for (let v = 0; v <= maxTop; v += yStep) yTicks.push(v)

  // Hele kroner fylder mere, end margenen har plads til, så snart formuen
  // løber op i millioner, og det yderste ciffer blev klippet af viewBox'ens
  // venstre kant. Går aksen over en million, skrives den derfor i millioner,
  // som mockuppens tegnFormuegraf() — og margenen udmåles efter det længste
  // mærkat, så et ciffer mere aldrig kan skubbe teksten ud over kanten igen.
  const inMillions = maxTop >= 1_000_000
  const yLabels = yTicks.map((v) => (inMillions ? millioner(v) : kroner(v)))

  // Aksens navn siger, hvad tallene tæller — og i hvilken størrelsesorden,
  // siden mærkaterne skifter til millioner. Hvilke kroner det er, dagens
  // eller årets egne, står i omskifteren over grafen og gentages ikke her.
  const yAxisName = inMillions ? 'mio. kr.' : 'kr.'

  const longestLabel = Math.max(0, ...[...yLabels, yAxisName].map((label) => label.length))
  const left = Math.max(MARGIN.left, longestLabel * LABEL_CHAR_WIDTH + LABEL_GAP)

  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([left, width - MARGIN.right])
  const y = scaleLinear()
    .domain([0, maxTop])
    .range([height - MARGIN.bottom, MARGIN.top])

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
      x1: Math.min(width - MARGIN.right, x(span.toIndex) + halfStep),
    }
  })

  // Båndene tegnes op til tre gange i et markeret spænd — i deres egne farver,
  // slukket mod fladen og dæmpet ovenpå — så formen ligger ét sted.
  const bandPaths = holdings.map((holding, si) => ({
    holding,
    color: holdingColor(si),
    path: areaGenerator(bands[si]!) ?? undefined,
    free: isFreeAssets(holding),
    opacity:
      selected?.kind === 'holding' && selected.id !== holding.id ? DESELECTED_OPACITY : 1,
  }))

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
          <defs>
            {/* Skellet mellem bundne beholdninger og frie midler skal kunne
                ses uden at læse legenden. Stregerne har fladens egen
                baggrundsfarve, som båndene i forvejen er adskilt med. */}
            <pattern
              id="skravering"
              patternUnits="userSpaceOnUse"
              width={8}
              height={8}
              patternTransform="rotate(45)"
            >
              <line x1={0} y1={0} x2={0} y2={8} stroke="var(--flade)" strokeWidth={2.5} />
            </pattern>
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
                  y={MARGIN.top}
                  width={span.x1 - span.x0}
                  height={height - MARGIN.top - MARGIN.bottom}
                />
              </clipPath>
            ))}
          </defs>
          <g className="formuegraf-akse-y">
            {/* Enheden står over mærkatsøjlen og er højrestillet som den, så
                den læses som søjlens overskrift. */}
            <text className="aksenavn" x={left - 6} y={MARGIN.top - 8} textAnchor="end">
              {yAxisName}
            </text>
            {yTicks.map((v, i) => (
              <g key={v}>
                <line
                  x1={left}
                  x2={width - MARGIN.right}
                  y1={y(v)}
                  y2={y(v)}
                  className={v === 0 ? 'basislinje' : 'gitterlinje'}
                />
                <text x={left - 6} y={y(v) + 3.5} textAnchor="end">
                  {yLabels[i]}
                </text>
              </g>
            ))}
          </g>
          {bandPaths.map((band) => (
            <g key={band.holding.id}>
              <path
                data-holding={band.holding.id}
                data-free-assets={band.free}
                d={band.path}
                fill={band.color}
                fillOpacity={band.opacity}
                stroke="var(--flade)"
                strokeWidth={2}
              />
              {/* Skraveringen ligger oven på beholdningens egen farve frem
                  for at erstatte den: farven siger hvilken beholdning,
                  skraveringen at den er bundet. */}
              {!band.free && (
                <path
                  data-hatch={band.holding.id}
                  d={band.path}
                  fill="url(#skravering)"
                  fillOpacity={band.opacity}
                  stroke="none"
                />
              )}
            </g>
          ))}
          {/* Dæmpningen inde i spændet. Begge lag gælder: spændet tager
              mætningen, legendens valg tager dækningen — et fravalgt bånd i et
              markeret spænd er altså både gråt og trådt tilbage. */}
          {spans.map((span) => (
            <g key={`daempning-${span.key}`} clipPath={`url(#${span.clipId})`}>
              {/* Et dæmpet bånd oven på et mættet blander sig med farven
                  nedenunder frem for at erstatte den. De fravalgte slukkes
                  derfor først i fladens egen farve, så kopien lægger sig på
                  ren bund. */}
              {bandPaths
                .filter((band) => band.opacity < 1)
                .map((band) => (
                  <path
                    key={band.holding.id}
                    d={band.path}
                    fill="var(--flade)"
                    stroke="var(--flade)"
                    strokeWidth={2}
                  />
                ))}
              <g filter="url(#bufferstate-daempning)">
                {bandPaths.map((band) => (
                  <g key={band.holding.id}>
                    <path
                      data-buffer-dimmed={band.holding.id}
                      d={band.path}
                      fill={band.color}
                      fillOpacity={band.opacity}
                      stroke="var(--flade)"
                      strokeWidth={2}
                    />
                    {!band.free && (
                      <path
                        d={band.path}
                        fill="url(#skravering)"
                        fillOpacity={band.opacity}
                        stroke="none"
                      />
                    )}
                  </g>
                ))}
              </g>
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
            const plateX = Math.min(span.x0 + 1, width - MARGIN.right - plateWidth)
            return (
              <g
                key={span.key}
                data-buffer-state={span.state}
                className={`bufferstate-spaen ${bufferStateClasses[span.state]}`}
              >
                <line
                  className="kant"
                  x1={span.x0}
                  x2={span.x0}
                  y1={MARGIN.top}
                  y2={height - MARGIN.bottom}
                />
                <line
                  className="kant"
                  x1={span.x1}
                  x2={span.x1}
                  y1={MARGIN.top}
                  y2={height - MARGIN.bottom}
                />
                {/* Rød skrift direkte på et bånd er ikke til at læse, heller
                    ikke på et dæmpet. */}
                <rect
                  className="maerkatplade"
                  x={plateX}
                  y={MARGIN.top + 3}
                  width={plateWidth}
                  height={14}
                  rx={2}
                />
                <text x={plateX + 4} y={MARGIN.top + 13}>
                  {label}
                </text>
              </g>
            )
          })}
          <g className="formuegraf-akse-x">
            {xTicks.map((yearTick) => {
              const index = yearTick - years[0]!.year
              // Tæt på højre kant ankres årstallet til højre i stedet for at
              // centreres, så det ikke rager ud over viewBox'en.
              const anchor = x(index) > width - MARGIN.right - 20 ? 'end' : 'middle'
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
            {/* Tidsenheden står midt under årstallene, hvor den ikke kan
                forveksles med et af dem. */}
            <text
              className="aksenavn"
              x={(left + width - MARGIN.right) / 2}
              y={height - 6}
              textAnchor="middle"
            >
              {X_AXIS_NAME}
            </text>
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
                <span
                  className="svatch"
                  data-free-assets={isFreeAssets(holding)}
                  style={{ background: holdingColor(si) }}
                />
                {holding.name}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
