# Gennemløbet forrenter sig ikke, og afkastet krediteres før årets drift

Aftrapningen af pensionstillægget kunne ikke regnes i ét fremadrettet gennemløb. Tillæggets størrelse afhænger af årets kapitalindkomst, og tillægget skabte selv kapitalindkomst ved at passere bufferen: hver krone, der landede der, vejede ind med ½ i afkastgrundlaget, afkastet blev personens kapitalindkomst, og positiv kapitalindkomst indgår i aftrapningsgrundlaget efter PL § 29. Ringen sluttede, og fire beslutninger, der hver især er rigtige, holdt den lukket.

Den er brudt ét sted: **bufferens jævne strømme vejer nul.**

Bufferen er husstandens transaktionskonto, og det er dét, der adskiller den fra enhver anden beholdning. Årets drift passerer den — indtægter, rater og ydelser ind, udgifter og skat ud — og det eneste, den efterlader, er over- eller underskuddet, som lander ved årets slutning. De penge ligger på en lønkonto, der ikke forrenter sig, indtil nogen flytter dem, og bufferens primosaldo er netop det, der *blev* flyttet, sidste gang året lukkede. Stakken forrenter sig, gennemløbet gør ikke. Det er ikke en tilnærmelse, vi accepterer for at slippe for et fikspunkt — det er beskrivelsen af, hvad en husstand gør, og modellen er derfor eksakt frem for skæv.

Reglen gælder kun bufferens ende. En rate mister stadig `½ × beløbet` fra ratepensionens afkastgrundlag, for pengene forlader den faktisk månedsvis; de forrenter sig blot ingen steder i det halve år, de er undervejs. En indbetaling vejer stadig ind i den ordning, den lander i, for de penge bliver faktisk investeret ved ankomsten. Vægten er dermed en egenskab ved **enden** og ikke ved strømmen, og det er den ene indsnævring af ADR-0006, beslutningen koster.

Reglen gælder kun de jævne strømme. En post med et forfald beholder sin vægt hele vejen, også på bufferen: et boligsalg på 2 mio. kr. i februar forrenter sig i elleve tolvtedele af året. Det er præcis det tilfælde, ADR-0006 købte måneden for, og det ville have været tabt, hvis alt var gået samme vej. Skellet har en mening frem for at være en undtagelse: **en jævn strøm er ikke en begivenhed, den er et niveau**, og en transaktionskonto beholder ikke et niveau.

## Alternativet var et fikspunkt, og det blev forkastet

Ringen er godmodig. Sløjfeforstærkningen er `½ × nettoafkast × aftrapningsprocent` ≈ 0,6 % pr. gennemløb, så to gennemløb rammer inden for et par kroner, og et fremadrettet pas, der stadig vejede strømmene, ville ramme 282 kr. under det rigtige svar. Et fikspunkt var altså både billigt og eksakt, og det havde den egenskab, at forklar-året ville gå op i hånden begge veje — hvad et fremadrettet pas med vejede strømme ikke gør.

Det blev forkastet, fordi det ville have løst det forkerte problem. Ringen var ikke et regneteknisk uheld, men symptomet på, at modellen forrentede penge, husstanden ikke havde: bruttoindkomsten vejede ½, mens skatten af den vejede nul, og en husstand, der betaler 250.000 kr. i skat og sparer 100.000 kr. op, fik derfor 5.000 kr. for meget i afkastgrundlag. Et fikspunkt ville have regnet det tal eksakt frem i stedet for at fjerne det. Med gennemløbet vejet nul forsvinder både ringen og skattens frie forrentning i samme greb, og den fremadrettede udregning, ADR-0002 lovede, holder igen.

## Afkastet krediteres, før driften er kendt

Efter ændringen rører folkepensionen intet afkastgrundlag, og den behøver derfor ikke længere at være kendt, før afkastet regnes. Rækkefølgen i motoren rettes efter det: bogen lukkes for vægtning, så snart de daterede bevægelser er noteret, og afkastet krediteres dér. Folkepensionen, aftrapningen, skatten og restposten ligger nedenunder.

Det er håndhævelsen og ikke et selvstændigt valg. Ringen bliver **umulig at skrive** frem for blot fraværende: tillægget findes ikke endnu, når afkastet spørges, så ingen fremtidig ændring kan lukke ringen i god tro. Det er samme greb som ADR-0010's — en forkert tilstand gøres umulig frem for noget, der skal valideres.

