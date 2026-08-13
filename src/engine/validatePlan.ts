import { isFreeAssets } from './holdingVariant'
import type { Holding, Plan } from './plan'

/** Planens pegere skal alle ramme noget, før motoren kan regne på den:
    bufferen, overførslernes to ender, indbetalingernes kilde og destination,
    og posternes ejere. En peger, der
    hænger, får motoren til enten at lyve eller styrte, jf. ADR-0013.

    Returnerer en forklarende dansk besked ved den første hængende peger —
    ellers intet. Brugt tre steder: `simulate` kaster på den, fladen viser den
    i resultatspalten frem for at lade planen fejle tavst, og persistenslaget
    afviser en fil, der bærer den. */
export function validatePlan(plan: Plan): string | undefined {
  return (
    bufferPointer(plan) ??
    transferEnds(plan) ??
    contributionEnds(plan) ??
    entryOwners(plan)
  )
}

/** Indbetalingens to ender. Destinationen skal findes og må ikke være frie
    midler — så er det en overførsel, jf. ADR-0016. */
function contributionEnds(plan: Plan): string | undefined {
  const byId = new Map(holdings(plan).map((holding) => [holding.id, holding]))
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
    // Fradragsretten nedsætter den personlige indkomst, og den hører hos den,
    // der ejer ordningen. En indbetaling til ægtefællens ordning ville
    // placere skattevirkningen hos den forkerte.
    if (source.owner !== ownerOf.get(contribution.to)) {
      return (
        `Indbetalingen ${contribution.id} går fra posten ${contribution.source} til ` +
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
  const byId = new Map(holdings(plan).map((holding) => [holding.id, holding]))
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
