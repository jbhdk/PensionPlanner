# En slettet beholdning rydder fordelingen tavst op, og restlinjen arves af den første tilbageværende linje

`removeHolding` ryddede allerede overførsler og indbetalinger op efter en slettet beholdning, men rørte ikke `PensionAgreement`s `Allocation` — en `AllocationLine`, hvis `to` ramte den slettede beholdning, blev stående, og `validatePlan` afviste bagefter hele planen med "fordeler til en beholdning, der ikke findes." Hullet var usynligt, mens en fordeling kun kunne have én linje; #70 gjorde det bredere ved at tillade flere.

Den lette halvdel løses som `Contribution` allerede løser den: en linje, hvis destination forsvinder, filtreres tavst væk. Den svære halvdel er, når den forsvundne linje er `Remainder` — præcis én linje skal være det, for at fordelingen kan gå op i noget år, og der findes ingen mellemting, en `AllocationShare` kan snappe til.

Løsningen er ikke en særregel for restlinjen, men bufferens egen opskrift, genbrugt: `inheritedBuffer` reassignerer allerede tavst til den første tilbageværende frie beholdning, når bufferen selv slettes, og lader kun pegeren hænge, når intet alternativ findes — `validatePlan` melder det bagefter, i stedet for at sletningen blokeres. `removeHolding` gør nu det samme ved en fordelings restlinje: findes der stadig andre linjer, overtager den første af dem (i `allocation`s egen rækkefølge) restrollen, og dens eget tal — en procent eller et kronebeløb — forsvinder i samme greb, fordi `Remainder` ikke bærer et tal at huske det i. Findes ingen anden linje, står fordelingen med nul restlinjer, og den eksisterende besked i `validatePlan` ("har 0 linjer med resten...") dækker det uden en ny fejltekst.

Ingen af de to sker med en besked til planlæggeren. `Transfer` og `Contribution` forsvinder allerede tavst i dag, og restlinjens overtagelse følger samme vane. En `Clamp` (ADR-0045) blev overvejet og fravalgt: den mekanismes princip er, at det felt, brugeren selv rører, er det, der viger — her rører brugeren "slet beholdning", og det er en *anden* linje, der viger. Det er en ny situation, mekanismen ikke er bygget til, og at bygge den ud ville koste mere, end tavsheden koster.

Rettelsen holder sig til `removeHolding`. `removePerson` har ikke samme hul: den fjerner allerede hele den slettede persons egne poster, inklusive hendes `pensionAgreement`, og `validatePlan`s ejerskabsregel forbyder i forvejen en fordeling, der peger på tværs af personer — der er derfor intet tilfælde, hvor en tilbageværende persons aftale kan pege på en beholdning, `removePerson` netop har fjernet.

## Se også

- [ADR-0013](./0013-motoren-regner-kun-paa-en-plan-hvis-pegere-alle-rammer.md) — hvorfor en hængende peger er "ikke en plan", og hvorfor fladen er stedet, hullet skal lukkes
- [ADR-0045](./0045-fladen-klemmer-og-siger-hvorfor-indgangskontrollen-er-bagstopperen.md) — `Clamp`-mekanismen, og hvorfor den ikke passer på denne situation
- [ADR-0020](./0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md) — hvervet bag `validatePlan`s besked om nul restlinjer
- `src/ui/planEdits.ts` (`removeHolding`, `inheritedBuffer`), `src/engine/validatePlan.ts` (`pensionAgreements`) — de to steder, beslutningen rører
