# Den skattefri ordning tømmes af en overførsel, ikke af en udbetalingsplan

En `PayoutSchedule` findes kun på de varianter, hvis `PayoutTaxation` er `PersonalIncome`: ratepensionen med start, varighed og princip, og livrenten med start alene. Aldersopsparingen og aktiesparekontoen har ingen. De tømmes af en `Transfer` som husstandens frie midler, og overførslens afgiverende løsnes tilsvarende fra "frie midler" til "en variant, hvis udbetaling er skattefri".

Loven giver ikke aldersopsparingen en udbetalingsplan. Fra pensionsudbetalingsalderen hæver ejeren, hvad hun vil, når hun vil, skattefrit og uden virkning på `TaperBase` — det, der skiller den fra en opsparingskonto, er en låst dør indtil den alder, PAL-skat på afkastet, og et loft på vejen ind. Alle tre er egenskaber ved varianten og allerede modelleret. En udbetalingsplan på den ville altså opfinde en lovregel og bede brugeren vælge et princip, der ikke findes.

Alternativet var en fjerde udbetalingsform på beholdningen — start og et årligt beløb, tømt til saldoen er væk. Den ville have kunnet nøjagtig det samme som en overførsel, blot udtrykt i en ny figur med sin egen periode, sin egen gentagelse og sit eget forfald, og dermed to måder at skrive den samme bevægelse. Overførslen kunne det hele i forvejen; det eneste, den manglede, var lov til at pege på en ordning.

Skellet falder på beskatningen på vejen ud, og ikke på "pension mod ikke-pension". Det er dét, der gør reglen til et opslag i varianttabellen frem for en liste: en overførsel må hente, hvor der ingen skat udløses, og en udbetaling, der er personlig indkomst, skal gennem en plan, fordi loven binder både dens start, dens længde og dens årlige beløb.

Aktiesparekontoen var i forvejen en musefælde. Efter etape 2 kunne en `Contribution` skyde penge ind på den, mens `validatePlan` afviste enhver overførsel ud af den, og der fandtes ingen udbetalingsplan. Pengene kunne komme ind og aldrig ud. Beslutningen her lukker det hul som en konsekvens frem for som en lap.

## Konsekvenser

Overførslens periode kan aldersforankres, og alderen måles på afgiverbeholdningens ejer. Påstanden om, at "en overførsel har ingen ejer at binde en alder til", holdt kun så længe begge ender var frie midler; en beholdning har præcis én ejer, og afgiverens er det entydige svar. Uden det ville en aldersopsparings tømning ikke flytte sig med `WorkEndAge`, og det er netop dét, en udbetalingsplans start blev aldersforankret for at kunne.

Overførslen afkortes til afgiverens saldo. Et fast kronebeløb kunne ellers drive en ordning negativ, og en beholdning, der ikke er bufferen, må ikke gå under nul. Afkortningen skal kunne ses, og `YearResult` får derfor en `TransferYear`-linje — samme greb som `CapYear` under et `OnBalance`-loft, hvor det afviste beløb også ville have været usynligt.

`validatePlan` skal afvise en overførsel, der begynder før afgiverens `PayoutAge`. En hævning fra en aldersopsparing før den alder koster 20 % i afgift og er ikke noget, planen skal kunne beskrive, jf. ADR-0020.

Hvad "likviditet andetsteds" betyder i `BufferState`, er nu et spørgsmål med et svar: de beholdninger, en overførsel kan nå.

Fladen låner ordet "udbetaling" til en overførsel ud af en ordning. Det er det, den er i virkeligheden — man beder selskabet udbetale sin aldersopsparing — men figuren er og hedder en overførsel i glossaret og i koden.

## Se også

- [ADR-0004](./0004-frie-midler-pr-person-med-udpeget-buffer.md) — overførslen findes, fordi frie midler ejes pr. person
- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — beskatningen er variantens akse, og derfor er dette et opslag
- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — indbetalingen kendes på sin destination; overførslen kendes nu også på sin kilde
- [ADR-0019](./0019-aktiesparekontoens-loft-forhindrer-indskuddet-frem-for-at-straffe-det.md) — afkortning frem for straf, og linjen der gør den synlig
- [ADR-0020](./0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md) — den låste dør indtil `PayoutAge` hører ved indgangen
- [docs/diagrams/01-domaenemodel.md](../diagrams/01-domaenemodel.md) — varianttabellens kolonne "Hævning/udbetaling" er `PayoutTaxation`
