import {
  bearsPayoutSchedule,
  isEmployerAdministered,
  isFreeAssets,
  isPensionScheme,
  isPensionSchemeVariant,
  payoutScheduleOf,
  payoutTaxation,
} from '../engine/holdingVariant'
import { isLifeAnnuity, newLifeAnnuity } from '../engine/lifeAnnuity'
import type { LifeAnnuityHolding } from '../engine/lifeAnnuity'
import { periodBounds } from '../engine/age'
import { boundValue, minimumPayoutYears, periodEndpointBounds } from '../engine/validatePlan'
import { clampBy } from './fields'
import type { Clamp } from './fields'
import type {
  AgeBound,
  Allocation,
  AllocationLine,
  Contribution,
  Direction,
  Entry,
  Holding,
  HoldingSourcedContribution,
  HoldingVariant,
  IncomeEntry,
  PayoutSchedule,
  PensionAgreement,
  PensionSchemeHolding,
  Period,
  Person,
  Plan,
  Transfer,
} from '../engine/plan'

/** Redigeringerne er rene: de bygger en ny plan frem for at rette i den
    gamle. Motoren er en ren funktion, og en muteret plan ville gøre det
    umuligt at se, hvad der faktisk ændrede sig. */

export function withPerson(
  plan: Plan,
  id: string,
  change: (person: Person) => Person,
): Plan {
  return {
    ...plan,
    household: {
      persons: plan.household.persons.map((person) =>
        person.id === id ? change(person) : person,
      ),
    },
  }
}

export function withHolding(
  plan: Plan,
  id: string,
  change: (holding: Holding) => Holding,
): Plan {
  return {
    ...plan,
    household: {
      persons: plan.household.persons.map((person) => ({
        ...person,
        holdings: person.holdings.map((holding) =>
          holding.id === id ? change(holding) : holding,
        ),
      })),
    },
  }
}

export function withEntry(
  plan: Plan,
  id: string,
  change: (entry: Entry) => Entry,
): Plan {
  return {
    ...plan,
    entries: plan.entries.map((entry) =>
      entry.id === id ? change(entry) : entry,
    ),
  }
}

/** Den tyndeste person, der kan tilføjes: fødselsåret gættes fyrre år før
    startåret, og resten er de samme standarder, minimumsplanen selv bærer —
    Silkeborg og ingen kirkeskat. De to skal blive ved med at være ens, for
    ellers ville husstandens skat afhænge af, om personen kom med planen
    eller blev tilføjet bagefter. Brugeren retter dem i skuffen. */
export function addPerson(plan: Plan): Plan {
  const id = freshPersonId(plan)
  const name = `Person ${plan.household.persons.length + 1}`

  return {
    ...plan,
    household: {
      persons: [
        ...plan.household.persons,
        {
          id,
          name,
          birthYear: plan.startYear - 40,
          birthMonth: 1,
          workEndAge: 65,
          horizon: 90,
          municipality: 'Silkeborg',
          churchMember: false,
          holdings: [],
        },
      ],
    },
  }
}

/** Fjerner personen, dennes beholdninger med (de er nestet under personen),
    posterne der peger på personen som ejer, og overførslerne der peger på
    personens beholdninger, og indbetalingerne i begge ender — ellers ville
    motoren støde på en peger, der ikke rammer noget, jf. ADR-0013. Var personens beholdning bufferen, arver den
    første tilbageværende beholdning rollen, så planen forbliver regnbar. */
export function removePerson(plan: Plan, id: string): Plan {
  const persons = plan.household.persons.filter((person) => person.id !== id)
  const buffer = inheritedBuffer(plan, persons)

  const gone = new Set(
    (plan.household.persons.find((person) => person.id === id)?.holdings ?? []).map(
      (holding) => holding.id,
    ),
  )
  const goneEntries = new Set(
    plan.entries.filter((entry) => entry.owner === id).map((entry) => entry.id),
  )

  return {
    ...plan,
    buffer,
    household: { persons },
    entries: plan.entries.filter((entry) => entry.owner !== id),
    transfers: plan.transfers.filter(
      (transfer) => !gone.has(transfer.from) && !gone.has(transfer.to),
    ),
    contributions: plan.contributions.filter(
      (contribution) =>
        !gone.has(contribution.to) && !goneEntries.has(contribution.source),
    ),
  }
}

function freshPersonId(plan: Plan): string {
  const existing = new Set(plan.household.persons.map((person) => person.id))
  let n = 1
  while (existing.has(`person-${n}`)) n++
  return `person-${n}`
}

export function findPerson(plan: Plan, id: string): Person | undefined {
  return plan.household.persons.find((person) => person.id === id)
}

export function findHolding(plan: Plan, id: string): Holding | undefined {
  return plan.household.persons
    .flatMap((person) => person.holdings)
    .find((holding) => holding.id === id)
}

/** Den tyndeste beholdning, der kan tilføjes: nul saldo og nul afkast, så den
    ikke lover en investeringsantagelse, brugeren ikke har tastet. Lander hos
    husstandens første person — "Ejer"-vælgeren i skuffen flytter den siden. */
export function addHolding(plan: Plan): Plan {
  const owner = plan.household.persons[0]
  if (!owner) return plan

  const count = plan.household.persons.flatMap((person) => person.holdings).length
  const holding: Holding = {
    id: freshHoldingId(plan),
    name: `Beholdning ${count + 1}`,
    variant: 'SavingsAccount',
    balance: 0,
    grossReturn: 0,
    annualCostRate: 0,
  }

  return withPerson(plan, owner.id, (person) => ({
    ...person,
    holdings: [...person.holdings, holding],
  }))
}

/** Fjerner beholdningen, overførslerne der peger på den (en overførsel uden
    begge ender ville flytte penge fra eller til et ingenting), indbetalingerne
    der havde den som destination, og fordelingslinjerne i enhver
    pensionsaftale der peger på den, jf. ADR-0046. Var
    beholdningen bufferen, arver den første tilbageværende beholdning rollen,
    ligesom ved `removePerson` — findes ingen, peger bufferen videre på et
    tomrum, og resultatspalten viser det som en simuleringsfejl frem for at
    styrte. */
export function removeHolding(plan: Plan, id: string): Plan {
  const persons = plan.household.persons.map((person) => ({
    ...person,
    holdings: person.holdings.filter((holding) => holding.id !== id),
  }))
  const buffer = inheritedBuffer(plan, persons)

  return {
    ...plan,
    buffer,
    household: { persons },
    entries: plan.entries.map((entry) =>
      entry.direction === 'Income' && entry.pensionAgreement
        ? {
            ...entry,
            pensionAgreement: {
              ...entry.pensionAgreement,
              allocation: allocationWithoutHolding(entry.pensionAgreement.allocation, id),
            },
          }
        : entry,
    ),
    transfers: plan.transfers.filter((transfer) => transfer.from !== id && transfer.to !== id),
    contributions: plan.contributions.filter((contribution) => contribution.to !== id),
  }
}

