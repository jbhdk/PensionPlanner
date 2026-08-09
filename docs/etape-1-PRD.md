# PRD — Etape 1: Skelettet der regner

Underordnet [docs/PRD.md](./PRD.md), som beskriver hele værktøjet. Denne PRD dækker første etape alene. Sproget er [CONTEXT.md](../CONTEXT.md)'s: dansk term, engelsk identifier, og intet ord i koden som ikke står der.

## Problem Statement

Der findes ingen kode endnu. Designet er grillet igennem og afgjort i ti ADR'er, fire diagrammer og et verificeret satsår, men ingen af beslutningerne er efterprøvet mod et tal.

Det er den egentlige risiko. Balanceinvarianten, forfald-som-afkastvægt, frie midler pr. person med udpeget buffer, beskatningsformen som beholdningens variant — alle fire er påstande om, at modellen hænger sammen, og ingen af dem er bevist. Bygges pensionssiden ovenpå, inden de er det, bygges den ovenpå en formodning.

Samtidig er der en indbygget fristelse ved at starte: den mest interessante del af værktøjet er pensionsudbetalingerne, og lysten er at gå direkte dertil. Men en udbetalingsplan tømmer beløb, der er gætværk, indtil opsparingssiden og skatten er rigtige. Rækkefølgen er valgt bevidst, og etape 1 er det mindste, der både er en fungerende applikation og et bevis på, at fundamentet bærer.

## Solution

En kørende single-page-applikation, der fremskriver en husstand uden pension: to personer, deres indtægts- og udgiftsposter, deres frie midler, og fuld dansk personskat for 2026.

Brugeren opretter en `Plan` med en `Household` på én eller to `Person`. Hver person har fødselsår, erhvervsophørsalder, folkepensionsalder og horisont. Personen ejer `Holding`s i de to frie-midler-varianter, og præcis én af planens beholdninger er udpeget som `buffer`. Indtægter og udgifter er `Entry`, flytninger mellem beholdninger er `Transfer`, og begge bærer et `Timing`, der oversættes til en vægt på årets afkast.

Motoren er en ren funktion, `simulate(plan) → YearResult[]`, der regner ét kalenderår ad gangen i løbende priser. Brugerfladen viser årsrækken som tabel og formuegraf i dagens kroner, og kan folde et enkelt år ud og vise hele udregningen linje for linje — herunder hvert skattelag.

Når etapen er færdig, kan brugeren stille ét rigtigt spørgsmål: *rækker vores frie midler fra det år vi holder op med at arbejde og frem?* Uden pension er svaret nej, og det skal det være. Pointen er, at tallet på vejen derhen er rigtigt.

## User Stories

### Plan, husstand og personer

1. Som planlægger vil jeg oprette en navngiven plan, så jeg senere kan holde flere scenarier adskilt.
2. Som planlægger vil jeg oprette én eller to personer i husstanden, så modellen passer på min situation.
3. Som planlægger vil jeg angive fødselsår pr. person, så motoren kan beregne alderen i hvert simuleringsår.
4. Som planlægger vil jeg sætte en erhvervsophørsalder pr. person, så jeg kan simulere, at vi holder op med at arbejde på hvert vores tidspunkt.
5. Som planlægger vil jeg have folkepensionsalderen udledt af mit fødselsår, så jeg ikke selv skal holde styr på en tabel, der ændrer sig.
6. Som planlægger vil jeg kunne overstyre en persons folkepensionsalder, fordi den for min kones fødselsår endnu ikke er vedtaget.
7. Som planlægger vil jeg sætte en horisont pr. person, så simuleringen løber så langt, som er meningsfuldt.
8. Som planlægger vil jeg se, at simuleringen løber til den længstlevende persons horisont, så den korteste ikke afkorter planen.
9. Som planlægger vil jeg se hver persons alder i hver række af årstabellen, så jeg kan orientere mig uden at regne.
10. Som planlægger vil jeg angive min kommunes skatteprocent og om vi betaler kirkeskat, så skatten bliver min og ikke en landsgennemsnitlig.
11. Som planlægger vil jeg angive inflationsantagelsen samt de to fremskrivningssatser for henholdsvis § 20-grænser og satsregulerede ydelser, fordi de følger hver sit indeks.

### Indtægter og udgifter

