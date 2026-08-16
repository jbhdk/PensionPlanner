import { holdingTaxRate } from './holdingVariant'
import type { Holding, HoldingId, Nominal } from './plan'
import type { RateYear } from './rates/rateYear'
import type { HoldingYear } from './yearResult'

/** Årets beholdningsrækker, mens bogen er åben for vægtning — én række pr.
    beholdning, ikke parallelle opslagstabeller over de samme beholdninger.

    Bogen kan kun vejes. Den bærer primosaldoen, årets vægtede strøm og
    beholdningen selv, hvis satser afkastet skal regnes af, og den kender
    hverken en saldo, der kan flyttes, eller en udbetaling, der kan noteres.
    Årets penge flytter sig først i den anden fase, `CreditedHoldingYears`,
    og de to bøger deler ingen operationer, jf. ADR-0024.

    Beholdningerne er dem, bogen blev åbnet med, og ingen andre: et opslag på
    en beholdning, der ikke findes, er en peger, `validatePlan` skulle have
    fanget, og bliver et kast frem for en tavs NaN, jf. ADR-0013. */
export type HoldingYears = ReadonlyMap<HoldingId, Row>

type Row = {
  holding: Holding
  openingBalance: Nominal
  weightedFlow: Nominal
}

/** Årets beholdningsrækker efter afkastet er krediteret — bogen lukket for
    vægtning, jf. ADR-0024 og diagram 02.

    Afkastet og beholdningsskatten står som tal på rækken frem for at blive
    udledt, hver gang nogen spørger, og saldoen er primosaldoen med afkastet
    lagt til og skatten trukket fra. Herfra flytter året kun penge:
    overførslerne, indbetalingerne, raterne, den sidste rates fejning,
    omsætningen og årets restpost.

    Rækken har sluppet beholdningen selv og bærer kun dens id. Satserne er
    brugt op — afkastet er regnet — og der er intet tilbage at regne dem af.
    Det er også dét, der gør de to bøger uforvekslelige for oversætteren: en
    krediteret bog kan ikke vejes, fordi den ikke længere ved, hvad den
    skulle vejes med. Ringen, ADR-0024 bryder, bliver dermed umulig at skrive
    frem for blot fraværende. */
export type CreditedHoldingYears = ReadonlyMap<HoldingId, CreditedRow>

type CreditedRow = {
  holding: HoldingId
  openingBalance: Nominal
  weightedFlow: Nominal
  balance: Nominal
  payout: Nominal
  return: Nominal
  tax: Nominal
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
      { holding, openingBalance: openingBalance(holding), weightedFlow: 0 },
    ]),
  )
}

/** Beholdningernes saldi ved årets begyndelse. Et `OnBalance`-loft måler
    mod netop dem, og opgørelsen får dem som et bart kort frem for hele
    bogen: den skal kunne læse en primosaldo og ikke andet, og et kort af tal
    kan hverken vejes, flyttes eller lukkes ved en fejl. */
export function openingBalances(years: HoldingYears): ReadonlyMap<HoldingId, Nominal> {
  return new Map([...years].map(([id, row]) => [id, row.openingBalance]))
}

/** Lægger en vægtet strøm til beholdningens afkastgrundlag, jf. ADR-0006.
    Strømmen lægges oveni de strømme, der allerede er noteret, og den flytter
    ingen saldo — bogen har ingen endnu. */
export function withFlow(years: HoldingYears, holding: HoldingId, weighted: Nominal): HoldingYears {
  return replace(years, holding, (row) => ({ ...row, weightedFlow: row.weightedFlow + weighted }))
}

/** Krediterer afkastet og trækker beholdningsskatten af det: bogen lukkes
    for vægtning, og året kan herfra kun flytte penge.

    Det er dét trin, diagram 02 lægger umiddelbart efter de daterede
    bevægelser. Alt, hvad der kommer nedenunder — folkepensionen,
    aftrapningen, skatten og årets restpost — kan ikke nå afkastgrundlaget,
    fordi der ikke længere findes en bog, der vil tage imod en vægtning, jf.
    ADR-0024.

    Afkastet står brutto på rækken; det er saldoen, skatten er trukket af. */
export function creditReturn(years: HoldingYears, rates: RateYear): CreditedHoldingYears {
  return new Map(
    [...years].map(([id, row]) => {
      const credited = returnOn(row)
      const tax = holdingTax(row.holding, credited, rates)
      return [
        id,
        {
          holding: id,
          openingBalance: row.openingBalance,
          weightedFlow: row.weightedFlow,
          balance: row.openingBalance + credited - tax,
          payout: 0,
          return: credited,
          tax,
        },
      ]
    }),
  )
}