/** Fordelingen uden linjen til den slettede beholdning. Var den restlinjen,
    overtager den første tilbageværende linje rollen og mister i samme greb
    sit eget tal — der findes ingen `AllocationShare`-form, der er både
    `Remainder` og husker en procent eller et kronebeløb. Er den den eneste
    linje, ender fordelingen med nul restlinjer, og `validatePlan` melder det
    ligesom den allerede gør, når bufferen mister sin sidste frie beholdning,
    jf. ADR-0046. */
function allocationWithoutHolding(allocation: Allocation, id: string): Allocation {
  const removed = allocation.find((line) => line.to === id)
  const rest = allocation.filter((line) => line.to !== id)
  if (removed?.form !== 'Remainder' || rest.length === 0) return rest

  const [first, ...others] = rest
  return [{ to: first!.to, form: 'Remainder' }, ...others]
}

/** Bufferpegeren efter en sletning: den samme, hvis beholdningen stadig
    findes, ellers de første tilbageværende frie midler. En pensionsbeholdning
    kan ikke arve rollen — bufferen bærer årets restpost, og penge ind i en
    ordning er en indbetaling, jf. ADR-0016. Findes ingen frie midler, peger
    bufferen videre på et tomrum, og resultatspalten viser det som en
    simuleringsfejl frem for at styrte. */
function inheritedBuffer(plan: Plan, persons: Person[]): string {
  const remaining = persons.flatMap((person) => person.holdings)
  if (remaining.some((holding) => holding.id === plan.buffer)) return plan.buffer
  return remaining.find(isFreeAssets)?.id ?? plan.buffer
}

function freshHoldingId(plan: Plan): string {
  const existing = new Set(
    plan.household.persons.flatMap((person) => person.holdings.map((holding) => holding.id)),
  )
  let n = 1
  while (existing.has(`holding-${n}`)) n++
  return `holding-${n}`
}

/** Personen, hvis `holdings` netop nu rummer beholdningen. Ejerskab er
    nesting, ikke et felt på `Holding` — se domænemodellen. */
export function findHoldingOwner(plan: Plan, holdingId: string): Person | undefined {
  return plan.household.persons.find((person) =>
    person.holdings.some((holding) => holding.id === holdingId),
  )
}

/** Flytter en beholdning til en anden person: ud af den gamle ejers
    `holdings`, ind i den nyes. Beholdningen selv rører sig ikke. */
/** Redigerer en beholdning, der er en pensionsordning, og lader den stå, hvis
    den ikke er en. Formen findes, fordi `withHolding` giver hele unionen ind:
    et oprettelsestidspunkt skrevet dér ville være et felt, halvdelen af
    varianterne ikke har, og skuffen ville skulle caste sig ud af det. */
export function withPensionScheme(
  plan: Plan,
  id: string,
  change: (holding: PensionSchemeHolding) => PensionSchemeHolding,
): Plan {
  return withHolding(plan, id, (holding) =>
    isPensionScheme(holding) ? change(holding) : holding,
  )
}

/** Lægger en udbetalingsplan på beholdningen. Starten er den tidligste, loven
    tillader, varigheden den korteste, og princippet det, der kan forstås uden
    en sats — de tre er ikke et gæt på, hvad brugeren vil, men det eneste sæt,
    der med sikkerhed er lovligt, uanset hvornår ordningen må udbetales.
    Brugeren retter dem i skuffen ved siden af.

    Beholdninger, der ikke kan bære en plan, står urørt: knappen tilbydes
    aldrig for dem, og reglen spørger varianttabellen frem for at nævne
    ratepensionen ved navn, jf. ADR-0010. */
export function addPayoutSchedule(plan: Plan, id: string, start: AgeBound): Plan {
  return withHolding(plan, id, (holding) =>
    bearsPayoutSchedule(holding)
      ? {
          ...holding,
          payout: { start, duration: minimumPayoutYears, principle: 'SerialPrinciple' },
        }
      : holding,
  )
}

/** Fjerner udbetalingsplanen igen. Feltet forsvinder helt frem for at stå som
    `undefined`: et felt, der ligger og venter i det gemte skema, er en løgn,
    der aldrig fejler, jf. ADR-0015. */
/** Lægger en udbetalingsstart på livrenten — det tidspunkt, depotet
    omsættes på. Der er hverken en varighed eller et princip at sætte: ydelsen
    er livsvarig, jf. ADR-0009.

    Starten er ordningens tidligste lovlige, af samme grund som
    ratepensionens: det ene tidspunkt, der med sikkerhed er lovligt, uanset
    hvornår ordningen må udbetales. */
export function addPayoutStart(plan: Plan, id: string, start: AgeBound): Plan {
  return withLifeAnnuity(plan, id, (holding) => ({ ...holding, payout: { start } }))
}

/** Fjerner udbetalingsstarten igen. Livrenten bliver stående og vokser, som
    en ratepension uden plan — de to oplyste tal bliver, for de hører til
    ordningen og ikke til beslutningen om, hvornår den skal omsættes. */
export function removePayoutStart(plan: Plan, id: string): Plan {
  return withLifeAnnuity(plan, id, ({ payout: _payout, ...rest }) => rest)
}

/** Retter en livrente. Er beholdningen ikke en, står den urørt: de tre
    omsætningsfelter hænger på dens eget medlem af unionen og kan ikke
    skrives på nogen anden variant. */
export function withLifeAnnuity(
  plan: Plan,
  id: string,
  change: (holding: LifeAnnuityHolding) => Holding,
): Plan {
  return withHolding(plan, id, (holding) =>
    isLifeAnnuity(holding) ? change(holding) : holding,
  )
}

export function removePayoutSchedule(plan: Plan, id: string): Plan {
  return withHolding(plan, id, (holding) => {
    if (!bearsPayoutSchedule(holding)) return holding
    const { payout: _payout, ...rest } = holding
    return rest
  })
}

/** Redigerer en beholdnings udbetalingsplan, og lader beholdningen stå, hvis
    den ingen har. Samme form og samme grund som `withPensionScheme`:
    `withHolding` giver hele unionen ind, og en plan skrevet dér ville være et
    felt, seks af syv varianter ikke har. */
export function withPayoutSchedule(
  plan: Plan,
  id: string,
  change: (payout: PayoutSchedule) => PayoutSchedule,
): Plan {
  return withHolding(plan, id, (holding) => {
    const payout = payoutScheduleOf(holding)
    return bearsPayoutSchedule(holding) && payout !== undefined
      ? { ...holding, payout: change(payout) }
      : holding
  })
}

