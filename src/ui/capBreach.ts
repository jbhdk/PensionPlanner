import type { CapBreach } from '../engine/yearResult'

/** Danske mærkater for de to slags loftbrud fra ADR-0018. Ordet siger, hvad
    bruddet kostede, og ikke bare at et loft er brudt: det ene flyttede årets
    skat, det andet ville have kostet en afgift, som ikke er modelleret. */
export const capBreachLabels: Record<CapBreach, string> = {
  LostDeductibility: 'Fradrag tabt',
  Chargeable: 'Afgiftspligtigt',
}

/** Rækkens CSS-klasse følger bruddet — se app.css. Farven er en anden end
    bufferens: rød er forbeholdt den negative buffer alene, og et brudt loft
    er ikke en fejltilstand, men en oplysning om, at en del af indbetalingen
    ikke virkede. De to slags brud deler tone og skelnes med ordet i
    mærkatet, ganske som bufferens to tilstande gør. */
export const capBreachClasses: Record<CapBreach, string> = {
  LostDeductibility: 'fradragtabt',
  Chargeable: 'afgiftspligtigt',
}
