import { isFreeAssets } from './holdingVariant'
import type { Holding, HoldingId, Plan } from './plan'

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
    persistenslaget afviser en fil, der bærer den. */
export function validatePlan(plan: Plan): string | undefined {
  return (
    bufferPointer(plan) ??
    transferEnds(plan) ??
    contributionEnds(plan) ??
    entryOwners(plan) ??
    singleShareSavingsAccount(plan) ??
    shareSavingsAccountSource(plan)
  )
}

/** [ASKL § 3](https://danskelove.dk/aktiesparekontoloven/3) tillader kun én
    aktiesparekonto pr. person. Reglen gælder alene aktiesparekontoen: flere
    ratepensioner, aldersopsparinger og livrenter er lovlige og skal blive ved
    med at kunne skrives — ADR-0018 hviler direkte på, at to ratepensioner
    deler ét loft, og det tilfælde skal kunne stilles.

    To konti ville dele ét råderum og fremskrive en skattefri beholdning på
    det dobbelte af, hvad et pengeinstitut ville have oprettet, jf. ADR-0020. */
function singleShareSavingsAccount(plan: Plan): string | undefined {
  for (const person of plan.household.persons) {
    const accounts = person.holdings.filter(
      (holding) => holding.variant === 'ShareSavingsAccount',
    )
    if (accounts.length > 1) {
      return (
        `Personen ${person.id} har ${accounts.length} aktiesparekonti. Der kan kun ` +
        `være én pr. person, jf. ASKL § 3.`
      )
    }
  }
  return undefined
}

/** Der findes ingen arbejdsgiveradministreret aktiesparekonto, og en
    lønkildet indbetaling til den kan derfor ikke ske. Den form indeholder
    AM-bidrag på vejen ind, fordi kilden er AM-pligtig — rigtigt for de tre
    pensionsordninger og en kategorifejl her: pengene på en aktiesparekonto er
    fuldt beskattede midler, ejeren selv flytter derind, og der lander 100 %.

    Reglen koster en smule udtryksevne. En skattefri indtægtspost regner
    faktisk rigtigt som lønkilde, fordi der ikke indeholdes AM-bidrag af den,
    og den afvises alligevel — en regel, hvis gyldighed afhang af et felt på
    en anden figur, ville gøre planen ugyldig, hver gang det felt ændres et
    andet sted i fladen, jf. ADR-0020. */
function shareSavingsAccountSource(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  for (const contribution of plan.contributions) {
    if (contribution.kind !== 'EntrySourced') continue
    if (byId.get(contribution.to)?.variant !== 'ShareSavingsAccount') continue
    return (
      `Indbetalingen ${contribution.id} kommer fra posten ${contribution.source} og går ` +
      `til aktiesparekontoen ${contribution.to}. Der findes ingen ` +
      `arbejdsgiveradministreret aktiesparekonto — skriv den som et bidrag fra ` +
      `personens frie midler.`
    )
  }
  return undefined
}

/** Indbetalingens to ender. Destinationen skal findes og må ikke være frie
    midler — så er det en overførsel, jf. ADR-0016 — og kilden skal findes i
    den bog, dens form peger ind i.

    Kilde og destination skal tilhøre samme person i begge former:
    fradragsretten nedsætter den personlige indkomst, og den hører hos den,
    der ejer ordningen. En indbetaling til ægtefællens ordning ville placere
    skattevirkningen hos den forkerte. */
