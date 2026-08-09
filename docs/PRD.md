# PRD — Pensionsplanner

## Problem Statement

Jeg står over for en pensionsbeslutning, som ingen tilgængelig beregner kan svare på, fordi min situation har tre træk, der forstærker hinanden.

Jeg er 53 år, min folkepensionsalder er 70, og jeg vil gerne holde op med at arbejde markant før. Min kone er cirka 12 år yngre og vil sandsynligvis arbejde nogle få år længere end mig, men også holde op før sin folkepensionsalder — som ikke engang er vedtaget endnu. Vores to forløb er altså forskudt med over et årti, og de er koblet sammen af skatte- og pensionsregler, der behandler os som én husstand.

Oveni ligger tre gamle ratepensioner, der er oprettet før 1. maj 2007 og derfor må udbetales allerede fra jeg fylder 60. Det åbner en mulighed, jeg ikke kan regne på i hovedet: hvis de tømmes inden jeg fylder 70, løber de aldrig samtidig med folkepensionens pensionstillæg, og jeg undgår en aftrapning på omkring 30 % oveni den almindelige skat. Timingen af den beslutning er værd rigtig mange penge, og jeg har syv år til at træffe den.

pensions-plan.dk kommer tæt på, men jeg kan ikke se dens mellemregninger, kan ikke efterprøve tallene, og kan ikke gemme og sammenligne mine egne varianter. Jeg har brug for et værktøj, der er mit eget, hvor jeg kan skrue på ét tal og se hele konsekvensen — og hvor jeg kan klikke på et årstal og se præcis, hvordan skatten blev til.

## Solution

En single-page-applikation, der fremskriver husstandens økonomi år for år fra i dag og gennem hele pensionen, med danske skatte- og pensionsregler indregnet, og som gemmer opsætningen i browserens localStorage.

Brugeren opretter en **Plan**: to **Personer** med hver deres fødselsår, erhvervsophørsalder og folkepensionsalder; deres **Beholdninger**, **Ydelser** og **Livrenter**; og deres indtægts- og udgifts**Poster**. Motoren simulerer hvert **Simuleringsår** i løbende priser og returnerer et **Årsresultat** med alle mellemregninger. Brugerfladen viser resultatet som årstabel, formuegraf og cashflow-graf i dagens kroner — og kan folde et enkelt år ud og vise hele udregningen linje for linje.

Kernen i værktøjet er, at **erhvervsophørsalderen er ét navngivet tal pr. person**, som poster og udbetalingsplaner forankres til. Ændrer man det ene tal, former hele planen sig efter det. Derudover kan værktøjet selv søge efter den tidligste erhvervsophørsalder, hvor **frie midler** aldrig går negativt.

Motoren er **plan-drevet**: brugeren bestemmer, hvornår hver ordning starter og over hvor mange år den løber, og frie midler absorberer årets over- eller underskud. En negativ saldo på frie midler er ikke en fejl, men modellens måde at sige, at planen ikke holder.

## User Stories

### Husstand og personer

1. Som planlægger vil jeg oprette to personer med hver deres fødselsår, så motoren kan beregne deres aldre korrekt i hvert simuleringsår.
2. Som planlægger vil jeg sætte en erhvervsophørsalder pr. person, så jeg kan simulere, at vi holder op med at arbejde på hvert vores tidspunkt.
3. Som planlægger vil jeg have min folkepensionsalder udledt automatisk af mit fødselsår, så jeg ikke selv skal holde styr på en tabel, der ændrer sig.
4. Som planlægger vil jeg kunne overstyre min kones folkepensionsalder, fordi den for hendes fødselsår endnu ikke er vedtaget og kun er et skøn.
5. Som planlægger vil jeg se hver persons alder i hver række af årstabellen, så jeg kan orientere mig i forløbet uden at regne.
6. Som planlægger vil jeg sætte en horisont pr. person, så simuleringen løber så langt, som er meningsfuldt.

### Indtægter og udgifter

