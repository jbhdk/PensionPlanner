import {
  balanceOf,
  closeYear,
  creditReturn,
  fromBalances,
  fromPreviousYear,
  openingBalances,
  returnOf,
  withFlow,
  withMovement,
  withPayout,
} from './holdingYears'
import type { CreditedHoldingYears, HoldingYears } from './holdingYears'
import type {
  Contribution,
  ContributionAmount,
  Entry,
  Holding,
  HoldingVariant,
  Household,
  Nominal,
  HoldingId,
  EntryId,
  PayoutPrinciple,
  PensionAgreement,
  Allocation,
  PayoutSchedule,
  Person,
  PersonId,
  Plan,
  Recurrence,
  SimulationYear,
  TaxTreatment,
  Timing,
  Transfer,
} from './plan'
import { householdLastYear, periodBounds, personLastYear } from './age'
import { payoutStartYear, transferAllowedFrom } from './payoutAge'
import {
  cap,
  cappedVariant,
  hasDeductibility,
  payoutScheduleOf,
  payoutStartOf,
  payoutTaxation,
  transferCharge,
} from './holdingVariant'
import { conversionFactor, isLifeAnnuity } from './lifeAnnuity'
import { rateYearFor } from './rates/rates'
import type { CivilStatus, RateYear } from './rates/rateYear'
import { statePensionsInYear } from './statePension'
import type { ActiveStatePension } from './statePension'
import { statePensionYear } from './statePensionAge'
import { assessHousehold, totalHouseholdTax } from './tax/assessHousehold'
import type { HouseholdTaxAssessment, StatePensionYear } from './tax/assessHousehold'
import type { TaxAssessmentInput } from './tax/assessTax'
import { endpointOwner, validatePlan } from './validatePlan'
import { totalYearTax } from './yearTax'
import type {
  BufferState,
  CapBreach,
  CapYear,
  HoldingYear,
  LifeAnnuityBenefit,
  RateBasis,
  YearResult,
} from './yearResult'

/** En post sammen med dens to beløb i årets fremtidskroner, for de poster der
    rent faktisk falder i det pågældende år.

    De to er kun forskellige på en lønpost med en `PensionAgreement`, jf.
    ADR-0040. `own` er postens eget beløb — det, lønsedlen kalder løn, og det
    grundlag enhver procent måler af. `amount` er brutto: `own` plus aftalens
    arbejdsgiverbidrag. Det er brutto, der lander på bufferen, krydser
    skattesømmet og vejes ind i afkastgrundlaget, ganske som før — ændringen
    er i, hvem der lægger de to tal sammen. */
type ActiveEntry = { entry: Entry; own: Nominal; amount: Nominal }

/** En overførsel sammen med dens beløb i årets fremtidskroner, for de
    overførsler der rent faktisk falder i det pågældende år: hvad planen bad
    om, hvad afgiverens saldo rakte til (`amount`), og hvad der landede hos
    modtageren (`landed`) — lavere end `amount`, når afgiveren er
    `Chargeable`, jf. ADR-0029. `from` er afgiverens egen beholdning, så dens
    variant kan slås op uden et andet opslag i planen. */
type ActiveTransfer = {
  transfer: Transfer
  from: Holding
  requested: Nominal
  amount: Nominal
  landed: Nominal
}

/** En indbetaling sammen med dens to beløb i årets fremtidskroner, dens
    forfald og den beholdning, pengene forlader — for de indbetalinger der
    rent faktisk falder i det pågældende år.

    Afgiverenden står her frem for at blive udledt, hvor pengene flyttes: et
    lønkildet bidrag forlader bufferen, hvor lønnen landede, og et
    beholdningskildet forlader sin egen kilde. Formen er dermed afgjort ét
    sted, og de to bevægelsesløkker længere nede kender kun `from`. */
type ActiveContribution = {
  contribution: Contribution
  from: HoldingId
  fromSource: Nominal
  intoHolding: Nominal
  timing: Timing
}

/** Ét beløb, en pensionsaftale placerede på én destination i ét
    simuleringsår. Kilden er altid bufferen: lønnen landede der først, brutto
    — arbejdsgiverbidraget lagt til af aftalen selv, jf. ADR-0040.

    `requested` er, hvad andelen bad om, og `landed` er, hvad der nåede frem.
    De to skilles ad i et magert år, hvor det placerede beløb ikke rakte til
    kronelinjerne — og det er `landed`, der bevæger penge og møder lofterne. */
type ActivePlacement = { to: HoldingId; requested: Nominal; landed: Nominal }

/** Én pensionsaftales regnestykke i ét simuleringsår — de to bidrag,
    AM-bidraget og det, der landede hvor.

    Hele regnestykket står og ikke kun facit, jf. ADR-0041: aftalen kan ikke
    låne `ContributionYear`, hvis ene difference er AM-bidraget, for her er
    kilen bredere. Ejeren står på linjen af samme grund som på `ActivePayout`
    — fradragsretten er lønmodtagerens, og pengene lander i hendes egen
    ordning — mens forfaldet er lønpostens, som aftalen arver alt andet fra. */
type ActiveAgreement = {
  entry: EntryId
  owner: PersonId
  employerContribution: Nominal
  employeeContribution: Nominal
  labourMarketContribution: Nominal
  /** Gebyret og præmien, som året fremskrev dem. De forlader husstanden uden
      at blive til formue og er derfor udgifter, jf. ADR-0042 — men de er
      aftalens udgifter og ingen `Entry`, og de står derfor her. */
  fee: Nominal
  insurancePremium: Nominal
  timing: Timing
  placements: ActivePlacement[]
}

/** Én beholdnings udbetaling i ét simuleringsår: hvad en `PayoutSchedule`
    tømmer den med, og hvem der skal beskattes af det.

    Ejeren står her frem for at blive slået op, hvor skatten regnes: raten er
    `PensionIncome` hos beholdningens ejer, og en beholdning har præcis én.
    Pengene lander derimod på bufferen uanset ejer, som al anden indkomst. */
type ActivePayout = {
  holding: HoldingId
  owner: PersonId
  amount: Nominal
  /** Om året er planens sidste. Det er dét år, resten fejes med, så
      beholdningen lukker på præcis nul — en plan, der efterlod en splint,
      ville lade den stå i formuegrafen for evigt. */
  final: boolean
}

/** Én livrentes to tal i ét simuleringsår: det depot, der forlader
    husstandens formue, og den livsvarige ydelse, personen modtager.

    De to står på samme linje, fordi det ene bliver til det andet. I
    omsætningsåret er depotet primosaldoen og ydelsen den ganget med
    `ConversionFactor`; i alle år derefter er depotet nul, og ydelsen er
    sidste års reguleret med `bonusRate`. Ingen af de to kan regnes uden den
    anden, og et årsresultat, hvor de sagde hver sit, ville lade brugeren
    efterregne en ydelse, der ikke passer til det depot, den kom af.

    Ejeren står her af samme grund som på `ActivePayout`: ydelsen er
    `PensionIncome` hos beholdningens ejer, og en beholdning har præcis én.
    Pengene lander på bufferen uanset ejer, som al anden indkomst. */
type ActiveAnnuity = {
  holding: HoldingId
  owner: PersonId
  /** Depotet, der omsættes. Nul i alle andre år end omsætningsåret — det er
      dét, der gør `YearResult.conversion` til det ene år, det er. */
  conversion: Nominal
  benefit: Nominal
}

/** Fremskriver planen år for år i fremtidskroner. Ren funktion: samme plan
    giver altid samme årsrække, og planen røres ikke.

    En foldning over årene: hvert år åbner sine beholdningsrækker på det
    foregående års ultimosaldi og lukker dem igen i sit årsresultat. Der
    bæres ingen anden tilstand end det. */
export function simulate(plan: Plan): YearResult[] {
  const error = validatePlan(plan)
  if (error) throw new Error(error)

  const holdings = allHoldings(plan)
  const results: YearResult[] = []
  for (let year = plan.startYear; year <= householdLastYear(plan.household); year++) {
    const { rates, basis } = rateYearFor(year, plan)
    const previous = results.at(-1)
    const opening =
      previous === undefined
        ? fromBalances(holdings)
        : fromPreviousYear(holdings, previous.holdings)
    results.push(simulateYear(plan, year, opening, rates, basis, previous))
  }
  return results
}

