import type { HoldingId, Nominal } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'

/** Årets overskud: summen af alt, der bevægede sig på bufferen i året,
    undtagen dens eget afkast, jf. ADR-0026.

    Udledt af fire tal på bufferens beholdningsår frem for gemt på
    `YearResult`. Bufferens saldo bevægede sig af to slags grunde — afkastet,
    som ikke er penge husstanden kan bruge, og strømmene, som er det hele
    — og trækkes afkastet fra igen, står strømmene tilbage. Beholdningsskatten
    lægges til, fordi den er trukket af saldoen sammen med afkastet og hører
    til det, ikke til driften; husstandens egen skat af afkastet er en regning
    som enhver anden og bliver derfor stående i tallet.

    ADR-0012 er ikke i vejen: fire tal fra samme række, der lægges sammen, kan
    ikke blive uenige med motoren, hvor en gentaget *udledning* kunne. Samme
    slags udledning som `netReturn`. */
export function surplus(year: YearResult, buffer: HoldingId): Nominal {
  const holding = year.holdings.find((candidate) => candidate.holding === buffer)!

  return holding.closingBalance - holding.openingBalance - holding.return + holding.tax
}