7. Som planlægger vil jeg oprette en indtægtspost med ejer, beløb, periode og skattebehandling, så løn, B-indkomst og lejeindtægt beskattes rigtigt hver for sig.
8. Som planlægger vil jeg indtaste alle beløb i dagens kroner, så jeg aldrig selv skal regne ud, hvad noget koster i 2049.
9. Som planlægger vil jeg forankre en posts periode til en persons alder frem for til et årstal, så posten flytter sig automatisk, når jeg ændrer erhvervsophørsalderen.
10. Som planlægger vil jeg forankre andre poster til et kalenderår, fordi et realkreditlån slutter på en bestemt dato uanset min alder.
11. Som planlægger vil jeg give hver post sin egen reguleringssats, så sundhedsudgifter kan stige hurtigere end mad.
12. Som planlægger vil jeg oprette engangsudgifter, så nyt tag i 2034 kan indgå i planen.
13. Som planlægger vil jeg oprette udgifter, der gentages hvert N. år, så en ny bil hvert ottende år kommer med.
14. Som planlægger vil jeg lade udgiftsposter overlappe med hver sin periode, så jeg kan modellere en aktiv og en rolig pensionsfase uden at lære et nyt begreb.

### Beholdninger og indbetalinger

15. Som planlægger vil jeg oprette en ratepension med saldo, forventet bruttoafkast og ÅOP, så omkostningens betydning bliver synlig.
16. Som planlægger vil jeg registrere hver ordnings oprettelsesdato, så motoren selv kan udlede, hvornår den lovligt må udbetales.
17. Som planlægger vil jeg se, at mine tre gamle ratepensioner må starte fra jeg fylder 60, fordi de er oprettet før 1. maj 2007.
18. Som planlægger vil jeg kunne overstyre en ordnings udbetalingsalder, fordi en overførsel kan have bevaret en lavere alder, end datoen antyder.
19. Som planlægger vil jeg oprette en aldersopsparing, så jeg kan se værdien af, at dens udbetaling hverken beskattes eller aftrapper mit pensionstillæg.
20. Som planlægger vil jeg registrere arbejdsgiverbidrag og egne indbetalinger pr. ordning, så opsparingsfasen bliver rigtig.
21. Som planlægger vil jeg advares, når en indbetaling overskrider fradragsloftet for ratepension, så jeg ikke planlægger noget, der ikke kan lade sig gøre.
22. Som planlægger vil jeg se aldersopsparingens høje loft slå til i de sidste syv år før min folkepensionsalder, så jeg kan udnytte vinduet bevidst.
23. Som planlægger vil jeg have aldersopsparingens loft beregnet pr. person, fordi mit vindue og min kones ligger 12 år fra hinanden.
24. Som planlægger vil jeg se fradragsværdien af mine indbetalinger slå igennem i årets skat, så jeg kan sammenligne at spare op mod at bruge nu.

### Livrente

25. Som planlægger vil jeg oprette en livrente med selskabets oplyste depot og oplyste årlige ydelse ved udbetalingsstart, så omsætningsfaktoren kan udledes af tal, jeg kan slå op.
26. Som planlægger vil jeg have livrentens depot fremskrevet med mine egne indbetalinger og afkast, så den livsvarige ydelse falder, når jeg stopper med at arbejde tidligere.
27. Som planlægger vil jeg have ydelsen låst fast ved udbetalingsstart og kun reguleret med min bonusantagelse, fordi min livrente er en gennemsnitsrente med garanti.
28. Som planlægger vil jeg se livrenten løbe livsvarigt, så den ikke fejlagtigt bliver tømt undervejs.

### Udbetalingsplaner

29. Som planlægger vil jeg vælge startår og varighed pr. ordning, fordi det er den fleksibilitet loven faktisk giver mig.
30. Som planlægger vil jeg vælge mellem serie- og annuitetsprincippet pr. ratepension, så jeg kan se, hvilket der giver det bedste skatteforløb.
31. Som planlægger vil jeg have raten genberegnet ved hvert kalenderårs begyndelse ud fra den faktiske saldo, så udbetalingen opfører sig som en rigtig ratepension og ikke som et fast beløb.
32. Som planlægger vil jeg forhindres i at sætte en udbetalingsperiode under 10 år, så planen ikke bygger på noget ulovligt.
33. Som planlægger vil jeg forhindres i at lade sidste rate falde senere end 30 år efter pensionsudbetalingsalderen.
34. Som planlægger vil jeg starte mine tre gamle ratepensioner forskudt og med forskellig varighed, så jeg kan forme det samlede indkomstforløb.
35. Som planlægger vil jeg se, at alle tre er tømt inden jeg fylder 70, så de aldrig løber samtidig med pensionstillægget.

### Broperioden

36. Som planlægger vil jeg se præcis, hvilke år mellem mit erhvervsophør og min første tilgængelige ordning der skal bæres af frie midler alene.
37. Som planlægger vil jeg se frie midler gå negativt, når planen ikke holder, frem for at værktøjet stiltiende retter den for mig.
38. Som planlægger vil jeg have værktøjet til at finde den tidligste erhvervsophørsalder, hvor frie midler aldrig går negativt, med min kones alder holdt fast.
39. Som planlægger vil jeg køre den samme søgning for min kone med min alder holdt fast, så vi kan se begge sider af beslutningen.