/** Ét simuleringsår: en ren funktion af planen, året og årets primosaldi. */
function simulateYear(
  plan: Plan,
  year: SimulationYear,
  years: HoldingYears,
  rates: RateYear,
  rateBasis: RateBasis,
  /** Forrige års resultat, eller `undefined` i planens første år. Det bæres
      alene for den omsatte livrentes ydelse: depotet er væk, saldoen er nul,
      og ydelsen findes derfor ikke andre steder end i det år, den sidst blev
      opgjort. Alt andet bæres i beholdningsrækkerne, jf. `simulate`. */
  previous: YearResult | undefined,
): YearResult {
  const entries = entriesInYear(plan, year)
  const requested = contributionsInYear(plan, year, entries, rates)

  // Aftalens to bidrag måler lønposten og ikke den brutto, `entriesInYear`
  // netop har lagt sammen af de to, jf. ADR-0040.
  //
  // Aftalerne regnes efter de selvstændige indbetalinger, jf. ADR-0041: en
  // `UpToCap`-linje skal vide, hvad de øvrige indbetalinger til ordningen
  // tog, og de øvrige skal aldrig vide, hvad aftalen tog. Afhængigheden står
  // som et argument frem for som en rækkefølge, der skal huskes.
  const agreements = pensionAgreementsInYear(plan, year, entries, rates, requested)

  // Primosaldiene står fast hele året igennem: de er forrige års ultimo og
  // ændrer sig ikke af noget, der sker herefter. `OnBalance`-loftets
  // råderum, overførslernes afkortning og årets rater måles alle mod netop
  // dem, og de læses derfor ét sted.
  const opening = openingBalances(years)

  // Overførslerne afkortes, før noget vejes ind, af samme grund som
  // lofterne: kun det, der faktisk flyttede sig, må forrente sig i den ende,
  // det landede i.
  const transfers = transfersInYear(plan, year, opening, rates)

  // Lofterne opgøres, før noget vejes ind. En loftform, der afkorter selve
  // indbetalingen, skal være afgjort først — ellers forrenter penge sig et
  // sted, de aldrig kom hen, jf. ADR-0019.
  //
  // Opgørelsen måler betalinger og ikke indbetalinger: loftet er personens og
  // gælder personens ordninger af slagsen under ét, uanset hvilken figur
  // pengene kom af, jf. ADR-0018 og ADR-0041. Planens egne indbetalinger står
  // først og aftalernes fordelinger derefter — det er dén rækkefølge,
  // råderummet uddeles i.
  const payments = paymentsOf(requested, agreements)
  const { byPerson, shortened } = paymentsThroughCaps(plan, payments, rates, year, opening)
  const contributions = requested.map((active, index) =>
    shortenedTo(active, shortened.get(index)),
  )
  const placedAgreements = withShortenedPlacements(agreements, shortened, requested.length)

  // Raten regnes af primosaldoen, jf. diagram 02 og PBL § 11 A: saldoen ved
  // årets begyndelse divideret med resterende udbetalingsår, eller
  // annuiteten af den. Den skal derfor være kendt, før noget vejes ind: en
  // rate, der først blev regnet undervejs, ville måle mod en saldo, loven
  // ikke peger på.
  const payouts = payoutsInYear(plan, year, rates, opening)

  // Omsætningen står samme sted som raten og af samme grund, jf. diagram 02:
  // depotet er saldoen ved årets begyndelse, og ydelsen skal være kendt, før
  // noget vejes ind. Ydelsen er penge udefra og lægges derfor til årets
  // indtægter, hvor en rate blot flytter penge mellem husstandens egne
  // lommer, jf. ADR-0009.
  const annuities = lifeAnnuitiesInYear(plan, year, opening, previous)

  // Herfra og til krediteringen vejes årets daterede bevægelser ind i
  // afkastgrundlaget efter Modified Dietz, jf. ADR-0006. Folkepensionen,
  // skatten og restposten er ikke iblandt dem og findes derfor endnu ikke:
  // de opgøres nedenfor, hvor bogen er lukket for vægtning, jf. ADR-0024.
  // Kun bufferen modtager poster, og strømmen vejes i dens ende, jf.
  // ADR-0004 og `weightAt`.
  const afterEntries = withFlow(years, plan.buffer, weightedNetFlow(entries, plan.buffer))
  // Overførslen vejer ind i begge ender, jf. ADR-0004 — men enderne spørges
  // hver for sig: en jævn overførsel til eller fra bufferen vejer nul i
  // bufferens ende og fuldt i den andens, jf. ADR-0024.
  const afterTransfers = transfers.reduce((years, { transfer, amount, landed }) => {
    const { from, to, timing } = transfer
    return withWeightedFlow(years, from, to, amount, landed, timing, plan.buffer)
  }, afterEntries)
  // Indbetalingen vejer ind i begge ender som en overførsel. Bufferen fik
  // hele bruttolønnen vægtet ind med posten, og uden modposten her ville de
  // penge, der gik videre til ordningen, forrente sig to steder på én gang.
  // Det er nettobeløbet, der vejes: AM-delen forlader bufferen som skat, og
  // skat rører aldrig afkastgrundlaget.
  const afterContributions = contributions.reduce(
    (years, { contribution, from, intoHolding, timing }) =>
      withWeightedFlow(years, from, contribution.to, intoHolding, intoHolding, timing, plan.buffer),
    afterTransfers,
  )
  // Aftalens penge vejer ind som en indbetalings og af samme grund: de
  // forlader bufferen, hvor hele bruttolønnen — arbejdsgiverbidraget med —
  // netop er vejet ind med posten. Forfaldet er lønpostens, som aftalen
  // arver alt andet fra.
  //
  // Gebyret og præmien vejes ud af bufferen i samme greb. De forlader den
  // sammen med resten af indbetalingen og har lønpostens forfald, og en
  // dateret bevægelse på bufferen forrenter sig kun for den del af året, den
  // var der, jf. `Buffer` og ADR-0006. De vejes kun i den ene ende: der er
  // ingen anden — pengene forlader husstanden, jf. ADR-0042.
  const afterAgreements = placedAgreements.reduce(
    (years, { placements, timing, fee, insurancePremium }) =>
      withFlow(
        placements.reduce(
          (years, { to, landed }) =>
            withWeightedFlow(years, plan.buffer, to, landed, landed, timing, plan.buffer),
          years,
        ),
        plan.buffer,
        -(fee + insurancePremium) * weightAt(plan.buffer, timing, plan.buffer),
      ),
    afterContributions,
  )
  // Raten vejer kun ind i afgiverens ende. Forfaldet er ikke et felt på
  // udbetalingsplanen: en rate udbetales månedsvis, og `'Even'` er det
  // matematisk rigtige for en jævn strøm, jf. ADR-0006. Pengene forlader
  // faktisk ordningen månedsvis, så dens afkastgrundlag mister `½ × raten` —
  // men de forrenter sig ingen steder undervejs, for de lander på bufferen,
  // hvor en jævn strøm vejer nul, jf. ADR-0024 og `weightAt`.
  const flowed = payouts.reduce(
    (years, { holding, amount }) =>
      withFlow(years, holding, -amount * weightAt(holding, 'Even', plan.buffer)),
    afterAgreements,
  )

  // Folkepensionen vejer ingen steder. Den udbetales månedsvis og lander på
  // bufferen, hvor en jævn strøm giver nul, jf. ADR-0024 — der er ingen
  // anden ende at veje i, for beløbet kommer udefra og forlader ingen
  // beholdning.

  // Omsætningen har vægt 1: depotet forlader beholdningen ved årets
  // begyndelse, og der er intet af det tilbage at forrente. Livrenten lukker
  // derfor på nul af sig selv, uden at fejningen skal træde til. Ydelsen
  // vejer derimod ingen steder: den udbetales månedsvis og lander på
  // bufferen, hvor en jævn strøm giver nul, jf. ADR-0024.
  //
  // Det er den sidste vægtning, og `annuitised` er derfor den bog,
  // krediteringen lukker.
  const annuitised = annuities.reduce(
    (years, { holding, conversion }) =>
      withFlow(years, holding, -conversion * conversionWeight),
    flowed,
  )

  // Alle daterede bevægelser er noteret, og afkastet krediteres her, jf.
  // diagram 02. Bogen er dermed lukket for vægtning: årets drift ligger
  // nedenunder og kan ikke nå afkastgrundlaget, fordi der ikke længere
  // findes en bog, der tager imod en vægtning. Rækkefølgen er ikke en
  // konvention men håndhævelsen af ADR-0024 — pensionstillægget findes
  // ikke endnu og kan derfor ikke indgå i sit eget grundlag gennem
  // bufferen.
  //
  // Beholdningsskatten trækkes med i samme greb: den regnes af årets
  // faktiske, vægtede afkast og bæres af beholdningen selv.
  const credited = creditReturn(annuitised, rates)

  // En overførsel flytter sit fulde beløb ud af afgiveren, men kun det, der
  // landede, ind i modtageren — de to er de samme, når afgiveren er
  // `TaxFree`, og forskellen er afgiften, når den er `Chargeable`, jf.
  // ADR-0029. Afgiften selv rammer aldrig pengestrømmen: den forlader
  // husstanden gennem `tax`-leddet nedenfor, ikke gennem en bevægelse her.
  const moved = transfers.reduce(
    (years, { transfer, amount, landed }) =>
      withMovement(withMovement(years, transfer.from, -amount), transfer.to, landed),
    credited,
  )

  // Indbetalingen tilføjer intet led til balanceinvarianten: den er en
  // intern bevægelse ligesom en overførsel. Bufferen belastes nettobeløbet,
  // fordi AM-delen allerede er trukket som en del af årets skat — trak vi
  // bruttobeløbet ud og lagde nettobeløbet ind, ville AM-delen forsvinde to
  // gange, og invarianten knække.
  const contributed = contributions.reduce(
    (years, { contribution, from, intoHolding }) =>
      withMovement(withMovement(years, from, -intoHolding), contribution.to, intoHolding),
    moved,
  )

  // Aftalens penge er en intern bevægelse som en indbetalings: bufferen
  // belastes det landede beløb, og AM-delen er allerede trukket som en del
  // af årets skat af hele bruttolønnen.
  const placed = placedAgreements.reduce(
    (years, { placements }) =>
      placements.reduce(
        (years, { to, landed }) =>
          withMovement(withMovement(years, plan.buffer, -landed), to, landed),
        years,
      ),
    contributed,
  )

  // Raten er heller ikke et led i invarianten: den flytter penge fra
  // beholdningen til bufferen og lader formuen uændret, præcis som en
  // overførsel. Kun dens skat sætter aftryk.
  const paid = payouts.reduce(
    (years, { holding, amount }) =>
      withMovement(withPayout(years, holding, amount), plan.buffer, amount),
    placed,
  )

  // Den sidste rate fejer resten med. Fejningen kommer efter afkastet, som
  // allerede er noteret vægtet, og har derfor selv vægt nul — ingen
  // cirkularitet, og rækkefølgen i diagram 02 holder.
  const swept = sweepFinalInstalment(payouts, paid, plan.buffer)

  // Depotet forlader husstandens formue her — ingen modtager, og hverken en
  // udgift eller en skat. Det er dét, `conversion`-leddet i
  // balanceinvarianten er til for.
  const converted = convert(annuities, swept.years)

  // Folkepensionen står intet sted i planen: hvem der får den, udledes af
  // fødselsdatoen, jf. ADR-0023, og hvad den er, af satsåret. Her afgøres
  // kun det første — kronebeløbene og aftrapningen af tillægget hører til
  // husstandssømmet nedenfor.
  //
  // Den opgøres her og ikke længere oppe, fordi den er årets drift og ikke
  // en dateret bevægelse. Den udbetales månedsvis og lander på bufferen,
  // hvor en jævn strøm vejer nul, jf. ADR-0024 — og bogen er lukket, så den
  // kan ikke vejes noget sted alligevel.
  const statePensions = statePensionsInYear(plan.household, year)

  // Aftalens gebyr og præmie er udgifter og ingen poster: pengene forlader
  // husstanden uden at blive til formue, og balanceinvarianten har kun det
  // ene led tilbage til dem, jf. ADR-0042. De står derfor i `expenses` uden
  // at have en `Entry` bag sig — årstabellens kolonne siger det selv.
  const expenses = sumOf(entries, 'Expense') + agreementCosts(placedAgreements)

  // Bufferen kan være et aktiedepot eller en opsparingskonto, og dens afkast
  // er da personens egen aktie- eller kapitalindkomst: læste opgørelsen her
  // et andet afkast end det, beholdningsrækken viser, ville skatten være
  // regnet af et tal, brugeren ikke kan finde nogen steder. Det er samme tal
  // i enhver bog fra krediteringen og frem — afkastet er et tal på rækken og
  // ikke en beregning, en bevægelse kan røre.
  const shareIncomeByPerson = incomeByVariant(plan, credited, 'ShareDepot')
  const capitalIncomeByPerson = incomeByVariant(plan, credited, 'SavingsAccount')

  // Hele husstandens skat bag ét søm, jf. ADR-0014. Motoren lægger intet
  // sammen selv: aktieindkomstens skat er husstandens og hører ikke til
  // nogen enkelt person, og totalen er modulets egen sum af sine dele.
  //
  // Raterne kommer med fejningen lagt til: den er en krone, personen
  // beskattes af, som enhver anden rate.
  const household = assessHousehold(
    {
      persons: plan.household.persons.map((person) => ({
        tax: taxInput(entries, person, rates, year, {
          capitalIncome: capitalIncomeByPerson.get(person.id)!,
          ...deductibleOf(byPerson.get(person.id)!, placedAgreements, person, plan),
          payouts: payoutOf(swept.payouts, person),
          benefits: sumOfBenefits(annuitiesOf(annuities, person)),
        }),
        shareIncome: shareIncomeByPerson.get(person.id)!,
        ...civilStatusOf(statePensions, person),
      })),
    },
    rates,
  )

  // Folkepensionen kommer udefra, ganske som den omsatte livrentes ydelse,
  // og indgår derfor i årets indtægter — hvor en rate blot flytter penge
  // mellem husstandens egne lommer, jf. diagram 02. Beløbene er sømmets, og
  // summen kan derfor først lægges her: tillægget er aftrappet undervejs.
  const income =
    sumOf(entries, 'Income') + sumOfBenefits(annuities) + sumOfStatePensions(household)

  // Årets restpost lander på bufferen. Den er det ene sted, over- og
  // underskuddet må samle sig, og den må gerne gå negativt — det er modellens
  // måde at sige, at planen ikke holder, jf. ADR-0002.
  //
  // Kun husstandens egen skat trækkes her. Beholdningsskatten er allerede
  // trukket af beholdningen selv ved krediteringen og passerer aldrig
  // pengestrømmen; trak bufferen den også, ville den være betalt to gange.
  const settled = withMovement(
    converted.years,
    plan.buffer,
    income - totalHouseholdTax(household) - expenses,
  )

  // Lukningen gør rækkerne til årsresultatets beholdningsår. Først dér er
  // alle fire bærere af årets skat kendt, og først dér kan de lægges sammen.
  const holdings = closeYear(settled)
  const transferChargeTotal = transfers.reduce((sum, { amount, landed }) => sum + (amount - landed), 0)
  const tax = totalYearTax(household, holdings, transferChargeTotal)

  return {
    year,
    rateBasis,
    openingWealth: sumOver(holdings, (holding) => holding.openingBalance),
    closingWealth: sumOver(holdings, (holding) => holding.closingBalance),
    income,
    return: sumOver(holdings, (holding) => holding.return),
    tax,
    expenses,
    conversion: converted.conversion,
    holdings,
    // Postens eget årstal er lønnen alene. Arbejdsgiverbidraget står i
    // aftalens regnestykke, hvor planlæggeren vil lede efter det — og hvor
    // det også står i virkeligheden, jf. ADR-0040.
    entries: entries.map(({ entry, own }) => ({ entry: entry.id, amount: own })),
    contributions: contributions.map(({ contribution, fromSource, intoHolding }) => ({
      contribution: contribution.id,
      fromSource,
      intoHolding,
    })),
    pensionAgreements: placedAgreements.map(
      ({
        entry,
        employerContribution,
        employeeContribution,
        labourMarketContribution,
        fee,
        insurancePremium,
        placements,
      }) => ({
        entry,
        employerContribution,
        employeeContribution,
        labourMarketContribution,
        fee,
        insurancePremium,
        destinations: placements.map(({ to, requested, landed }) => ({
          holding: to,
          requested,
          landed,
        })),
      }),
    ),
    transfers: transfers.map(({ transfer, from, requested, amount, landed }) =>
      payoutTaxation(from) === 'Chargeable'
        ? {
            payoutTaxation: 'Chargeable' as const,
            transfer: transfer.id,
            requested,
            moved: amount,
            landed,
          }
        : { payoutTaxation: 'TaxFree' as const, transfer: transfer.id, requested, moved: amount },
    ),
    persons: plan.household.persons.map((person, index) => ({
      person: person.id,
      shareIncome: shareIncomeByPerson.get(person.id)!,
      capitalIncome: capitalIncomeByPerson.get(person.id)!,
      tax: household.persons[index]!.tax,
      marginal: household.persons[index]!.marginal,
      lifeAnnuityBenefits: benefitsOf(annuities, person),
      ...statePensionOf(household.persons[index]!),
      caps: byPerson.get(person.id)!.caps,
    })),
    shareIncomeTax: household.shareIncomeTax,
    bufferState: bufferState(plan, holdings, year, rates),
    capBreach: capBreach([...byPerson.values()]),
  }
}

