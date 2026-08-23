import type { Nominal } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'

/** Det, årets pensionsaftaler tilsammen placerede i ordninger.

    AM-delen tælles ikke med: den forlod aldrig kilden som opsparing, og den
    står allerede i personens eget skattelag — aftalen opkræver ingenting, den
    trækker alene fra på vejen ind, jf. ADR-0041. Gebyret og præmien tælles
    heller ikke med: de blev aldrig til formue, jf. ADR-0042. Det er dem, der
    skiller dette tal fra `leftBufferForAgreements`. */
export function placedByAgreements(year: YearResult): Nominal {
  return sum(year.pensionAgreements, (agreement) =>
    sum(agreement.destinations, (destination) => destination.landed),
  )
}

/** Det, årets pensionsaftaler tilsammen tog af bufferen: det placerede plus
    gebyret og præmien.

    De to forlader bufferen sammen med resten af indbetalingen — det er
    derfor, de hører i indbetalingernes bånd og ikke i udgiftsposternes, jf.
    ADR-0042. Båndet navngives efter, hvad der bevæger sig på bufferen, og
    ikke efter hvad pengene siden blev til.

    AM-delen står stadig udenfor: den forlod bufferen som en del af årets
    skat og ligger allerede i skattebåndet. */
export function leftBufferForAgreements(year: YearResult): Nominal {
  return (
    placedByAgreements(year) +
    sum(year.pensionAgreements, (agreement) => agreement.fee + agreement.insurancePremium)
  )
}

/** Det, der i alt landede i ordningerne i året — årstabellens
    Indbetalinger-kolonne.

    Læser to steder, fordi året har to slags kilder: planens egne
    indbetalinger og aftalernes fordelinger. Loftopgørelsen læser allerede
    begge, og kolonnen ville ellers sige et mindre tal end det, den samme
    plan er målt mod, jf. ADR-0041.

    Det er beløbet, der **landede**, og ikke det, der forlod kilden. Vejen
    derhen — bruttobeløbet ved kilden og AM-delen imellem — står i
    forklar-året, hvor der er plads til hele regnestykket. */
export function contributedInYear(year: YearResult): Nominal {
  return (
    sum(year.contributions, (contribution) => contribution.intoHolding) +
    placedByAgreements(year)
  )
}

function sum<T>(items: T[], of: (item: T) => Nominal): Nominal {
  return items.reduce((total, item) => total + of(item), 0)
}