### Folkepension og ATP

40. Som planlægger vil jeg se folkepensionens grundbeløb starte automatisk ved min folkepensionsalder.
41. Som planlægger vil jeg se pensionstillægget aftrappet efter det korrekte aftrapningsgrundlag, så jeg ikke overvurderer min indkomst.
42. Som planlægger vil jeg se, at min egen og min kones arbejdsindkomst ikke reducerer mit pensionstillæg, så jeg kan vurdere værdien af at arbejde videre.
43. Som planlægger vil jeg se, at mine ratepensionsudbetalinger derimod reducerer tillægget, fordi det er hele grunden til at time dem rigtigt.
44. Som planlægger vil jeg se 54 %-bortseelsen anvendt på min kones øvrige indkomst, mens hun endnu ikke er pensionist.
45. Som planlægger vil jeg se aftrapningsgrænsen skifte i det år, min kone selv bliver folkepensionist, fordi bortfaldsgrænsen springer fra 366.400 til 533.800 kr.
46. Som planlægger vil jeg oprette ATP som en ydelse pr. person med startalder og reguleringssats.
47. Som planlægger vil jeg se den sammensatte marginalskat i et år, hvor både skat og tillægsaftrapning rammer, så jeg forstår hvad en ekstra hævning reelt koster.

### Skat

48. Som planlægger vil jeg se AM-bidrag, personfradrag, bundskat samt kommune- og kirkeskat beregnet efter årets satser.
49. Som planlægger vil jeg se mellemskat, topskat og top-topskat beregnet som tre selvstændige lag, ikke som én sats.
50. Som planlægger vil jeg se det skrå skatteloft anvendt, så den samlede sats ikke overstiger loftet.
51. Som planlægger vil jeg se beskæftigelsesfradrag, jobfradrag og ekstra pensionsfradrag indregnet, så arbejdsår og pensionsår kan sammenlignes retfærdigt.
52. Som planlægger vil jeg se PAL-skat på 15,3 % beregnet pr. beholdning af årets afkast.
53. Som planlægger vil jeg se lagerbeskattet aktieindkomst beskattet med 27 % og 42 % om den relevante progressionsgrænse.
54. Som planlægger vil jeg have vores fælles, overførbare progressionsgrænse for aktieindkomst udnyttet, fordi vi er gift.
55. Som planlægger vil jeg se en aktiesparekonto beskattet med 17 % og dens indskudsloft håndhævet.
56. Som planlægger vil jeg se kapitalindkomst og rentefradrag indregnet, så gælden i modellen påvirker skatten rigtigt.
57. Som planlægger vil jeg indtaste min kommunes skatteprocent og angive, om vi betaler kirkeskat.
58. Som planlægger vil jeg se, hvilket satsår hver beregning bygger på, og hvor tallene kommer fra.
59. Som planlægger vil jeg justere fremskrivningssatserne for henholdsvis skattelovgivningens beløbsgrænser og de satsregulerede ydelser, fordi de følger hver sit indeks.

### Bolig og gæld

60. Som planlægger vil jeg oprette et lån med restgæld, rente, løbetid og eventuel afdragsfrihed.
61. Som planlægger vil jeg se ydelsen splittet i renter og afdrag, så rentefradraget falder i takt med at gælden afvikles.
62. Som planlægger vil jeg oprette en bolig med værdi og offentlig vurdering, der fremskrives med hver sin sats.
63. Som planlægger vil jeg se ejendomsværdiskat og grundskyld beregnet efter reglerne frem for at gætte et beløb.
64. Som planlægger vil jeg se skatterabatten fra 2024 indregnet, så min nuværende ejendomsskat er rigtig.
65. Som planlægger vil jeg se rabatten bortfalde, hvis planen indeholder et boligsalg, så jeg opdager den varige merudgift ved at flytte.
66. Som planlægger vil jeg lægge et boligsalg og et boligkøb ind i et bestemt år med handelsomkostninger.
67. Som planlægger vil jeg se salgsprovenuet lande skattefrit på frie midler, jf. parcelhusreglen.
68. Som planlægger vil jeg kunne modellere et nedsparingslån som alternativ til at sælge, så jeg kan sammenligne de to veje.

### Resultat og visning