12. Som planlægger vil jeg oprette en indtægtspost med ejer, beløb, periode og skattebehandling, så løn, B-indkomst og lejeindtægt beskattes rigtigt hver for sig.
13. Som planlægger vil jeg oprette en udgiftspost uden skattebehandling, fordi en udgift ikke har nogen.
14. Som planlægger vil jeg indtaste alle beløb i dagens kroner, så jeg aldrig selv skal regne ud, hvad noget koster i 2049.
15. Som planlægger vil jeg forankre en posts periode til en persons alder, så posten flytter sig automatisk, når jeg ændrer erhvervsophørsalderen.
16. Som planlægger vil jeg forankre andre poster til et kalenderår, fordi visse ting slutter på en bestemt dato uanset min alder.
17. Som planlægger vil jeg give hver post sin egen reguleringssats, så sundhedsudgifter kan stige hurtigere end mad.
18. Som planlægger vil jeg oprette engangsudgifter, så nyt tag i 2034 kan indgå i planen.
19. Som planlægger vil jeg oprette udgifter, der gentages hvert N. år, så en ny bil hvert ottende år kommer med.
20. Som planlægger vil jeg lade udgiftsposter overlappe med hver sin periode, så jeg kan modellere en aktiv og en rolig fase uden at lære et nyt begreb.
21. Som planlægger vil jeg angive en posts forfald som enten jævnt fordelt eller en bestemt måned, så en engangsudgift i november ikke vægtes som om den faldt i juli.
22. Som planlægger vil jeg angive min løn brutto inklusive arbejdsgiverbidrag, så beløbet svarer til det, der står i min ansættelseskontrakt.

### Frie midler, buffer og overførsler

23. Som planlægger vil jeg oprette en beholdning ejet af en bestemt person, så skatten af dens afkast lander hos den rigtige af os.
24. Som planlægger vil jeg vælge beholdningens variant mellem `ShareIncome` og `CapitalIncome`, fordi de beskattes forskelligt.
25. Som planlægger vil jeg angive saldo, forventet bruttoafkast og ÅOP pr. beholdning, så omkostningens betydning bliver synlig.
26. Som planlægger vil jeg se nettoafkastet udregnet af bruttoafkast minus ÅOP, så jeg kan se, hvad omkostningen koster mig over horisonten.
27. Som planlægger vil jeg udpege præcis én beholdning som husstandens buffer, så jeg selv bestemmer, hvor årets restpost lander.
28. Som planlægger vil jeg forhindres i at have nul eller to buffere, fordi planen så ikke har et entydigt sted at lægge overskuddet.
29. Som planlægger vil jeg se årets samlede over- eller underskud lande på bufferen, så jeg kan følge, hvordan likviditeten udvikler sig.
30. Som planlægger vil jeg se bufferen gå negativ, når planen ikke holder, frem for at værktøjet stiltiende retter den for mig.
31. Som planlægger vil jeg oprette en overførsel mellem to beholdninger med beløb, periode og forfald, så en ikke-buffer-beholdning kan bruges.
32. Som planlægger vil jeg se, at en overførsel hverken er en indtægt eller en udgift og ikke udløser skat, fordi det kun er en flytning inden for husstanden.
33. Som planlægger vil jeg se afkastet beregnet på den vægtede gennemsnitssaldo, så en overførsel i marts bidrager mere til årets afkast end en i november.

### Skat

34. Som planlægger vil jeg se AM-bidrag beregnet af den AM-pligtige indkomst.
35. Som planlægger vil jeg se personfradraget anvendt korrekt i hvert skattelag, der har et.
36. Som planlægger vil jeg se bundskat samt kommune- og kirkeskat beregnet efter årets satser.
37. Som planlægger vil jeg se mellemskat, topskat og top-topskat beregnet som tre selvstændige lag, ikke som én sats.
38. Som planlægger vil jeg se progressionsgrænserne målt på personlig indkomst efter AM-bidrag, fordi det er den form loven regulerer.
39. Som planlægger vil jeg se det skrå skatteloft anvendt som en trappe med tre niveauer, fordi det ikke længere er ét tal.
40. Som planlægger vil jeg se beskæftigelsesfradrag, jobfradrag og ekstra pensionsfradrag indregnet, så arbejdsår og senere pensionsår kan sammenlignes retfærdigt.
41. Som planlægger vil jeg se lagerbeskattet aktieindkomst beskattet med 27 % og 42 % om progressionsgrænsen.
42. Som planlægger vil jeg have vores fælles, overførbare progressionsgrænse for aktieindkomst udnyttet, fordi vi er gift.
43. Som planlægger vil jeg se kapitalindkomst beskattet for sig, så et rentebærende indestående ikke behandles som aktier.
44. Som planlægger vil jeg se hvilket satsår hver beregning bygger på, og hvor tallene kommer fra.
45. Som planlægger vil jeg se satser fremskrevet efter det sidst kendte satsår med procenter holdt fast og beløbsgrænser løftet, så år 2040 ikke regnes med 2026-grænser.
46. Som planlægger vil jeg se den sammensatte marginalskat i et år, så jeg forstår hvad en ekstra krone reelt koster.