/** Skifter beholdningens variant, og flytter med det de felter, den nye
    variant har og den gamle ikke havde — eller omvendt.

    Bliver beholdningen en pensionsordning, skal den have en
    pensionsudbetalingsalder: den lander på nul, ligesom livrentens to
    oplyste tal gør ved samme skifte, og brugeren taster det, selskabet
    oplyser, i skuffen ved siden af. Bliver den til noget, der ikke er en
    ordning, forsvinder alderen igen — et felt, varianten ikke har, må ikke
    ligge og vente i det gemte skema.

    Skiftet fra én ordning til en anden bevarer den: det ændrer
    beskatningen på vejen ud, ikke hvornår ordningen tidligst må udbetales. */
export function withVariant(plan: Plan, id: string, variant: HoldingVariant): Plan {
  return withHolding(plan, id, (holding) => {
    // Grundformen skrives ud felt for felt frem for at blive skrabet af det,
    // beholdningen var. Et restfelt, ingen huskede at tage med, ville følge
    // med over på en variant, der ikke har det — en udbetalingsplan på en
    // opsparingskonto, eller et oplyst depot på en ratepension — og et dødt
    // felt i det gemte skema er en løgn, der aldrig fejler.
    const base = {
      id: holding.id,
      name: holding.name,
      balance: holding.balance,
      grossReturn: holding.grossReturn,
      annualCostRate: holding.annualCostRate,
    }
    if (!isPensionSchemeVariant(variant)) return { ...base, variant }

    const scheme = {
      ...base,
      payoutAge: isPensionScheme(holding) ? holding.payoutAge : 0,
    }
    // De tre omsætningsfelter er livrentens egne. Bliver beholdningen en
    // livrente, skal den have dem — er den det allerede, står de urørt.
    if (variant !== 'LifeAnnuity') return { ...scheme, variant }
    return { ...scheme, variant, ...(isLifeAnnuity(holding) ? quoteOf(holding) : newLifeAnnuity) }
  })
}

/** Livrentens tre omsætningsfelter, læst af en livrente. Skrevet ud som
    `newLifeAnnuity`s modstykke, så et felt, der kommer til, ikke tavst kan
    falde ud af et typeskift. */
function quoteOf(holding: LifeAnnuityHolding) {
  return {
    quotedReserve: holding.quotedReserve,
    quotedAnnualBenefit: holding.quotedAnnualBenefit,
    bonusRate: holding.bonusRate,
  }
}

export function withHoldingOwner(plan: Plan, holdingId: string, newOwnerId: string): Plan {
  const holding = findHolding(plan, holdingId)
  if (!holding) return plan

  return {
    ...plan,
    household: {
      persons: plan.household.persons.map((person) =>
        person.id === newOwnerId
          ? { ...person, holdings: [...person.holdings, holding] }
          : { ...person, holdings: person.holdings.filter((h) => h.id !== holdingId) },
      ),
    },
  }
}

/** Den tyndeste post, der kan tilføjes: nul beløb, hele horisonten, hvert år,
    hos husstandens første person. En indtægt får skattebehandlingen
    lønindkomst; en udgift har ikke feltet, jf. `Direction` i domænemodellen. */
export function addEntry(plan: Plan, direction: Direction): Plan {
  const owner = plan.household.persons[0]
  if (!owner) return plan

  const count = plan.entries.filter((entry) => entry.direction === direction).length
  const base = {
    id: freshEntryId(plan),
    name: direction === 'Income' ? `Indtægt ${count + 1}` : `Udgift ${count + 1}`,
    amountInRealKroner: 0,
    owner: owner.id,
    timing: 'Even' as const,
    period: { anchor: 'CalendarYear' as const },
    recurrence: { kind: 'Annual' as const },
  }
  const entry: Entry =
    direction === 'Income'
      ? { ...base, direction: 'Income', taxTreatment: 'EarnedIncome', regulationRate: 0 }
      : { ...base, direction: 'Expense' }

  return { ...plan, entries: [...plan.entries, entry] }
}

function freshEntryId(plan: Plan): string {
  const existing = new Set(plan.entries.map((entry) => entry.id))
  let n = 1
  while (existing.has(`entry-${n}`)) n++
  return `entry-${n}`
}

export function findEntry(plan: Plan, id: string): Entry | undefined {
  return plan.entries.find((entry) => entry.id === id)
}

/** Fjerner posten og indbetalingerne, der havde den som kilde. Et lønkildet
    bidrag uden sin post ville ikke bare udeblive — planen kunne slet ikke
    regnes, og resultatspalten ville gå i stå, jf. ADR-0013. */
export function removeEntry(plan: Plan, id: string): Plan {
  return {
    ...plan,
    entries: plan.entries.filter((entry) => entry.id !== id),
    contributions: plan.contributions.filter((contribution) => contribution.source !== id),
  }
}

export function findTransfer(plan: Plan, id: string): Transfer | undefined {
  return plan.transfers.find((transfer) => transfer.id === id)
}

export function removeTransfer(plan: Plan, id: string): Plan {
  return { ...plan, transfers: plan.transfers.filter((transfer) => transfer.id !== id) }
}

export function withTransfer(
  plan: Plan,
  id: string,
  change: (transfer: Transfer) => Transfer,
): Plan {
  return {
    ...plan,
    transfers: plan.transfers.map((transfer) =>
      transfer.id === id ? change(transfer) : transfer,
    ),
  }
}

/** De beholdninger, en overførsels ene ende kan pege på.

    De to ender har hver sin regel, jf. ADR-0016 og ADR-0029: afgiveren skal
    være en variant, hvis `PayoutTaxation` ikke er `PersonalIncome` — også
    aldersopsparingen, aktiesparekontoen og kapitalpensionen, som netop
    tømmes af en overførsel — og destinationen skal være frie midler, for ind
    i en ordning er det en indbetaling.

    Ét sted, fordi tre spørger: skuffens to lister, byttegrebet herunder, og
    svaret på om en overførsel overhovedet kan tilføjes. Regnet hvert sit sted
    kunne fladen komme til at tilbyde et valg, den selv ville afvise. */
export function transferEndOptions(plan: Plan, end: 'from' | 'to'): Holding[] {
  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  return end === 'to'
    ? holdings.filter(isFreeAssets)
    : holdings.filter((holding) => payoutTaxation(holding) !== 'PersonalIncome')
}

/** Sætter den ene ende af en overførsel. Vælges den beholdning, der allerede
    er den anden ende, bytter de to plads frem for at lade overførslen pege på
    sig selv.

    Byttet var i sin tid det eneste, valget kunne betyde: begge ender var
    frie midler, og "fra den beholdning, der i forvejen er til" var brugerens
    måde at sige den anden vej på. Nu har enderne hver sin regel, og en
    aldersopsparing kan ikke tage destinationens plads — dér flytter den anden
    ende sig i stedet til den første, den lovligt kan stå på. Er der ingen,
    står overførslen, som den stod: der findes intet lovligt at skrive.

    Begynder overførslen før den nye afgivers `PayoutAge`, løftes starten til
    det år, døren går op — samme greb som en ny udbetalingsplan, der lægges
    på ordningens tidligste lovlige alder frem for på en, motoren afviser. */
