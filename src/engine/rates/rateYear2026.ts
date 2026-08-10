import type { RateYear } from './rateYear'

/** Satsår 2026, skrevet af efter docs/satser/2026.md. Dokumentet er
    forlægget med hjemmelshenvisninger og selvkontrol; denne fil er det, som
    motoren læser. Retter man et tal her, retter man det begge steder. */
export const rateYear2026: RateYear = {
  year: 2026,
  verifiedOn: '2026-08-09',

  bracketTaxRates: {
    source: 'https://skat.dk/hjaelp/bundskat-mellemskat-topskat-og-toptopskat',
    unconfirmed: [],
    bottomBracketTax: 0.1201,
    middleBracketTax: 0.075,
    topBracketTax: 0.075,
    additionalTopBracketTax: 0.05,
  },

  taxRates: {
    source: 'https://www.skatteguiden.dk/skattesatser/',
    unconfirmed: [],
    labourMarketContribution: 0.08,
    shareIncomeBelowThreshold: 0.27,
    shareIncomeAboveThreshold: 0.42,
    palTax: 0.153,
    shareSavingsAccount: 0.17,
  },

  taxCeiling: {
    source: 'https://www.skatteguiden.dk/skattesatser/',
    unconfirmed: [],
    atMiddleBracket: 0.4457,
    atTopBracket: 0.5207,
    atAdditionalTopBracket: 0.5707,
    capitalIncome: 0.42,
  },

  thresholds: {
    source:
      'https://skm.dk/tal-og-metode/satser/regulering-af-beloebsgraenser/beloebsgraenser-i-skattelovgivningen-der-reguleres-efter-personskattelovens-20-2025-2026',
    unconfirmed: [],
    personalAllowance: 54_100,
    middleBracketTax: 641_200,
    topBracketTax: 777_900,
    additionalTopBracketTax: 2_592_700,
    shareIncome: 79_400,
    capitalIncomeInTopBracket: 55_000,
    employmentAllowanceMax: 63_300,
    jobAllowanceMax: 3_100,
    jobAllowanceFloor: 235_200,
    extraPensionAllowanceBaseMax: 87_800,
    oldAgeSavingsCap: 9_900,
    oldAgeSavingsCapNearStatePensionAge: 64_200,
    instalmentPensionCap: 68_700,
    shareSavingsAccountCap: 174_200,
  },

  allowanceRates: {
    source:
      'https://skat.dk/en-us/individuals/deductions-and-allowances/' +
      'deductions-and-allowances-when-working/employment-and-job-allowances ' +
      '(beskæftigelses- og jobfradrag) og ' +
      'https://danskelove.dk/ligningsloven/9l ' +
      '(det ekstra pensionsfradrags to satser)',
    unconfirmed: [],
    employmentAllowance: 0.1275,
    jobAllowance: 0.045,
    extraPensionAllowanceEarly: 0.12,
    extraPensionAllowanceLate: 0.32,
  },

  statePension: {
    source:
      'https://www.borger.dk/pension-og-efterloen/Folkepension-oversigt/foer-du-gaar-paa-folkepension/Folkepension-grundbeloeb-pensionstillaeg',
    unconfirmed: ['basicAmount', 'taper'],
    basicAmount: 90_528,
    taper: [
      {
        civilStatus: 'Single',
        pensionSupplement: 104_748,
        allowance: 99_200,
        rate: 0.309,
        cutOff: 438_200,
      },
      {
        civilStatus: 'WithNonPensioner',
        pensionSupplement: 53_604,
        allowance: 198_800,
        rate: 0.32,
        cutOff: 366_400,
      },
      {
        civilStatus: 'WithPensioner',
        pensionSupplement: 53_604,
        allowance: 198_800,
        rate: 0.16,
        cutOff: 533_800,
      },
    ],
  },
}
