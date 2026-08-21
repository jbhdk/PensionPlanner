import type { Entry } from '../engine/plan'
import type { YearResult } from '../engine/yearResult'
import { kroner } from './format'

/** Notens tekst under en posts felter: hvornår posten løber, og hvad beløbet
    fremskrives med.

    Perioden er motorens eget svar, ikke en udledning ved siden af den —
    skuffen slår posten op i årsrækken frem for at regne den om, jf.
    ADR-0012. Det er også derfor, sætningen ikke spørger til `Recurrence`
    eller `Anchor`, men kun til hvor mange år posten faktisk falder i. */
export function entryNote(years: YearResult[], entry: Entry): string {
  const period = periodSentence(years, entry)
  return [period, regulationSentence(entry, period !== undefined)]
    .filter((sentence) => sentence !== undefined)
    .join(' ')
}

/** Fraværende, når årsrækken er tom: en knækket bufferpeger lader skuffen stå
    åben uden noget at slå op i, og resultatspalten siger allerede hvorfor. */
function periodSentence(years: YearResult[], entry: Entry): string | undefined {
  if (years.length === 0) return undefined

  const falling = fallingYears(years, entry)

  const first = falling[0]
  const last = falling.at(-1)
  if (first === undefined || last === undefined) {
    return 'Posten falder uden for horisonten.'
  }

  if (first === last) {
    return `Posten falder i ${first.year} med ${kroner(first.amount)} kr.`
  }

  return `Posten løber ${first.year}–${last.year}.`
}

/** De år, posten faktisk falder i, med sit beløb — motorens eget svar, ikke
    en udledning ved siden af den, jf. ADR-0012. */
function fallingYears(
  years: YearResult[],
  entry: Entry,
): { year: number; amount: number }[] {
  return years.flatMap((year) => {
    const found = year.entries.find(({ entry: id }) => id === entry.id)
    return found === undefined ? [] : [{ year: year.year, amount: found.amount }]
  })
}

/** Årene posten løber i, som ét kort udtryk — "2026–2031", "2029", eller
    intet, når der ikke er noget at slå op i. Bruges af den rude, der skal
    sige, hvad et lønkildet bidrag arver af sin post. */
export function entryPeriodLabel(years: YearResult[], entry: Entry): string | undefined {
  const falling = fallingYears(years, entry)
  const first = falling[0]
  const last = falling.at(-1)
  if (first === undefined || last === undefined) return undefined
  return first === last ? String(first.year) : `${first.year}–${last.year}`
}

/** Hvad beløbet fremskrives med. Ingen af tilfældene gentager året — det har
    `periodSentence` allerede sagt — og ingen af dem sætter "nutidskroner" og
    "det års egne kroner" op mod hinanden uden at forklare forskellen.

    `yearNamed` fortæller, om der er et år at pege tilbage på. Er der ikke,
    må engangspostens sætning ikke sige "det år": den ville henvise til noget,
    noten aldrig har nævnt. */
function regulationSentence(entry: Entry, yearNamed: boolean): string {
  if (entry.direction === 'Expense') {
    return entry.recurrence.kind === 'Once' && yearNamed
      ? 'Beløbet tastes i nutidskroner og følger planens inflation frem til det år — kun indtægter har deres egen reguleringssats.'
      : 'Udgiften står i nutidskroner og følger planens inflationsantagelse — kun indtægter har deres egen reguleringssats.'
  }
  return entry.recurrence.kind === 'Once' && yearNamed
    ? 'Beløbet tastes i nutidskroner, og satsen bærer det op til det år — den gentager ingenting. Er satsen nul, følger beløbet ikke priserne og er dermed mindre værd, jo længere ude posten ligger.'
    : 'Reguleringssatsen er indtægtens egen og adskilt fra planens inflationsantagelse.'
}
