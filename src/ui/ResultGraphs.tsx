import type { Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import type { AmountUnit } from './real'
import type { Selection } from './selection'
import { SurplusBandsChart } from './SurplusBandsChart'
import { SurplusChart } from './SurplusChart'
import { WealthChart } from './WealthChart'

/** De tre grafer, planlæggeren kan vise. Fast rækkefølge — den, mini-
    graferne står i, når en anden er hovedgraf. */
export type MainGraph = 'Wealth' | 'Fordeling' | 'Overskud'
const GRAPHS: MainGraph[] = ['Wealth', 'Fordeling', 'Overskud']

/** Graf-laget: én hovedgraf til venstre, to mini-grafer stablet i en søjle
    til højre, jf. ADR-0034 (afløser arrangementet fra ADR-0033). Alle tre er
    synlige samtidig — modsat den tidligere omskifter, der viste én ad
    gangen. Klikker man en mini-graf, bytter den plads med hovedgrafen; den
    anden mini rører sig ikke. De to mini-pladser har derfor ingen egen
    identitet, kun de tre grafer har.

    `mainGraph` er løftet til den ejende komponent, ligesom `selected` er
    det for `WealthChart` — så et helt kasseret plan nulstiller den samme
    vej som resten af resultatspaltens tilstand. */
export function ResultGraphs({
  years,
  plan,
  unit,
  selected,
  onSelect,
  onSelectYear,
  mainGraph,
  onMainGraphChange,
}: {
  years: YearResult[]
  plan: Plan
  unit: AmountUnit
  selected: Selection
  onSelect: (selection: Selection) => void
  onSelectYear: (year: number) => void
  mainGraph: MainGraph
  onMainGraphChange: (graph: MainGraph) => void
}) {
  const minis = GRAPHS.filter((graph) => graph !== mainGraph)

  function graph(kind: MainGraph, mode: 'main' | 'mini') {
    switch (kind) {
      case 'Wealth':
        return (
          <WealthChart
            years={years}
            plan={plan}
            unit={unit}
            selected={selected}
            onSelect={onSelect}
            mode={mode}
          />
        )
      case 'Fordeling':
        return (
          <SurplusBandsChart
            years={years}
            plan={plan}
            unit={unit}
            onSelectYear={onSelectYear}
            mode={mode}
          />
        )
      case 'Overskud':
        return (
          <SurplusChart years={years} plan={plan} unit={unit} onSelectYear={onSelectYear} mode={mode} />
        )
    }
  }

  return (
    <div className="graf-lag">
      <div className="hovedgraf-plads">{graph(mainGraph, 'main')}</div>
      <div className="mini-graferne">
        {minis.map((kind) => (
          <button
            key={kind}
            type="button"
            className="byt-knap"
            onClick={() => onMainGraphChange(kind)}
          >
            {graph(kind, 'mini')}
          </button>
        ))}
      </div>
    </div>
  )
}
