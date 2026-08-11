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

export function loadPlan(): LoadResult {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return { kind: 'Empty' }
  }
  return parsePlanEnvelope(raw)
}
