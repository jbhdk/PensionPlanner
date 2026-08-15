import type { Holding } from './plan'

/** Livrenten som medlem af `Holding`-unionen. Det ene sted, varianten nævnes
    ved navn: omsætningen er dens egen regel og hører derfor ikke i
    varianttabellen, som svarer på det, alle seks varianter skal svare på —
    en sats, et loft, en beskatningsform. Der er hverken en sats at slå op
    eller et loft at måle her, kun to oplyste tal og en kvotient. */
export type LifeAnnuityHolding = Extract<Holding, { variant: 'LifeAnnuity' }>

/** Om beholdningen er en livrente. Svaret indsnævrer typen, så de tre
    omsætningsfelter kan læses uden et cast — de hænger på dette ene medlem
    og kan ikke skrives på nogen anden variant, jf. ADR-0015. */
export function isLifeAnnuity(holding: Holding): holding is LifeAnnuityHolding {
  return holding.variant === 'LifeAnnuity'
}

/** Omsætningsfaktoren: selskabets oplyste årlige ydelse divideret med dets
    oplyste depot på samme tidspunkt, jf. ADR-0009.

    De to tal er enhedsløse. De bruges udelukkende som kvotient, og
    prisniveauet går ud med sig selv i divisionen — faktoren er derfor et
    rent forhold, der kan ganges på et depot i løbende priser uden at nogen
    af de to skal deflateres eller fremskrives først.

    Er depotet nul, er der ingen kvotient, og svaret er nul frem for `NaN`.
    En nyoprettet livrente står med nul i begge felter, indtil brugeren
    taster selskabets tal af pensionsoverblikket, og et regnestykke, der
    forgiftede hele fremskrivningen med `NaN`, ville sige mindre om den plan,
    der mangler et tal, end en ydelse på nul gør. */
export function conversionFactor(holding: LifeAnnuityHolding): number {
  if (holding.quotedReserve === 0) return 0
  return holding.quotedAnnualBenefit / holding.quotedReserve
}

/** De tre felter, en livrente oprettes med. Nul i alle tre: selskabets to tal
    står på pensionsoverblikket og kan ikke gættes, og et opfundet
    standardtal ville se ud som et svar, brugeren ikke har givet. Indtil de
    er tastet, er kvotienten nul og ydelsen nul, og skuffen siger hvorfor.

    Typen er skåret af unionens eget medlem, så et fjerde felt ikke kan
    komme til uden også at få en startværdi her. */
export const newLifeAnnuity: Pick<
  LifeAnnuityHolding,
  'quotedReserve' | 'quotedAnnualBenefit' | 'bonusRate'
> = {
  quotedReserve: 0,
  quotedAnnualBenefit: 0,
  bonusRate: 0,
}