69. Som planlægger vil jeg se en årstabel med én række pr. simuleringsår og kolonner for indtægter, skat, udgifter, nettoresultat og formue.
70. Som planlægger vil jeg se alle beløb i dagens kroner som standard, så tallene er til at forholde sig til.
71. Som planlægger vil jeg kunne slå om til løbende priser, når jeg vil se de faktiske fremtidige kronebeløb.
72. Som planlægger vil jeg se en formuegraf med stablet areal pr. kontotype, så jeg kan se hvornår hver konto tømmes.
73. Som planlægger vil jeg se en cashflow-graf med indtægter opad og udgifter nedad, så underskudsår springer i øjnene.
74. Som planlægger vil jeg klikke på et år og se hele udregningen linje for linje, herunder hvert skattelag, aftrapningen af pensionstillæg og PAL-skat pr. beholdning.
75. Som planlægger vil jeg tydeligt se de år, hvor frie midler er negative, så jeg ved præcis hvor planen knækker.

### Planer og lagring

76. Som planlægger vil jeg have min opsætning gemt automatisk i localStorage, så den er der igen næste gang jeg åbner appen.
77. Som planlægger vil jeg oprette flere navngivne planer, så jeg kan holde "gå af som 60" og "gå af som 64" adskilt.
78. Som planlægger vil jeg duplikere en plan med ét klik og rette i kopien.
79. Som planlægger vil jeg se to eller flere planers kurver tegnet oven i hinanden, så jeg kan sammenligne dem direkte.
80. Som planlægger vil jeg eksportere en plan til en JSON-fil, så mit arbejde ikke kun ligger i én browser.
81. Som planlægger vil jeg importere en JSON-fil igen, også på en anden maskine.
82. Som planlægger vil jeg have mine gemte planer migreret automatisk, når datamodellen ændrer sig, så en opdatering ikke ødelægger det jeg har bygget.

## Implementation Decisions

### Arkitektur og stak

- **React + TypeScript + Vite.** Beregningsmotoren er et rent TypeScript-modul uden afhængigheder til React eller DOM, så den kan køres og testes isoleret.
- **Ingen backend.** Applikationen er statiske filer. Al data ligger i brugerens browser og forlader den aldrig.
- Motoren er en **ren funktion**: samme plan ind giver altid samme årsrække ud. Ingen skjult tilstand, ingen I/O.

### Tidsmodel og pengeenhed

- Ét **Simuleringsår** svarer til ét kalenderår. Al skat opgøres årligt, hvilket matcher dansk skattelovgivning.
- Hver pengestrøm bærer et **forfald** — jævnt fordelt eller en bestemt måned — der oversættes til en vægt på årets afkast. Motoren skridter ikke månedligt. Se [ADR-0006](./adr/0006-maaneden-er-en-afkastvaegt-ikke-et-tidsskridt.md).
- Motoren regner i **løbende priser**; brugerfladen deflaterer til **dagens kroner** ved visning. Se [ADR-0001](./adr/0001-nominel-regning-real-visning.md).
- Alle brugerindtastede beløb angives i dagens kroner og fremskrives af motoren.
- Simuleringen starter i indeværende kalenderår og løber til den længstlevende persons horisont, som er et felt pr. person.

### Udbetalingsmodel

- Motoren er **plan-drevet**, og en udpeget buffer må gå negativt. Se [ADR-0002](./adr/0002-plan-drevet-motor-med-frie-midler-som-buffer.md) og [ADR-0004](./adr/0004-frie-midler-pr-person-med-udpeget-buffer.md).
- Hver beholdning bærer en udbetalingsstrategi, så en behøvsdrevet strategi med prioriteret dækningsrækkefølge kan tilføjes senere uden at ændre kontomodellen.
- **Erhvervsophørsalder** er en navngiven størrelse pr. person, som poster og udbetalingsplaner kan forankres til.
- Søgningen efter tidligste holdbare erhvervsophørsalder varierer én persons alder ad gangen med den andens holdt fast, og kører motoren for hver kandidatalder. Kriteriet er, at **bufferen** aldrig går negativt — ikke husstandens samlede frie midler. Se [ADR-0008](./adr/0008-holdbarhed-maales-paa-bufferen-alene.md).

### Domænetyper

Tre grundtyper til pensionsposter, jf. `CONTEXT.md`:

- **Beholdning** — saldo, bruttoafkast, ÅOP, oprettelsesdato, udbetalingsplan. Ratepension, aldersopsparing, frie midler, aktiesparekonto.
- **Ydelse** — årlig strøm uden saldo, med startalder og reguleringssats. Folkepension og ATP.
- **Livrente** — en beholdning, der omsættes til en garanteret livsvarig ydelse ved udbetalingsstart.

