import {
  bearsPayoutSchedule,
  cappedVariant,
  isEmployerAdministered,
  isFreeAssets,
  isOpenToContributions,
  isPensionScheme,
  isUniquePerPerson,
  payoutStartOf,
  payoutTaxation,
} from './holdingVariant'
import { payoutStartYear, payoutYear, transferAllowedFrom } from './payoutAge'
import { householdLastYear, periodBounds, yearAtAge } from './age'
import type {
  AgeBound,
  ContributionAmount,
  Entry,
  EntryId,
  Holding,
  HoldingId,
  HoldingSourcedContribution,
  PensionSchemeHolding,
  Period,
  Person,
  Plan,
  SimulationYear,
  Transfer,
} from './plan'

/** Planen skal beskrive noget, der kan eksistere, før motoren kan regne på
    den. Hvervet er to slags regler.

    Pegerne skal alle ramme noget: bufferen, overførslernes to ender,
    indbetalingernes kilde og destination, og posternes ejere. En peger, der
    hænger, får motoren til enten at lyve eller styrte, jf. ADR-0013.

    Og en tilstand, der ikke kan findes i virkeligheden, skal ikke kunne
    skrives i planen, jf. ADR-0020. Kan typen bære forbuddet, hører det ikke
    her — beskatningsformen er varianten selv, netop for at kombinationer,
    der ikke findes, er uskrivelige frem for validerede, jf. ADR-0010. Kan
    den ikke, afvises tilstanden her. Faren ved den slags er, at de regner
    uden at kaste: modellen ville svare på et spørgsmål, virkeligheden ikke
    stiller, og svaret ville se rigtigt ud.

    Grænsen mod `CapBreach` går ved, om spørgsmålet har et årstal. Er svaret
    det samme i alle simuleringsår, kan reglen stå her; afhænger det af årets
    fremskrevne beløb målt mod årets satsår, er det et årsresultat, jf.
    ADR-0018. En regel, der ville kræve et år for at kunne svare, hører ikke
    i denne funktion.

    Returnerer en forklarende dansk besked ved den første regel, planen
    bryder — ellers intet. Brugt tre steder: `simulate` kaster på den, fladen
    viser den i resultatspalten frem for at lade planen fejle tavst, og
    persistenslaget afviser en fil, der bærer den.

    Beskeden nævner figurerne ved de navne, planen selv giver dem, og aldrig
    ved deres id. Den skrives til den, der planlægger sin pension, og hun har
    aldrig set `contribution-4` — hun kender sin indbetaling på det navn, der
    står i navigatoren. Id'et er motorens peger, og det hører hjemme, hvor det
    er selve emnet: i en invariant, der er brudt inde i motoren, jf.
    `holdingYears`. */
export function validatePlan(plan: Plan): string | undefined {
  return (
    bufferPointer(plan) ??
    transferEnds(plan) ??
    contributionEnds(plan) ??
    entryOwners(plan) ??
    oneOfEachUniqueVariant(plan) ??
    entrySourcedDestination(plan) ??
    pensionAgreements(plan) ??
    payoutSchedules(plan) ??
    ageBoundedPeriods(plan) ??
    reversedPeriods(plan) ??
    undatedOnce(plan)
  )
}

/** En aldersforankret periode skal beskrive noget. En post fra alder −4 er
    ingen fejl, motoren tager skade af — den beskriver bare ingenting: en
    person kan ikke have et endepunkt før sin fødsel.

    Målt på opløste kalenderår som de øvrige, jf. ADR-0045. En fødselsmåned må
    ikke kunne gøre afvisningen strengere end fladens egen klemning.

    Kun de aldersforankrede måles. En kalenderårsperiode har ingen alder at
    holde op mod en fødsel.

    Reglen kan ikke længere nås gennem fladen, som klemmer begge endepunkter.
    Den bliver stående som nettet under en håndredigeret fil, jf. ADR-0045. */
function ageBoundedPeriods(plan: Plan): string | undefined {
  const last = householdLastYear(plan.household)
  for (const figure of periodicFigures(plan)) {
    const period = figure.period
    if (period.anchor !== 'PersonAge') continue
    // Ejeren findes: pegerreglerne er kørt før denne, jf. `reversedPeriods`.
    const owner = periodOwner(plan, figure)!

    for (const endpoint of ['from', 'to'] as const) {
      const standing = period[endpoint]
      // Et åbent endepunkt og et flueben er ingen alder at måle: det ene
      // betyder planens start eller horisontens slut, det andet følger
      // erhvervsophøret, som ligger inden for forløbet i forvejen.
      if (typeof standing !== 'number') continue
      const year = yearAtAge(owner, standing)
      const broken =
        year < yearAtAge(owner, 0)
          ? bornInReason(owner)
          : year > last
            ? householdEndsReason(last)
            : undefined
      if (broken === undefined) continue
      return (
        `${figureSubject(figure)} ${runsFrom(endpoint)} ved alder ` +
        `${danishNumber(standing)}. ${broken}`
      )
    }
  }
  return undefined
}

/** Den ene sætning om fødslen. Grænsen, afvisningen og reparationsbeskeden
    møder den samme væg og skal ikke kunne komme til at sige hver sit om den,
    jf. `Bound`. */
function bornInReason(owner: Person): string {
  return `${owner.name} er født i ${owner.birthYear} og har ingen alder før da.`
}

/** Den ene sætning om husstandens sidste år. Væggen er husstandens og ikke
    ejerens: en udgiftspost forankret til den korteste horisont må løbe helt
    til det fælles sidste år, jf. ADR-0030 og `householdLastYear`. */
function householdEndsReason(last: SimulationYear): string {
  return `Husstandens forløb slutter i ${last}.`
}

/** Det, endepunktet gør ved perioden. Samme ord som reparationsbeskedens, blot
    i nutid: afvisningen taler om den plan, der ligger der nu. */
function runsFrom(endpoint: 'from' | 'to'): string {
  return endpoint === 'from' ? 'begynder' : 'slutter'
}

/** Et tal, som brugeren ville have læst det: komma som decimaltegn. En alder
    kan være en brøk — folkepensionsalderen er 65,5 for én årgang. */
function danishNumber(value: number): string {
  return String(value).replace('.', ',')
}

