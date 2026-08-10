/** Hvad der er valgt i navigatoren, og dermed hvad skuffen viser. */
export type Target =
  | { kind: 'plan' }
  | { kind: 'person'; id: string }
  | { kind: 'holding'; id: string }
  | { kind: 'entry'; id: string }

export type Selection = Target | null

export function sameSelection(a: Selection, b: Selection): boolean {
  if (a === null || b === null) return a === b
  return a.kind === b.kind && ('id' in a ? a.id : '') === ('id' in b ? b.id : '')
}