**Indbetaling** er en bevægelse fra husstandens pengestrøm ind i en beholdning, med skattevirkning og loft. Den er en selvstændig figur, fordi lofterne hænger på bidraget og ikke på lønnen, og lønposter angives derfor brutto inklusive arbejdsgiverbidrag. Se [ADR-0007](./adr/0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md).

**Overførsel** er en dateret, skattefri flytning mellem to beholdninger inden for husstanden. Den er nødvendig, fordi frie midler ejes pr. person, jf. [ADR-0004](./adr/0004-frie-midler-pr-person-med-udpeget-buffer.md): en beholdning, der ikke er udpeget som buffer, kan ellers aldrig bruges. I v1 er den begrænset til frie midler → frie midler; en flytning ind i en pensionsordning er en indbetaling, ikke en overførsel.

**Post** er én figur for både indtægter og udgifter: navn, ejer, beløb i dagens kroner, periode, **forankring** (alder eller kalenderår), **gentagelse** (årlig, engangs, hvert N. år) og reguleringssats. Indtægtsposter bærer desuden en skattebehandling.

### Pensionsudbetalingsalder

- Registreres som **oprettelsesdato pr. beholdning**; udbetalingsalderen udledes af **udbetalingsregimet**, med et overstyringsfelt til overførselstilfælde.
- Tre regimer: oprettet før 1. maj 2007 giver fast 60 år; 1. maj 2007 til 31. december 2017 giver folkepensionsalder minus fem år; fra 1. januar 2018 giver folkepensionsalder minus tre år. Det er aftaletidspunktet for oprettelsen, ikke indbetalingstidspunktet, der er afgørende.
- Fordi de to nyeste regimer er relative til folkepensionsalderen, retter udbetalingsalderen sig automatisk, når skønnet for en persons folkepensionsalder justeres.

### Ratepensionens udbetaling

- To lovlige beregningsprincipper, valgt pr. ordning: **serieprincippet** (saldo ved årets begyndelse divideret med resterende udbetalingsår) og **annuitetsprincippet** (annuitet af saldoen ved årets begyndelse med lovfastsat amortisationsrente).
- Raten **genberegnes ved hvert kalenderårs begyndelse** ud fra den faktiske saldo under begge principper. Brugeren vælger ikke det årlige beløb.
- Valideringer: udbetalingsperioden er mindst 10 år, og sidste rate falder senest 30 år efter ordningens pensionsudbetalingsalder.

### Livrentens omsætning

- Modellen antager **gennemsnitsrente**: den årlige ydelse er garanteret og ændres kun ved bonustildeling. Markedsrente er udskudt, se [docs/udskudt.md](./udskudt.md).
- Livrenten er en beholdning i opsparingsfasen — den modtager indbetalinger, forrentes og betaler PAL — og omsættes **én gang** ved udbetalingsstart med en **omsætningsfaktor**: selskabets oplyste årlige ydelse divideret med dets oplyste depot på samme tidspunkt, anvendt på det faktisk fremskrevne depot.
- Derefter er ydelsen fast og reguleres kun med en bonusantagelse. Ingen aldersskalering, ingen levetidsmodel, ingen genberegning. Se [ADR-0009](./adr/0009-livrenten-omsaettes-en-gang-ved-udbetalingsstart.md).
- Depotet må ikke fjernes fra opsparingsfasen: uden det ville livrenten ikke reagere på erhvervsophørsalderen, og scenariesammenligningen ville være forkert på planens længstløbende indkomststrøm.

### Skattemotor

Fuld regelmotor med AM-bidrag, personfradrag, bundskat, kommune- og kirkeskat, mellemskat, topskat, top-topskat, skråt skatteloft, beskæftigelsesfradrag, jobfradrag og ekstra pensionsfradrag.

- **Progressionsgrænserne måles på personlig indkomst efter AM-bidrag.** Det er den form § 20 regulerer. Sekundære kilder angiver rutinemæssigt de samme grænser før AM-bidrag — 697.000 i stedet for 641.200 — og de to sæt må aldrig blandes.
- **Det skrå skatteloft er trappet fra 2026** og er ikke længere ét tal: 44,57 % op til mellemskat, 52,07 % med topskat, 57,07 % med top-topskat.