/** En periode, hvis slutår ligger før dens startår, beskriver ingenting:
    motoren regner nul år, og figuren forsvinder tavst ud af planen. Reglen
    hører ved indgangen af samme grund som de øvrige, jf. ADR-0020 — svaret
    er det samme i alle simuleringsår.

    Målt på opløste kalenderår. En `PersonAge`-periode og en
    `CalendarYear`-periode skal måles med det samme, og et endepunkt sat til
    erhvervsophør opløses forskelligt i de to roller, jf. ADR-0031: to flueben
    på den samme alder giver Y til Y−1 uden at et eneste tal er tastet.

    Et udeladt endepunkt binder ingenting. Det betyder "fra planens start"
    henholdsvis "til horisontens slut", og de to vægge er ikke denne regels:
    den venstre er med vilje ikke klemt, jf. ADR-0045, og den højre er
    husstandens sidste år og en regel for sig.

    Reglen kan ikke længere nås gennem fladen, som klemmer begge endepunkter
    mod hinanden. Den bliver stående som nettet under en håndredigeret fil,
    jf. ADR-0045. */
function reversedPeriods(plan: Plan): string | undefined {
  for (const figure of periodicFigures(plan)) {
    // Ejeren findes: pegerreglerne er kørt før denne, og de har afvist en
    // post uden en ejer, en overførsel uden en afgiver og en indbetaling uden
    // en destination.
    const owner = periodOwner(plan, figure)!
    const { from, to } = periodBounds(figure.period, owner)
    if (from === undefined || to === undefined || to >= from) continue
    return (
      `${figureSubject(figure)} løber fra ${from} til ${to}. ` +
      `En periode kan ikke slutte, før den begynder.`
    )
  }
  return undefined
}

/** En `Én gang`-gentagelse uden et kalenderår beskriver ingenting: motoren
    leder efter det år, hvor `year === (from ?? to)`, og uden nogen af dem
    sat, findes det år ikke. Figuren forsvinder ligeså tavst som en omvendt
    periode, jf. `reversedPeriods` — og er lige så let at overse, fordi planen
    ellers ser komplet ud.

    Kun kalenderårsforankringen rammes. En aldersforankret `Én gang` uden en
    alder viser sig som et tomt felt i fladen, ikke som et årstal der ligner
    et gyldigt svar, og fanges i øvrigt af `ageBoundedPeriods`, når alderen
    til sidst sættes til noget, der ikke kan lade sig gøre.

    Reglen kan ikke længere nås gennem fladen, som skriver et konkret år, så
    snart gentagelsen bliver `Én gang`. Den bliver stående som nettet under en
    håndredigeret fil, jf. ADR-0045. */
function undatedOnce(plan: Plan): string | undefined {
  for (const figure of periodicFigures(plan)) {
    if (figure.recurrence.kind !== 'Once') continue
    if (figure.period.anchor !== 'CalendarYear') continue
    if (figure.period.from !== undefined || figure.period.to !== undefined) continue
    return `${figureSubject(figure)} gentages "Én gang", men har intet år sat. Den falder aldrig.`
  }
  return undefined
}

/** Planens figurer med udstrækning. Den lønkildede indbetaling er ikke
    iblandt: den arver lønpostens periode, og posten står allerede på listen. */
function periodicFigures(plan: Plan): PeriodicFigure[] {
  return [
    ...plan.entries,
    ...plan.transfers,
    ...plan.contributions.filter(
      (contribution): contribution is HoldingSourcedContribution =>
        contribution.kind === 'HoldingSourced',
    ),
  ]
}

/** Pensionsaftalens strukturelle regler. De er alle de samme i alle
    simuleringsår og hører derfor ved indgangen og ikke i årsresultatet, jf.
    ADR-0020: en fordeling, der ikke går op, findes ikke i virkeligheden i
    noget år.

    Grænsen mod `PensionAgreementYear`s to tal går netop dér. Et magert år,
    hvor et kronebeløb ikke kan være der, er ikke en indgangsfejl — det er et
    årsresultat, fordi samme plan kan gå op i ét år og ikke i det næste. Det
    er også dét, der skiller de to slags fordelingsfejl fra hinanden: 60 % +
    60 % går ikke op i noget år, uanset lønnen, hvor et kronebeløb, der ikke
    kan være der, går op på fuld tid og ikke på deltid.

    Destinationsreglen er den lønkildede indbetalings, stillet gennem samme
    opslag: pengene kommer fra en løn begge steder, og en ordning, ingen
    arbejdsgiver kan administrere, kan ikke tage imod dem, jf. ADR-0016.
    Ejerskellet er ligeledes det samme — en arbejdsgiveradministreret ordning
    står i lønmodtagerens eget navn. */
