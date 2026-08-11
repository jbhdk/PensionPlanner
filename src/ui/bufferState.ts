import type { BufferState } from '../engine/yearResult'

/** Danske mærkater for de to fejltilstande fra ADR-0008. Delt mellem
    årstabellen og formuegrafen, så et spænd hedder det samme begge steder. */
export const bufferStateLabels: Record<BufferState, string> = {
  Incomplete: 'Ufuldstændig',
  Unsustainable: 'Uholdbar',
}

/** Rækkens/spændets CSS-klasse følger tilstanden, så ufuldstændig og
    uholdbar kan skelnes uden at læse et tal — se app.css. Farven er den
    samme for begge: rød er forbeholdt den negative buffer alene, og de to
    tilstande skelnes med ordet i mærkatet, ikke med endnu en farve. */
export const bufferStateClasses: Record<BufferState, string> = {
  Incomplete: 'ufuldstaendig',
  Unsustainable: 'uholdbar',
}