function sumOver(holdings: HoldingYear[], of: (holding: HoldingYear) => Nominal): Nominal {
  return holdings.reduce((sum, holding) => sum + of(holding), 0)
}

/** Hvorfor bufferen er negativ ved årets slutning, jf. ADR-0008: `Incomplete`
    når husstanden har likviditet andetsteds og blot mangler en overførsel, og
    `Unsustainable` når den ikke har. Fraværende, når bufferen ikke er negativ.

    "Likviditet andetsteds" er de beholdninger, en overførsel kan nå i netop
    det år, og ikke summen af alle øvrige, jf. ADR-0022. Summen af alle øvrige
    talte likviditet med, som ingen overførsel kunne hente: en ratepension kan
    kun nås af en udbetalingsplan, der binder ti år frem, og en aldersopsparing
    eller en kapitalpension først fra sin `PayoutAge`. Spørgsmålet stilles
    derfor gennem `transferAllowedFrom`, det samme opslag, `validatePlan`
    afviser en umulig overførsel med — de to må ikke kunne svare hver sit.

    Målt er ikke saldoen, men det beløb, en fuld tømning ville lande med, jf.
    ADR-0029: en kapitalpension på 100.000 med 40 % i afgift dækker kun
    60.000 af et hul, og talte saldoen med uden fradrag, ville `Incomplete`
    love noget, en overførsel ikke kan indfri.

    Året er årets, og svaret kan derfor skifte undervejs: den samme plan er
    `Unsustainable`, mens aldersopsparingens dør er lukket, og `Incomplete`
    bagefter. */
function bufferState(
  plan: Plan,
  holdings: HoldingYear[],
  year: SimulationYear,
  rates: RateYear,
): BufferState | undefined {
  const buffer = holdings.find((holding) => holding.holding === plan.buffer)!
  if (buffer.closingBalance >= 0) return undefined

  const closingBalanceOf = new Map(
    holdings.map((holding) => [holding.holding, holding.closingBalance]),
  )
  const elsewhere = plan.household.persons
    .flatMap((person) =>
      person.holdings
        .filter((holding) => holding.id !== plan.buffer)
        .filter((holding) => transferAllowedFrom(holding, person, year)),
    )
    .reduce((sum, holding) => {
      const closingBalance = closingBalanceOf.get(holding.id)!
      return sum + (closingBalance - transferCharge(holding, closingBalance, rates))
    }, 0)

  return elsewhere >= -buffer.closingBalance ? 'Incomplete' : 'Unsustainable'
}

/** Summen af afkastet på en persons beholdninger af én variant — grundlaget
    for aktie- og kapitalindkomsten pr. person, jf. ADR-0010. */
function incomeByVariant(
  plan: Plan,
  years: CreditedHoldingYears,
  variant: HoldingVariant,
): Map<PersonId, Nominal> {
  return new Map(
    plan.household.persons.map((person) => [
      person.id,
      person.holdings
        .filter((holding) => holding.variant === variant)
        .reduce((sum, holding) => sum + returnOf(years, holding.id), 0),
    ]),
  )
}

/** Summen af årets poster, hver vægtet efter sit forfald — grundlaget der
    lægges til primosaldoen i Modified Dietz. Posterne lander alle på
    bufferen, og strømmen vejes derfor i bufferens ende: en jævn post bliver
    til nul, en dateret beholder sin vægt, jf. `weightAt`. */
function weightedNetFlow(entries: ActiveEntry[], buffer: HoldingId): Nominal {
  return entries.reduce((sum, { entry, amount }) => {
    const signed = entry.direction === 'Income' ? amount : -amount
    return sum + signed * weightAt(buffer, entry.timing, buffer)
  }, 0)
}

/** Vejer en strøm ind i begge ender af sit forløb: afgiveren mister sin
    vægtede del af afkastgrundlaget, og modtageren får sin.

    De to ender spørges hver for sig, og de kan svare forskelligt, jf.
    `weightAt`. Det er ikke en inkonsistens: vægten er en egenskab ved enden
    og ikke ved strømmen, og en jævn rate mister derfor `½ × beløbet` i
    ordningen uden at give noget som helst på bufferen.

    De to ender kan også få hvert sit beløb: en overførsel ud af en
    `Chargeable` ordning mister `fromAmount` i afgiverens ende, men kun det,
    der landede, i modtagerens — afgiften forlader husstanden og forrenter
    sig ingen steder, jf. ADR-0029. Ens for enhver anden bevægelse, hvor de to
    beløb er de samme. */
function withWeightedFlow(
  years: HoldingYears,
  from: HoldingId,
  to: HoldingId,
  fromAmount: Nominal,
  toAmount: Nominal,
  timing: Timing,
  buffer: HoldingId,
): HoldingYears {
  return withFlow(
    withFlow(years, from, -fromAmount * weightAt(from, timing, buffer)),
    to,
    toAmount * weightAt(to, timing, buffer),
  )
}

/** Afkastvægten i den ende af en strøm, der rammer `end`. Vægten er en
    egenskab ved enden og ikke ved strømmen, jf. ADR-0024: på bufferens ende
    giver et jævnt forfald nul, fordi bufferen er husstandens
    transaktionskonto — en jævn strøm passerer den blot og efterlader først
    over- eller underskuddet ved årets slutning, hvor det lander som en
    bevægelse uden vægt.

    Reglen gælder kun bufferens ende, og kun de jævne strømme. Enhver anden
    beholdning vejer som før, og en strøm med et forfald i en bestemt måned
    beholder sin vægt hele vejen — også på bufferen. En jævn strøm er ikke en
    begivenhed, den er et niveau, og en transaktionskonto beholder ikke et
    niveau.

    Eksporteret så fladen kan vise en posts afkastvægt uden at regne den om
    — og uden at kunne komme til at vise en anden vægt, end den motoren
    regnede med. */
export function weightAt(end: HoldingId, timing: Timing, buffer: HoldingId): number {
  return end === buffer && timing === 'Even' ? 0 : returnWeight(timing)
}

/** `Even` er det matematisk rigtige for jævnt fordelte strømme, ikke en
    tilnærmelse; måned N vejer strømmen efter, hvor meget af året der er
    tilbage, jf. ADR-0006. Vægten i én ende spørges gennem `weightAt`, som
    er den, der kender bufferens undtagelse. */
function returnWeight(timing: Timing): number {
  return timing === 'Even' ? 0.5 : (12 - timing + 1) / 12
}

/** Om et loft er brudt i året, og hvad bruddet kostede — husstandens
    konklusion i ét felt, jf. ADR-0018. Et brud er beløbet **over** loftet:
    et bidrag, der rammer loftet på kronen, har hverken mistet fradragsret
    eller udløst afgift.

    Kun `PerYear` kan bryde. `OnBalance` forhindrer indskuddet frem for at
    straffe det, og et år, hvor et indskud blev afkortet, er derfor umarkeret
    — afkortningen står på loftlinjen i stedet, jf. ADR-0019.

    De to slags brud er én form og to regler. Ratepensionen har en
    fradragsret, som det overskydende mister, og det koster rigtige penge i
    årets skat; aldersopsparingen har ingen at miste og betaler i stedet en
    afgift, som ikke er modelleret. Brydes begge samme år, står den, der
    flyttede skatten. */
function capBreach(persons: PersonCaps[]): CapBreach | undefined {
  const breached = persons
    .flatMap(({ caps }) => caps)
    // Formen først, tallene bagefter. En `OnBalance`-linje har ikke et
    // beløb, der landede over sit loft — den har et, der aldrig kom ind — og
    // sammenlignes de to alligevel, markerer året et brud, der ikke er sket,
    // jf. ADR-0019.
    .filter((line): line is Extract<CapYear, { form: 'PerYear' }> => line.form === 'PerYear')
    .filter((line) => line.paid > line.cap)
  if (breached.length === 0) return undefined

  // En loftbelagt ordning med fradragsret har fået præcis loftet med over —
  // resten er tabt. En uden har nul, og dens overskydende er afgiftspligtigt
  // i stedet.
  return breached.some((line) => line.withDeductibility > 0)
    ? 'LostDeductibility'
    : 'Chargeable'
}