function pensionAgreements(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  const ownerOf = ownersByHolding(plan)

  for (const entry of plan.entries) {
    if (entry.direction !== 'Income') continue
    const agreement = entry.pensionAgreement
    if (agreement === undefined) continue

    const subject = `Pensionsaftalen på posten ${entry.name}`

    // En aftale, der trak mere ud, end der blev betalt ind, findes ikke:
    // selskabet ville sætte præmien ned eller kræve mere ind. Spørgsmålet
    // har intet årstal — bidragenes procenter måler lønposten, og alle
    // aftalens kronebeløb løftes med lønpostens egen reguleringssats, så
    // forholdet er det samme i hvert eneste simuleringsår.
    //
    // Målt mod indbetalingen selv og ikke mod indbetalingen efter
    // AM-bidrag: indgangen kender ikke et satsår og dermed ikke satsen, og
    // en sats skrevet af her ville være en dublet af satsåret. Det smalle
    // bånd, bidraget alene tipper, lander derfor på nul i motoren i stedet,
    // jf. `pensionAgreementsInYear`.
    const costs = agreement.fee + agreement.insurancePremium
    const contributions =
      measuredAgainstEntry(agreement.employerContribution, entry) +
      measuredAgainstEntry(agreement.employeeContribution, entry)
    if (costs >= contributions && costs > 0) {
      return (
        `${subject} trækker mere i gebyret og forsikringspræmien, end der betales ind. ` +
        `Der skal blive noget tilbage at fordele.`
      )
    }

    const remainders = agreement.allocation.filter((line) => line.form === 'Remainder')
    if (remainders.length !== 1) {
      return (
        `${subject} har ${remainders.length} linjer med resten. Præcis én linje skal ` +
        `være resten, så fordelingen går op i hvert eneste år.`
      )
    }

    const seen = new Set<HoldingId>()
    for (const line of agreement.allocation) {
      const to = byId.get(line.to)
      if (!to) {
        return `${subject} fordeler til en beholdning, der ikke findes.`
      }
      if (!isEmployerAdministered(to)) {
        return (
          `${subject} fordeler til beholdningen ${to.name}, som ikke er ` +
          `arbejdsgiveradministreret.`
        )
      }
      // Postens ejer findes: `entryOwners` er kørt før denne regel og har
      // afvist en post uden en, og det er dén fejl, brugeren skal se først.
      const sourceOwner = plan.household.persons.find((person) => person.id === entry.owner)!
      const destinationOwner = ownerOf.get(line.to)!
      if (sourceOwner.id !== destinationOwner.id) {
        return (
          `${subject}, som tilhører ${sourceOwner.name}, fordeler til beholdningen ` +
          `${to.name}, som tilhører ${destinationOwner.name}. En ordning, en ` +
          `arbejdsgiver administrerer, står i lønmodtagerens eget navn.`
        )
      }

      // En linje op til loftet skal have et loft at måle sig mod. Livrenten
      // står ikke i PBL § 16, stk. 2, og har intet — og en linje, der bad om
      // resten af ingenting, ville bede om nul hvert eneste år uden at sige
      // hvorfor. Svaret er det samme i alle simuleringsår, og reglen hører
      // derfor her, jf. ADR-0020.
      if (line.form === 'UpToCap' && cappedVariant(to) === undefined) {
        return (
          `${subject} fordeler op til loftet på beholdningen ${to.name}, som har ` +
          `intet loft. Kun en ratepension og en aldersopsparing har et at fylde ud.`
        )
      }

      // Samme ordning to gange er ét beløb skrevet to steder, og ingen af de
      // to linjer kan læses uden den anden. Den står sidst blandt linjens
      // regler: er ordningen slet ikke en, aftalen kan pege på, er det dén
      // fejl, planlæggeren skal se — og ikke at den står der to gange.
      if (seen.has(line.to)) {
        return (
          `${subject} fordeler to gange til beholdningen ${to.name}. Hver ordning ` +
          `står på én linje i fordelingen.`
        )
      }
      seen.add(line.to)
    }

    // Procenterne måler det placerede beløb, og de kan derfor ikke tilsammen
    // bede om mere end det hele: 60 % + 60 % går ikke op i noget år, uanset
    // hvad lønnen er. Spørgsmålet har intet årstal og hører derfor ved
    // indgangen, hvor et kronebeløb, der ikke kan være der, er et
    // årsresultat.
    //
    // Tolerancen findes, fordi procenterne er andele og ikke decimaltal:
    // tre linjer på en tredjedel hver kan summe til en anelse over 1 i binær
    // aritmetik, og en fordeling, der går op på papiret, skal ikke afvises af
    // det sidste ciffer.
    const percentages = agreement.allocation.reduce(
      (sum, line) => sum + (line.form === 'Percentage' ? line.percentage : 0),
      0,
    )
    if (percentages > 1 + percentageTolerance) {
      return (
        `${subject} fordeler ${danishPercent(percentages)} af indbetalingen. ` +
        `Procenterne måler det, der bliver betalt ind, og de kan ikke tilsammen ` +
        `bede om mere end det hele.`
      )
    }
  }
  return undefined
}

/** Den plads, en sum af andele har til at ligge over det hele uden at være en
    anden fordeling. Den er sat, så den kun rummer regnefejl og ingen mening:
    en tusindedel af en procent er tusind gange større. */
const percentageTolerance = 1e-9

/** En andel skrevet som procent på dansk: 1,2 bliver til "120 %" frem for til
    sytten cifre. Afrundingen er feltets egen i skuffen — sagde beskeden et
    andet tal end det, brugeren netop har tastet, ville hun lede efter en
    linje, der ikke står der. */
function danishPercent(share: number): string {
  return `${String(Math.round(share * 1_000_000) / 10_000).replace('.', ',')} %`
}

/** Et bidrag målt i nutidskroner mod sin lønpost: procenten af postens eget
    beløb, jf. ADR-0040, eller kronebeløbet som det står.

    Fremskrivningen er udeladt med vilje. Alle aftalens tal løftes med
    lønpostens egen reguleringssats — den samme faktor — og forholdet mellem
    dem er derfor det samme i hvert eneste simuleringsår. Det er dét, der gør
    spørgsmålet til et indgangsspørgsmål frem for et årsresultat. */
function measuredAgainstEntry(amount: ContributionAmount, entry: Entry): number {
  return 'percentageOfEntry' in amount
    ? entry.amountInRealKroner * amount.percentageOfEntry
    : amount.amountInRealKroner
}

/** Udbetalingsplanens lovregler, jf. [PBL § 11 A, stk.
    1](https://danskelove.dk/pensionsbeskatningsloven/11a): udbetalingen må
    tidligst begynde ved ordningens pensionsudbetalingsalder, perioden skal
    være mindst ti år, og den sidste rate skal falde senest tredive år efter
    den alder.

    Den første af de tre gælder både ratepensionen og livrenten: den ene
    tømmes fra tidspunktet, den anden omsættes på det, og loven låser døren
    lige hårdt begge steder. De to øvrige måler på en varighed, og livrenten
    har ingen — dens plan bærer kun en start, fordi ydelsen er livsvarig, jf.
    ADR-0009.

    De hører ved indgangen og ikke i årsresultatet, jf. ADR-0020: svaret
    afhænger ikke af et satsår, kun af planen selv, og en plan, der beskrev
    en ordning, loven ikke ville oprette, ville regne uden at kaste.

    Alt måles i kalenderår og aldrig i aldre. Pensionsudbetalingsalderen er
    ofte en brøk — folkepensionsalderen minus fem eller tre — og året, hvor
    personen fylder 62,5, indeholder lovlige udbetalingsmåneder. En plan, der
    starter dér, findes i virkeligheden, jf. `payoutYear`. */