export function withTransferEnd(
  plan: Plan,
  id: string,
  end: 'from' | 'to',
  holding: string,
): { plan: Plan; clamp: Clamp | null } {
  const transfer = findTransfer(plan, id)
  if (!transfer) return { plan, clamp: null }

  const opened = openDoorFor(plan, withEnd(plan, transfer, end, holding))
  return {
    plan: withTransfer(plan, id, () => opened.transfer),
    clamp: opened.clamp,
  }
}

/** Overførslen med den ene ende sat — byttet med, hvor de to ellers ville
    pege samme sted. Starten er ikke løftet endnu; det er `openDoorFor`s
    arbejde, og de to er skilt ad, så byttet kan læses uden døren og omvendt. */
function withEnd(plan: Plan, transfer: Transfer, end: 'from' | 'to', holding: string): Transfer {
  const other = end === 'from' ? 'to' : 'from'
  const moved = { ...transfer, [end]: holding }
  if (transfer[other] !== holding) return moved

  const displaced = transfer[end]
  if (transferEndOptions(plan, other).some((option) => option.id === displaced)) {
    return { ...transfer, from: transfer.to, to: transfer.from }
  }

  const replacement = transferEndOptions(plan, other).find((option) => option.id !== holding)
  return replacement ? { ...moved, [other]: replacement.id } : transfer
}

/** Løfter overførslens start til afgiverens `PayoutAge`, hvis den ligger før.
    En overførsel, der begynder for tidligt, afvises af `validatePlan`, og et
    endeknap-valg skal ikke kunne gøre hele planen uregnelig — det er samme
    grund, som lader en ny udbetalingsplan begynde på ordningens tidligste
    lovlige alder. Ligger starten allerede efter døren, røres den ikke.

    Grænsen slås op i `periodEndpointBounds`, den samme, håndtaget og feltet
    bruger, og løftet siger derfor det samme som dem. Det var tavst indtil
    ADR-0045: brugeren så et årstal, hun ikke havde tastet, uden at få at vide
    hvorfor.

    Kun starten viger. Forankringen og slutåret står, hvor de stod — det er
    afgiveren, brugeren rørte, og ikke perioden. */
function openDoorFor(plan: Plan, transfer: Transfer): { transfer: Transfer; clamp: Clamp | null } {
  const bounds = periodEndpointBounds(plan, transfer, 'from')
  const owner = findHoldingOwner(plan, transfer.from)
  if (bounds.min === undefined || owner === undefined) return { transfer, clamp: null }

  const floor = boundValue(bounds.min)
  // Begge sider måles i kalenderår. Grænsen er i endepunktets egen enhed, og
  // det står endepunktet også — men en alder og et årstal kan ikke
  // sammenlignes, og et endepunkt, der følger erhvervsophøret, er slet ikke
  // et tal. Et åbent `from` betyder planens start, ganske som i
  // `transferEnds`.
  const asYear = (from: Period['from']) =>
    periodBounds({ ...transfer.period, from } as Period, owner, plan.household).from ?? plan.startYear
  if (asYear(transfer.period.from) >= asYear(floor)) return { transfer, clamp: null }

  return {
    transfer: { ...transfer, period: { ...transfer.period, from: floor } as Period },
    clamp: clampBy('Period.from', bounds.min),
  }
}

/** Klemmer den sammenlagte Overførsel-figurs forankring tilbage til
    kalenderår, når "Fra" er frie midler, "Fra"/"Til" har fået hver sin ejer,
    og mindst ét af de satte endepunkter er et bart fast alderstal — det er
    dér, og kun dér, at "Til" reelt afgør, hvis alder forankringen betyder:
    bliver figuren ved med at være en overførsel, måles den på afgiverens
    ejer; bliver den et bidrag, måles den på destinationens, jf. ADR-0028. Et
    bart alderstal uden en fælles ejer er derfor tvetydigt.

    Er begge satte endepunkter enten åbne, en eksplicit navngiven "følger",
    eller et fast alderstal der selv navngiver personen, er der intet
    tvetydigt at klemme — hvert endepunkt siger selv, hvem det måler på,
    uafhængigt af "Fra"/"Til", jf. ADR-0050 og ADR-0051. Kun det bare tal,
    uden en navngiven person, mangler et entydigt svar.

    Er "Fra" en låst ordning (en Udbetaling), er destinationen altid frie
    midler, svaret altid afgiverens ejer, og guarden rører aldrig figuren,
    jf. ADR-0047 og #82. */
export function guardTransferOrContributionAnchor(
  plan: Plan,
  id: string,
): { plan: Plan; clamp: Clamp | null } {
  const figure = findTransferOrContribution(plan, id)
  if (!figure || figure.period.anchor !== 'PersonAge') return { plan, clamp: null }

  const isContribution = 'kind' in figure
  const fromId = isContribution ? figure.source : figure.from
  const from = findHolding(plan, fromId)
  if (!from || !isFreeAssets(from)) return { plan, clamp: null }

  const fromOwner = findHoldingOwner(plan, fromId)
  const toOwner = findHoldingOwner(plan, figure.to)
  const hasAmbiguousAge =
    typeof figure.period.from === 'number' || typeof figure.period.to === 'number'
  if (!fromOwner || !toOwner || fromOwner.id === toOwner.id || !hasAmbiguousAge) {
    return { plan, clamp: null }
  }

  const period: Period = { anchor: 'CalendarYear' }
  const guardedPlan = isContribution
    ? withContribution(plan, id, (c) => ({ ...c, period }))
    : withTransfer(plan, id, (t) => ({ ...t, period }))
  return {
    plan: guardedPlan,
    clamp: {
      field: 'Period.anchor',
      message: '"Fra" og "Til" tilhører hver sin ejer, så en aldersforankring er tvetydig.',
    },
  }
}

/** Slår den sammenlagte Overførsel-figur op, uanset om den lige nu er en
    `Transfer` eller et beholdningskildet bidrag. `Contribution`s to grene
    skelnes på `kind`, som kun `Transfer` mangler — det er nok til at
    diskriminere unionen uden endnu en type. */
export function findTransferOrContribution(
  plan: Plan,
  id: string,
): Transfer | HoldingSourcedContribution | undefined {
  const transfer = findTransfer(plan, id)
  if (transfer) return transfer
  const contribution = findContribution(plan, id)
  return contribution?.kind === 'HoldingSourced' ? contribution : undefined
}