- **PAL-skat** på 15,3 % af årets afkast pr. pensionsbeholdning.
- **Frie midler** i tre former: lagerbeskattet aktieindkomst (27 %/42 % med ægtefællernes fælles, overførbare progressionsgrænse), aktiesparekonto (17 % lager med indskudsloft) og kapitalindkomst med rentefradrag. **Realisationsbeskatning er fravalgt**, hvilket betyder, at der ikke føres kostpris nogen steder, og at en hævning fra frie midler er en ren saldoreduktion uden skattekonsekvens.
- Kommune- og kirkeskatteprocent er inputfelter.

### Folkepension

- Grundbeløbet er fladt: hverken arbejdsindkomst eller anden indkomst reducerer det.
- Pensionstillægget aftrappes af et **aftrapningsgrundlag**, der efter pensionslovens § 29 omfatter ATP, livrente- og ratepensionsudbetalinger, **positiv kapitalindkomst** og **aktieindkomst efter personskattelovens § 8 a, stk. 1 og 2** — men hverken arbejdsindkomst, udbetalinger fra aldersopsparing eller afkast på en aktiesparekonto.
- Kapitalindkomsten indgår kun når den er positiv. Negativ nettokapitalindkomst lemper ikke grundlaget, og rentefradraget fra etape 4 har derfor ingen virkning på aftrapningen.
- Lovens bundfradrag på 5.000 kr. aktieudbytte modelleres ikke: det gælder udbytte, og en lagerbeskattet beholdning uden kostprissporing har intet udbytte at anvende det på.
- Ægtefællens indkomst indgår med **54 % bortseelse**, og ægtefællens arbejdsindkomst indgår slet ikke.
- **Både aftrapningsprocenten og bortfaldsgrænsen skifter**, når ægtefællen selv bliver folkepensionist. Fradragsbeløbet er 198.800 kr. i begge tilfælde, men gift med en ikke-pensionist aftrappes med 32 % til bortfald ved 366.400 kr., mens gift med en pensionist aftrappes med 16 % til bortfald ved 533.800 kr. (2026). Overgangen er derfor et spring i marginalskatten, ikke kun i grænsen — og den falder i vores tilfælde omkring 15 år inde i min folkepension.
- Bortfaldsgrænsen er ikke et selvstændigt tal, men følger af ydelsen, fradragsbeløbet og procenten. Se [satsår 2026](./satser/2026.md) for udledningen; forholdet er den rigtige invariant at teste et satsår på.
- **Konsekvens for arkitekturen:** skatten kan ikke beregnes som to uafhængige personberegninger. Der skal være et koblingstrin på husstandsniveau, hvor den ene persons ydelse afhænger af den andens indkomst.
- **Konsekvens for `Årsresultat`:** aktieindkomst og kapitalindkomst føres **pr. person**, og begge aggregeringer er afledte. Skatten summerer dem over husstanden, fordi progressionsgrænsen for aktieindkomst er fælles og overførbar; aftrapningen bruger derimod persongrundlaget, fordi ægtefællens indgår med 54 % bortseelse. En gemt husstandssum kan ikke splittes tilbage, og feltet findes derfor ikke.

### Satser over tid

- Ét komplet **satsår** pr. kendt kalenderår, holdt som data med kilde-URL pr. sæt. 2026 er hentet og verificeret i [docs/satser/2026.md](./satser/2026.md). Satser er delt referencedata: en plan pinner dem ikke, men `Årsresultat` stempler hvilket grundlag det er regnet på. Se [ADR-0005](./adr/0005-satser-er-referencedata-planen-pinner-ikke.md).
- Simuleringsår efter det sidst kendte satsår fremskrives: procentsatser holdes konstante, mens beløbsgrænser løftes — skattelovgivningens grænser efter personskattelovens § 20 og de satsregulerede ydelser efter satsreguleringsprocenten, hver med sin justerbare antagelse.
- Folkepensionsalder kommer fra en indbygget fødselsårstabel (67 i 2025, 68 fra 2030, 70 fra 2040) og kan overstyres pr. person.

### Afkast

- Ét fast **bruttoafkast** og ét **ÅOP** pr. beholdning; nettoafkastet beregnes, så omkostningen er synlig. Se [ADR-0003](./adr/0003-fast-afkast-pr-beholdning.md).
- Afkastet beregnes på den vægtede gennemsnitssaldo efter Modified Dietz: `nettoafkastsats × (primosaldo + Σ vægt × strøm)`.

### Bolig og gæld

