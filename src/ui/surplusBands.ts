import type { Direction, Nominal, Plan } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'

/** De otte bånd, årets overskud består af. Faste og navngivne, aldrig ét pr.
    post: et antal, der fulgte planen, ville give hver plan sin egen graf, og
    et bånd kunne ikke følges med øjnene fra første til sidste år.

    Hvad et bånd består af, er afgjort af, hvad der bevæger sig på bufferen —
    ikke af, hvad ordet lyder som. ATP ligger derfor under indtægtsposterne
    og ikke under ydelserne, jf. ADR-0023, og beholdningsskatten ligger intet
    sted, fordi den bæres af beholdningen selv og aldrig passerer bufferen. */
export type SurplusBandName =
  | 'IncomeEntries'
  | 'Benefits'
  | 'Payouts'
  | 'TransfersIn'
  | 'Tax'
  | 'ExpenseEntries'
  | 'Contributions'
  | 'TransfersOut'

/** Ét bånd i ét simuleringsår. Beløbet er positivt i begge retninger —
    fortegnet er retningens arbejde, ganske som på en `Entry`. */
export type SurplusBand = {
  name: SurplusBandName
  label: string
  direction: Direction
  amount: Nominal
}

/** Båndene i den rækkefølge, stablingen og farvetildelingen bruger: de fire,
    der lægger til bufferen, og derefter de fire, der trækker fra.
    Rækkefølgen ligger fast hele horisonten igennem og uafhængigt af planen,
    så et bånd beholder sin plads i stablingen og sin farve.

    Navnene på skærmen er glossarets: `Entry`s to retninger, `Benefit`,
    `payout`, `Transfer` og `Contribution`. */
export const surplusBandOrder: { name: SurplusBandName; label: string; direction: Direction }[] = [
  { name: 'IncomeEntries', label: 'Indtægtsposter', direction: 'Income' },
  { name: 'Benefits', label: 'Ydelser', direction: 'Income' },
  { name: 'Payouts', label: 'Udbetalinger', direction: 'Income' },
  { name: 'TransfersIn', label: 'Overførsler ind', direction: 'Income' },
  { name: 'Tax', label: 'Skat', direction: 'Expense' },
  { name: 'ExpenseEntries', label: 'Udgiftsposter', direction: 'Expense' },
  { name: 'Contributions', label: 'Indbetalinger', direction: 'Expense' },
  { name: 'TransfersOut', label: 'Overførsler ud', direction: 'Expense' },
]

/** Hvad årets overskud består af, opdelt i de otte bånd. De fire opadgående
    minus de fire nedadgående er `surplus` for det samme år — det er hele
    pointen med opdelingen, og det er kun sandt, fordi hvert bånd er målt på
    den bevægelse, det rent faktisk gjorde på bufferen:

    - **Skatten** er husstandens egen. Beholdningsskatten trækkes fra igen:
      den er trukket af beholdningens saldo sammen med afkastet og passerer
      aldrig bufferen, jf. ADR-0026.
    - **Indbetalingen** er `intoHolding` og ikke `fromSource`. AM-delen
      forlod bufferen som en del af årets skat og ligger allerede i
      skattebåndet; talt med begge steder ville bidraget betales to gange.
    - **Overførslerne** tæller kun med, når den ene ende er bufferen. En
      flytning mellem to andre beholdninger rører den ikke og hverken løfter
      eller sænker årets overskud.

    Udledt af årsresultatet frem for gemt, ganske som `surplus` selv. */
export function surplusBands(year: YearResult, plan: Plan): SurplusBand[] {
  const amounts: Record<SurplusBandName, Nominal> = {
    IncomeEntries: entryTotal(year, plan, 'Income'),
    Benefits: benefitTotal(year),
    Payouts: sum(year.holdings, (holding) => holding.payout),
    TransfersIn: transferTotal(year, plan, ({ to }) => to === plan.buffer),
    Tax: year.tax - sum(year.holdings, (holding) => holding.tax),
    ExpenseEntries: entryTotal(year, plan, 'Expense'),
    Contributions: contributionTotal(year, plan),
    TransfersOut: transferTotal(year, plan, ({ from }) => from === plan.buffer),
  }

  return surplusBandOrder.map((band) => ({ ...band, amount: amounts[band.name] }))
}

function entryTotal(year: YearResult, plan: Plan, direction: Direction): Nominal {
  const directions = new Map(plan.entries.map((entry) => [entry.id, entry.direction]))
  return sum(year.entries, (entry) =>
    directions.get(entry.entry) === direction ? entry.amount : 0,
  )
}

/** Ydelserne er strømmene uden en saldo: folkepensionens grundbeløb og
    pensionstillæg, og hver omsat livrentes årlige ydelse. ATP er ingen af
    delene — den er en indtægtspost med brugerens eget tal fra PensionsInfo,
    jf. ADR-0023, og tælles derfor med de øvrige poster. */
function benefitTotal(year: YearResult): Nominal {
  return sum(year.persons, (person) => {
    const statePension = person.statePension
    return (
      (statePension ? statePension.basicAmount + statePension.pensionSupplement : 0) +
      sum(person.lifeAnnuityBenefits, (benefit) => benefit.amount)
    )
  })
}

function transferTotal(
  year: YearResult,
  plan: Plan,
  counts: (ends: { from: string; to: string }) => boolean,
): Nominal {
  const ends = new Map(plan.transfers.map((transfer) => [transfer.id, transfer]))
  return sum(year.transfers, (transfer) =>
    counts(ends.get(transfer.transfer)!) ? transfer.moved : 0,
  )
}

/** En `EntrySourced` indbetaling har altid bufferen som kilde: lønnen landede
    der først. En `HoldingSourced` har det kun, hvis kilden er bufferen selv
    — flytter den penge fra en anden beholdning, forlader de aldrig den, og
    årets overskud mærker det ikke. */
function contributionTotal(year: YearResult, plan: Plan): Nominal {
  const sources = new Map(
    plan.contributions.map((contribution) => [contribution.id, contribution]),
  )
  return sum(year.contributions, (contribution) => {
    const source = sources.get(contribution.contribution)!
    const fromBuffer = source.kind === 'EntrySourced' || source.source === plan.buffer
    return fromBuffer ? contribution.intoHolding : 0
  })
}

function sum<T>(items: T[], of: (item: T) => Nominal): Nominal {
  return items.reduce((total, item) => total + of(item), 0)
}
