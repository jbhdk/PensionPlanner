import type { Plan } from '../engine/plan'
import { envelope, parsePlanEnvelope, type ParseResult } from './planEnvelope'

export type ImportResult = ParseResult

/** Planen som JSON, i samme konvolut som localStorage bruger — samme
    skemaversion, samme migrationskæde ved import, jf. issue #16. */
export function exportPlan(plan: Plan): string {
  return JSON.stringify(envelope(plan), null, 2)
}

export function importPlan(raw: string): ImportResult {
  return parsePlanEnvelope(raw)
}