function payoutSchedules(plan: Plan): string | undefined {
  for (const person of plan.household.persons) {
    for (const holding of person.holdings) {
      // Startreglen gælder begge de varianter, der overhovedet har en
      // udbetaling at lægge: ratepensionen, der tømmes fra det tidspunkt, og
      // livrenten, der omsættes på det. Begge er en `PensionScheme` — det er
      // dét, der giver reglen en `PayoutAge` at måle mod uden en antagelse
      // undervejs.
      const start = payoutStartOf(holding)
      if (start !== undefined && isPensionScheme(holding)) {
        const legal = payoutYear(holding, person)
        const begins = payoutStartYear(start, person)
        if (begins < legal) {
          return (
            `Beholdningen ${holding.name} udbetales fra ${begins}, men dens ` +
            `pensionsudbetalingsalder nås først i ${legal}.`
          )
        }
      }

      // De to øvrige regler måler på en varighed. Livrenten har ingen — den
      // er livsvarig — og reglerne herunder gælder derfor kun den variant,
      // hvis plan bærer alle tre felter.
      if (!bearsPayoutSchedule(holding)) continue
      const schedule = holding.payout
      if (schedule === undefined) continue

      const legal = payoutYear(holding, person)
      const begins = payoutStartYear(schedule.start, person)
      if (schedule.duration < minimumPayoutYears) {
        return (
          `Beholdningen ${holding.name} udbetales over ${schedule.duration} år. ` +
          `${minimumDurationReason()}`
        )
      }

      // Den sidste rate falder i startårets `duration`-te år og altså
      // `duration − 1` år efter starten. Ét år galt her ville lade en plan,
      // loven afviser, regne igennem.
      const last = begins + schedule.duration - 1
      const latest = legal + latestPayoutYearsAfterPayoutAge
      if (last > latest) {
        return (
          `Beholdningen ${holding.name} udbetaler sin sidste rate i ${last}. ` +
          `Den skal falde senest i ${latest}, ${latestPayoutYearsAfterPayoutAge} år ` +
          `efter pensionsudbetalingsalderen.`
        )
      }
    }
  }
  return undefined
}

/** PBL § 11 A, stk. 1, nr. 4: udbetalingsperioden skal være mindst ti år.
    Grænsen står i loven og ikke i § 20-tabellen og hører derfor ikke i
    satsåret — samme sted som aldersopsparingens syvårsgrænse, og af samme
    grund. Eksporteret, så skuffens standardvarighed er den samme værdi og
    ikke et tal, der kan skille sig fra reglen. */
export const minimumPayoutYears = 10

/** PBL § 11 A, stk. 1, nr. 4: sidste rate skal falde senest tredive år efter
    pensionsudbetalingsalderen. Står i loven af samme grund som
    `minimumPayoutYears` og hører derfor samme sted. */
const latestPayoutYearsAfterPayoutAge = 30

/** Varighedens to grænser for en plan, der begynder ved `start`: mindst ti
    år, og aldrig så mange at den sidste rate falder senere end tredive år
    efter pensionsudbetalingsalderen.

    Samme to regler som afvisningen ovenfor, udledt af de samme tal. De står
    her frem for i fladen, så feltets grænser og motorens afvisning ikke kan
    skille sig: en grænse regnet to steder er en grænse, der før eller siden
    siger to ting.

    Den øvre grænse falder aldrig under den nedre. Ligger starten så sent, at
    de tredive år er brugt op, findes der ingen lovlig varighed — feltet har
    da ingen at tilbyde, og afvisningen ovenfor er den, der siger hvorfor.

    Begge grænser bærer en begrundelse. Ingen af de to vægge kan ses: aksen
    har hverken et mærke for tiårsreglen eller for det år, den sidste rate
    senest må falde i, og et felt, der blot rettede sig selv, ville lade
    brugeren gætte, jf. `Bound` og ADR-0045. */
export function payoutDurationBounds(
  holding: PensionSchemeHolding,
  owner: Person,
  start: AgeBound,
): { min: Bound; max: Bound } {
  const latest = payoutYear(holding, owner) + latestPayoutYearsAfterPayoutAge
  const room = latest - payoutStartYear(start, owner) + 1
  return {
    min: { value: minimumPayoutYears, reason: minimumDurationReason() },
    max: { value: Math.max(minimumPayoutYears, room), reason: lastInstalmentReason(holding, latest) },
  }
}

/** Den ene sætning om tiårsreglen. Afvisningen ovenfor og feltets grænse
    siger den samme lovregel, og de er den samme sætning — hvor
    trediveårsgrænsens to ikke er det: afvisningen melder det år, planen
    ramte, og grænsen beskriver væggen, der aldrig lod den komme dertil. */
function minimumDurationReason(): string {
  return `En ratepension skal udbetales over mindst ${minimumPayoutYears} år.`
}

/** Den ene sætning om trediveårsgrænsen. To grænser møder den — varighedens
    øvre og startens, når gestussen beholder varigheden — og det er den samme
    væg set fra hver sin ende. */
function lastInstalmentReason(holding: Holding, latest: SimulationYear): string {
  return (
    `Beholdningen ${holding.name} skal udbetale sin sidste rate senest i ` +
    `${latest}, ${latestPayoutYearsAfterPayoutAge} år efter ` +
    `pensionsudbetalingsalderen.`
  )
}

/** En grænse: tallet alene, eller tallet og den besked, fladen siger, når den
    greb ind.

    Beskeden følger med grænsen frem for at blive skrevet dér, hvor den vises.
    Håndtaget og feltet møder den samme væg, og de skal ikke kunne komme til
    at sige hver sit om den, jf. ADR-0045. Den udelades, hvor væggen kan ses i
    forvejen — postens egen anden kant, eller tidslinjens — for en besked om
    noget synligt er støj. */
export type Bound = number | { value: number; reason: string }

/** Et felts nedre og øvre grænse. Værdien, feltet giver videre, klemmes ind i
    dem, så almindelig indtastning ikke kan skrive en plan, motoren afviser —
    reglen selv står her i indgangskontrollen, fordi en importeret fil ikke er
    gået gennem et felt, og grænsen er dens venlige udgave. */
export type Bounds = {
  min?: Bound
  max?: Bound
  /** Om tomt er et svar. En nedre grænse gør ellers feltet påkrævet — en
      udbetalingsplan skal begynde et sted, og et tømt felt falder da tilbage
      på grænsen. Et periodeendepunkt er den anden slags: tomt betyder "fra
      planens start" henholdsvis "til horisontens slut", og den betydning
      overlever, at det andet endepunkt har lagt en grænse. Udeladt er det
      påkrævede, som er den ældste af de to. */
  mayBeEmpty?: boolean
}

/** Tallet i en grænse — det, der klemmes imod, uanset om grænsen bærer en
    begrundelse. */
export function boundValue(bound: Bound): number {
  return typeof bound === 'number' ? bound : bound.value
}

/** Begrundelsen i en grænse, hvor der er en. Er der ingen, siger fladen
    ingenting: væggen kan ses i forvejen. */
export function boundReason(bound: Bound | undefined): string | undefined {
  return typeof bound === 'object' ? bound.reason : undefined
}

