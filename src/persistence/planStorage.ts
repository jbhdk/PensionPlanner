import type { Plan } from '../engine/plan'
import { validateBuffer } from '../engine/simulate'
import { migrations, runMigrations } from './migrations'

export const STORAGE_KEY = 'pensionplanner.plan'

/** Skemaversionen data gemmes under. Kæden i migrations.ts løfter en gemt
    plan fra sin egen version og frem til denne, jf. issue #15. */
export const CURRENT_SCHEMA_VERSION = 1

export type LoadResult =
  | { kind: 'Loaded'; plan: Plan }
  | { kind: 'Empty' }
  | { kind: 'Failed'; reason: string }

export function savePlan(plan: Plan): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, plan }),
  )
}

export function loadPlan(): LoadResult {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return { kind: 'Empty' }
  }

  let stored: unknown
  try {
    stored = JSON.parse(raw)
  } catch {
    return { kind: 'Failed', reason: 'Den gemte plan er ikke gyldig JSON.' }
  }

  if (!isEnvelope(stored)) {
    return { kind: 'Failed', reason: 'Det gemte er ikke en genkendelig plan.' }
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
      reason: error instanceof Error ? error.message : 'Den gemte plan kunne ikke indlæses.',
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