### Resultat og visning

47. Som planlægger vil jeg se en årstabel med én række pr. simuleringsår og kolonner for indtægter, afkast, skat, udgifter, nettoresultat og formue.
48. Som planlægger vil jeg se alle beløb i dagens kroner som standard, så tallene er til at forholde sig til.
49. Som planlægger vil jeg kunne slå om til løbende priser, når jeg vil se de faktiske fremtidige kronebeløb.
50. Som planlægger vil jeg se en formuegraf med stablet areal pr. beholdning, så jeg kan se hvordan formuen fordeler sig over tid.
51. Som planlægger vil jeg klikke på et år og se hele udregningen linje for linje, herunder hvert skattelag og afkastet pr. beholdning.
52. Som planlægger vil jeg i forklar-året se hvilke poster der indgik, med hvilket forfald og med hvilken afkastvægt, så jeg kan efterprøve tallet i hånden.
53. Som planlægger vil jeg tydeligt se de år, hvor bufferen er negativ, så jeg ved præcis hvor planen knækker.
54. Som planlægger vil jeg skelne mellem en negativ buffer med likviditet andetsteds i husstanden og en negativ buffer uden, fordi det første er en ufuldstændig plan og det andet en uholdbar.

### Lagring

55. Som planlægger vil jeg have min opsætning gemt automatisk i localStorage, så den er der igen næste gang jeg åbner appen.
56. Som planlægger vil jeg have et skemaversionsnummer på gemte data, så en modelændring ikke korrupterer det jeg har bygget.
57. Som planlægger vil jeg have mine gemte planer migreret automatisk ved opdatering, så jeg ikke skal taste forfra.
58. Som planlægger vil jeg eksportere en plan til en JSON-fil, så mit arbejde ikke kun ligger i én browser.
59. Som planlægger vil jeg importere en JSON-fil igen, også på en anden maskine.
60. Som planlægger vil jeg have importen til at afvise en fil med et ukendt fremtidigt skemaversionsnummer frem for at fejltolke den.

## Implementation Decisions

### Stak og opdeling

- **React + TypeScript + Vite.** Ingen backend; applikationen er statiske filer, og data forlader aldrig browseren.
- **Motoren er et rent TypeScript-modul** uden afhængighed til React eller DOM, så den kan køres og testes isoleret. Den er en ren funktion: samme plan ind giver altid samme årsrække ud.
- **Skattemotoren er et selvstændigt modul** i motoren, fordi den er den sekundære testsøm.
- **Satser er et datamodul**, ikke en del af planen. Se [ADR-0005](./adr/0005-satser-er-referencedata-planen-pinner-ikke.md). Satsår 2026 er hentet og verificeret i [docs/satser/2026.md](./satser/2026.md) og lægges ind derfra, inklusive kilde-URL pr. blok.
- **Node skal installeres først.** Der er intet node/npm i miljøet i dag; det er en forudsætning, ikke en opgave i etapen.

### Domænemodellen

Bygges som tegnet i [diagram 01](./diagrams/01-domaenemodel.md), men kun de figurer etapen bruger: `Plan`, `Household`, `Person`, `Holding`, `Entry`, `Transfer`. `Benefit`, `LifeAnnuity`, `PayoutSchedule`, `Contribution`, `Property` og `Loan` bygges ikke.

- `Holding.variant` er et lukket sæt, men kun `ShareIncome` og `CapitalIncome` er lovlige værdier i etape 1. De tre øvrige varianter tilføjes i etape 2 og 3. Se [ADR-0010](./adr/0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md).
- `PayoutSchedule` udelades helt. En `Holding` uden udbetalingsplan tømmes ikke af sig selv, hvilket er den rigtige adfærd for frie midler.
- **Præcis én `Holding` pr. `Plan` er `buffer`.** Invarianten håndhæves ved indlæsning og ved redigering, ikke kun i brugerfladen. Se [ADR-0004](./adr/0004-frie-midler-pr-person-med-udpeget-buffer.md).
- `Transfer` er med fra dag ét og ikke en senere tilføjelse: uden den kan en ikke-buffer-beholdning aldrig bruges, og bufferen kan stå negativ, mens den anden konto er fuld.

### Tid, penge og afkast