/** Udbetalingsstartens nedre grænse: ordningens egen dør, jf.
    `payoutSchedules`-reglen ovenfor og PBL § 11 A, stk. 1. Ratepensionens
    `Start` og livrentens `Udbetalingsstart` deler den lovregel og slår begge
    op her, ligesom deres to håndtag på tidslinjen.

    Målt i kalenderår og svaret i alder. Døren er et årstal, fordi
    pensionsudbetalingsalderen ofte er en brøk: året, hvor personen fylder
    62,5, indeholder lovlige udbetalingsmåneder, og en plan, der starter
    dér, findes i virkeligheden, jf. `payoutYear`. Målt i aldre ville feltet
    være strengere end både håndtaget og afvisningen — og alderen 62 ville
    blive løftet til 62,5, selv om de to falder i det samme kalenderår.

    Oversættelsen tilbage går gennem endepunktets egen delta, den samme som
    `periodEndpointBounds` bruger: den alder, feltet står på, flyttet lige så
    mange år som kalenderåret skal flytte sig. Den bevarer en brøkalder, hvor
    et årstal minus fødselsåret ville have tabt halvåret. Er der endnu ingen
    plan, er der ingen alder at flytte, og ordningens egen
    pensionsudbetalingsalder er svaret — den rammer døren pr. definition.

    Den øvre grænse afhænger af, hvad redigeringen holder fast, mens starten
    flytter sig — og de to svar er forskellige vægge, ikke det samme tal skrevet
    to gange. `'Duration'` beholder varigheden, så hele planen flytter sig, og
    den sidste rate flytter sig med: loftet er da det seneste år, planen må
    begynde i, for at den sidste rate stadig falder inden for de tredive år.
    `'LastInstalment'` lader den sidste rate stå og lader varigheden vige i
    stedet: loftet er da de ti år, varigheden aldrig må komme under. Skuffens
    felt og et træk i kroppen holder varigheden fast; tidslinjens venstre
    håndtag holder den sidste rate fast.

    Livrenten har ingen af de to. Den er livsvarig og har hverken en varighed
    eller en sidste rate, og dens eneste grænse er derfor døren. */
export function payoutStartBounds(
  holding: PensionSchemeHolding,
  owner: Person,
  start: AgeBound | undefined,
  keeping: 'Duration' | 'LastInstalment' = 'Duration',
  // Døren står altid: enhver pensionsordning har en, og et kald kan derfor
  // læse `min` uden at spørge, om den er der. Loftet kan mangle — livrenten
  // har intet.
): Bounds & { min: Bound } {
  const door = payoutYear(holding, owner)
  const standing = typeof start === 'number' ? start : holding.payoutAge
  const asAge = (year: SimulationYear) => standing + (year - yearAtAge(owner, standing))
  const min: Bound = { value: asAge(door), reason: payoutDoorReason(holding, door) }

  const schedule = bearsPayoutSchedule(holding) ? holding.payout : undefined
  if (schedule === undefined) return { min }

  const latest = door + latestPayoutYearsAfterPayoutAge
  return {
    min,
    max:
      keeping === 'Duration'
        ? {
            value: asAge(latest - (schedule.duration - 1)),
            reason: lastInstalmentReason(holding, latest),
          }
        : {
            value: standing + (schedule.duration - minimumPayoutYears),
            reason: minimumDurationReason(),
          },
  }
}

/** Den ene sætning om den ene dør. To grænser møder den — udbetalingsplanens
    start og overførslens tidligste år — og det er den samme lovregel og
    dermed den samme besked. Skrevet to steder ville de to før eller siden
    sige hver sit om den samme væg. */
function payoutDoorReason(holding: Holding, door: SimulationYear): string {
  return `Beholdningen ${holding.name} må tidligst udbetales i ${door}.`
}

/** En figur med udstrækning: den slags, hvis periode har to endepunkter at
    binde mod hinanden. Den lønkildede indbetaling er ikke iblandt — den
    arver lønpostens periode og har ingen egen, jf. ADR-0016. */
export type PeriodicFigure = Entry | Transfer | HoldingSourcedContribution

/** Grænserne for ét af en figurs to periodeendepunkter.

    Der er tre regler at svare på. Den første rammer kun overførslen: den må
    ikke hente fra en ordning før dens pensionsudbetalingsalder. En hævning før
    den koster 20 % i afgift og er ikke noget, planen skal kunne beskrive, jf.
    ADR-0022 — og `transferEnds` afviser den plan. Den anden rammer alle tre:
    perioden må ikke vendes om, og de to endepunkter binder derfor hinanden.
    Den tredje rammer kun de aldersforankrede: endepunktet skal ligge inden for
    husstandens forløb, jf. `householdBounds` og `ageBoundedPeriods`. Grænserne
    står her ved siden af afvisningerne, så håndtaget, feltet og afvisningen
    ikke kan komme til at sige hver sit; det er den samme grund,
    `payoutDurationBounds` findes af.

    De måles alle tre på opløste kalenderår, og først dér kan de holdes op mod
    hinanden: en `PersonAge`-periode og en `CalendarYear`-periode skal måles
    med det samme, og et endepunkt sat til erhvervsophør opløses forskelligt i
    de to roller, jf. ADR-0031. Møder flere vægge det samme endepunkt, er det
    kun den strammeste, der svarer — se `latest` og `earliest`.

    Et udeladt endepunkt binder ingenting. Det betyder "fra planens start"
    henholdsvis "til horisontens slut", og ingen af de to er en væg, en anden
    figur skal måles mod: den venstre er med vilje ikke klemt, jf. ADR-0045, og
    den højre er husstandens sidste år, som er den tredje regels øvre grænse i
    forvejen.

    Svaret er i endepunktets egen enhed: et årstal til en kalenderårsforankret
    periode, en alder til en aldersforankret. Alderen findes ved at flytte den
    alder, endepunktet står på, lige så mange år som kalenderåret skal flytte
    sig — samme oversættelse som `clampLifeAnnuityStart`. Den bevarer en
    brøkalder, hvor et årstal minus fødselsåret ville have tabt halvåret.
    Står endepunktet åbent, er der ingen alder at flytte, og alderen i
    grænseåret er svaret. */