/** Ét beløb på vej ind i én beholdning i ét simuleringsår, uden hensyn til
    hvilken figur det kom af. Både en `Contribution` og en
    `PensionAgreement`s fordelingslinje bliver til en af disse, før lofterne
    måler.

    Kildeuafhængigheden er ikke en bekvemmelighed, den er selve reglen:
    loftet måles pr. person og pr. slags ordning og aldrig pr. indbetaling,
    jf. ADR-0018, og en opgørelse, der kunne se forskel på de to kilder,
    ville kunne komme til at måle dem hver for sig. Loftet var i forvejen en
    sum over flere kilder — der er alene kommet én slags mere, jf. ADR-0041.

    Beløbet er det, der **landede** i beholdningen, altså efter AM-bidrag:
    både fradragsretten, det ekstra pensionsfradrags grundlag og lofterne
    måler dér, jf. PBL § 16, stk. 3, LL § 9 L, stk. 1, og
    docs/satser/2026.md. */
type Payment = { to: HoldingId; intoHolding: Nominal }

/** Det, én person fik ud af årets lofter: linjerne, årsresultatet skal vise,
    og det ene tal, der krydser skattesømmet.

    Det er denne gruppering — og aldrig en `HoldingVariant` — der krydser
    sømmet: skattereglen hedder ikke "ratepension giver fradragsret", men
    "indbetalinger til ordninger, hvis udbetaling er personlig indkomst,
    giver fradragsret", og hvilke varianter det så er, er varianttabellens
    viden og ikke skattens, jf. ADR-0016 og ADR-0014. */
type PersonCaps = { caps: CapYear[]; withDeductibility: Nominal }

/** Årets betalinger ført gennem lofterne: hvad hver person fik ud af dem, og
    de betalinger, et loft afkortede.

    De to svar kommer fra samme opgørelse med vilje. Regnede forklar-årets
    linje, årets skat og de penge, der faktisk blev flyttet, hver sit sted,
    kunne de komme til at sige hver sit, og brugeren ville se en linje, der
    ikke kan efterregne hverken den skat eller den saldo, den står ved siden
    af, jf. ADR-0018 og ADR-0019.

    Afkortningen svares som pladserne i den liste, opgørelsen fik, frem for
    som betalingerne selv: en betaling ved ikke, hvilken figur den kom af, og
    det er figuren, der skal have sit beløb rettet. Kortet er tomt i ethvert
    år, hvor intet loft afkortede noget — og det er de fleste, for kun
    `OnBalance` afkorter, jf. ADR-0019.

    Opgørelsen står før årets strømme. En loftform, der afkorter selve
    indbetalingen, skal være afgjort, før noget vejes ind i afkastgrundlaget
    — og den saldo, `OnBalance` måler mod, er årets primo og ikke en saldo
    undervejs, jf. ASKL § 9, stk. 1.

    `PerYear` afkorter ingenting. Hele indbetalingen er allerede landet i
    beholdningen, og det overskydende bliver liggende dér — motoren flytter
    ikke pengene tilbage på bufferen, jf. ADR-0018 og ADR-0002. */
type MeasuredPayments = {
  byPerson: Map<PersonId, PersonCaps>
  shortened: Map<number, Nominal>
}

function paymentsThroughCaps(
  plan: Plan,
  payments: Payment[],
  rates: RateYear,
  year: SimulationYear,
  opening: ReadonlyMap<HoldingId, Nominal>,
): MeasuredPayments {
  const byPerson = new Map<PersonId, PersonCaps>()
  const shortened = new Map<number, Nominal>()

  for (const person of plan.household.persons) {
    // Årstællingen går gennem `statePensionYear`, motorens eneste vej til
    // det årstal: aldersopsparingens vindue og det ekstra pensionsfradrags
    // 15-årsgrænse skal ramme det samme år, og alderen er en brøk for de
    // fleste årgange.
    const own = throughCaps(person, payments, rates, statePensionYear(person) - year, opening)
    byPerson.set(person.id, { caps: own.caps, withDeductibility: own.withDeductibility })
    for (const [index, amount] of own.shortened) shortened.set(index, amount)
  }

  return { byPerson, shortened }
}

/** Årets betalinger til én person ført gennem personens lofter, én
    variantgruppe ad gangen. Loftet er personens og gælder personens
    ordninger af den slags under ét: to ratepensioner med 40.000 kr. hver er
    ét brud og ikke to lovlige indbetalinger, jf. PBL § 16.

    Selve reglen ligger i `throughCap`. Her lægges gruppernes svar sammen.

    Grupper uden betaling får ingen linje, og en variant uden loft heller
    ikke. En linje på nul ville sige, at året indbetalte til en ordning, det
    ikke rørte, og et loft, der ikke blev målt mod noget, er ikke et svar.
    Men det, der tælles, er hvad året **bad om** og ikke hvad der landede:
    ellers forsvandt netop det år, hvor råderummet var nul, og hele
    indskuddet blev afvist.

    Hver betaling går til præcis én persons beholdning, jf. `validatePlan`,
    så hver af dem er målt nøjagtig én gang. */
function throughCaps(
  person: Person,
  payments: Payment[],
  rates: RateYear,
  yearsToStatePensionAge: number,
  opening: ReadonlyMap<HoldingId, Nominal>,
): PersonCaps & { shortened: Map<number, Nominal> } {
  const caps: CapYear[] = []
  const shortened = new Map<number, Nominal>()
  let withDeductibility = 0

  for (const holdings of byVariant(person).values()) {
    const group = throughCap(holdings, payments, rates, yearsToStatePensionAge, opening)
    withDeductibility += group.withDeductibility
    for (const [index, amount] of group.shortened) shortened.set(index, amount)
    if (group.line !== undefined) caps.push(group.line)
  }

  return { caps, withDeductibility, shortened }
}

/** Én gruppes vej gennem sit loft: det tal, der krydser skattesømmet, de
    afkortninger opgørelsen svarer med, og linjen året skal vise. */
type CappedGroup = {
  /** Det, der landede i gruppen med `Deductibility` i behold — nul for en
      variant, der ingen har. De tre veje igennem giver hver sit grundlag at
      måle af, men fradragsretten selv følger destinationens variant og
      spørges derfor ét sted, jf. ADR-0016. */
  withDeductibility: Nominal
  /** De betalinger, loftet afkortede, slået op på deres plads i årets liste.
      Tomt for de to veje igennem, der ikke afkorter noget. */
  shortened: Map<number, Nominal>
  /** Fraværende, når varianten ingen loft har, eller når året ikke bad om
      noget. */
  line?: CapYear
}

/** Årets betalinger til én persons beholdninger af én variant, ført gennem
    den varianttabellen giver dem — de tre veje, `Cap` kan gå.

    Uden loft går pengene urørt igennem. `PerYear` lader dem lande og
    begrænser kun det tal, skatten regnes af: det overskydende bliver
    liggende i ordningen, jf. ADR-0018. `OnBalance` afkorter selve
    betalingen til råderummet, og det uindskudte forlader aldrig kilden, jf.
    ADR-0019. Det er hele grunden til, at funktionen svarer med afkortninger
    og ikke kun med et tal og en linje.

    Bad året ikke om noget, måles der ikke. */
function throughCap(
  holdings: Holding[],
  payments: Payment[],
  rates: RateYear,
  yearsToStatePensionAge: number,
  opening: ReadonlyMap<HoldingId, Nominal>,
): CappedGroup {
  // Gruppens betalinger læses ud af årets liste, som allerede står i den
  // rækkefølge, råderummet uddeles i — planens egne indbetalinger først,
  // aftalernes fordelinger derefter, jf. ADR-0019 og ADR-0041. Pladsen
  // følger med, for det er den, en afkortning svares på.
  const ids = new Set(holdings.map((holding) => holding.id))
  const into = payments.flatMap((payment, index) =>
    ids.has(payment.to) ? [{ index, payment }] : [],
  )
  const requested = into.reduce((sum, { payment }) => sum + payment.intoHolding, 0)
  const untouched = { withDeductibility: 0, shortened: new Map<number, Nominal>() }
  if (requested === 0) return untouched

  // Beholdningerne i gruppen deler variant, og loftet gælder dem under ét —
  // den første kan derfor svare på tabellens vegne for dem alle.
  const holding = holdings[0]!
  const limit = cap(holding, rates, yearsToStatePensionAge)
  const variant = cappedVariant(holding)
  const deductible = (amount: Nominal) => (hasDeductibility(holding) ? amount : 0)

  if (limit === undefined || variant === undefined) {
    return { ...untouched, withDeductibility: deductible(requested) }
  }

  if (limit.form === 'PerYear') {
    // Pengene er landet. Loftet begrænser kun det tal, skatten regnes af —
    // og aldersopsparingen har ingen fradragsret at miste, så dens
    // overskydende ændrer ikke et tal her, jf. `Cap` i CONTEXT.md.
    const withDeductibility = deductible(Math.min(requested, limit.amount))
    return {
      withDeductibility,
      shortened: new Map(),
      line: {
        form: 'PerYear',
        variant,
        paid: requested,
        cap: limit.amount,
        withDeductibility,
      },
    }
  }

  // Råderummet er loftet minus primosaldoen og aldrig negativt — vokser
  // saldoen over loftet af afkast alene, er intet loft brudt, der er blot
  // ikke plads til mere, jf. ADR-0019.
  const openingBalance = holdings.reduce((sum, held) => sum + opening.get(held.id)!, 0)
  const shortened = shortenToHeadroom(into, Math.max(limit.amount - openingBalance, 0))
  const deposited = [...shortened.values()].reduce((sum, amount) => sum + amount, 0)

  return {
    withDeductibility: deductible(deposited),
    shortened,
    line: {
      form: 'OnBalance',
      variant,
      requested,
      cap: limit.amount,
      openingBalance,
      deposited,
    },
  }
}

/** Årets betalinger i den rækkefølge, lofterne måler dem: planens egne
    indbetalinger først, aftalernes fordelinger derefter.

    Rækkefølgen falder ud af afhængigheden og ikke af en listeposition, jf.
    ADR-0041: en fordelingslinje skal kunne vide, hvad de øvrige
    indbetalinger til ordningen tog, og de øvrige skal aldrig vide, hvad
    aftalen tog. Rækkefølgen i `plan.contributions` er urørt — den afgør
    stadig, hvem der først får råderummet under et `OnBalance`-loft, jf.
    ADR-0019. */
function paymentsOf(
  contributions: ActiveContribution[],
  agreements: ActiveAgreement[],
): Payment[] {
  return [
    ...contributions.map(({ contribution, intoHolding }) => ({
      to: contribution.to,
      intoHolding,
    })),
    ...agreements.flatMap(({ placements }) =>
      placements.map(({ to, landed }) => ({ to, intoHolding: landed })),
    ),
  ]
}

/** En indbetaling, som et loft afkortede den — eller den samme igen, når
    intet loft rørte den.

    Begge tal afkortes til det samme. Kun et beholdningskildet bidrag kan nå
    et `OnBalance`-loft — der findes ingen arbejdsgiveradministreret
    aktiesparekonto, og `validatePlan` afviser den anden form — og dér har
    pengene aldrig båret AM-bidrag, så det, der forlod kilden, er det, der
    kom ind. Resten forlader aldrig kilden, jf. ADR-0019. */
function shortenedTo(
  active: ActiveContribution,
  intoHolding: Nominal | undefined,
): ActiveContribution {
  return intoHolding === undefined ? active : { ...active, fromSource: intoHolding, intoHolding }
}

/** Aftalerne med et lofts afkortning skrevet ind i deres fordelinger.

    Betalingerne blev målt i den rækkefølge, `paymentsOf` lagde dem, og
    `offset` er dermed pladsen, hvor den første af aftalernes står. */
