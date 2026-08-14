import type { Plan } from '../engine/plan'
import { envelope, parsePlanEnvelope } from './planEnvelope'

export const STORAGE_KEY = 'pensionplanner.plan'

export type LoadResult =
  | { kind: 'Loaded'; plan: Plan }
  | { kind: 'Empty' }
  | { kind: 'Failed'; reason: string }

export function savePlan(plan: Plan): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope(plan)))
}

/** Det gemte, som det står — utolket og umigreret. Fladen bruger det, når
    indlæsningen fejlede: det, der ikke kunne læses, er netop det, brugeren
    skal kunne få ud som fil og rette i. En tolket plan ville være det
    forkerte svar, for der er ingen. */
export function storedPlanText(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function loadPlan(): LoadResult {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return { kind: 'Empty' }
  }
  return parsePlanEnvelope(raw)
}