- Ét `SimulationYear` er ét kalenderår. Motoren skridter aldrig månedligt.
- Motoren regner i `Nominal`; brugerfladen deflaterer til `Real` ved visning. Se [ADR-0001](./adr/0001-nominel-regning-real-visning.md).
- `Timing` oversættes til en vægt på årets afkast: jævnt fordelt giver ½, en bestemt måned N giver `(12 − N + 1) / 12`. Se [ADR-0006](./adr/0006-maaneden-er-en-afkastvaegt-ikke-et-tidsskridt.md).
- Afkastet beregnes efter Modified Dietz: `nettoafkastsats × (primosaldo + Σ vægt × strøm)`. **Alle årets strømme skal være kendt, før afkastet kan krediteres** — rækkefølgen i [diagram 02](./diagrams/02-simuleringsaaret.md) er bindende.
- Ét fast bruttoafkast og ét ÅOP pr. beholdning. Se [ADR-0003](./adr/0003-fast-afkast-pr-beholdning.md).

### Skattemotoren

Fuld personskat for 2026 med alle lag: AM-bidrag, personfradrag, bundskat, kommune- og kirkeskat, mellemskat, topskat, top-topskat, skråt skatteloft, beskæftigelsesfradrag, jobfradrag og ekstra pensionsfradrag. Dertil aktieindkomst 27/42 % og kapitalindkomst.

- **Progressionsgrænserne måles på personlig indkomst efter AM-bidrag.** Det er den form § 20 regulerer, og den, fremskrivningen gælder for. De tal, der cirkulerer hos rådgivere og i medier, er de samme grænser før AM-bidrag; en forveksling flytter topskattens start med 67.600 kr.
- **Det skrå skatteloft er en trappe:** 44,57 % op til mellemskat, 52,07 % med topskat, 57,07 % med top-topskat. Alle ekskl. AM-bidrag og kirkeskat.
- **Aktieindkomst og kapitalindkomst føres pr. `Person` på `YearResult`.** Husstandssummen findes ikke som felt. Skatten summerer over husstanden, fordi progressionsgrænsen for aktieindkomst er fælles og overførbar; senere etaper skal bruge persongrundlaget til aftrapningen. Se [ADR-0010](./adr/0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md).
- **Skatten bogføres i optjeningsåret**, ikke i betalingsåret. Det følger af balanceinvarianten. Modellen er dermed op mod elleve måneder foran virkeligheden på likviditeten, hvilket er en bevidst forenkling.
- **Realisationsbeskatning er fravalgt.** Der føres ingen kostpris, og en hævning fra en beholdning er en ren saldoreduktion uden skattekonsekvens.
- Satser efter det sidst kendte satsår fremskrives: procenter holdes konstante, beløbsgrænser løftes med hver sin justerbare antagelse.

### Brugerfladen

- Årstabel, formuegraf og forklar-året. Cashflow-grafen hører til etape 5.
- **Forklar-året er ikke en ekstra**, men den funktion hele værktøjet findes for. Den skal vise mellemregningerne, ikke totalerne, og den er den billigste måde at fange en fejl i skattemotoren under udvikling.
- Bufferen tegnes med to forskellige fejltilstande: *ufuldstændig* når husstanden har likviditet andetsteds, og *uholdbar* når husstandens samlede frie midler er negative. Se [ADR-0008](./adr/0008-holdbarhed-maales-paa-bufferen-alene.md).

### Lagring

- localStorage med skemaversionsnummer og en migrationskæde fra dag ét. Kæden er tom ved v1, men strukturen skal være der, før den første plan gemmes.
- JSON-eksport og -import tages med i etape 1 frem for senere. Begrundelsen står i hoved-PRD'en: localStorage alene er ikke holdbar opbevaring, og en plan bygget over flere aftener må ikke kunne forsvinde med en ryddet browser.

## Testing Decisions

En god test beskriver **observerbar adfærd**, ikke intern struktur: den bygger en plan, kører motoren og udtaler sig om årsrækken. Den nævner ikke, hvordan motoren er opdelt indeni, så motoren kan omstruktureres frit, så længe tallene holder.

Der er ingen prior art — dette er et grønt felt, og sømmene defineres her. De to sømme er allerede besluttet i hoved-PRD'en og ændres ikke af denne etape.

### Primær søm: `simulate(plan) → YearResult[]`

Al adfærdstest går herigennem. Testene bygger en plan-fixture og udtaler sig om de returnerede årsresultater. I etape 1 dækker det: forankring til alder mod kalenderår, gentagelse, reguleringssatser, forfald som afkastvægt, bufferens absorption af restposten, overførsler mellem beholdninger, og deflatering til dagens kroner.

### Sekundær søm: skatteopgørelsen for ét år og én person