function contributionEnds(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  const entries = new Map(plan.entries.map((entry) => [entry.id, entry]))
  const ownerOf = new Map(
    plan.household.persons.flatMap((person) =>
      person.holdings.map((holding) => [holding.id, person.id]),
    ),
  )

  for (const contribution of plan.contributions) {
    const to = byId.get(contribution.to)
    if (!to) {
      return (
        `Indbetalingen ${contribution.id} går til beholdningen ${contribution.to}, ` +
        `som ikke findes.`
      )
    }
    if (isFreeAssets(to)) {
      return (
        `Indbetalingen ${contribution.id} går til beholdningen ${contribution.to}, ` +
        `som er frie midler. En flytning mellem frie midler er en overførsel.`
      )
    }

    // En kilde, der ikke rammer noget, ville få bidraget til tavst at udeblive
    // hvert eneste år frem for at fejle — netop den slags løgn, ADR-0013 er
    // til for.
    let owner: string | undefined
    if (contribution.kind === 'EntrySourced') {
      const source = entries.get(contribution.source)
      if (!source) {
        return (
          `Indbetalingen ${contribution.id} kommer fra posten ${contribution.source}, ` +
          `som ikke findes.`
        )
      }
      if (source.direction !== 'Income') {
        return (
          `Indbetalingen ${contribution.id} kommer fra posten ${contribution.source}, ` +
          `som er en udgiftspost. En lønkilde er en indtægtspost.`
        )
      }
      owner = source.owner
    } else {
      const source = byId.get(contribution.source)
      if (!source) {
        return (
          `Indbetalingen ${contribution.id} kommer fra beholdningen ${contribution.source}, ` +
          `som ikke findes.`
        )
      }
      // En flytning mellem to ordninger er ikke en indbetaling. Loven har
      // sine egne regler om overførsel mellem ordninger, og de er ikke i
      // domænet — den plan skal afvises frem for at blive regnet forkert.
      if (!isFreeAssets(source)) {
        return (
          `Indbetalingen ${contribution.id} kommer fra beholdningen ${contribution.source}, ` +
          `som ikke er frie midler. En flytning mellem to ordninger er ikke en indbetaling.`
        )
      }
      owner = ownerOf.get(contribution.source)
    }

    if (owner !== ownerOf.get(contribution.to)) {
      return (
        `Indbetalingen ${contribution.id} går fra ${contribution.source} til ` +
        `beholdningen ${contribution.to}, som ikke tilhører samme person.`
      )
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
    return `Planens buffer peger på beholdningen ${plan.buffer}, som ikke findes.`
  }
  if (matches.length > 1) {
    return `Flere beholdninger er udpeget som buffer.`
  }
  if (!isFreeAssets(matches[0]!)) {
    return `Planens buffer peger på beholdningen ${plan.buffer}, som ikke er frie midler.`
  }
  return undefined
}

/** Overførslens to ender skal begge findes, og de skal begge være frie
    midler: en flytning ind i en ordning er en indbetaling og ikke en
    overførsel, uanset hvor pengene kom fra, jf. ADR-0016. */
function transferEnds(plan: Plan): string | undefined {
  const byId = holdingsById(plan)
  for (const transfer of plan.transfers) {
    const from = byId.get(transfer.from)
    const to = byId.get(transfer.to)
    if (!from) {
      return `Overførslen ${transfer.id} kommer fra beholdningen ${transfer.from}, som ikke findes.`
    }
    if (!to) {
      return `Overførslen ${transfer.id} går til beholdningen ${transfer.to}, som ikke findes.`
    }
    if (!isFreeAssets(to)) {
      return (
        `Overførslen ${transfer.id} går til beholdningen ${transfer.to}, som ikke er ` +
        `frie midler. En flytning ind i en ordning er en indbetaling.`
      )
    }
    if (!isFreeAssets(from)) {
      return (
        `Overførslen ${transfer.id} kommer fra beholdningen ${transfer.from}, som ikke er ` +
        `frie midler.`
      )
    }
  }
  return undefined
}

function entryOwners(plan: Plan): string | undefined {
  const ids = new Set(plan.household.persons.map((person) => person.id))
  for (const entry of plan.entries) {
    if (!ids.has(entry.owner)) {
      return `Posten ${entry.id} tilhører personen ${entry.owner}, som ikke findes.`
    }
  }
  return undefined
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
