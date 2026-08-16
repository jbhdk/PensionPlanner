# Ét simuleringsår

Rækkefølgen inde i motoren for ét kalenderår. Alt herunder regnes i `Nominal` — deflateringen til `Real` sker først i brugerfladen, jf. [ADR-0001](../adr/0001-nominel-regning-real-visning.md).

Diagrammet er den mest omstridte del af designet: hvert trin læser resultatet af de foregående, og en ombytning ændrer tallene.

```mermaid
sequenceDiagram
    autonumber
    participant E as Engine
    participant H as Holdings
    participant L as LifeAnnuity
    participant S as StatePension
    participant N as Entries
    participant T as TaxEngine
    participant F as FreeAssets

    Note over E: Årets begyndelse — saldi primo er kendt

    E->>H: instalment from opening balance, by principle
    H-->>E: payouts (SerialPrinciple / AnnuityPrinciple)
    E->>L: at payout start: benefit = reserve × conversionFactor(), once
    L-->>E: guaranteed lifelong benefit, bonus-regulated thereafter
    Note over E,L: the reserve leaves household wealth here — the conversion term
    E->>N: project entries, contributions and transfers by regulationRate or inflationAssumption, and Timing
    N-->>E: flows for the year, each with its return weight
    Note over N: ATP is an Entry with taxTreatment PensionIncome — there is no Benefit figure
    E->>H: transfers out of TaxFree holdings, shortened to the opening balance
    H-->>E: what actually moved

    Note over E,H: Alle daterede bevægelser skal være kendt, før afkastet kan beregnes
    E->>H: credit return on weighted average balance
    Note over E,H: on the Buffer an Even flow weighs zero — only the giving end keeps its weight
    H-->>E: return per holding
    E->>T: HoldingTax on that return, rate by variant
    T-->>H: deduct HoldingTax from balance
    E->>H: in the last payout year, sweep the remainder into the instalment
    H-->>E: holding closes at exactly zero
    E->>L: in the conversion year, sweep the remainder into the conversion
    L-->>E: holding closes at exactly zero

    Note over E,H: Afkastet står fast herfra — årets drift ligger nedenunder og kan ikke nå det
    E->>S: BasicAmount and PensionSupplement from statePensionAge
    S-->>E: amounts before taper

    Note over E,T: Husstandskobling — kan ikke deles i to uafhængige personberegninger
    E->>T: TaperBase = own + (1 − spouseDisregard) × spouse's, rounded down to nearest 100
    Note over T: Earned income is outside the base — the pensioner's own and the spouse's alike
    T-->>E: tapered PensionSupplement
    Note over T: StatePension is not part of its own base — one pass, never an iteration

    E->>T: tax assessment per person, EarnedIncome and PensionIncome kept apart
    T-->>E: tax for the year, and one marginal rate per income kind

    E->>F: net result = income + benefits − tax − expenses; payouts only move money
    Note over F: Saldoen må gå negativt — signalet om at planen ikke holder
    F-->>E: closing wealth

    Note over E: YearResult med alle mellemregninger
```

## Hvorfor rækkefølgen er som den er