Diagram 02's note indsnævres af samme grund fra *alle årets strømme* til **alle daterede bevægelser**.

## Hvad beslutningen flytter

I #46's eget eksempel — en enlig folkepensionist med 1.000.000 kr. i buffer til 4 %, en rate på 200.000 kr. og **ingen udgifter**:

| | Kapitalindkomst | Pensionstillæg |
|---|---|---|
| Fikspunktet på den gamle model | 46.992 | 59.080 |
| Efter denne beslutning | 40.000 | 61.241 |

**2.161 kr.** Læs ikke de 282 kr. ovenfor som størrelsen på det, der blev vejet — de var prisen på et fremadrettet pas, der stadig vejede strømmene, og det er ikke det, der blev bygget.

De 2.161 kr. er til gengæld et mål for, hvor ekstremt eksemplet er: pensionisten bruger nul kroner og sparer hele sin indkomst op. Lægges der 290.000 kr. i udgifter ind, falder forskellen til **379 kr.** For en husstand, der faktisk lever af pengene, flytter beslutningen et par hundrede kroner.

## Konsekvenser

Ringen er brudt eksakt og ikke tilnærmet. Bufferens afkastgrundlag var den eneste bue: rater regnes af primosaldoen, livrenteydelser af primosaldoen, overførsler afkortes mod primosaldoen, og et indbetalingsloft er enten `PerYear` fra satsåret eller `OnBalance` mod primosaldoen. Ingen af dem kan læse årets afledte indkomst.

Der kommer intet nyt begreb og intet nyt felt. Ændringen er en fjernelse — fire vægtninger på bufferen forsvinder — og restposten landede i forvejen som en bevægelse uden vægt. Det gemte skema er urørt, migrationskæden får intet led, og balanceinvarianten er uændret.

**Der skal ikke bygges et felt for lønkontoens rente.** Husstanden, der lader 400.000 kr. hobe sig op og først flytter dem 31. december, har et `Transfer`-problem og ikke et rentefelt-problem, og en overførsel med et forfald beholder sin vægt hele vejen. Værktøjet kan allerede beskrive hende.

Balanceinvarianten fanger ikke beslutningen — den holder for et hvilket som helst afkastbeløb — og `WorkedExample` kan ikke bære den, fordi glossaret binder den til skatteopgørelsen. Tre prøver mod den primære søm holder den derfor på plads: et år med kun jævne strømme, hvor bufferens afkast er nøjagtig `nettoafkastsats × primosaldo` og dens vægtede strøm nul; ratepensionens række samme år, hvor den vægtede strøm er `−½ × raten`; og et år med et boligsalg i februar, hvor bufferens vægtede strøm er `11/12` af beløbet. Den første fanger enhver, der lægger en vægtning tilbage, den anden enhver, der "retter" asymmetrien, og den tredje enhver, der generaliserer reglen til også at ramme de daterede poster.

`HoldingYear.weightedFlow` bliver mindre for bufferen, end brugeren forventer, og kolonnens forklaring i `fieldHelp.ts` blev usand for netop den række. Afvigelsen gælder altid bufferen og er derfor en feltforklaring og ikke en `Hint`.

## Se også

- [ADR-0002](./0002-plan-drevet-motor-med-frie-midler-som-buffer.md) — påstanden om, at hvert års beregning er en ligefrem fremadrettet udregning. Den var truet af den ring, denne ADR bryder, og holder nu igen.
- [ADR-0006](./0006-maaneden-er-en-afkastvaegt-ikke-et-tidsskridt.md) — indsnævres af denne på to punkter: vægten er en egenskab ved enden og ikke ved strømmen, og det er de daterede bevægelser og ikke alle strømme, der skal kendes før afkastet. Selve påstanden, at måneden er en vægt og ikke et tidsskridt, står uændret.
- [ADR-0004](./0004-frie-midler-pr-person-med-udpeget-buffer.md) — bufferrollen som udpeget egenskab, og hvorfor kapitalindkomstens ejer betyder noget for aftrapningen.
- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — hvorfor bufferens afkast overhovedet bliver til aktie- eller kapitalindkomst hos en person.
- [Diagram: Simuleringsåret](../diagrams/02-simuleringsaaret.md) — afkastets nye plads i årets rækkefølge.
