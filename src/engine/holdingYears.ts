import type { Holding, HoldingId, Nominal } from './plan'
import type { HoldingYear } from './yearResult'

/** Årets beholdningsrækker under opbygning — én række pr. beholdning, ikke
    fire parallelle opslagstabeller over de samme beholdninger.

    Rækken bærer de fire tal, `HoldingYear` lukker om: primosaldoen, den
    vægtede strøm, saldoen som den står lige nu, og beholdningen selv, hvis
    satser afkastet regnes af. Afkastet gemmes ikke — det er udledt af primo
    og strøm og er derfor det samme, uanset hvornår i året man spørger.

    Beholdningerne er dem, bogen blev åbnet med, og ingen andre: et opslag på
    en beholdning, der ikke findes, er en peger, `validatePlan` skulle have
    fanget, og bliver et kast frem for en tavs NaN, jf. ADR-0013. */
export type HoldingYears = ReadonlyMap<HoldingId, Row>

type Row = {
  holding: Holding
  openingBalance: Nominal
  weightedFlow: Nominal
  balance: Nominal
}

/** Årets rækker åbnet på beholdningernes egne saldi — planens startår. */
export function fromBalances(holdings: Holding[]): HoldingYears {
  return open(holdings, (holding) => holding.balance)
}

/** Årets rækker åbnet på forrige års ultimosaldi. Det er hele det, der bæres
    fra år til år: rækkerne selv lukkes og lægges i årsresultatet. */
export function fromPreviousYear(holdings: Holding[], previous: HoldingYear[]): HoldingYears {
  const closing = new Map(previous.map((year) => [year.holding, year.closingBalance]))
  return open(holdings, (holding) => closing.get(holding.id) ?? holding.balance)
}

function open(holdings: Holding[], openingBalance: (holding: Holding) => Nominal): HoldingYears {
  return new Map(
    holdings.map((holding) => [
      holding.id,
      {
        holding,
        openingBalance: openingBalance(holding),
        weightedFlow: 0,
        balance: openingBalance(holding),
      },
    ]),
  )
}

/** Lægger en vægtet strøm til beholdningens afkastgrundlag, jf. ADR-0006.
    Strømmen flytter ikke saldoen — det gør `withMovement` — og den lægges
    oveni de strømme, der allerede er noteret. */
export function withFlow(years: HoldingYears, holding: HoldingId, weighted: Nominal): HoldingYears {
  return replace(years, holding, (row) => ({ ...row, weightedFlow: row.weightedFlow + weighted }))
}

/** Flytter beholdningens saldo. Årets restpost på bufferen og overførslernes
    fulde beløb er bevægelser; de rører ikke afkastgrundlaget, som allerede er
    noteret vægtet. */
export function withMovement(years: HoldingYears, holding: HoldingId, amount: Nominal): HoldingYears {
  return replace(years, holding, (row) => ({ ...row, balance: row.balance + amount }))
}

/** Beholdningens afkast i året: nettoafkastsatsen af primosaldoen plus årets
    vægtede strømme, jf. ADR-0006. Skatten spørger om det, før restposten er
    afregnet — og svaret er det samme før og efter, fordi hverken primo eller
    strøm ændrer sig af en bevægelse. */
export function returnOf(years: HoldingYears, holding: HoldingId): Nominal {
  return credited(row(years, holding))
}

/** Lukker året: afkastet krediteres, og rækkerne bliver til årsresultatets
    `HoldingYear`. */
export function closeYear(years: HoldingYears): HoldingYear[] {
  return [...years.values()].map((row) => ({
    holding: row.holding.id,
    openingBalance: row.openingBalance,
    closingBalance: row.balance + credited(row),
    return: credited(row),
    weightedFlow: row.weightedFlow,
  }))
}

function credited(row: Row): Nominal {
  return netReturn(row.holding) * (row.openingBalance + row.weightedFlow)
}

/** Nettoafkastsatsen er bruttoafkast minus ÅOP — udledt og aldrig et gemt
    felt, jf. CONTEXT.md. */
function netReturn(holding: Holding): number {
  return holding.grossReturn - holding.annualCostRate
}

function replace(years: HoldingYears, holding: HoldingId, change: (row: Row) => Row): HoldingYears {
  const next = new Map(years)
  next.set(holding, change(row(years, holding)))
  return next
}

function row(years: HoldingYears, holding: HoldingId): Row {
  const found = years.get(holding)
  if (found === undefined) {
    throw new Error(
      `Årets beholdningsrækker kender ikke beholdningen ${holding}. ` +
        `Planen skulle have været afvist ved indgangen, jf. ADR-0013.`,
    )
  }
  return found
}