- Lån med restgæld, rente, løbetid og eventuel afdragsfrihed; ydelsen splittes i fradragsberettigede renter og afdrag.
- Bolig med markedsværdi og offentlig vurdering, fremskrevet med hver sin sats.
- Ejendomsværdiskat og grundskyld beregnes efter reglerne inklusive skatterabatten fra 2024 og dens bortfald ved salg.
- Boligsalg er en hændelse i et bestemt år: gammel bolig sælges skattefrit efter parcelhusreglen, restgæld indfries, provenuet lander på frie midler, ny bolig købes med nyt lån og handelsomkostninger.
- Nedsparingslån modelleres som lån uden afdrag, hvor renterne enten betales eller tilskrives gælden.

### Lagring

- **Plan** er en komplet, selvstændig enhed — bortset fra satserne, der er delt referencedata. Scenarier er uafhængige kopier, ikke varianter af en delt kerne.
- Gemte data bærer et **skemaversionsnummer**, og der vedligeholdes en migrationskæde, så en modelændring ikke korrupterer eksisterende planer.
- Eksport og import af en plan som JSON-fil er en kernefunktion, ikke en ekstra — localStorage alene er ikke holdbar opbevaring for arbejde af denne størrelse.

### Datakilder

Ingen integration med PensionsInfo. Alt indtastes manuelt. Baggrunden er undersøgt og dokumenteret i [docs/udskudt.md](./udskudt.md).

## Testing Decisions

En god test her beskriver **observerbar adfærd**, ikke intern struktur: den bygger en plan, kører motoren og udtaler sig om årsrækken. Den nævner ikke, hvordan motoren er opdelt indeni, så motoren kan omstruktureres frit, så længe tallene holder.

Der er **ingen prior art** — dette er et grønt felt. Sømmene defineres her og bør derefter være dem, alle senere tests bruger.

### To sømme

**1. `simulate(plan) → Årsresultat[]`** er den primære søm. Al adfærdstest går herigennem: udbetalingsprincipper, folkepensionens aftrapning, broperioden, boligsalgets konsekvenser, indbetalingslofter, søgningen efter tidligste erhvervsophørsalder. Testene bygger en plan-fixture og udtaler sig om de returnerede årsresultater.

**2. Skatteopgørelsen for ét år og én person** er den sekundære søm. Facitcaser mod skat.dk og borger.dk hører hjemme her, fordi en facitcase er "denne indkomst i dette satsår giver denne skat" — og at bygge en hel plan for at udtrykke det ville sløre både testen og fejlmeddelelsen. Den søm forudsætter, at skattemotoren er et selvstændigt modul, hvilket den bør være uanset.

### Balanceinvarianten

For hvert simuleringsår i hver testplan skal `formue ultimo − formue primo` svare præcis til `indtægter + afkast − skat − udgifter`. Den køres som en delt assertion på tværs af alle tests mod den primære søm, ikke som en enkeltstående test.

Invarianten fanger en helt anden fejlklasse end facitcaserne: penge der forsvinder mellem konti, en hævning der ikke reducerer saldoen, skat der trækkes to gange, et boligsalg der taber provenuet. Den er billig at holde ved lige og fanger overraskende meget.

### Facitcaser

En håndfuld håndverificerede cases mod skat.dk's og borger.dk's egne beregnere, holdt som data sammen med kilde og verifikationsdato. De genkøres, når et nyt satsår tilføjes, og de er den eneste kontrol af, om satserne faktisk er rigtige.

Facitcaserne skal som minimum dække: en lønmodtager under mellemskattegrænsen; en lønmodtager i hvert af de tre progressive lag; en folkepensionist med ratepensionsudbetaling i aftrapningsintervallet; og en husstand hvor den ene er pensionist og den anden stadig arbejder.

### Brugerfladen

Testes minimalt i v1. Motoren bærer al logik, og brugerfladen er en visning af årsresultaterne.

## Out of Scope

Detaljeret dokumenteret med begrundelse i [docs/udskudt.md](./udskudt.md):

- **Efterladtescenarie ved dødsfald.** `Person` har et slutår fra dag ét, så mekanikken kan slås til senere. Bemærk tidsfølsomheden: ægtefælledækning på en livrente skal købes, før udbetalingen starter.
- **Monte Carlo-simulation.** Kræver en ombygning af afkastmodellen, når den tages op.
- **Behøvsdrevne udbetalinger** med prioriteret dækningsrækkefølge.
- **PensionsInfo-import.** Afvist, ikke udskudt.

Desuden uden for scope, uden nuværende plan om at tage det op:

- Realisationsbeskattede værdipapirer og kostprissporing.
- Ældrecheck og øvrige formueprøvede tillæg som varmetillæg og helbredstillæg.
- Enlige husstande, skilsmisse, flytning til eller fra Danmark, delvis skattepligt.
- Tjenestemandspension, virksomhedsordning, ApS- og A/S-konstruktioner.
- Efterløn og tidlig pension.
- Rapportgenerering og udskrift.

