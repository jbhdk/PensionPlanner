import type { Plan } from './plan'

/** Planens pegere skal alle ramme noget, før motoren kan regne på den:
    bufferen, overførslernes to ender og posternes ejere. En peger, der
    hænger, får motoren til enten at lyve eller styrte, jf. ADR-0013.

    Returnerer en forklarende dansk besked ved den første hængende peger —
    ellers intet. Brugt tre steder: `simulate` kaster på den, fladen viser den
    i resultatspalten frem for at lade planen fejle tavst, og persistenslaget
    afviser en fil, der bærer den. */
export function validatePlan(plan: Plan): string | undefined {
  return bufferPointer(plan) ?? transferEnds(plan) ?? entryOwners(plan)
}

/** Præcis én beholdning skal være bufferen, jf. ADR-0004. */
function bufferPointer(plan: Plan): string | undefined {
  const matches = holdingIds(plan).filter((id) => id === plan.buffer)
  if (matches.length === 0) {
    return `Planens buffer peger på beholdningen ${plan.buffer}, som ikke findes.`
  }
  if (matches.length > 1) {
    return `Flere beholdninger er udpeget som buffer.`
  }
  return undefined
}

function transferEnds(plan: Plan): string | undefined {
  const ids = new Set(holdingIds(plan))
  for (const transfer of plan.transfers) {
    if (!ids.has(transfer.from)) {
      return `Overførslen ${transfer.id} kommer fra beholdningen ${transfer.from}, som ikke findes.`
    }
    if (!ids.has(transfer.to)) {
      return `Overførslen ${transfer.id} går til beholdningen ${transfer.to}, som ikke findes.`
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

function holdingIds(plan: Plan): string[] {
  return plan.household.persons.flatMap((person) =>
    person.holdings.map((holding) => holding.id),
  )
}