/** Den "Til"-værdi et kolliderende "Fra"-valg reelt efterlader figuren med —
    samme spørgsmål, `withEnd`s bytte stiller, men svaret her bruges til at
    afgøre klassificeringen, før byttet selv skrives. Uden kollision (valgets
    beholdning er ikke allerede "Til") ændrer "Fra" aldrig "Til", og
    funktionen kaldes ikke.

    Kan den fortrængte værdi selv stå som "Til" i en ren overførsel, bytter de
    to plads, som de altid har gjort. Ellers findes en anden frie midler at
    sætte i stedet, hvis husstanden har en. Findes ingen af delene — en eneste
    frie midler-konto, og den fortrængte er en ordning — er der intet lovligt
    "Til" tilbage for en `Transfer`, og den fortrængte værdi bliver stående
    som "Til": det er signalet, `withTransferOrContributionEnd` reklassificerer
    på, jf. ADR-0048. */
function resolvedToAfterFromCollision(plan: Plan, displaced: string, holding: string): string {
  if (transferEndOptions(plan, 'to').some((option) => option.id === displaced)) return displaced
  const alternative = transferEndOptions(plan, 'to').find((option) => option.id !== holding)
  return alternative ? alternative.id : displaced
}

/** Sætter den ene ende af den sammenlagte Overførsel-figur, og lader den
    usynligt skifte mellem en `Transfer` og et beholdningskildet bidrag, når
    "Til" krydser grænsen mellem frie midler og en ordning, jf. ADR-0047.

    Hvilken figur resultatet bliver, afgør sig i almindelighed alene af den
    nye "Til": en `Transfer`s `to` er altid frie midler, et beholdningskildet
    bidrags er aldrig det. Men vælges "Fra" til den beholdning, der allerede
    står som "Til", kolliderer de to ender, og byttet, kollisionen normalt
    løser, kan selv kræve reklassificering — har husstanden kun én frie
    midler-konto, og den fortrængte værdi er en ordning, findes intet lovligt
    "Til" tilbage for en `Transfer`, og figuren må blive et bidrag i stedet,
    jf. ADR-0048. `resolvedToAfterFromCollision` regner det bytte hjem, før
    klassificeringen afgøres, så et "Fra"-valg kan krydse grænsen præcis dér,
    hvor det ellers ville gå i stå.

    Bliver figuren ved med at være en `Transfer`, overlades selve byttet — de
    to ender må ikke pege på det samme — til `withTransferEnd`, uændret af
    sammenlægningen. Bliver den ved med at være et beholdningskildet bidrag,
    kan enderne aldrig kollidere: kilden skal være frie midler, destinationen
    må aldrig være det. Krydser figuren grænsen, findes ingen kollision af
    samme grund, og figuren flytter til enden af sit nye array — dens plads i
    det gamle var en prioritet blandt sine egne, jf. ADR-0019, og har intet at
    sige om en liste, den lige er kommet ind i. */
export function withTransferOrContributionEnd(
  plan: Plan,
  id: string,
  end: 'from' | 'to',
  holding: string,
): { plan: Plan; clamp: Clamp | null } {
  const figure = findTransferOrContribution(plan, id)
  if (!figure) return { plan, clamp: null }

  const wasTransfer = !('kind' in figure)
  const from = wasTransfer ? figure.from : figure.source
  const to = figure.to
  const nextTo =
    end === 'to'
      ? holding
      : wasTransfer && holding === to
        ? resolvedToAfterFromCollision(plan, from, holding)
        : to
  const destination = findHolding(plan, nextTo)
  const becomesTransfer = destination ? isFreeAssets(destination) : wasTransfer

  if (wasTransfer && becomesTransfer) {
    return withAnchorGuard(withTransferEnd(plan, id, end, holding), id)
  }

  const nextFrom = end === 'from' ? holding : from
  const shared = {
    id: figure.id,
    name: figure.name,
    amountInRealKroner: figure.amountInRealKroner,
    timing: figure.timing,
    period: figure.period,
    recurrence: figure.recurrence,
    // Pladsen i den sammenlagte liste er ikke et spørgsmål, en
    // grænsekrydsning stiller — den bevares uændret, som `id` allerede gør,
    // jf. ADR-0049.
    position: figure.position,
  }

  if (!wasTransfer && !becomesTransfer) {
    const fresh: Contribution = { ...shared, kind: 'HoldingSourced', source: nextFrom, to: nextTo }
    return withAnchorGuard({ plan: withContribution(plan, id, () => fresh), clamp: null }, id)
  }

  const withoutOld: Plan = wasTransfer
    ? { ...plan, transfers: plan.transfers.filter((candidate) => candidate.id !== id) }
    : { ...plan, contributions: plan.contributions.filter((candidate) => candidate.id !== id) }

  if (becomesTransfer) {
    const opened = openDoorFor(withoutOld, { ...shared, from: nextFrom, to: nextTo })
    return withAnchorGuard(
      {
        plan: { ...withoutOld, transfers: [...withoutOld.transfers, opened.transfer] },
        clamp: opened.clamp,
      },
      id,
    )
  }

  const fresh: Contribution = { ...shared, kind: 'HoldingSourced', source: nextFrom, to: nextTo }
  return withAnchorGuard(
    { plan: { ...withoutOld, contributions: [...withoutOld.contributions, fresh] }, clamp: null },
    id,
  )
}

/** Lader `guardTransferOrContributionAnchor` få det sidste ord om en
    redigerings klemning. Den klemning, resultatet allerede bærer — dørens
    løft i `openDoorFor`, som `withTransferEnd` selv kalder — melder om
    `Period.from`, en anden væg end ejerreglens `Period.anchor`, og de to
    sammenblandes ikke: rammer ejerreglen, er det den, brugeren skal se, for
    det var den, redigeringen lige udløste. */
function withAnchorGuard(
  result: { plan: Plan; clamp: Clamp | null },
  id: string,
): { plan: Plan; clamp: Clamp | null } {
  const guarded = guardTransferOrContributionAnchor(result.plan, id)
  return guarded.clamp ? guarded : result
}

/** De to første beholdninger, en overførsel kan gå mellem — og dermed også
    svaret på, om en overførsel overhovedet kan tilføjes.

    Enderne har hver sin regel, og parret læses derfor af `transferEndOptions`
    frem for af en liste her: afgiveren kan være enhver variant, hvis
    udbetaling er skattefri, destinationen kun frie midler. Enderne behøver
    ikke samme ejer — `validatePlan` stiller ikke det krav, indbetalingen
    har. */
export function firstTransferPair(plan: Plan): { from: string; to: string } | undefined {
  const destinations = transferEndOptions(plan, 'to')
  for (const from of transferEndOptions(plan, 'from')) {
    const to = destinations.find((holding) => holding.id !== from.id)
    if (to) return { from: from.id, to: to.id }
  }
  return undefined
}

/** Id'erne, en frisk Overførsel eller et frisk beholdningskildet bidrag ikke
    må vælge — begge arrays, ikke kun sit eget. Krydser en figur grænsen
    mellem `Transfer` og `Contribution`, jf. ADR-0047, beholder den sit id
    og flytter blot array; en tælling, der kun så sit eget array, ville tro
    id'et var ledigt igen og give det til en ny figur, der intet har med den
    gamle at gøre. To figurer med samme id er ikke en pyntefejl: navigatorens
    markering kender kun id'et, jf. `sameSelection`, og ville da vise begge
    som valgt på én gang. */