function withShortenedPlacements(
  agreements: ActiveAgreement[],
  shortened: ReadonlyMap<number, Nominal>,
  offset: number,
): ActiveAgreement[] {
  let index = offset
  return agreements.map((agreement) => ({
    ...agreement,
    placements: agreement.placements.map((placement) => {
      const landed = shortened.get(index++)
      return landed === undefined ? placement : { ...placement, landed }
    }),
  }))
}

/** Personens beholdninger grupperet efter variant, i den rækkefølge de står
    i planen. Loftet måles over gruppen og aldrig over den enkelte
    beholdning, jf. ADR-0018. */
function byVariant(person: Person): Map<HoldingVariant, Holding[]> {
  const groups = new Map<HoldingVariant, Holding[]>()
  for (const holding of person.holdings) {
    groups.set(holding.variant, [...(groups.get(holding.variant) ?? []), holding])
  }
  return groups
}

/** Årets indskud afkortet til råderummet, i listens rækkefølge: den første
    tager sit fulde beløb, og den næste får resten. Skranken honorerer det
    første indskud og afviser det næste — pro rata ville afkorte dem begge,
    og den fordeling sker ikke nogen steder, jf. ADR-0019.

    Svaret er hvert indskuds plads og dets afkortede beløb. Også de
    uafkortede står der: kaldet kender ikke ét råderum fra et andet, og et
    kort med huller i ville lade en betaling stå med et beløb, opgørelsen
    ikke har set. */
function shortenToHeadroom(
  deposits: { index: number; payment: Payment }[],
  headroom: Nominal,
): Map<number, Nominal> {
  let left = headroom
  return new Map(
    deposits.map(({ index, payment }) => {
      const amount = Math.min(payment.intoHolding, left)
      left -= amount
      return [index, amount]
    }),
  )
}

/** Det, en persons skat skal regnes af — selve opgørelsen sker bag
    skattesømmet. Kommune- og kirkeskatteprocenten slås op i satsåret efter
    personens bopælskommune. Kirkeskatten slås fra ved at regne med nul, når
    personen ikke er medlem af folkekirken.

    Årets indtægtsposter deles op efter deres skattebehandling og krydser
    sømmet som hver sit tal: arbejdsindkomsten bærer AM-bidrag og de to
    arbejdsfradrag, pensionsindkomsten ingen af delene. Lagt sammen ville en
    pensionist få beskæftigelsesfradrag. En `TaxFree`-post krydser slet ikke
    — den har intet at gøre i nogen af de to summer. Pensionsindkomsten
    udelades, når året ingen har, ligesom indbetalingen gør.

    Årets rater lægges til pensionsindkomsten og krydser sømmet i den. De er
    hverken en post eller en ydelse, men skatten kender ingen af delene: den
    kender personlig indkomst uden AM-bidrag, og en rate og et ATP-beløb er
    det samme dér, jf. `PensionIncome` i CONTEXT.md.

    Folkepensionen er derimod **ikke** med. Den lægges til inde i sømmet,
    efter aftrapningen: den indgår ikke i sit eget aftrapningsgrundlag, jf.
    PL § 29, stk. 4, nr. 1, og var den lagt til her, kunne grundlaget ikke
    skilles fra den igen. Det er netop den regel, der gør husstandskoblingen
    til ét gennemløb frem for en fikspunktsiteration.

    Årets indbetaling med `Deductibility` går med som ét tal og udelades, når
    den er nul — så står året uden indbetaling, og fradraget følger
    indbetalingen frem for personen. Årstællingen frem til
    folkepensionsalderen går gennem `statePensionYear`, motorens eneste vej
    til det årstal, så det ekstra pensionsfradrags 15-årsgrænse og
    folkepensionens egen start ikke kan skille sig i det halve år.

    De to tal, `simulateYear` allerede har regnet pr. person, står i ét
    argument frem for som to `Nominal` ved siden af hinanden: to bare tal i
    træk kan byttes om uden at compileren siger fra, og det er præcis den
    slags fejl, der ikke viser sig som andet end en forkert skat. */
function taxInput(
  entries: ActiveEntry[],
  person: Person,
  rates: RateYear,
  year: SimulationYear,
  ofPerson: {
    capitalIncome: Nominal
    withDeductibility: Nominal
    extraPensionAllowanceBase: Nominal
    payouts: Nominal
    benefits: Nominal
  },
): TaxAssessmentInput {
  const ownIncome = (taxTreatment: TaxTreatment) =>
    entries
      .filter(
        ({ entry }) =>
          entry.direction === 'Income' &&
          entry.owner === person.id &&
          entry.taxTreatment === taxTreatment,
      )
      .reduce((sum, { amount }) => sum + amount, 0)

  const pensionIncome =
    ownIncome('PensionIncome') + ofPerson.payouts + ofPerson.benefits
  const municipalTax = rates.municipalTax.rates[person.municipality]!

  return {
    earnedIncome: ownIncome('EarnedIncome'),
    municipalTaxRate: municipalTax.municipalTaxRate,
    churchTaxRate: person.churchMember ? municipalTax.churchTaxRate : 0,
    capitalIncome: ofPerson.capitalIncome,
    ...(pensionIncome > 0 ? { pensionIncome } : {}),
    ...(ofPerson.withDeductibility > 0
      ? {
          contribution: {
            withDeductibility: ofPerson.withDeductibility,
            extraPensionAllowanceBase: ofPerson.extraPensionAllowanceBase,
            yearsToStatePensionAge: statePensionYear(person) - year,
          },
        }
      : {}),
  }
}

/** Årets rater: én pr. beholdning, hvis udbetalingsplan er i gang i året.

    En beholdning uden plan giver ingen linje, og det er hele grunden til, at
    feltet er valgfrit — en ratepension, brugeren endnu ikke har besluttet
    sig om, bliver stående og vokser frem for at få motoren til at nægte at
    regne.

    Starten er en `AgeBound` og oversættes til et kalenderår gennem
    `yearAtAge`, ganske som en posts periode: er den sat til erhvervsophør,
    flytter hele forløbet sig, når `WorkEndAge` ændres, uden at planen
    redigeres. Uden for de `duration` år, planen løber, falder ingen rate —
    en tømt ratepension bliver stående med saldo nul. */
function payoutsInYear(
  plan: Plan,
  year: SimulationYear,
  rates: RateYear,
  opening: ReadonlyMap<HoldingId, Nominal>,
): ActivePayout[] {
  return plan.household.persons.flatMap((person) =>
    person.holdings.flatMap((holding) => {
      const schedule = payoutScheduleOf(holding)
      if (schedule === undefined) return []

      const remaining = remainingPayoutYears(schedule, person, year)
      if (remaining === undefined) return []

      return [
        {
          holding: holding.id,
          owner: person.id,
          amount: instalment(
            schedule.principle,
            opening.get(holding.id)!,
            remaining,
            rates,
          ),
          final: remaining === 1,
        },
      ]
    }),
  )
}

/** Antallet af udbetalingsår, der er tilbage til og med dette — eller
    `undefined`, når året ligger uden for planen. Det er den nævner, begge
    principper regner med, og den tælles i kalenderår: udbetalingsalderen er
    ofte en brøk, og året, hvor personen fylder 62,5, indeholder lovlige
    udbetalingsmåneder. */
function remainingPayoutYears(
  schedule: PayoutSchedule,
  owner: Person,
  year: SimulationYear,
): number | undefined {
  const start = payoutStartYear(schedule.start, owner)
  const remaining = start + schedule.duration - year
  return year >= start && remaining > 0 ? remaining : undefined
}

/** Årets rate, regnet af primosaldoen efter planens princip.

    Serieprincippet deler saldoen med de resterende udbetalingsår og giver
    stigende rater ved positivt afkast. Annuitetsprincippet regner i stedet
    annuiteten af saldoen over de samme år, med satsårets amortisationsrente
    — den er satsdata efter PBL § 11 A, stk. 3, og aldrig beholdningens eget
    nettoafkast. Er nettoafkastet højere end renten, stiger raterne let år
    for år; deraf *tilnærmelsesvis* lige store rater og ikke lige store, jf.
    `AnnuityPrinciple` i CONTEXT.md.

    Ved rente nul er annuiteten serien: formlen går mod `saldo ÷ år`, men
    divisionen ville være nul over nul, og grænsen skrives derfor ud. Det er
    ikke et hypotetisk år — Finans Danmark kan fastsætte renten til nul, og
    loftet i loven er en øvre og ikke en nedre grænse. */
function instalment(
  principle: PayoutPrinciple,
  openingBalance: Nominal,
  remaining: number,
  rates: RateYear,
): Nominal {
  if (principle === 'SerialPrinciple') return openingBalance / remaining

  const rate = rates.amortisationRate.rate
  if (rate === 0) return openingBalance / remaining
  return (openingBalance * rate) / (1 - (1 + rate) ** -remaining)
}

/** Årets rater efter den sidste rates fejning, og bogen med fejningen
    bogført.

    De to svar kommer af samme opgørelse med vilje. Fejningen er både et
    beløb, beholdningen forlader, og en krone, personen beskattes af — regnet
    hver sit sted kunne de komme til at sige hver sit, og brugeren ville se
    en rate, der ikke kan efterregne den skat, den står ved siden af. Samme
    greb som `PersonContributions`, jf. ADR-0018.

    Resten er saldoen, som den står på den krediterede bog: årets afkast er
    tilskrevet og beholdningsskatten trukket. Den kan være negativ —
    annuitetsprincippets sidste rate overstiger saldoen — og fejningen
    trækker så fra i stedet. Begge veje lukker beholdningen på nul, og det er
    hele reglen. */
function sweepFinalInstalment(
  payouts: ActivePayout[],
  years: CreditedHoldingYears,
  buffer: HoldingId,
): { payouts: ActivePayout[]; years: CreditedHoldingYears } {
  return payouts.reduce<{ payouts: ActivePayout[]; years: CreditedHoldingYears }>(
    (swept, payout) => {
      if (!payout.final) return { ...swept, payouts: [...swept.payouts, payout] }

      const remainder = balanceOf(swept.years, payout.holding)
      return {
        payouts: [...swept.payouts, { ...payout, amount: payout.amount + remainder }],
        years: withMovement(
          withPayout(swept.years, payout.holding, remainder),
          buffer,
          remainder,
        ),
      }
    },
    { payouts: [], years },
  )
}

/** Omsætningens afkastvægt. Depotet forlader beholdningen ved årets
    begyndelse — det er dét, "ved udbetalingsstart" betyder, når året er den
    mindste tidsenhed, motoren regner i — og der er derfor intet af det
    tilbage at forrente. Livrenten lukker på præcis nul uden hjælp fra andet.

    Vægten er ikke et `Timing`. Forfaldet er noget, brugeren lægger på en
    strøm, og omsætningen er ingen strøm: den er et trin, jf. ADR-0006 og
    diagram 02. */
const conversionWeight = 1

/** Årets livrenter: én linje pr. livrente, hvis udbetaling er begyndt — det
    depot, der omsættes, og den ydelse, året giver.

    En livrente uden en udbetalingsstart giver ingen linje, af samme grund
    som en ratepension uden plan: brugeren har endnu ikke besluttet sig, og
    ordningen bliver stående og vokser.

    I omsætningsåret er depotet primosaldoen, og ydelsen er den ganget med
    `ConversionFactor`. Fordi året er udledt af ejerens alder, sker
    omsætningen præcis én gang inden for én kørsel: `year === start` er sand
    i nøjagtig ét år. I alle år derefter er depotet nul, og ydelsen er sidste
    års reguleret med `bonusRate` — garanteret og fast, uden aldersskalering
    og uden genberegning, jf. ADR-0009.

    Ligger udbetalingsstarten før planens startår, er livrenten allerede
    omsat i virkeligheden, og der findes intet depot at regne ydelsen af. En
    sådan ordning skrives som en indtægtspost med `PensionIncome`, præcis som
    ATP, jf. ADR-0023 — ikke som en beholdning med en saldo, motoren ikke kan
    genskabe.

    Omsætningen selv er upåvirket af ejerens horisont — depotet er en
    beholdningsbevægelse, ikke en indkomst, jf. ADR-0030 — men ydelsen er
    `PensionIncome` og stopper derfor, når året ligger efter hendes eget
    sidste år. */