export function periodEndpointBounds(
  plan: Plan,
  figure: PeriodicFigure,
  endpoint: 'from' | 'to',
): Bounds {
  const owner = periodOwner(plan, figure)
  if (owner === undefined) return {}

  const unit = (bound: YearBound): Bound => ({
    value: inEndpointUnit(figure.period, endpoint, bound.value, owner),
    reason: bound.reason,
  })
  const opposite = periodBounds(figure.period, owner)[endpoint === 'from' ? 'to' : 'from']
  // Døren måler kun startåret: en overførsel må ikke *hente* fra ordningen,
  // før den må udbetales, og et slutår henter ingenting.
  const door = endpoint === 'from' ? payoutDoor(plan, figure) : undefined
  const household = householdBounds(plan, figure.period, owner)

  const min = latest([
    household?.min,
    door === undefined
      ? undefined
      : { value: door.year, reason: payoutDoorReason(door.holding, door.year) },
    endpoint === 'to' && opposite !== undefined
      ? { value: opposite, reason: cannotEndBeforeReason(figure, opposite) }
      : undefined,
  ])
  const max = earliest([
    household?.max,
    endpoint === 'from' && opposite !== undefined
      ? { value: opposite, reason: cannotBeginAfterReason(opposite) }
      : undefined,
  ])

  return {
    // Et åbent slutår betyder horisontens slut og er stadig et svar, selv om
    // startåret har lagt en nedre grænse — derfor falder et tømt felt ikke
    // tilbage på den, jf. `Bounds`. Et åbent startår betyder planens start, og
    // ligger døren efter den, er tomt derimod ikke et svar: overførslen ville
    // hente fra ordningen, før den må udbetales.
    mayBeEmpty: endpoint === 'to' || door === undefined,
    ...(min === undefined ? {} : { min: unit(min) }),
    ...(max === undefined ? {} : { max: unit(max) }),
  }
}

/** En grænse målt i kalenderår, med den begrundelse den melder. Vægge fra
    forskellige regler kan kun sammenlignes i den ene enhed, de deler, jf.
    ADR-0045 — oversættelsen til endepunktets egen sker først, når den
    strammeste er fundet. */
type YearBound = { value: SimulationYear; reason: string }

/** Husstandens forløb som de to vægge, en aldersforankret periode skal ligge
    inden for: fødslen og husstandens sidste år.

    Loftet er husstandens og ikke ejerens egen horisont, jf.
    `householdLastYear`. Døren er fødslen, fordi en alder før den ikke
    beskriver noget — en person kan ikke have et endepunkt før sin fødsel.

    En kalenderårsforankret periode har ingen af de to. Den har ingen alder at
    holde op mod en fødsel, og dens venstre kant er med vilje ikke klemt, jf.
    ADR-0045. */
function householdBounds(
  plan: Plan,
  period: Period,
  owner: Person,
): { min: YearBound; max: YearBound } | undefined {
  if (period.anchor === 'CalendarYear') return undefined
  const last = householdLastYear(plan.household)
  return {
    min: { value: yearAtAge(owner, 0), reason: bornInReason(owner) },
    max: { value: last, reason: householdEndsReason(last) },
  }
}

/** Den strammeste af flere nedre grænser — den seneste — og af flere øvre:
    den tidligste. Et endepunkt skal stå inden for dem alle, og det er derfor
    kun den strammeste, der nogensinde griber ind. */
function latest(bounds: (YearBound | undefined)[]): YearBound | undefined {
  return bounds.reduce<YearBound | undefined>(
    (tightest, bound) =>
      bound !== undefined && (tightest === undefined || bound.value > tightest.value)
        ? bound
        : tightest,
    undefined,
  )
}

function earliest(bounds: (YearBound | undefined)[]): YearBound | undefined {
  return bounds.reduce<YearBound | undefined>(
    (tightest, bound) =>
      bound !== undefined && (tightest === undefined || bound.value < tightest.value)
        ? bound
        : tightest,
    undefined,
  )
}

/** Ordningens dør, hvor figuren har en at måle mod: overførslen, som henter
    fra en beholdning, og kun når den beholdning er en pensionsordning. En
    post og en indbetaling henter ikke fra noget og har ingen. */
function payoutDoor(
  plan: Plan,
  figure: PeriodicFigure,
): { holding: Holding; year: SimulationYear } | undefined {
  if (!isTransfer(figure)) return undefined
  const from = holdingsById(plan).get(figure.from)
  const owner = ownersByHolding(plan).get(figure.from)
  if (from === undefined || owner === undefined || !isPensionScheme(from)) return undefined
  return { holding: from, year: payoutYear(from, owner) }
}

/** Den person, figurens aldersforankring måles på. Posten har sin ejer,
    overførslen afgiverens — en beholdning har præcis én, jf. `Transfer` — og
    den beholdningskildede indbetaling destinationens, jf.
    `holdingSourcedInYear`: kilden kan tilhøre den anden person, og det er
    destinationen, ordningens loft og fradragsret allerede følger.

    Findes personen ikke, er pegeren hængende, og der er ingen grænse at
    svare med. Det er `validatePlan`s egen sag og ikke grænsens, jf.
    `repairPlan`. */
export function periodOwner(plan: Plan, figure: PeriodicFigure): Person | undefined {
  if (isEntry(figure)) {
    return plan.household.persons.find((person) => person.id === figure.owner)
  }
  return ownersByHolding(plan).get(isTransfer(figure) ? figure.from : figure.to)
}

/** Figuren ved det navn, planen giver den, med det ord brugeren kender den
    på. Samme sprog som afvisningernes egne beskeder — hun har aldrig set
    `entry-4`, jf. `validatePlan`. */
export function figureSubject(figure: PeriodicFigure): string {
  if (isEntry(figure)) return `Posten ${figure.name}`
  return isTransfer(figure)
    ? `Overførslen ${figure.name}`
    : `Indbetalingen ${figure.name}`
}

/** De tre figurer deles ikke om et mærke, der siger hvad de er — de er tre
    typer i planen og ikke tre grene af én union. De kendes derfor på det
    felt, kun den ene har: retningen er postens, og kilden er indbetalingens.
    Overførslen er den, der har ingen af dem. */
function isEntry(figure: PeriodicFigure): figure is Entry {
  return 'direction' in figure
}

function isTransfer(figure: PeriodicFigure): figure is Transfer {
  return !isEntry(figure) && !('kind' in figure)
}

/** Den ene sætning om slutårets væg: periodens eget startår. Væggen kan ses —
    det er boksens anden kant — men den siger alligevel, hvad den er, for det
    er den samme væg, fluebenet støder på, og dér er der intet at se.

    Sætningen siger perioden og ikke figuren. Den vises altid dér, hvor
    figuren i forvejen er nævnt — skuffen står åben på den, og
    reparationsbeskeden har allerede sagt dens navn — og et navn to gange i
    træk læses som to figurer.

    Følger startåret erhvervsophøret, er det en anden sætning. Perioden er da
    ikke rørt af et eneste tastet tal, og det, der overrasker, er ADR-0031:
    erhvervsophørsåret er det første år uden arbejde og tælles derfor med som
    `from` og ikke med som `to`. En besked, der blot meldte årstallet, ville
    lade brugeren gætte, hvor det kom fra. */