function allTransferOrContributionIds(plan: Plan): Set<string> {
  return new Set([
    ...plan.transfers.map((transfer) => transfer.id),
    ...plan.contributions.map((contribution) => contribution.id),
  ])
}

/** Pladsen en frisk Overførsel eller et frisk beholdningskildet bidrag skal
    have for at lande nederst i den sammenlagte liste — én mere end den
    højeste, der allerede findes blandt begge, jf. ADR-0049. Er listen tom,
    er nul den nederste plads, der findes. */
function nextTransferOrContributionPosition(plan: Plan): number {
  const positions = [
    ...plan.transfers.map((transfer) => transfer.position),
    ...plan.contributions
      .filter((contribution) => contribution.kind === 'HoldingSourced')
      .map((contribution) => contribution.position),
  ]
  return positions.length === 0 ? 0 : Math.max(...positions) + 1
}

function freshTransferId(plan: Plan): string {
  const existing = allTransferOrContributionIds(plan)
  let n = 1
  while (existing.has(`transfer-${n}`)) n++
  return `transfer-${n}`
}

/** Læser et tal, brugeren har tastet. Tusindtalspunktummer tåles, og komma
    er decimaltegn — det er sådan, tal skrives på dansk. */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/\s|\.(?=\d{3}\b)/g, '').replace(',', '.')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}

/** Skriver et tal, som brugeren ville have tastet det: komma som decimaltegn.
    Den nøjagtige modsatte vej af `parseNumber` — `parseNumber(formatNumber(x))`
    er `x` — og det er den egenskab, talfeltet hviler på, når det afgør, om en
    værdi er kommet udefra eller fra tastaturet. Uden tusindtalsseparator:
    feltet skal kunne redigeres, ikke kun læses. */
export function formatNumber(value: number): string {
  return String(value).replace('.', ',')
}

/** Redigerer en post, der er en indtægt, og lader den stå, hvis den er en
    udgift. Formen findes, fordi `withEntry` giver hele unionen ind:
    skattebehandlingen, reguleringssatsen og pensionsaftalen hænger på
    indtægtsgrenen alene, og en redigering skrevet dér ville skulle spørge om
    retningen for at komme til dem. Samme form og samme grund som
    `withPensionScheme` og `withLifeAnnuity`.

    Der er ingen modstykke, der skifter en posts retning. En indtægt og en
    udgift oprettes hver sit sted, og retningen afgør, hvad posten er — ikke
    hvad den står på. */
export function withIncomeEntry(
  plan: Plan,
  id: string,
  change: (entry: IncomeEntry) => IncomeEntry,
): Plan {
  return withEntry(plan, id, (entry) =>
    entry.direction === 'Income' ? change(entry) : entry,
  )
}

/** Den tyndeste lønkildede indbetaling, der kan tilføjes: nul procent af den
    første lovlige lønpost, ind i den første ordning, den må gå til.
    Destinationen må ikke være frie midler, jf. ADR-0016, og skal kunne
    administreres af en arbejdsgiver — findes intet sådant par, er der
    ingenting at tilføje, og knappen der kalder her, er selv skjult. Den
    beholdningskildede form hører til den sammenlagte Overførsel-sektion, jf.
    `addTransferOrContribution` og ADR-0047. */
export function addContribution(plan: Plan): Plan {
  const pair = firstContributionPair(plan)
  if (!pair) return plan

  const id = freshContributionId(plan)
  const number = plan.contributions.filter((c) => c.kind === 'EntrySourced').length + 1
  const name = `Indbetaling ${number}`
  return {
    ...plan,
    contributions: [
      ...plan.contributions,
      { id, name, kind: 'EntrySourced', source: pair.source, to: pair.to, percentageOfEntry: 0 },
    ],
  }
}

/** Det første lovlige par af lønpost og ordning — og dermed også svaret på,
    om en lønkildet indbetaling overhovedet kan tilføjes. Det beholdningskildede
    par hører til den sammenlagte Overførsel-sektion og besvares i stedet af
    `firstTransferOrContributionPair`, jf. ADR-0047.

    En ordning, ingen arbejdsgiver kan administrere, kan ikke være enden på et
    lønkildet par: så ville ét klik skrive en plan, `validatePlan` afviser,
    jf. ADR-0020. Parret skal desuden tilhøre samme person — en
    arbejdsgiverordning står i lønmodtagerens eget navn. */
export function firstContributionPair(
  plan: Plan,
): { kind: 'EntrySourced'; source: string; to: string } | undefined {
  for (const entry of plan.entries) {
    if (entry.direction !== 'Income') continue
    const owner = plan.household.persons.find((person) => person.id === entry.owner)
    const to = (owner?.holdings ?? []).find(
      (holding) => !isFreeAssets(holding) && isEmployerAdministered(holding),
    )
    if (to) return { kind: 'EntrySourced', source: entry.id, to: to.id }
  }
  return undefined
}

/** Det første par, et beholdningskildet bidrag kan gå mellem: husstandens
    første frie midler til dens første ordning. Delt af `firstContributionPair`
    og `firstTransferOrContributionPair`, så de to ikke kan komme til at svare
    hver sit på det samme spørgsmål. */
function firstHoldingSourcedPair(plan: Plan): { from: string; to: string } | undefined {
  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const from = holdings.find(isFreeAssets)
  const to = holdings.find((holding) => !isFreeAssets(holding))
  return from && to ? { from: from.id, to: to.id } : undefined
}

/** Det første lovlige par for den sammenlagte Overførsel-sektion i skuffen —
    og dermed også svaret på, om dens "+"-knap overhovedet kan aktiveres.
    Transfer-parret først: en overførsel mellem to frie beholdninger er den
    almindelige vej, og det beholdningskildede bidrag findes af samme grund
    som i `firstContributionPair` — der er stadig noget at oprette, når
    husstanden ingen anden fri beholdning har at overføre til, men vel en
    ordning at betale ind på, jf. ADR-0047. */
export function firstTransferOrContributionPair(
  plan: Plan,
): { kind: 'Transfer'; from: string; to: string } | { kind: 'HoldingSourced'; from: string; to: string } | undefined {
  const transferPair = firstTransferPair(plan)
  if (transferPair) return { kind: 'Transfer', ...transferPair }

  const holdingSourcedPair = firstHoldingSourcedPair(plan)
  return holdingSourcedPair && { kind: 'HoldingSourced', ...holdingSourcedPair }
}

/** Den tyndeste figur, den sammenlagte Overførsel-sektion kan tilføje: en
    Transfer, når der findes et lovligt Transfer-par, ellers et
    beholdningskildet bidrag. De to deler én nummerering, fordi de deler én
    liste og én "+"-knap på skærmen, jf. ADR-0047 — en bruger, der tæller
    "Overførsel 1", "Overførsel 2" i navigatoren, skal ikke opdage et hul,
    fordi den ene er en Transfer og den anden et bidrag under motorhjelmen. */
