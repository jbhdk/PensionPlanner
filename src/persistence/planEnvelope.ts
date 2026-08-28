import type { Plan } from '../engine/plan'
import { validatePlan } from '../engine/validatePlan'
import { SALARY_MEANING_CHANGED_IN, migrations, runMigrations } from './migrations'
import { repairPlan } from './repairPlan'

/** Skemaversionen data gemmes under, både i localStorage og i en eksporteret
    fil — kæden i migrations.ts løfter en gemt plan fra sin egen version og
    frem til denne, jf. issue #15. */
export const CURRENT_SCHEMA_VERSION = 17

export type ParseResult =
  | {
      kind: 'Loaded'
      plan: Plan
      /** Sat, når planen blev læst, men et menneske skal se på den. Det er
          ikke en fejl — planen regner — men en migration kan ikke altid gøre
          arbejdet færdigt, og en tavshed ville lade et forkert tal blive
          stående, jf. ADR-0040. Fraværende i det almindelige tilfælde. */
      notice?: string
    }
  | { kind: 'Failed'; reason: string }

/** Beskeden til planlæggeren, når en plan fra før ADR-0040 åbnes. Den siger,
    hvad tallet betyder nu, og hvad der skal gøres — motoren kan ikke selv
    vide, hvor meget af en gemt lønpost der var arbejdsgiverens. */
const salaryMeaningNotice =
  'Lønposterne skal efterses. Beløbet på en lønpost er nu det, lønsedlen ' +
  'kalder løn — før skulle arbejdsgiverens pensionsbidrag være lagt til. ' +
  'Værktøjet kan ikke selv vide, hvor meget af det gemte tal der var ' +
  'arbejdsgiverens, så tallet står, som det stod. Ret lønnen, og skriv ' +
  'firmaordningen i afsnittet Pension på posten.'

/** Beskeden til planlæggeren, når reparationstrinnet klemte noget på vej ind.
    Planen regner, men tallene er ikke længere dem, filen bar, og en tavs
    rettelse af brugerens egne tal er den slags fejl, der aldrig viser sig,
    jf. ADR-0045. */
function repairNotice(repairs: string[]): string {
  return (
    'Planen bar værdier, den ikke kan bære, og de er rettet ved indlæsningen. ' +
    `Se dem efter: ${repairs.join(' ')}`
  )
}

/** De beskeder, indlæsningen har at sige, som én. To af dem kan falde samme
    gang — en plan fra før ADR-0040 kan også bære en periode, fladen ville
    have klemt — og `ParseResult` bærer ét `notice` og ikke en liste. */
function noticed(notices: string[]): string | undefined {
  return notices.length === 0 ? undefined : notices.join(' ')
}

/** Konvolutten, både localStorage og en eksporteret fil gemmer planen i. */
export function envelope(plan: Plan): { schemaVersion: number; plan: Plan } {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, plan }
}

/** Tolker en gemt konvolut — fra localStorage eller en importeret fil — og
    kører den gennem migrationskæden. Delt mellem de to, så en ukendt
    fremtidig skemaversion afvises ens begge steder, jf. issue #16: kæden
    løber kun fremad, så en version nyere end `CURRENT_SCHEMA_VERSION` skal
    afvises eksplicit i stedet for at blive returneret umigreret.

    Mellem kæden og indgangskontrollen står `repairPlan`, som klemmer med de
    samme grænser, feltet og håndtaget bruger, jf. ADR-0045. Rækkefølgen er
    hele pointen: en gemt plan, der bar en tilstand, fladen i dag ville have
    klemt væk, skal repareres og ikke afvises — ellers ville næste indlæsning
    give fejlskærmen, uden at brugeren havde rørt noget. Trinnet er ikke et
    led i kæden, og `CURRENT_SCHEMA_VERSION` flytter sig derfor ikke: en
    importeret fil kan bære tilstanden på den nuværende version. */
export function parsePlanEnvelope(raw: string): ParseResult {
  let stored: unknown
  try {
    stored = JSON.parse(raw)
  } catch {
    return { kind: 'Failed', reason: 'Det gemte er ikke gyldig JSON.' }
  }

  if (!isEnvelope(stored)) {
    return { kind: 'Failed', reason: 'Det gemte er ikke en genkendelig plan.' }
  }

  if (stored.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      kind: 'Failed',
      reason:
        `Det gemte er fra en nyere version af værktøjet (skemaversion ${stored.schemaVersion}) ` +
        `end den, du bruger nu (skemaversion ${CURRENT_SCHEMA_VERSION}).`,
    }
  }

  try {
    const migrated = runMigrations(
      stored.plan,
      stored.schemaVersion,
      CURRENT_SCHEMA_VERSION,
      migrations,
    )
    const repaired = repairPlan(migrated as Plan)
    const planError = validatePlan(repaired.plan)
    if (planError) {
      return { kind: 'Failed', reason: planError }
    }
    const notice = noticed([
      ...(stored.schemaVersion < SALARY_MEANING_CHANGED_IN ? [salaryMeaningNotice] : []),
      ...(repaired.repairs.length > 0 ? [repairNotice(repaired.repairs)] : []),
    ])
    return { kind: 'Loaded', plan: repaired.plan, ...(notice ? { notice } : {}) }
  } catch (error) {
    return {
      kind: 'Failed',
      reason: error instanceof Error ? error.message : 'Det gemte kunne ikke indlæses.',
    }
  }
}

function isEnvelope(data: unknown): data is { schemaVersion: number; plan: unknown } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'schemaVersion' in data &&
    typeof (data as { schemaVersion: unknown }).schemaVersion === 'number' &&
    'plan' in data
  )
}
