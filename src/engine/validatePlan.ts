import {
  bearsPayoutSchedule,
  isEmployerAdministered,
  isFreeAssets,
  isPensionScheme,
  isUniquePerPerson,
  payoutStartOf,
  payoutTaxation,
} from './holdingVariant'
import { payoutStartYear, payoutYear, transferAllowedFrom } from './payoutAge'
import { periodBounds } from './age'
import type {
  AgeBound,
  Contribution,
  Entry,
  EntryId,
  Holding,
  HoldingId,
  PensionSchemeHolding,
  Person,
  Plan,
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
    aldrig set `contribution-4` — hun kender sin indbetaling på de to ender,
    navigatoren viser den ved. Id'et er motorens peger, og det hører hjemme,
    hvor det er selve emnet: i en invariant, der er brudt inde i motoren, jf.
    `holdingYears`. */
export function validatePlan(plan: Plan): string | undefined {
  return (
    bufferPointer(plan) ??
    transferEnds(plan) ??
    contributionEnds(plan) ??
    entryOwners(plan) ??
    oneOfEachUniqueVariant(plan) ??
    entrySourcedDestination(plan) ??
    payoutSchedules(plan)
  )
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
          `En ratepension skal udbetales over mindst ${minimumPayoutYears} år.`
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
    da ingen at tilbyde, og afvisningen ovenfor er den, der siger hvorfor. */
export function payoutDurationBounds(
  holding: PensionSchemeHolding,
  owner: Person,
  start: AgeBound,
): { min: number; max: number } {
  const latest = payoutYear(holding, owner) + latestPayoutYearsAfterPayoutAge
  const room = latest - payoutStartYear(start, owner) + 1
  return { min: minimumPayoutYears, max: Math.max(minimumPayoutYears, room) }
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
    AM-pligtig — rigtigt for de tre pensionsordninger og en kategorifejl her:
    pengene på en aktiesparekonto er fuldt beskattede midler, ejeren selv
    flytter derind, og der lander 100 %.

    Reglen koster en smule udtryksevne. En skattefri indtægtspost regner
    faktisk rigtigt som lønkilde, fordi der ikke indeholdes AM-bidrag af den,
    og den afvises alligevel — en regel, hvis gyldighed afhang af et felt på
    en anden figur, ville gøre planen ugyldig, hver gang det felt ændres et
    andet sted i fladen, jf. ADR-0020. */
function entrySourcedDestination(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  const entries = entriesById(plan)
  for (const contribution of plan.contributions) {
    if (contribution.kind !== 'EntrySourced') continue
    const to = byId.get(contribution.to)
    if (!to || isEmployerAdministered(to)) continue
    return (
      `${contributionBySource(contribution, entries, byId)} går til beholdningen ` +
      `${to.name}, som ikke er arbejdsgiveradministreret — skriv den som et bidrag ` +
      `fra personens frie midler.`
    )
  }
  return undefined
}

/** Indbetalingens to ender. Destinationen skal findes og må ikke være frie
    midler — så er det en overførsel, jf. ADR-0016 — og kilden skal findes i
    den bog, dens form peger ind i.

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
    const subject = contributionBySource(contribution, entries, byId)
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

    // En kilde, der ikke rammer noget, ville få bidraget til tavst at udeblive
    // hvert eneste år frem for at fejle — netop den slags løgn, ADR-0013 er
    // til for.
    if (contribution.kind === 'EntrySourced') {
      const source = entries.get(contribution.source)
      if (!source) {
        return `Indbetalingen til beholdningen ${to.name} kommer fra en post, der ikke findes.`
      }
      if (source.direction !== 'Income') {
        return (
          `Indbetalingen til beholdningen ${to.name} kommer fra posten ${source.name}, ` +
          `som er en udgiftspost. En lønkilde er en indtægtspost.`
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
          `Indbetalingen kommer fra posten ${source.name}, som tilhører ` +
          `${sourceOwner.name}, og går til beholdningen ${to.name}, som tilhører ` +
          `${destinationOwner.name}. En ordning, en arbejdsgiver administrerer, står ` +
          `i lønmodtagerens eget navn.`
        )
      }
    } else {
      const source = byId.get(contribution.source)
      if (!source) {
        return (
          `Indbetalingen til beholdningen ${to.name} kommer fra en beholdning, ` +
          `der ikke findes.`
        )
      }
      // En flytning mellem to ordninger er ikke en indbetaling. Loven har
      // sine egne regler om overførsel mellem ordninger, og de er ikke i
      // domænet — den plan skal afvises frem for at blive regnet forkert.
      if (!isFreeAssets(source)) {
        return (
          `Indbetalingen til beholdningen ${to.name} kommer fra beholdningen ` +
          `${source.name}, som ikke er frie midler. En flytning mellem to ordninger ` +
          `er ikke en indbetaling.`
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
    den begynder: en variant, hvis `PayoutTaxation` er `TaxFree`, og — er den
    en pensionsordning — først fra dens `PayoutAge`. En hævning fra en
    aldersopsparing før den alder koster 20 % i afgift og er ikke noget,
    planen skal kunne beskrive, jf. ADR-0020 og ADR-0022.

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
      return `${transferByEnd(to, 'til')} kommer fra en beholdning, der ikke findes.`
    }
    if (!to) {
      return `${transferByEnd(from, 'fra')} går til en beholdning, der ikke findes.`
    }
    if (!isFreeAssets(to)) {
      return (
        `Overførslen fra beholdningen ${from.name} går til beholdningen ${to.name}, ` +
        `som ikke er frie midler. En flytning ind i en ordning er en indbetaling.`
      )
    }
    const owner = ownerOf.get(transfer.from)!
    const start = periodBounds(transfer.period, owner).from ?? plan.startYear
    if (!transferAllowedFrom(from, owner, start)) {
      // Reglen har afgjort, at en af de to betingelser svigtede; her udledes
      // alene hvilken. Er varianten skattefri på vejen ud, og har den en dør,
      // er det døren — kun en pensionsordning har en. Ellers er det
      // varianten selv.
      if (isPensionScheme(from) && payoutTaxation(from) === 'TaxFree') {
        return (
          `Overførslen henter fra beholdningen ${from.name} fra ${start}, men dens ` +
          `pensionsudbetalingsalder nås først i ${payoutYear(from, owner)}.`
        )
      }
      return (
        `Overførslen kommer fra beholdningen ${from.name}, hvis udbetaling er ` +
        `personlig indkomst. Den tømmes af en udbetalingsplan.`
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

/** "Indbetalingen fra posten Løn" — indbetalingen har intet navn af sig selv
    og kendes på sine to ender, præcis som navigatoren viser den. Kilden er
    den ene af dem, og hvilken slags figur den er, siger formen: en post i den
    lønkildede udgave, en beholdning i den beholdningskildede.

    Rammer kilden ingenting, bliver det bare "Indbetalingen". To knækkede
    pegere på samme figur er en fil, der er redigeret i hånden, og beskeden
    siger da det, den kan, frem for at falde tilbage på et id, ingen har
    skrevet. */
function contributionBySource(
  contribution: Contribution,
  entries: Map<EntryId, Entry>,
  byId: Map<HoldingId, Holding>,
): string {
  const source =
    contribution.kind === 'EntrySourced'
      ? entries.get(contribution.source)
      : byId.get(contribution.source)
  if (source === undefined) return 'Indbetalingen'
  const noun = contribution.kind === 'EntrySourced' ? 'posten' : 'beholdningen'
  return `Indbetalingen fra ${noun} ${source.name}`
}

/** Overførslen kendes på sine ender af samme grund som indbetalingen. Her er
    begge ender beholdninger, og det er den hele ende, der navngiver den. */
function transferByEnd(other: Holding | undefined, direction: 'fra' | 'til'): string {
  return other === undefined
    ? 'Overførslen'
    : `Overførslen ${direction} beholdningen ${other.name}`
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