function cannotEndBeforeReason(figure: PeriodicFigure, from: SimulationYear): string {
  if (figure.period.anchor === 'PersonAge' && figure.period.from === 'WorkEndAge') {
    return (
      `Perioden begynder ved erhvervsophøret i ${from}. Erhvervsophørsåret er det ` +
      `første år uden arbejde og tæller ikke med som slutår.`
    )
  }
  return `Perioden begynder i ${from} og kan ikke slutte før.`
}

/** Den ene sætning om startårets væg: periodens eget slutår, set fra den
    anden ende. */
function cannotBeginAfterReason(to: SimulationYear): string {
  return `Perioden slutter i ${to} og kan ikke begynde efter.`
}

function inEndpointUnit(
  period: Period,
  endpoint: 'from' | 'to',
  year: SimulationYear,
  owner: Person,
): number {
  if (period.anchor === 'CalendarYear') return year
  const standing = period[endpoint]
  if (typeof standing !== 'number') return year - owner.birthYear
  return standing + (year - yearAtAge(owner, standing))
}

/** En variant, personen kun kan have én af, må ikke stå to gange hos samme
    person. I dag er aktiesparekontoen den eneste — [ASKL
    § 3](https://danskelove.dk/aktiesparekontoloven/3) tillader kun én — og
    reglen spørger varianttabellen frem for at nævne den ved navn, jf.
    ADR-0010. Flere ratepensioner, aldersopsparinger og livrenter er lovlige
    og skal blive ved med at kunne skrives: ADR-0018 hviler direkte på, at to
    ratepensioner deler ét loft, og det tilfælde skal kunne stilles.

    To konti ville dele ét råderum og fremskrive en skattefri beholdning på
    det dobbelte af, hvad et pengeinstitut ville have oprettet, jf. ADR-0020. */
function oneOfEachUniqueVariant(plan: Plan): string | undefined {
  for (const person of plan.household.persons) {
    const counted = new Map<string, number>()
    for (const holding of person.holdings) {
      if (!isUniquePerPerson(holding.variant)) continue
      const count = (counted.get(holding.variant) ?? 0) + 1
      counted.set(holding.variant, count)
      if (count > 1) {
        // Varianten nævnes ikke ved navn: dens danske etiket er fladens, og
        // motoren har ingen at låne. Beholdningerne selv siger det bedre —
        // brugeren kan pege på dem i navigatoren.
        const same = person.holdings.filter((other) => other.variant === holding.variant)
        return (
          `${person.name} har ${same.length} beholdninger af samme type: ` +
          `${listed(same.map((other) => other.name))}. Der kan kun være én af den ` +
          `type pr. person.`
        )
      }
    }
  }
  return undefined
}

/** En lønkildet indbetaling kræver en destination, en arbejdsgiver kan
    administrere. Aktiesparekontoen er den eneste, der ikke er det, og reglen
    spørger varianttabellen frem for at nævne den ved navn, jf. ADR-0010. Den
    lønkildede form indeholder AM-bidrag på vejen ind, fordi kilden er
    AM-pligtig — rigtigt for de ordninger, en arbejdsgiver kan administrere,
    og en kategorifejl her: pengene på en aktiesparekonto er fuldt beskattede
    midler, ejeren selv flytter derind, og der lander 100 %.

    Reglen koster en smule udtryksevne. En skattefri indtægtspost regner
    faktisk rigtigt som lønkilde, fordi der ikke indeholdes AM-bidrag af den,
    og den afvises alligevel — en regel, hvis gyldighed afhang af et felt på
    en anden figur, ville gøre planen ugyldig, hver gang det felt ændres et
    andet sted i fladen, jf. ADR-0020. */
function entrySourcedDestination(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  for (const contribution of plan.contributions) {
    if (contribution.kind !== 'EntrySourced') continue
    const to = byId.get(contribution.to)
    if (!to || isEmployerAdministered(to)) continue
    return (
      `Indbetalingen ${contribution.name} går til beholdningen ${to.name}, som ikke ` +
      `er arbejdsgiveradministreret — skriv den som et bidrag fra personens frie ` +
      `midler.`
    )
  }
  return undefined
}

/** Indbetalingens to ender. Destinationen skal findes, må ikke være frie
    midler — så er det en overførsel, jf. ADR-0016 — og skal være åben for
    indbetaling: kapitalpensionen er lukket for nytegning siden udgangen af
    2012 og kan kun tømmes, aldrig fyldes, jf. ADR-0020 og
    `OpenToContributions` i CONTEXT.md. Kilden skal findes i den bog, dens
    form peger ind i.

    Ejerskellet gælder kun den lønkildede form: en arbejdsgiveradministreret
    ordning står i lønmodtagerens eget navn, og person 1's løn kan derfor
    ikke lande i person 2's ratepension. Det beholdningskildede bidrag må
    krydse det — husstandens frie midler flytter sig allerede uhindret
    mellem ejerne gennem en `Transfer`, og skattevirkningen følger
    destinationens ejer og ikke kildens, jf. ADR-0028. */
function contributionEnds(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  const entries = entriesById(plan)
  const ownerOf = ownersByHolding(plan)

  for (const contribution of plan.contributions) {
    const subject = `Indbetalingen ${contribution.name}`
    const to = byId.get(contribution.to)
    if (!to) {
      return `${subject} går til en beholdning, der ikke findes.`
    }
    if (isFreeAssets(to)) {
      return (
        `${subject} går til beholdningen ${to.name}, som ikke er en ordning. ` +
        `En flytning mellem frie midler er en overførsel.`
      )
    }
    if (!isOpenToContributions(to)) {
      return (
        `${subject} går til beholdningen ${to.name}, som har været lukket for ` +
        `indbetaling siden udgangen af 2012.`
      )
    }

    // En kilde, der ikke rammer noget, ville få bidraget til tavst at udeblive
    // hvert eneste år frem for at fejle — netop den slags løgn, ADR-0013 er
    // til for.
    if (contribution.kind === 'EntrySourced') {
      const source = entries.get(contribution.source)
      if (!source) {
        return `${subject} kommer fra en post, der ikke findes.`
      }
      if (source.direction !== 'Income') {
        return (
          `${subject} kommer fra posten ${source.name}, som er en udgiftspost. ` +
          `En lønkilde er en indtægtspost.`
        )
      }
      // Ejerskellet kræver begge ejere for at kunne siges i navne. Findes
      // postens ikke, er det dén fejl, der skal meldes, og `entryOwners`
      // melder den længere nede i kæden — bedre end en besked her om, at
      // posten tilhører en anden end destinationen.
      const sourceOwner = plan.household.persons.find((person) => person.id === source.owner)
      const destinationOwner = ownerOf.get(contribution.to)!
      if (sourceOwner !== undefined && sourceOwner.id !== destinationOwner.id) {
        return (
          `${subject} kommer fra posten ${source.name}, som tilhører ` +
          `${sourceOwner.name}, og går til beholdningen ${to.name}, som tilhører ` +
          `${destinationOwner.name}. En ordning, en arbejdsgiver administrerer, står ` +
          `i lønmodtagerens eget navn.`
        )
      }
    } else {
      const source = byId.get(contribution.source)
      if (!source) {
        return (
          `${subject} kommer fra en beholdning, der ikke findes.`
        )
      }
      // En flytning mellem to ordninger er ikke en indbetaling. Loven har
      // sine egne regler om overførsel mellem ordninger, og de er ikke i
      // domænet — den plan skal afvises frem for at blive regnet forkert.
      if (!isFreeAssets(source)) {
        return (
          `${subject} kommer fra beholdningen ${source.name}, som ikke er frie ` +
          `midler. En flytning mellem to ordninger er ikke en indbetaling.`
        )
      }
    }
  }
  return undefined
}