Facitcaser mod skat.dk og borger.dk hører hjemme her, fordi en facitcase er "denne indkomst i dette satsår giver denne skat" — og at bygge en hel plan for at udtrykke det ville sløre både testen og fejlmeddelelsen.

### Balanceinvarianten

For hvert simuleringsår i hver testplan skal `closingWealth − openingWealth` svare præcis til `income + return − tax − expenses`. Den køres som en **delt assertion på tværs af alle tests mod den primære søm**, ikke som en enkeltstående test.

Invarianten fanger en anden fejlklasse end facitcaserne: penge der forsvinder mellem konti, en hævning der ikke reducerer saldoen, skat der trækkes to gange. Den er den vigtigste enkeltstående kontrol i etapen, netop fordi den er det, hele modellen er bygget op om — og den er grunden til, at en `Transfer` skal netto til nul og en indbetaling er en bevægelse og ikke en udgift. Se [ADR-0007](./adr/0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md).

### Satsårets egen invariant

Et satsår testes på, at aftrapningens bortfaldsgrænse følger af ydelsen, fradragsbeløbet og procenten frem for at være et selvstændigt tal. Kontrollen bruges ikke i etape 1, hvor folkepensionen ikke findes, men satsdataene lægges ind nu, og invarianten skrives sammen med dem. Udledningen står i [docs/satser/2026.md](./satser/2026.md).

### Facitcaser i etape 1

Som minimum: en lønmodtager under mellemskattegrænsen; en lønmodtager i hvert af de tre progressive lag; en husstand hvor det skrå skatteloft binder; og et par hvor den fælles progressionsgrænse for aktieindkomst udnyttes på tværs. Hver case holdes som data med kilde og verifikationsdato, og de genkøres, når et nyt satsår tilføjes.

### Brugerfladen

Testes minimalt. Motoren bærer al logik, og brugerfladen er en visning af årsresultaterne.

## Out of Scope

Alt pensionsrelateret. Konkret ude af etape 1:

- `Benefit`, `LifeAnnuity`, `PayoutSchedule` og `Contribution` som figurer.
- Ratepension, aldersopsparing og aktiesparekonto som varianter, og dermed også PAL-skat, fradragslofter og aldersopsparingens trappe (etape 2 og 3).
- Folkepension, ATP, `TaperBase` og husstandskoblingen i skatten (etape 3).
- `Property`, `Loan`, ejendomsskatter og rentefradrag (etape 4).
- Sammenligning af flere planer, cashflow-graf og søgningen efter tidligste holdbare `workEndAge` (etape 5).
- Monte Carlo, behøvsdrevne udbetalinger, efterladtescenarie og PensionsInfo-import — se [docs/udskudt.md](./udskudt.md).

`Person.workEndAge` findes og kan forankres til i etape 1. Det er kun *søgningen* efter den, der er udskudt.

## Further Notes

### En scopeafvigelse, der skal ses

Hoved-PRD'ens byggerækkefølge placerer "kapitalindkomst" i etape 2. Denne PRD tager `CapitalIncome` med allerede i etape 1. Grunden er bufferen: er `ShareIncome` den eneste lovlige variant, bliver husstandens buffer nødvendigvis et aktiedepot, og så genererer hver eneste krone overskud aktieindkomst. Det er ikke et neutralt udgangspunkt, og det gør `Transfer` mellem to varianter — etapens egentlige nye mekanik — umulig at afprøve. `ShareSavingsAccount` bliver i etape 2, hvor dens indskudsloft hører hjemme sammen med de øvrige lofter.

### Rækkefølgen indeni etapen

Skattemotoren og facitcaserne før brugerfladen. Balanceinvarianten skrives sammen med den første plan-fixture, ikke bagefter — den er billig at indføre fra start og dyr at retrofitte, fordi den stiller krav til, hvordan hver strøm bogføres.

### Åbne punkter, der ikke blokerer

Fra hoved-PRD'ens liste rører ingen ved etape 1. Nærmest på er det ekstra pensionsfradrags maksimum, hvor § 20-tabellens 87.800 kr. og sekundære kilders 10.536/28.096 kr. tydeligvis ikke måler det samme. Det skal forstås, før facitcasen for et pensionsindbetalende arbejdsår skrives, men ikke før motoren kan køre.

### Hvornår etapen er færdig

Når en plan med to personer, deres poster og deres frie midler kan gemmes, genindlæses, eksporteres og importeres; når årstabellen og formuegrafen viser den; når et enkelt år kan foldes ud og udregningen efterprøves i hånden; når facitcaserne står grønt mod skat.dk; og når balanceinvarianten holder for hvert år i hver testplan.