export function addTransferOrContribution(plan: Plan): Plan {
  const pair = firstTransferOrContributionPair(plan)
  if (!pair) return plan

  const number =
    plan.transfers.length +
    plan.contributions.filter((contribution) => contribution.kind === 'HoldingSourced').length +
    1
  const name = `Overførsel ${number}`
  const position = nextTransferOrContributionPosition(plan)

  if (pair.kind === 'Transfer') {
    const fresh: Transfer = {
      id: freshTransferId(plan),
      name,
      from: pair.from,
      to: pair.to,
      amountInRealKroner: 0,
      timing: 'Even',
      period: { anchor: 'CalendarYear' },
      recurrence: { kind: 'Annual' },
      position,
    }
    return { ...plan, transfers: [...plan.transfers, openDoorFor(plan, fresh).transfer] }
  }

  const fresh: Contribution = {
    id: freshContributionId(plan),
    name,
    kind: 'HoldingSourced',
    source: pair.from,
    to: pair.to,
    amountInRealKroner: 0,
    timing: 'Even',
    period: { anchor: 'CalendarYear' },
    recurrence: { kind: 'Annual' },
    position,
  }
  return { ...plan, contributions: [...plan.contributions, fresh] }
}

function freshContributionId(plan: Plan): string {
  const existing = allTransferOrContributionIds(plan)
  let n = 1
  while (existing.has(`contribution-${n}`)) n++
  return `contribution-${n}`
}

/** Slår Pension-sektionen til på en lønpost.

    Aftalen skrives med to bidrag på nul, et gebyr og en præmie på nul og én
    fordelingslinje, der er resten. Ét klik må ikke skrive en plan, indgangskontrollen afviser, jf.
    ADR-0020: linjen peger derfor på ejerens første
    arbejdsgiveradministrerede ordning, og præcis den ene er resten.

    Har ejeren ingen sådan ordning, er der intet at pege på, og posten står
    urørt — fladen tilbyder da ikke sektionen, og reglen bag står i et `Hint`
    ved siden af, som en spærret vælger gør det andre steder. */
export function addPensionAgreement(plan: Plan, entryId: string): Plan {
  const to = agreementDestination(plan, entryId)
  if (!to) return plan

  return withIncomeEntry(plan, entryId, (entry) => ({
    ...entry,
    pensionAgreement: {
      employerContribution: { percentageOfEntry: 0 },
      employeeContribution: { percentageOfEntry: 0 },
      fee: 0,
      insurancePremium: 0,
      allocation: [{ to, form: 'Remainder' }],
    },
  }))
}

/** Den ordning, en ny fordelingslinje peger på — og dermed også svaret på,
    om sektionen overhovedet kan slås til, og om der er en ordning mere at
    lægge i fordelingen. Ejerens egen og arbejdsgiveradministreret: en
    firmaordning står i lønmodtagerens eget navn, jf. ADR-0028, og
    aktiesparekontoen og de frie midler kan ingen arbejdsgiver administrere.

    Ordninger, fordelingen allerede peger på, springes over. Samme destination
    på to linjer er ét beløb skrevet to steder, og indgangskontrollen afviser
    det — ét klik må ikke skrive en plan, motoren nægter at regne, jf.
    ADR-0020. */
export function agreementDestination(plan: Plan, entryId: string): string | undefined {
  const entry = findEntry(plan, entryId)
  if (!entry || entry.direction !== 'Income') return undefined

  const allocation = entry.pensionAgreement?.allocation ?? []
  const used = new Set(allocation.map((line) => line.to))
  const owner = findPerson(plan, entry.owner)
  return owner?.holdings.find(
    (holding) =>
      !isFreeAssets(holding) && isEmployerAdministered(holding) && !used.has(holding.id),
  )?.id
}

/** Lægger en ordning mere i fordelingen.

    Linjen skrives som en procent på nul: det er den ene af de to former, der
    ikke kan komme til at bede om et beløb, aftalen ikke har, og et nul deler
    ingenting ud, før planlæggeren har taget stilling.

    Den lægges over restlinjen og aldrig under. Resten er det, de øvrige ikke
    tog, og en liste, hvor den stod i midten, ville læses som et regnestykke,
    der ikke er dét, den er.

    Har ejeren ingen ordning tilbage at pege på, står fordelingen urørt —
    fladen tilbyder da ikke knappen. */
export function addAllocationLine(plan: Plan, entryId: string): Plan {
  const to = agreementDestination(plan, entryId)
  if (!to) return plan

  return withPensionAgreement(plan, entryId, (agreement) => {
    const line: AllocationLine = { to, form: 'Percentage', percentage: 0 }
    const remainder = agreement.allocation.findIndex((other) => other.form === 'Remainder')
    return {
      ...agreement,
      allocation:
        remainder === -1
          ? [...agreement.allocation, line]
          : [
              ...agreement.allocation.slice(0, remainder),
              line,
              ...agreement.allocation.slice(remainder),
            ],
    }
  })
}

/** Tager en linje ud af fordelingen igen. Restlinjen kan ikke fjernes ad
    denne vej — uden den ville fordelingen ikke gå op, og fladen tilbyder
    derfor ingen knap på den. Skal hele aftalen væk, er det sektionen, der
    slås fra. */
export function removeAllocationLine(plan: Plan, entryId: string, index: number): Plan {
  return withPensionAgreement(plan, entryId, (agreement) =>
    agreement.allocation[index]?.form === 'Remainder'
      ? agreement
      : {
          ...agreement,
          allocation: agreement.allocation.filter((_line, other) => other !== index),
        },
  )
}

/** Retter én linje i fordelingen. Pladsen og ikke destinationen er nøglen:
    destinationen er selv et felt, brugeren kan skifte, og en linje, der blev
    slået op på den, ville miste sig selv i samme greb. */
export function withAllocationLine(
  plan: Plan,
  entryId: string,
  index: number,
  change: (line: AllocationLine) => AllocationLine,
): Plan {
  return withPensionAgreement(plan, entryId, (agreement) => ({
    ...agreement,
    allocation: agreement.allocation.map((line, other) =>
      other === index ? change(line) : line,
    ),
  }))
}

/** Slår sektionen fra igen. Aftalen er væk med sine tal: der er ingen
    afbryder, der lader dem stå, mens året regner uden dem — det ville være
    to scenarier i én plan, og scenarier er uafhængige planer, jf. `Plan`. */
export function removePensionAgreement(plan: Plan, entryId: string): Plan {
  return withIncomeEntry(plan, entryId, ({ pensionAgreement: _pensionAgreement, ...rest }) => rest)
}