function lifeAnnuitiesInYear(
  plan: Plan,
  year: SimulationYear,
  opening: ReadonlyMap<HoldingId, Nominal>,
  previous: YearResult | undefined,
): ActiveAnnuity[] {
  return plan.household.persons.flatMap((person) =>
    person.holdings.flatMap((holding) => {
      if (!isLifeAnnuity(holding)) return []

      const start = payoutStartOf(holding)
      if (start === undefined) return []

      const startYear = payoutStartYear(start, person)
      if (year < startYear) return []

      const activeIncome = year <= personLastYear(person)
      const line = { holding: holding.id, owner: person.id }
      if (year === startYear) {
        const reserve = opening.get(holding.id)!
        return [
          {
            ...line,
            conversion: reserve,
            benefit: activeIncome ? reserve * conversionFactor(holding) : 0,
          },
        ]
      }
      return [
        {
          ...line,
          conversion: 0,
          benefit: activeIncome
            ? benefitLastYear(previous, holding.id) * (1 + holding.bonusRate)
            : 0,
        },
      ]
    }),
  )
}

/** Den ydelse, livrenten gav i det foregående år — det, `bonusRate`
    regulerer. Nul, når året ikke findes: planens første år har intet
    foregående, og en livrente, hvis omsætningsår ligger før det, har derfor
    ingen ydelse at føre videre.

    Ydelsen læses af forrige `PersonYear` frem for at blive regnet forfra af
    et gemt depot. Depotet er væk efter omsætningen — det er hele pointen i
    ADR-0009 — og et tal, der skulle bæres ved siden af årsrækken, ville
    være en tilstand, motoren ellers ikke har. */
function benefitLastYear(previous: YearResult | undefined, holding: HoldingId): Nominal {
  return (
    previous?.persons
      .flatMap((person) => person.lifeAnnuityBenefits)
      .find((benefit) => benefit.holding === holding)?.amount ?? 0
  )
}

/** Omsætningen bogført, og årets samlede omsætning.

    De to svar kommer af samme opgørelse af samme grund som den sidste rates
    fejning: beløbet er både det, beholdningen forlader, og det led,
    balanceinvarianten skal have for at gå op. Regnet hver sit sted kunne de
    komme til at sige hver sit.

    Depotet er allerede vejet ud med vægt 1, og livrenten lukker derfor på
    nul i et år, hvor intet andet faldt i den. Faldt der en indbetaling,
    bliver dens rest stående, og fejningen tager den med i omsætningen —
    efter afkastet og beholdningsskatten, og dermed med vægt nul, ganske som
    den sidste rates. Ydelsen røres ikke af det: den er regnet af
    primosaldoen, som er det depot, selskabet omsætter. */
function convert(
  annuities: ActiveAnnuity[],
  years: CreditedHoldingYears,
): { conversion: Nominal; years: CreditedHoldingYears } {
  return annuities.reduce<{ conversion: Nominal; years: CreditedHoldingYears }>(
    (converted, { holding, conversion }) => {
      if (conversion === 0) return converted

      const emptied = withMovement(converted.years, holding, -conversion)
      const remainder = balanceOf(emptied, holding)
      return {
        conversion: converted.conversion + conversion + remainder,
        years: withMovement(emptied, holding, -remainder),
      }
    },
    { conversion: 0, years },
  )
}

/** Personens egne livrenter blandt årets. Ydelsen er `PensionIncome` hos
    beholdningens ejer, og ejeren står allerede på linjen — pengene lander på
    bufferen uanset hvem det er, men skatten gør ikke, ganske som for en
    rate. */
function annuitiesOf(annuities: ActiveAnnuity[], person: Person): ActiveAnnuity[] {
  return annuities.filter((annuity) => annuity.owner === person.id)
}

/** Personens ydelseslinjer, som de står i `PersonYear`. */
function benefitsOf(annuities: ActiveAnnuity[], person: Person): LifeAnnuityBenefit[] {
  return annuitiesOf(annuities, person).map(({ holding, benefit }) => ({
    holding,
    amount: benefit,
  }))
}

/** Personens civilstand blandt årets folkepensionister, formet så den kan
    spredes ind i husstandssømmets input: et tomt objekt i årene før
    folkepensionsalderen, hvor feltet skal være fraværende, og ét felt
    bagefter.

    Spredningen frem for en valgfri værdi, så det fraværende felt ikke kan
    blive til et felt med værdien `undefined` — de to ser ens ud i
    TypeScript, men ikke i den JSON, en plan eksporteres og importeres som. */
function civilStatusOf(
  statePensions: ActiveStatePension[],
  person: Person,
): { statePension?: { civilStatus: CivilStatus } } {
  const line = statePensions.find((statePension) => statePension.owner === person.id)
  if (line === undefined) return {}
  return { statePension: { civilStatus: line.civilStatus } }
}

/** Personens folkepension, som den står i `PersonYear`. Den kommer fra
    husstandssømmet og ikke fra `statePensionsInYear`: først dér er tillægget
    aftrappet, og aftrapningen er husstandens beregning, jf. ADR-0014. */
function statePensionOf(person: {
  statePension?: StatePensionYear
}): { statePension?: StatePensionYear } {
  return person.statePension === undefined ? {} : { statePension: person.statePension }
}

/** Summen af årets folkepension i husstanden, med tillægget aftrappet.
    Begge kronebeløb er penge udefra og lægges sammen her — de står hver for
    sig i `PersonYear`, hvor udregningen skal kunne ses, og som ét tal her,
    hvor det er husstandens pengestrøm, der opgøres. */
function sumOfStatePensions(household: HouseholdTaxAssessment): Nominal {
  return household.persons.reduce(
    (sum, { statePension }) =>
      sum +
      (statePension ? statePension.basicAmount + statePension.pensionSupplement : 0),
    0,
  )
}

function sumOfBenefits(annuities: ActiveAnnuity[]): Nominal {
  return annuities.reduce((sum, annuity) => sum + annuity.benefit, 0)
}

/** Summen af de rater, personens egne beholdninger blev tømt med i året.
    Raten er `PensionIncome` hos beholdningens ejer, og ejeren står allerede
    på linjen — pengene lander på bufferen uanset hvem det er, men skatten
    gør ikke. */
function payoutOf(payouts: ActivePayout[], person: Person): Nominal {
  return payouts
    .filter((payout) => payout.owner === person.id)
    .reduce((sum, payout) => sum + payout.amount, 0)
}

/** De to tal om årets indbetalinger, som krydser skattesømmet for én person.

    De var ét tal, indtil pensionsaftalen fik et gebyr og en
    forsikringspræmie, jf. ADR-0043. De to har bortseelsesret som resten af
    § 19-indbetalingen og nedsætter derfor den personlige indkomst, uanset
    hvor pengene lander — men de skaber intet grundlag for det ekstra
    pensionsfradrag på egen hånd. Går aftalens penge ind i en aldersopsparing,
    er hverken de eller resten omfattet af § 18 eller § 19, og grundlaget er
    nul, hvor indkomsten alligevel er nedsat. Ét tal kunne ikke sige begge
    dele. Deler fordelingen sig mellem de to slags, deler de to beløb sig med
    den — pro rata efter det, hver destination fik, jf. ADR-0044.

    Loftets eget bidrag er det samme i begge: en indbetaling, der har
    fradragsret, er også den, § 9 L måler. Gebyret og præmien måles derimod
    ikke mod noget loft — de er trukket, før fordelingen mødte det, jf.
    ADR-0042. */
function deductibleOf(
  caps: PersonCaps,
  agreements: ActiveAgreement[],
  person: Person,
  plan: Plan,
): { withDeductibility: Nominal; extraPensionAllowanceBase: Nominal } {
  return agreements
    .filter((agreement) => agreement.owner === person.id)
    .reduce(
      (sums, agreement) => {
        const costs = agreement.fee + agreement.insurancePremium
        return {
          withDeductibility: sums.withDeductibility + costs,
          extraPensionAllowanceBase:
            sums.extraPensionAllowanceBase + costs * deductibleShareOf(agreement, plan),
        }
      },
      {
        withDeductibility: caps.withDeductibility,
        extraPensionAllowanceBase: caps.withDeductibility,
      },
    )
}

/** Den del af aftalens penge, der gik ind i en ordning, hvis indbetaling er
    omfattet af PBL § 18 eller § 19 — målt på det, destinationerne faktisk
    fik.

    Det er den andel, gebyret og præmien deler sig efter, jf. ADR-0044. De to
    trækkes af den samlede indbetaling, før fordelingen møder den, og de har
    derfor ingen destination af sig selv at følge. Pro rata frem for et af de
    to yderpunkter: en enkelt krone den anden vej ville ellers afgøre hele
    grundlaget for dem.

    Nul, når intet blev placeret. Et magert år, hvor gebyret og præmien tog
    det hele, har intet fordelingsforhold at måle med — og der er da heller
    ingen indbetaling, § 9 L kan måle på. Fradragsretten selv rører det ikke:
    den følger de to uanset destination, jf. ADR-0043. */
function deductibleShareOf(agreement: ActiveAgreement, plan: Plan): number {
  const placed = agreement.placements.reduce((sum, { landed }) => sum + landed, 0)
  if (placed === 0) return 0

  return (
    agreement.placements
      .filter(({ to }) => hasDeductibility(holdingById(plan, to)))
      .reduce((sum, { landed }) => sum + landed, 0) / placed
  )
}

/** Det, årets pensionsaftaler trak af indbetalingerne uden at det blev til
    formue: gebyrerne og præmierne under ét. De to opfører sig ens hele vejen
    igennem og lægges derfor sammen her — det er som udgifter, de er ens, og
    hvert af dem står for sig på aftalens egen linje, jf. ADR-0042. */
function agreementCosts(agreements: ActiveAgreement[]): Nominal {
  return agreements.reduce(
    (sum, { fee, insurancePremium }) => sum + fee + insurancePremium,
    0,
  )
}

function sumOf(entries: ActiveEntry[], direction: Entry['direction']): Nominal {
  return entries
    .filter(({ entry }) => entry.direction === direction)
    .reduce((sum, { amount }) => sum + amount, 0)
}

/** Årets poster med deres to beløb. Arbejdsgiverbidraget lægges til her og
    ingen andre steder: motorens aktive post er brutto, jf. ADR-0040, og
    resten af gennemløbet kender derfor kun ét indtægtstal, præcis som før.
    Postens eget årstal er lønnen alene og står i `EntryYear`. */
function entriesInYear(plan: Plan, year: SimulationYear): ActiveEntry[] {
  return plan.entries
    .filter((entry) => appliesInYear(entry, year, ownerOf(plan, entry), plan.household, plan.startYear))
    .map((entry) => {
      const own = entry.amountInRealKroner * entryProjection(entry, plan, year)
      const agreement = pensionAgreementOf(entry)
      const employerContribution =
        agreement === undefined
          ? 0
          : measuredAgainstEntry(agreement.employerContribution, entry, own, plan, year)
      return { entry, own, amount: own + employerContribution }
    })
}

