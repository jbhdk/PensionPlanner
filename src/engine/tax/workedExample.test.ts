import { describe, expect, it } from 'vitest'
import { rateYear2026 } from '../rates/rateYear2026'
import { assessHousehold, totalTaperBase } from './assessHousehold'
import { totalTax } from './assessTax'
import type { Allowance, TaxLayer } from './assessTax'
import { workedExamples } from './testing/workedExamples'

/** Facitcasene. Testen er den samme for dem alle — det er dataene, der bærer
    beregningen, kilden og verifikationsdatoen. En ny case er en ny post i
    listen og ikke en ny test. */

describe('facitcase', () => {
  for (const example of workedExamples) {
    it(example.name, () => {
      const assessment = assessHousehold(example.input, rateYear2026)

      example.expected.forEach((expected, index) => {
        const person = assessment.persons[index]!
        const where = (of: string) => `${of} for person ${index + 1} i "${example.name}"`

        // Folkepensionen findes for præcis de personer, inputtet gav en
        // civilstand — feltet siger selv, om personen var folkepensionist i
        // året. Det er den halvdel, en case ellers ikke kunne skrive: at
        // ægtefællen, der stadig arbejder, ikke fik en folkepension, kan ikke
        // stå som et forventet tal, kun som et fravær.
        expect(person.statePension === undefined, where('folkepensionen')).toBe(
          example.input.persons[index]!.statePension === undefined,
        )

        if (expected.personalIncome !== undefined)
          expect(person.tax.personalIncome, where('personlig indkomst')).toBeCloseTo(
            expected.personalIncome,
            2,
          )
        if (expected.taxableIncome !== undefined)
          expect(person.tax.taxableIncome, where('skattepligtig indkomst')).toBeCloseTo(
            expected.taxableIncome,
            2,
          )
        for (const [allowance, amount] of Object.entries(expected.allowances ?? {}))
          expect(
            person.tax.allowances[allowance as Allowance],
            where(allowance),
          ).toBeCloseTo(amount, 2)
        for (const [layer, amount] of Object.entries(expected.layers ?? {}))
          expect(
            person.tax.layers[layer as TaxLayer].amount,
            where(layer),
          ).toBeCloseTo(amount, 2)
        if (expected.total !== undefined)
          expect(totalTax(person.tax), where('skatten i alt')).toBeCloseTo(expected.total, 2)

        if (expected.statePension) {
          const statePension = person.statePension!
          expect(statePension.basicAmount, where('grundbeløbet')).toBeCloseTo(
            expected.statePension.basicAmount,
            2,
          )
          expect(statePension.pensionSupplement, where('pensionstillægget')).toBeCloseTo(
            expected.statePension.pensionSupplement,
            2,
          )
          expect(
            totalTaperBase(statePension.taper.base),
            where('aftrapningsgrundlaget'),
          ).toBeCloseTo(expected.statePension.taperBase, 2)
        }
      })
    })
  }

  it('siger selv, hvad den hviler på, og hvornår det sidst er efterset', () => {
    for (const example of workedExamples) {
      expect(example.source, `${example.name} mangler en kilde`).not.toBe('')
      expect(example.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(example.expected.length, `${example.name} mangler et facit`).toBe(
        example.input.persons.length,
      )
    }
  })

  it('navngiver præcis de ⚠︎-mærkede satstal, den hviler på', () => {
    // Skattecaserne hviler ikke på et ubekræftet tal: beløbsgrænserne står i
    // skm.dk's § 20-tabel, de fire lag og fradragsprocenterne på skat.dk, og
    // det ekstra pensionsfradrags satser i loven selv. Folkepensionens
    // ydelser og hele aftrapningsblokken er derimod ⚠︎, og enhver case med en
    // folkepensionist i husstanden må sige det.
    //
    // Listen læses af satsåret og ikke skrevet af i hånden: den dag et af
    // tallene bekræftes officielt og mærket fjernes i `unconfirmed`, fejler
    // casene, indtil de selv har sluppet det. Det er den halvdel af oprydningen,
    // der ellers ville blive glemt.
    for (const example of workedExamples) {
      const drawsStatePension = example.input.persons.some((person) => person.statePension)

      expect(example.dependsOnUnconfirmed, example.name).toEqual(
        drawsStatePension ? rateYear2026.statePension.unconfirmed : [],
      )
    }
  })
})