export function withPensionAgreement(
  plan: Plan,
  entryId: string,
  change: (agreement: PensionAgreement) => PensionAgreement,
): Plan {
  return withIncomeEntry(plan, entryId, (entry) =>
    entry.pensionAgreement
      ? { ...entry, pensionAgreement: change(entry.pensionAgreement) }
      : entry,
  )
}

export function findContribution(plan: Plan, id: string): Contribution | undefined {
  return plan.contributions.find((contribution) => contribution.id === id)
}

export function withContribution(
  plan: Plan,
  id: string,
  change: (contribution: Contribution) => Contribution,
): Plan {
  return {
    ...plan,
    contributions: plan.contributions.map((contribution) =>
      contribution.id === id ? change(contribution) : contribution,
    ),
  }
}

export function removeContribution(plan: Plan, id: string): Plan {
  return {
    ...plan,
    contributions: plan.contributions.filter((contribution) => contribution.id !== id),
  }
}

/** ---------- rækkefølgen ----------

    Planens rækkefølge er ikke en visningsdetalje. Beder to indbetalinger til
    samme aktiesparekonto tilsammen om mere, end loftet giver plads til, tager
    den første i `plan.contributions` sit fulde beløb, og den næste får
    resten, jf. ADR-0019; overførsler deler råderummet efter samme regel, jf.
    `transfersInYear`. Det er derfor rækkefølgen kan flyttes af brugeren og
    ikke af fladen: den er et greb om en prioritet, motoren allerede adlyder.

    Alle fem flytter inden for den liste, brugeren ser. Ingen af dem kan
    ændre, hvad en figur er eller hører til — en beholdning bliver i sin
    ejers egen liste, og et ejerskifte har både skattemæssige følger og sit
    eget felt i skuffen, jf. `withHoldingOwner`. */

/** Flytter figuren med `id` hen på pladsen `to` og skubber resten sammen.
    En plads uden for listen klemmes ind i den, så et slip forbi enden lander
    i enden — og en figur, der ikke findes, lader listen stå. */
function movedById<T extends { id: string }>(items: T[], id: string, to: number): T[] {
  const from = items.findIndex((item) => item.id === id)
  if (from === -1) return items

  const rest = items.filter((_, index) => index !== from)
  const at = Math.max(0, Math.min(to, rest.length))
  return [...rest.slice(0, at), items[from]!, ...rest.slice(at)]
}

export function movePerson(plan: Plan, id: string, to: number): Plan {
  return {
    ...plan,
    household: { persons: movedById(plan.household.persons, id, to) },
  }
}

/** Pladsen tælles i ejerens egen liste. Beholdningen kan ikke flyttes ud af
    den: `withPerson` rører kun den ene person, og en plads uden for listen
    klemmes ind i dens ende. */
export function moveHolding(plan: Plan, id: string, to: number): Plan {
  const owner = findHoldingOwner(plan, id)
  if (owner === undefined) return plan

  return withPerson(plan, owner.id, (person) => ({
    ...person,
    holdings: movedById(person.holdings, id, to),
  }))
}

/** Pladsen tælles blandt posterne i postens egen retning, for det er dem,
    brugeren ser i kassen. Indtægter og udgifter deler `plan.entries`, og den
    anden slags bliver liggende, hvor den lå: kun de pladser, retningen
    optager i listen, bytter indhold. */
export function moveEntry(plan: Plan, id: string, to: number): Plan {
  const moving = findEntry(plan, id)
  if (moving === undefined) return plan

  const slots = plan.entries.flatMap((entry, index) =>
    entry.direction === moving.direction ? [index] : [],
  )
  const reordered = movedById(
    slots.map((slot) => plan.entries[slot]!),
    id,
    to,
  )

  const entries = [...plan.entries]
  slots.forEach((slot, index) => {
    entries[slot] = reordered[index]!
  })
  return { ...plan, entries }
}

/** Pladsen tælles blandt bidrag af samme slags som det, der flyttes — de to
    sektioner i navigatoren viser hver sin delmængde af `plan.contributions`
    (lønkildet og beholdningskildet), og kun de pladser, den flyttede figurs
    egen slags optager, må bytte indhold. Samme mønster som `moveEntry`
    bruger på retning. */
export function moveContribution(plan: Plan, id: string, to: number): Plan {
  const moving = findContribution(plan, id)
  if (moving === undefined) return plan

  const slots = plan.contributions.flatMap((contribution, index) =>
    contribution.kind === moving.kind ? [index] : [],
  )
  const reordered = movedById(
    slots.map((slot) => plan.contributions[slot]!),
    id,
    to,
  )

  const contributions = [...plan.contributions]
  slots.forEach((slot, index) => {
    contributions[slot] = reordered[index]!
  })
  return { ...plan, contributions }
}

export function moveTransfer(plan: Plan, id: string, to: number): Plan {
  return { ...plan, transfers: movedById(plan.transfers, id, to) }
}

/** Flytter en Overførsel eller et beholdningskildet bidrag til en vilkårlig
    plads i den sammenlagte, position-sorterede liste, jf. ADR-0049 og issue
    #84 — trækket i navigatorens 'Overførsler'-blok, der nu går på tværs af de
    to typer.

    Den fælles liste flyttes først med `movedById`, og hele den nye
    rækkefølge får sin `position` nummereret forfra. Derefter fysisk: de
    beholdningskildede bidrags indbyrdes plads i `plan.contributions`
    omsorteres med samme "kun blandt egen slags"-teknik som `moveContribution`
    — de lønkildede bidrags plads og rækkefølge ligger fast — og hele
    `plan.transfers` erstattes af sin nye orden, fordi arrayet kun rummer
    Transfer og derfor ingen slots at bevare. Det er derfor motorens
    loft-prioritet, som læser `plan.contributions`s rå array-rækkefølge, jf.
    `shortenToHeadroom` og ADR-0019, følger trækket uden at `simulate.ts`
    rører sig. */
export function moveTransferOrContribution(plan: Plan, id: string, to: number): Plan {
  if (!findTransferOrContribution(plan, id)) return plan

  const holdingSourced = plan.contributions.filter(
    (contribution): contribution is HoldingSourcedContribution =>
      contribution.kind === 'HoldingSourced',
  )
  const merged = [...plan.transfers, ...holdingSourced].sort((a, b) => a.position - b.position)
  const reordered = movedById(merged, id, to).map((figure, index) => ({
    ...figure,
    position: index,
  }))

  const transfers = reordered.filter((figure): figure is Transfer => !('kind' in figure))
  const newHoldingSourced = reordered.filter(
    (figure): figure is HoldingSourcedContribution => 'kind' in figure,
  )

  const slots = plan.contributions.flatMap((contribution, index) =>
    contribution.kind === 'HoldingSourced' ? [index] : [],
  )
  const contributions = [...plan.contributions]
  slots.forEach((slot, index) => {
    contributions[slot] = newHoldingSourced[index]!
  })

  return { ...plan, transfers, contributions }
}
