import type { Plan } from '../engine/plan'
import { validateBuffer } from '../engine/simulate'
import { migrations, runMigrations } from './migrations'

/** Skemaversionen data gemmes under, både i localStorage og i en eksporteret
    fil — kæden i migrations.ts løfter en gemt plan fra sin egen version og
    frem til denne, jf. issue #15. */
export const CURRENT_SCHEMA_VERSION = 2

export type ParseResult =
  | { kind: 'Loaded'; plan: Plan }
  | { kind: 'Failed'; reason: string }

/** Konvolutten, både localStorage og en eksporteret fil gemmer planen i. */
export function envelope(plan: Plan): { schemaVersion: number; plan: Plan } {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, plan }
}

/** Tolker en gemt konvolut — fra localStorage eller en importeret fil — og
    kører den gennem migrationskæden. Delt mellem de to, så en ukendt
    fremtidig skemaversion afvises ens begge steder, jf. issue #16: kæden
    løber kun fremad, så en version nyere end `CURRENT_SCHEMA_VERSION` skal
    afvises eksplicit i stedet for at blive returneret umigreret. */
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
    const plan = migrated as Plan
    const bufferError = validateBuffer(plan)
    if (bufferError) {
      return { kind: 'Failed', reason: bufferError }
    }
    return { kind: 'Loaded', plan }
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