## Further Notes

### Byggerækkefølge

Hver etape er en fungerende applikation.

1. **[Skelet der regner](./etape-1-PRD.md).** Personer, indtægts- og udgiftsposter, frie midler pr. person med lagerbeskatning og udpeget buffer, overførsler mellem dem, fuld personskat for 2026, årstabel, formuegraf, forklar-året, localStorage med versionering, balanceinvariant og de første facitcaser. Ingen pension endnu.
2. **Indbetalingsfasen.** Arbejdsgiver- og egne bidrag, fradragslofter, aldersopsparingens trappe, aktiesparekonto og kapitalindkomst.
3. **Udbetalingsfasen.** Ratepension, aldersopsparing, livrente, PAL-skat, udbetalingsplaner med begge principper, ATP og folkepension med fuld aftrapning og husstandskobling.
4. **Bolig.** Gæld, ejendomsskatter med rabatordning, køb og salg, nedsparingslån.
5. **Sammenligning.** Flere planer tegnet oven i hinanden, cashflow-graf, søgning efter tidligste holdbare erhvervsophørsalder.

Rækkefølgen er valgt, fordi udbetalingsplaner tømmer beløb, der er gætværk, indtil opsparingssiden er rigtig.

### Åbne spørgsmål

Disse skal afklares undervejs, men blokerer ikke etape 1:

- **Amortisationsrenten i annuitetsprincippet** er fastsat efter en metode angivet i loven og skal slås op præcist.
- **Renten på en negativ saldo på frie midler.** Forslag: et inputfelt for kassekreditrente, så et underskud eskalerer realistisk frem for at stå stille. Påvirker ikke søgningen efter tidligste holdbare erhvervsophør, jf. [ADR-0008](./adr/0008-holdbarhed-maales-paa-bufferen-alene.md).
- **Hustruens folkepensionsalder** er ikke vedtaget for hendes fødselsår og indgår som et skøn, der kan overstyres.
- **Det ekstra pensionsfradrags maksimum.** § 20-tabellen angiver 87.800 kr., mens sekundære kilder angiver 10.536 og 28.096 kr. for de to satstrin. De måler ikke det samme, og forskellen skal forstås før facitcasen skrives.
- **Er 54 %-bortseelsen for ægtefællens indtægt loftlagt?** Selve satsen er bekræftet i pensionslovens § 49; et eventuelt maksimumbeløb er ikke undersøgt.
- **Fradragsbeløbene i aftrapningen indeholder en midlertidig forhøjelse.** Om den videreføres efter 2026 er ikke undersøgt, og det påvirker fremskrivningen af satsåret.

### Kilder

- [skat.dk om bund-, mellem-, top- og toptopskat](https://skat.dk/en-us/help/botton-bracket-middle-bracket-top-bracket-and-additional-top-bracket-tax)
- [Skatteministeriets beløbsgrænser efter personskattelovens § 20](https://skm.dk/tal-og-metode/satser/regulering-af-beloebsgraenser/beloebsgraenser-i-skattelovgivningen-der-reguleres-efter-personskattelovens-20-2025-2026)
- [Pensionsloven § 29 om indtægtsgrundlaget for pensionstillæg](https://danskelove.dk/pensionsloven/29)
- [borger.dk om grundbeløb og pensionstillæg](https://www.borger.dk/pension-og-efterloen/Folkepension-oversigt/foer-du-gaar-paa-folkepension/Folkepension-grundbeloeb-pensionstillaeg)
- [borger.dk om ægtefælles indkomst og 54 %-reglen](https://www.borger.dk/pension-og-efterloen/Folkepension-oversigt/naar-du-er-paa-folkepension)
- [skat.dk om PAL-skat](https://skat.dk/borger/pension-og-efterloen/skat-af-pensionsafkast)
- [STAR om folkepensionsalderen nu og fremover](https://star.dk/ydelser/pension-og-efterloen/folkepension-tidlig-pension-foertidspension-og-seniorpension/folkepension/folkepensionsalderen-nu-og-fremover/)
- [Den juridiske vejledning C.A.10.2.1.1.2.1 om pensionsudbetalingsalder og overgangsregler](https://info.skat.dk/data.aspx?oid=2048232)
- [Den juridiske vejledning C.A.10.2.2.1.2 om rateopsparing i pensionsøjemed](https://info.skat.dk/data.aspx?oid=2048278)