/** Præcis én beholdning skal være bufferen, jf. ADR-0004, og den skal være
    frie midler: bufferen bærer årets restpost, og en ordning kan ikke tage
    imod frit forbrug — penge ind i den er en indbetaling med et loft og en
    skattevirkning, jf. ADR-0016. */
function bufferPointer(plan: Plan): string | undefined {
  const matches = holdings(plan).filter((holding) => holding.id === plan.buffer)
  if (matches.length === 0) {
    return `Planens buffer peger på en beholdning, der ikke findes.`
  }
  if (matches.length > 1) {
    return `Flere beholdninger er udpeget som buffer.`
  }
  if (!isFreeAssets(matches[0]!)) {
    return `Planens buffer er beholdningen ${matches[0]!.name}, som ikke er frie midler.`
  }
  return undefined
}

/** Overførslens to ender skal begge findes.

    Destinationen er altid frie midler: en flytning ind i en ordning er en
    indbetaling og ikke en overførsel, uanset hvor pengene kom fra, jf.
    ADR-0016.

    Afgiveren skal være en beholdning, en overførsel må hente fra i det år,
    den begynder: en variant, hvis `PayoutTaxation` ikke er `PersonalIncome`,
    og — er den en pensionsordning — først fra dens `PayoutAge`. En hævning
    fra en aldersopsparing før den alder koster 20 % i afgift og er ikke
    noget, planen skal kunne beskrive, jf. ADR-0020 og ADR-0022.

    Reglen er `transferAllowedFrom`s og stilles ét sted; her udledes alene,
    hvilken af de to betingelser der svigtede, så beskeden kan sige hvorfor.
    Begynder overførslen uden startår, begynder den ved planens start — det
    er dét år, døren måles mod. */
function transferEnds(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  const ownerOf = ownersByHolding(plan)
  for (const transfer of plan.transfers) {
    const from = byId.get(transfer.from)
    const to = byId.get(transfer.to)
    if (!from) {
      return `Overførslen ${transfer.name} kommer fra en beholdning, der ikke findes.`
    }
    if (!to) {
      return `Overførslen ${transfer.name} går til en beholdning, der ikke findes.`
    }
    if (!isFreeAssets(to)) {
      return (
        `Overførslen ${transfer.name} går til beholdningen ${to.name}, som ikke er ` +
        `frie midler. En flytning ind i en ordning er en indbetaling.`
      )
    }
    const owner = ownerOf.get(transfer.from)!
    const start = periodBounds(transfer.period, owner).from ?? plan.startYear
    if (!transferAllowedFrom(from, owner, start)) {
      // Reglen har afgjort, at en af de to betingelser svigtede; her udledes
      // alene hvilken. Er varianten ikke personlig indkomst på vejen ud, og
      // har den en dør, er det døren — kun en pensionsordning har en, og både
      // den skattefri og den afgiftspligtige kan stå bag den. Ellers er det
      // varianten selv: en `PersonalIncome` tømmes af en udbetalingsplan.
      if (isPensionScheme(from) && payoutTaxation(from) !== 'PersonalIncome') {
        return (
          `Overførslen ${transfer.name} henter fra beholdningen ${from.name} fra ` +
          `${start}, men dens pensionsudbetalingsalder nås først i ` +
          `${payoutYear(from, owner)}.`
        )
      }
      return (
        `Overførslen ${transfer.name} kommer fra beholdningen ${from.name}, hvis ` +
        `udbetaling er personlig indkomst. Den tømmes af en udbetalingsplan.`
      )
    }
  }
  return undefined
}

function entryOwners(plan: Plan): string | undefined {
  const ids = new Set(plan.household.persons.map((person) => person.id))
  for (const entry of plan.entries) {
    if (!ids.has(entry.owner)) {
      return `Posten ${entry.name} tilhører en person, der ikke findes.`
    }
  }
  return undefined
}

/** Navne på dansk remseform: "A og B", "A, B og C". */
function listed(names: string[]): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} og ${names.at(-1)}`
}

/** Husstandens poster slået op på deres id — det, en besked om en lønkilde
    har brug for for at kunne sige postens navn. */
function entriesById(plan: Plan): Map<EntryId, Entry> {
  return new Map(plan.entries.map((entry) => [entry.id, entry]))
}

/** Hver beholdnings ejer slået op på beholdningens id. En beholdning har
    præcis én, og det er dén, en aldersforankret periode og en `PayoutAge`
    måles mod. */
function ownersByHolding(plan: Plan): Map<HoldingId, Person> {
  return new Map(
    plan.household.persons.flatMap((person) =>
      person.holdings.map((holding) => [holding.id, person] as const),
    ),
  )
}

function holdings(plan: Plan): Holding[] {
  return plan.household.persons.flatMap((person) => person.holdings)
}

/** Husstandens beholdninger slået op på deres id — det, enhver regel om en
    pegers modtager har brug for.

    Kortet kan ikke bære alle regler: to beholdninger med samme id kollapser
    til én indgang, og netop den plan er `bufferPointer` til for at fange.
    Den tæller derfor på listen selv og skal blive ved med det. */
function holdingsById(plan: Plan): Map<HoldingId, Holding> {
  return new Map(holdings(plan).map((holding) => [holding.id, holding]))
}