/** Postens pensionsaftale, eller `undefined` når den ingen har. Feltet
    hænger på indtægtsgrenen alene, og opslaget står ét sted, så ingen af
    kalderne skal indsnævre unionen selv. */
function pensionAgreementOf(entry: Entry): PensionAgreement | undefined {
  return entry.direction === 'Income' ? entry.pensionAgreement : undefined
}

/** Et bidrag målt mod sin lønpost: procenten af postens eget beløb, eller
    kronebeløbet løftet med postens egen reguleringssats.

    Procenten måler `own` og aldrig brutto. Målte den brutto, skulle de 12 %,
    der står på lønsedlen, tastes som 10,714 % for at ramme de 72.000 kr., de
    i virkeligheden er — og den, der tastede de 12, ville ramme 8.640 kr. for
    højt hvert år uden at noget nogensinde spurgte, om tallet var ment, jf.
    ADR-0040. Reglen er den samme for aftalens to bidrag og for det
    selvstændige lønkildede bidrag: begge måler den post, de hænger på. */
function measuredAgainstEntry(
  amount: ContributionAmount,
  entry: Entry,
  own: Nominal,
  plan: Plan,
  year: SimulationYear,
): Nominal {
  return 'percentageOfEntry' in amount
    ? own * amount.percentageOfEntry
    : amount.amountInRealKroner * entryProjection(entry, plan, year)
}

function ownerOf(plan: Plan, entry: Entry): Person {
  return plan.household.persons.find((person) => person.id === entry.owner)!
}

/** Faktoren der løfter nutidskroner op i årets egne. En indtægt følger sin
    egen reguleringssats, uafhængig af planens inflationsantagelse; en udgift
    har ingen egen sats og følger inflationen, som en overførsel gør.
    Startåret er prisniveauet, så faktoren er 1 dér.

    Intern: fladen viser postens beløb ved at slå året op i motorens egen
    årsrække frem for at regne fremskrivningen om, jf. ADR-0012. */
function entryProjection(entry: Entry, plan: Plan, year: SimulationYear): number {
  const rate =
    entry.direction === 'Income' ? entry.regulationRate : plan.inflationAssumption
  return (1 + rate) ** (year - plan.startYear)
}

/** Om en post falder i det pågældende år: dens periode skal dække året, og
    dens gentagelse skal ramme netop det år.

    En indtægtspost har desuden ejerens egen horisont som et loft, der vinder
    over et eksplicit sat slutpunkt — jf. ADR-0030. Loftet gælder dog ikke,
    når slutpunktet eksplicit følger en anden person end postens egen ejer,
    jf. #88: fulgte det stadig ejerens horisont, ville et bevidst valg om at
    følge fx samleverens erhvervsophør kunne blive klippet af en horisont,
    valget netop var sat for at række forbi. Følger slutpunktet i stedet
    postens egen ejer — eksplicit eller ej — gælder loftet uændret.

    En udgiftspost er husstandens og ikke personens og har intet loft ud over
    sin egen periode, selvom den måtte være aldersforankret til netop denne
    ejer. */
function appliesInYear(
  entry: Entry,
  year: SimulationYear,
  owner: Person,
  household: Household,
  startYear: SimulationYear,
): boolean {
  const horizonApplies =
    entry.direction === 'Income' && endpointOwner(entry.period, 'to', owner, household).id === owner.id
  if (horizonApplies && year > personLastYear(owner)) return false
  const { from, to } = periodBounds(entry.period, owner, household)
  return withinPeriod(from, to, year) && matchesRecurrence(entry.recurrence, year, from, to, startYear)
}

/** Årets pensionsaftaler, én linje pr. lønpost der bærer en og falder i
    året. Aftalen har ingen periode at prøve: den arver lønpostens og ophører
    derfor af sig selv ved erhvervsophør, ganske som det lønkildede bidrag,
    jf. ADR-0016 og ADR-0040. Den findes dermed præcis i de år, posten står i
    `entries`.

    Rækkefølgen i årets gennemløb: de to bidrag lægges sammen, AM-bidraget
    trækkes fra, og resten fordeles. Aftalen opkræver ikke AM — hele
    indbetalingen er en del af `EarnedIncome`, og bidraget står allerede i
    personens eget skattelag, jf. ADR-0041. */
function pensionAgreementsInYear(
  plan: Plan,
  year: SimulationYear,
  entries: ActiveEntry[],
  rates: RateYear,
  contributions: ActiveContribution[],
): ActiveAgreement[] {
  const headroom = capHeadroom(plan, rates, year, contributions)

  return entries.flatMap(({ entry, own }) => {
    const agreement = pensionAgreementOf(entry)
    if (agreement === undefined) return []

    const measured = (amount: ContributionAmount) =>
      measuredAgainstEntry(amount, entry, own, plan, year)
    const employerContribution = measured(agreement.employerContribution)
    const employeeContribution = measured(agreement.employeeContribution)
    const labourMarketContribution =
      (employerContribution + employeeContribution) * labourMarketRateOf(entry, rates)

    // Gebyret og præmien følger lønpostens egen reguleringssats som alt
    // andet i aftalen, og de trækkes efter AM-bidraget og før fordelingen.
    // De måles ikke mod noget loft: det er alene det placerede beløb, der
    // møder ordningens `Cap`, jf. ADR-0042.
    //
    // Ingen af dem kan tage mere, end der er. En aftale, hvis to beløb er
    // større end indbetalingen, er afvist ved indgangen, jf. `validatePlan`
    // — men indgangen kender ikke et satsår og dermed ikke AM-satsen, og
    // der er derfor et smalt bånd tilbage, hvor bidraget alene tipper den.
    // Gebyret tages først, præmien af resten: selskabets eget træk går forud
    // for den dækning, det administrerer. Så placeres der nul frem for et
    // negativt beløb, og linjen går op af sig selv, jf. ADR-0041.
    const projection = entryProjection(entry, plan, year)
    const afterLabourMarketContribution =
      employerContribution + employeeContribution - labourMarketContribution
    const fee = Math.min(agreement.fee * projection, afterLabourMarketContribution)
    const insurancePremium = Math.min(
      agreement.insurancePremium * projection,
      afterLabourMarketContribution - fee,
    )

    return [
      {
        entry: entry.id,
        owner: entry.owner,
        employerContribution,
        employeeContribution,
        labourMarketContribution,
        fee,
        insurancePremium,
        timing: entry.timing,
        placements: allocate(
          agreement.allocation,
          afterLabourMarketContribution - fee - insurancePremium,
          projection,
          headroom,
        ),
      },
    ]
  })
}

/** Årets råderum under de lofter, en fordeling kan måle sig mod — ført med,
    mens linjerne tager af det.

    Regnskabet findes alene for `UpToCap`, som er den ene form, der ikke kan
    sige, hvad den beder om, uden at vide hvad året ellers har lagt i
    ordningen. Det er ikke loftopgørelsen: den måler bagefter og afgør årets
    skat og forklar-årets linje. Her sizes kun et ønske, og de to kan ikke
    komme til at sige hver sit om, hvad loftet **er** — begge slår det op
    gennem `cap` med det årstal, `statePensionYear` giver, og ingen af dem
    kender et andet tal.

    Rummet er personens og gælder personens ordninger af slagsen under ét, jf.
    ADR-0018: to ratepensioner deler ét loft, og en `UpToCap`-linje til den
    ene ser derfor også, hvad den anden fik. Kun `PerYear` er med —
    `OnBalance` kan ingen fordeling nå, fordi aktiesparekontoen ikke er
    `EmployerAdministered`, jf. ADR-0019.

    Årets selvstændige indbetalinger tager først af rummet. Det er dét, der
    gør koblingen til lovens og ikke til værktøjets: lægger planlæggeren en
    privat indbetaling ind i sin ratepension, falder aftalens linje af sig
    selv, jf. ADR-0041. */
type CapHeadroom = {
  /** Det, der er tilbage under destinationens loft. Aldrig negativt: er
      rummet brugt op af de øvrige linjer, beder `UpToCap` om nul frem for at
      tage fra dem. Nul også for en destination uden loft — den kan ikke bære
      formen, jf. `validatePlan`. */
  room: (to: HoldingId) => Nominal
  /** Noterer et beløb på vej ind i destinationens ordning. Kaldt for hver
      eneste fordelingslinje og ikke kun for `UpToCap`s: en procentlinje, der
      fylder loftet, skal sænke den næste linjes rum, ellers ville formen
      bygge et loftbrud ind i sig selv. */
  take: (to: HoldingId, amount: Nominal) => void
}

function capHeadroom(
  plan: Plan,
  rates: RateYear,
  year: SimulationYear,
  contributions: ActiveContribution[],
): CapHeadroom {
  // Beholdningens plads i regnskabet er personen og varianten under ét —
  // aldrig beholdningen selv, jf. ADR-0018.
  const group = new Map<HoldingId, string>()
  const left = new Map<string, Nominal>()

  for (const person of plan.household.persons) {
    // Årstællingen går gennem `statePensionYear` af samme grund som i
    // loftopgørelsen: aldersopsparingens trappe skal ramme det samme år
    // begge steder, og alderen er en brøk for de fleste årgange.
    const yearsToStatePensionAge = statePensionYear(person) - year
    for (const holding of person.holdings) {
      const limit = cap(holding, rates, yearsToStatePensionAge)
      if (limit === undefined || limit.form !== 'PerYear') continue
      const key = `${person.id} ${holding.variant}`
      group.set(holding.id, key)
      left.set(key, limit.amount)
    }
  }

  const take = (to: HoldingId, amount: Nominal) => {
    const key = group.get(to)
    if (key === undefined) return
    // Rummet føres ufortrødent negativt. En procentlinje må gerne bryde
    // loftet med vilje — en firmaordning er, som den er, jf. ADR-0018 — og
    // et rum, der stoppede ved nul, ville lade en `UpToCap`-linje bagefter
    // fylde plads op, der for længst er brugt.
    left.set(key, left.get(key)! - amount)
  }
  for (const { contribution, intoHolding } of contributions) take(contribution.to, intoHolding)

  return {
    room: (to) => {
      const key = group.get(to)
      return key === undefined ? 0 : Math.max(left.get(key)!, 0)
    },
    take,
  }
}

/** Det placerede beløb delt ud på fordelingens destinationer.

    Procenterne måler det placerede beløb — indbetalingen efter AM-bidrag,
    gebyr og præmie — og aldrig lønnen. Kronelinjerne fremskrives med
    lønpostens egen reguleringssats som alt andet i aftalen. `UpToCap` beder
    om det, der er tilbage under ordningens loft. Og præcis én linje er
    `Remainder` og får det, de øvrige ikke tog: det er formen og ikke et
    regnestykke, der får fordelingen til at gå op i hvert eneste
    simuleringsår. */