- **De daterede bevægelser først, afkastet bagefter.** Afkastet regnes på den vægtede gennemsnitssaldo, så enhver bevægelse med et forfald skal være kendt, før det kan beregnes. Se [ADR-0006](../adr/0006-maaneden-er-en-afkastvaegt-ikke-et-tidsskridt.md).
- **Årets drift ligger derimod nedenunder.** Folkepensionen, aftrapningen, skatten og restposten kommer efter afkastet, fordi ingen af dem kan nå det: på bufferen vejer en jævn strøm nul, jf. [ADR-0024](../adr/0024-gennemloebet-forrenter-sig-ikke-og-afkastet-krediteres-foer-aarets-drift.md). Rækkefølgen er ikke en konvention men en håndhævelse — tillægget findes ikke endnu, når afkastet spørges, og kan derfor ikke indgå i sit eget grundlag gennem bufferen.
- **Vægten hører til enden og ikke til strømmen.** En rate mister `½ × beløbet` fra ratepensionens afkastgrundlag, men bufferen får ikke de penge vejet ind: de forlader ordningen månedsvis og forrenter sig ingen steder i det halve år, de er undervejs. En dateret post beholder til gengæld sin vægt i begge ender — et boligsalg i februar er stadig elleve tolvtedele af et år.
- **Raten regnes altid af primosaldoen.** Det er en lovregel — saldoen ved årets begyndelse divideret med resterende udbetalingsår — ikke en konvention, og den påvirkes derfor ikke af vægtningen.
- **Omsætningen har vægt 1, og fejningen efter den har vægt nul.** Depotet er saldoen ved årets begyndelse, og det forlader beholdningen dér — der er derfor intet af det tilbage at forrente, og livrenten lukker af sig selv på nul i et år, hvor intet andet faldt i den. Faldt der en indbetaling, tager fejningen dens rest med i omsætningen efter afkastet og beholdningsskatten, ganske som den sidste rates gør. Ydelsen røres ikke af fejningen: den er regnet af primosaldoen, som er det depot, selskabet omsætter.
- **Den sidste rate fejer resten med, og den fejning har vægt nul.** Den sker efter afkastet og beholdningsskatten og kan derfor ikke flytte det grundlag, den selv er regnet af — uden den rækkefølge var regnestykket cirkulært. Beløbet kan være negativt, når annuitetsprincippets sidste rate overstiger saldoen; begge veje lukker beholdningen på nul.
- **`HoldingTax` af årets faktiske afkast.** Når afkastet er vægtet korrekt, er der ikke længere et spørgsmål om, hvad skatten rammer. Afkastet forbliver brutto — skatten trækkes af saldoen og tælles med i årets `tax`, så balanceinvarianten læser som den gør.
- **Aftrapning før skat.** `PensionSupplement` er skattepligtig indkomst, så det aftrappede beløb — ikke det fulde — skal ind i skatteopgørelsen.
- **Omsætningen er et trin, ikke en bogføring.** Livrentens depot forlader husstandens formue i omsætningsåret uden at være hverken en udgift eller en skat, og det er derfor `conversion` har sit eget led i balanceinvarianten. Bagefter er ydelsen indkomst udefra.
- **En udbetaling er ikke indkomst; en ydelse er.** Ratepensionens rate flytter penge fra beholdningen til bufferen og lader formuen uændret — kun dens skat sætter aftryk i ligningen. Folkepensionen, ATP og den omsatte livrentes ydelse kommer derimod udefra og indgår i `income`.
- **Aftrapningen er ét gennemløb.** Den sociale pension indgår ikke i sit eget indtægtsgrundlag, jf. PL § 29, stk. 4, nr. 1, så den ene persons tillæg afhænger aldrig af den andens tillæg — kun af den andens øvrige indkomst. Den regel lukker koblingen mellem to personer; bufferen kunne lukke den samme ring gennem kapitalindkomsten, og det er den anden halvdel af svaret, jf. ADR-0024. Begge skal holde, for at ét gennemløb er nok.
- **`FreeAssets` til sidst.** Alt, der ikke er placeret et bestemt sted, lander her. Se [ADR-0002](../adr/0002-plan-drevet-motor-med-frie-midler-som-buffer.md).

## Åbne punkter

- **Balanceinvarianten skal kunne udtrykkes på dette diagram.** `closingWealth − openingWealth = income + return − tax − expenses − conversion` er den delte assertion i alle motortests; hvis et trin her ikke er synligt i den ligning, mangler diagrammet noget.
- **`Property` og `Loan` mangler.** Ejendomsværdiskat, grundskyld og låneydelsens split i renter og afdrag hører til etape 4 — men de skal ind i denne rækkefølge, ikke ved siden af den.
