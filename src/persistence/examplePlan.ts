import exampleRaw from './eksempelplan.json?raw'
import { importPlan, type ImportResult } from './planFile'

/** Den bundlede eksempelplan, tolket én gang ved opstart gennem samme
    konvolut og migrationskæde som en importeret fil, jf. issue #2. Skulle
    skemaet vokse, uden at filen er fulgt med, retter migrationen den som
    enhver anden gammel fil — eksemplet kan ikke stille drive væk fra, hvad
    `importPlan` accepterer. `examplePlan.test.ts` sikrer, at resultatet
    altid er `Loaded`. */
const EXAMPLE: ImportResult = importPlan(exampleRaw)

export function loadExamplePlan(): ImportResult {
  return EXAMPLE
}

/** Eksemplets eget navn, til bekræftelsen der spørger, om det må erstatte
    den plan der står nu. Falder tilbage til et generisk ord, hvis filen mod
    forventning ikke kunne læses — `examplePlan.test.ts` er stedet, der
    fanger den fejl, ikke denne fallback. */
export const exampleName = EXAMPLE.kind === 'Loaded' ? EXAMPLE.plan.name : 'eksemplet'
