# Marginalskatten måles på husstandens rådighed, ikke på personens skat

`PersonYear.marginal` svarede før på ét spørgsmål: hvad koster den næste krone i skat. Med aftrapningen af pensionstillægget er det svar ikke længere det, spørgsmålet handler om. En krone mere ud af ratepensionen koster både sin egen skat og det tillæg, den aftrapper væk — og et mistet tillæg er ingen skat. Det er netop den omkostning, hele PRD'ens problemstilling koger ned til, og den ville være usynlig i et felt, der kun talte skattekroner.

Satsen måles derfor på husstandens **rådighed**: al dens skat minus de ydelser, den får udefra, og som en indkomst kan skære i. Målemåden er uændret ellers — opgørelsen regnes om med én krone mere af sin egen art, og differencen er satsen. Den udledes aldrig analytisk af satserne, så den ikke kan komme til at sige noget andet end selve opgørelsen ville.

## Husstandens og ikke personens

Det andet og sværere valg er, hvis tillæg der tælles med.

Uden bortseelse indgår den ene persons krone fuldt ud i den andens aftrapningsgrundlag. Er begge folkepensionister, falder derfor **begge** tillæg, når Jesper hæver en krone mere. Med en marginal på 37 % og 16 % aftrapning:

| | Kun Jespers eget tillæg | Hele husstandens |
|---|---|---|
| `marginal.pensionIncome` | 47,1 % | 57,2 % |

De ti procentpoint forsvinder ikke — de lander bare i Annes navn. Målt på Jespers eget tillæg alene ville feltet sige 47 % om et valg, der koster 57, og det er præcis den timing-beslutning, værktøjet findes for at oplyse.

Halveringen fra 32 til 16 %, når ægtefællen selv bliver pensionist, er selv et argument for husstandens svar: satsen halveres, fordi kronen fra da af tælles to gange i stedet for én. En sats, der kun så det ene af de to tillæg, ville læse halveringen som en lempelse og ikke som den ombytning, den er.

## Hvad det koster

Marginalsatserne kan ikke længere regnes af én persons skattegrundlag alene, og `marginalTaxRates` flytter derfor fra `assessTax` op i `assessHousehold`. Det er samme flytning og samme begrundelse som aktieindkomstens skat i ADR-0014: beregningen er husstandens, fordi grundlaget er det.

Opgørelsen kan af samme grund ikke bære sine egne marginalsatser undervejs — de måles jo ved at regne netop den om. Sømmet regner derfor husstandens opgørelse først uden satserne og lægger dem på bagefter, og det er den ene ekstra form, beslutningen koster i koden.

`marginal.earnedIncome` ændrer sig ikke af beslutningen. Arbejdsindkomst står uden for aftrapningsgrundlaget, også ægtefællens, så den sats er den samme, hvad enten den måles på rådigheden eller på skatten alene. De to satser har dermed samme målemåde uden at måle det samme — og det er efter hensigten: de svarer på hver sit spørgsmål.

## Se også

- [ADR-0014](./0014-skattesoemmet-er-husstandens-ikke-personens.md) — sømmet er husstandens, og aftrapningen er grunden
- [ADR-0012](./0012-fladen-laeser-motorens-svar-frem-for-at-gentage-udledningen.md) — fladen viser satsen frem for at regne den
- [ADR-0024](./0024-gennemloebet-forrenter-sig-ikke-og-afkastet-krediteres-foer-aarets-drift.md) — hvorfor aftrapningen overhovedet kan regnes i ét gennemløb
- [diagram 02](../diagrams/02-simuleringsaaret.md) — husstandskoblingen og dens plads i rækkefølgen