function allocate(
  allocation: Allocation,
  placed: Nominal,
  projection: number,
  headroom: CapHeadroom,
): ActivePlacement[] {
  // Hver linje tager af det, der er tilbage, og aldrig mere end det. Det er
  // dén skranke, der får de landede beløb til at summe til præcis det
  // placerede — ikke en efterregning, men formen selv, jf. `Allocation`.
  let left = placed
  const claimed = new Map<number, ActivePlacement>()
  const claim = (index: number, to: HoldingId, requested: Nominal) => {
    const landed = Math.min(requested, left)
    left -= landed
    headroom.take(to, landed)
    claimed.set(index, { to, requested, landed })
  }

  // Procenterne først. De måler det placerede beløb, og deres sum er højst
  // det hele — mere afvises ved indgangen, jf. ADR-0020 — så skranken rører
  // dem i praksis aldrig, og en procentlinje får det samme, uanset hvor i
  // fordelingen den står.
  allocation.forEach((line, index) => {
    if (line.form === 'Percentage') claim(index, line.to, placed * line.percentage)
  })

  // Kronelinjerne dernæst, i planens rækkefølge. Rækker det, der er tilbage,
  // ikke til dem alle, får den sidste, der når frem, det der er — samme
  // skranke som to indbetalinger, der deler ét råderum under et loft, jf.
  // ADR-0019, og af samme grund: en fordeling pro rata sker ikke nogen
  // steder.
  allocation.forEach((line, index) => {
    if (line.form === 'Amount') claim(index, line.to, line.amountInRealKroner * projection)
  })

  // `UpToCap` derefter, og altså efter begge de former, planlæggeren har
  // skrevet et tal på. Formen måler pr. definition det, der er tilbage, når
  // årets øvrige indbetalinger til ordningen er talt med — også de øvrige i
  // aftalens egen fordeling — og en linje, der målte før dem, ville kunne
  // bygge et loftbrud ind i sig selv.
  allocation.forEach((line, index) => {
    if (line.form === 'UpToCap') claim(index, line.to, headroom.room(line.to))
  })

  // Restlinjen til sidst, uanset hvor den står: den beder pr. definition om
  // det, de øvrige ikke tog, og et magert år efterlader den på nul.
  allocation.forEach((line, index) => {
    if (line.form === 'Remainder') claim(index, line.to, left)
  })

  // Hver linje er talt præcis én gang: de fire former er udtømmende, og
  // præcis én af dem er resten, jf. `validatePlan`.
  return allocation.map((_line, index) => claimed.get(index)!)
}

/** Årets indbetalinger med deres to beløb, deres forfald og den beholdning,
    pengene forlader. De to former svarer forskelligt på hvert af de tre
    spørgsmål — hvornår falder bidraget, hvor stort er det, og hvad koster
    vejen ind — og det er dét, formen er til for.

    Et lønkildet bidrag har ingen periode at prøve: det falder præcis de år,
    dets lønpost falder, og ophører derfor af sig selv, når lønnen gør — det
    er hele pointen med at lade det pege på posten frem for at give det en
    periode, der kan komme ud af trit, jf. ADR-0016. Et beholdningskildet
    bidrag har ingen post at arve fra og prøver sin egen periode og
    gentagelse, som en overførsel gør.

    Det, der forlader kilden, er brutto. AM-behandlingen følger kilden: er
    lønposten AM-pligtig, er AM-bidraget af de penge allerede betalt i
    personens eget skattelag, og der lander 92 % i beholdningen. Kommer
    pengene fra en beholdning, har de aldrig båret AM-bidrag, og brutto er
    lig netto. */
function contributionsInYear(
  plan: Plan,
  year: SimulationYear,
  entries: ActiveEntry[],
  rates: RateYear,
): ActiveContribution[] {
  return plan.contributions.flatMap((contribution) =>
    contribution.kind === 'EntrySourced'
      ? entrySourcedInYear(contribution, plan, year, entries, rates)
      : holdingSourcedInYear(contribution, plan, year),
  )
}

function entrySourcedInYear(
  contribution: Contribution & { kind: 'EntrySourced' },
  plan: Plan,
  year: SimulationYear,
  entries: ActiveEntry[],
  rates: RateYear,
): ActiveContribution[] {
  const source = entries.find(({ entry }) => entry.id === contribution.source)
  if (source === undefined) return []

  const fromSource = measuredAgainstEntry(contribution, source.entry, source.own, plan, year)

  const labourMarketContribution = labourMarketRateOf(source.entry, rates)

  return [
    {
      contribution,
      // Lønnen landede på bufferen med hele sit bruttobeløb; det er derfra,
      // bidraget går videre.
      from: plan.buffer,
      fromSource,
      intoHolding: fromSource * (1 - labourMarketContribution),
      timing: source.entry.timing,
    },
  ]
}

/** AM-satsen på vejen ind fra en post. Den følger kilden og aldrig
    destinationen, jf. ADR-0016: en AM-pligtig lønpost har allerede betalt
    bidraget af hele sit bruttobeløb i personens eget skattelag, og der
    lander derfor 92 %; en skattefri indtægt har aldrig båret AM, og hele
    beløbet går ind.

    Delt af det lønkildede bidrag og af pensionsaftalen. Ingen af de to
    **opkræver** noget — begge trækker alene fra på vejen ind. Bygges det som
    en opkrævning, betales AM to gange, jf. ADR-0041. */
function labourMarketRateOf(entry: Entry, rates: RateYear): number {
  return entry.direction === 'Income' && entry.taxTreatment === 'EarnedIncome'
    ? rates.taxRates.labourMarketContribution
    : 0
}

/** Et beholdningskildet bidrag bærer sin egen periode, gentagelse og forfald
    og løftes af planens inflationsantagelse, som en overførsel gør — det er
    ikke en indtægt og har derfor ingen reguleringssats at følge.

    Aldersforankringen måler fra destinationens ejer. Kilden kan tilhøre den
    anden person, jf. ADR-0028, og valget mellem de to ender er derfor et
    valg: destinationen er den, ordningens loft og fradragsret allerede
    følger, og det er den, der gør formen aldersforankringsdygtig, hvor en
    overførsel ikke er det. */
function holdingSourcedInYear(
  contribution: Contribution & { kind: 'HoldingSourced' },
  plan: Plan,
  year: SimulationYear,
): ActiveContribution[] {
  const owner = ownerOfHolding(plan, contribution.to)
  const { from, to } = periodBounds(contribution.period, owner, plan.household)
  if (!withinPeriod(from, to, year)) return []
  if (!matchesRecurrence(contribution.recurrence, year, from, to, plan.startYear)) return []

  const amount = contribution.amountInRealKroner * transferProjection(plan, year)
  return [
    {
      contribution,
      from: contribution.source,
      fromSource: amount,
      intoHolding: amount,
      timing: contribution.timing,
    },
  ]
}

function ownerOfHolding(plan: Plan, holding: HoldingId): Person {
  return plan.household.persons.find((person) =>
    person.holdings.some((owned) => owned.id === holding),
  )!
}

function holdingById(plan: Plan, id: HoldingId): Holding {
  return plan.household.persons.flatMap((person) => person.holdings).find((h) => h.id === id)!
}

/** Årets overførsler, hver afkortet til det, afgiveren havde at give af.

    Råderummet er primosaldoen ført med årets egne overførsler: en beholdning,
    der modtog tidligere i planens rækkefølge, kan give videre samme år. Året
    har ingen indre tidsrækkefølge at måle imod — måneden er en afkastvægt og
    ikke et tidsskridt, jf. ADR-0006 — så en beholdning, pengene ubestridt
    landede i, har også noget at give af. Målte afkortningen mod primosaldoen
    alene, ville en ordning, der fyldes op og tømmes i samme år, aldrig kunne
    give noget fra sig. Det, en modtagende beholdning har at give videre, er
    det, den faktisk fik ind — er den selv en `Chargeable` afgiver længere
    nede i planens rækkefølge, er det beløbet efter afgift, ikke før.

    Afkortes gør den stadig: et fast kronebeløb kunne ellers drive en ordning
    negativ, og en beholdning, der ikke er bufferen, må ikke gå under nul, jf.
    ADR-0022. Planens rækkefølge er den eneste orden, der findes, og den
    afgør begge veje. Falder to overførsler ud af den samme beholdning i
    samme år, får den første hele saldoen og den næste resten — samme greb,
    og af samme grund, som to indbetalinger, der deler ét råderum. Falder et
    udtræk før det indskud, der skulle dække det, er der intet at give af, og
    linjen står med et ønsket beløb, der ikke flyttede sig.

    Bufferen er undtaget som afgiver. Den er det ene sted, årets restpost må
    samle sig, og dens negative saldo er hele modellens måde at sige, at
    planen ikke holder, jf. ADR-0002 og ADR-0008. Afkortede en overførsel
    den, ville signalet forsvinde i stedet for at vise sig — og derfor føres
    dens rest ufortrødent negativ, hvor en anden beholdning stopper ved nul.

    Afgiften rammer `amount` — det, der rent faktisk forlod afgiveren — og
    aldrig `requested`: beløbet måles hos afgiveren, ganske som en
    indbetaling fra lønnen måles på bruttolønnen, og afkortningen til
    saldoen sker derfor før afgiften og ikke efter, jf. ADR-0029. */
function transfersInYear(
  plan: Plan,
  year: SimulationYear,
  opening: ReadonlyMap<HoldingId, Nominal>,
  rates: RateYear,
): ActiveTransfer[] {
  const remaining = new Map(opening)
  return plan.transfers.flatMap((transfer) => {
    if (!transferAppliesInYear(transfer, year, ownerOfHolding(plan, transfer.from), plan.household, plan.startYear))
      return []

    const from = holdingById(plan, transfer.from)
    const requested = transfer.amountInRealKroner * transferProjection(plan, year)
    const room = remaining.get(transfer.from)!
    const amount =
      transfer.from === plan.buffer ? requested : Math.min(requested, Math.max(0, room))
    const landed = amount - transferCharge(from, amount, rates)

    remaining.set(transfer.from, room - amount)
    remaining.set(transfer.to, remaining.get(transfer.to)! + landed)
    return [{ transfer, from, requested, amount, landed }]
  })
}

/** Overførsler har ingen egen reguleringssats — de følger planens generelle
    inflationsantagelse, som enhver anden ureguleret størrelse i planen. */
function transferProjection(plan: Plan, year: SimulationYear): number {
  return (1 + plan.inflationAssumption) ** (year - plan.startYear)
}

/** Om overførslen falder i året. Aldersforankringen måles på
    afgiverbeholdningens ejer — en beholdning har præcis én, og det er dén
    alder, en aldersopsparings tømning skal flytte sig med, jf. ADR-0022. */
function transferAppliesInYear(
  transfer: Transfer,
  year: SimulationYear,
  owner: Person,
  household: Household,
  startYear: SimulationYear,
): boolean {
  const { from, to } = periodBounds(transfer.period, owner, household)
  return withinPeriod(from, to, year) && matchesRecurrence(transfer.recurrence, year, from, to, startYear)
}

function withinPeriod(
  from: SimulationYear | undefined,
  to: SimulationYear | undefined,
  year: SimulationYear,
): boolean {
  if (from !== undefined && year < from) return false
  if (to !== undefined && year > to) return false
  return true
}

/** `EveryNYears` tæller fra `from`, men et udeladt `from` betyder "fra
    planens start" ligesom alle andre steder, jf. `Period`s egen
    dokumentation — ikke "aldrig", som `from !== undefined` ellers ville
    give. */
function matchesRecurrence(
  recurrence: Recurrence,
  year: SimulationYear,
  from: SimulationYear | undefined,
  to: SimulationYear | undefined,
  startYear: SimulationYear,
): boolean {
  switch (recurrence.kind) {
    case 'Annual':
      return true
    case 'Once':
      return year === (from ?? to)
    case 'EveryNYears':
      return (year - (from ?? startYear)) % recurrence.n === 0
  }
}

function allHoldings(plan: Plan): Holding[] {
  return plan.household.persons.flatMap((person) => person.holdings)
}