/** Flytter beholdningens saldo. Overførslernes fulde beløb, indbetalingerne
    og årets restpost på bufferen er bevægelser, og de rører intet
    afkastgrundlag: det er regnet færdigt, og bogen bærer et tal frem for en
    beregning, der kunne flytte sig. */
export function withMovement(
  years: CreditedHoldingYears,
  holding: HoldingId,
  amount: Nominal,
): CreditedHoldingYears {
  return replace(years, holding, (row) => ({ ...row, balance: row.balance + amount }))
}

/** Tømmer beholdningen med årets udbetaling: saldoen falder, og beløbet
    noteres på rækken. To handlinger i én, fordi de aldrig må ske hver for
    sig — en bevægelse uden en note ville lade `HoldingYear.payout` sige
    noget andet end saldoen, og en note uden en bevægelse ville lade pengene
    blive stående.

    Lægges oveni det, der allerede er udbetalt, så det sidste udbetalingsårs
    fejning kan komme som sit eget kald og alligevel stå i ét tal, jf.
    `HoldingYear.payout`. */
export function withPayout(
  years: CreditedHoldingYears,
  holding: HoldingId,
  amount: Nominal,
): CreditedHoldingYears {
  return replace(years, holding, (row) => ({
    ...row,
    balance: row.balance - amount,
    payout: row.payout + amount,
  }))
}

/** Beholdningens saldo, som den står lige nu — afkastet tilskrevet og
    beholdningsskatten trukket, siden bogen er krediteret.

    Det er dét, den sidste rate og omsætningen fejer med. Fejningen sker
    efter afkastet og kan derfor ikke flytte det grundlag, den selv er regnet
    af — ingen cirkularitet, og rækkefølgen i diagram 02 holder. */
export function balanceOf(years: CreditedHoldingYears, holding: HoldingId): Nominal {
  return row(years, holding).balance
}

/** Beholdningens afkast i året, brutto. Skatteopgørelsen spørger om det, før
    restposten er afregnet — og svaret er det samme før og efter, fordi det
    er et tal på rækken og ikke en beregning, en bevægelse kan røre. */
export function returnOf(years: CreditedHoldingYears, holding: HoldingId): Nominal {
  return row(years, holding).return
}

/** Lukker året: rækkerne bliver til årsresultatets `HoldingYear`. Afkastet
    og skatten står der allerede fra krediteringen, og ultimosaldoen er
    saldoen, som årets bevægelser efterlod den. */
export function closeYear(years: CreditedHoldingYears): HoldingYear[] {
  return [...years.values()].map((row) => ({
    holding: row.holding,
    openingBalance: row.openingBalance,
    closingBalance: row.balance,
    return: row.return,
    tax: row.tax,
    payout: row.payout,
    weightedFlow: row.weightedFlow,
  }))
}

/** Beholdningsskatten af årets afkast: satsen slås op på varianten og hentes
    i satsåret. Nul, når varianten ingen har.

    Et negativt afkast giver en negativ skat, og det er med vilje: der er
    hverken gulv eller advarsel. Et negativt PAL-afkast er fremførbart og
    bliver før eller siden til penge tilbage, så at lade tabsåret give en
    negativ skat er en timingforenkling af samme slags som den, personskatten
    allerede hviler på. Læg ikke et `Math.max(0, …)` her. */
function holdingTax(holding: Holding, credited: Nominal, rates: RateYear): Nominal {
  const rate = holdingTaxRate(holding)
  return rate === undefined ? 0 : credited * rates.taxRates[rate]
}

/** Afkastet af nettoafkastsatsen ganget med primosaldoen plus årets vægtede
    strømme, jf. ADR-0006. Regnes én gang, i krediteringen. */
function returnOn(row: Row): Nominal {
  return netReturn(row.holding) * (row.openingBalance + row.weightedFlow)
}

/** Nettoafkastsatsen er bruttoafkast minus ÅOP — udledt og aldrig et gemt
    felt, jf. CONTEXT.md. */
function netReturn(holding: Holding): number {
  return holding.grossReturn - holding.annualCostRate
}

function replace<R>(
  years: ReadonlyMap<HoldingId, R>,
  holding: HoldingId,
  change: (row: R) => R,
): ReadonlyMap<HoldingId, R> {
  const next = new Map(years)
  next.set(holding, change(row(years, holding)))
  return next
}

function row<R>(years: ReadonlyMap<HoldingId, R>, holding: HoldingId): R {
  const found = years.get(holding)
  if (found === undefined) {
    throw new Error(
      `Årets beholdningsrækker kender ikke beholdningen ${holding}. ` +
        `Planen skulle have været afvist ved indgangen, jf. ADR-0013.`,
    )
  }
  return found
}
