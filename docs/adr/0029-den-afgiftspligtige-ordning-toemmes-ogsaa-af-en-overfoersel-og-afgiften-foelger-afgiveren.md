# Den afgiftspligtige ordning tømmes også af en overførsel, og afgiften følger afgiveren

`PayoutTaxation` får en tredje værdi, `Chargeable`, og kapitalpensionen er den eneste variant, der bærer den. En `Transfer` må hente fra enhver afgiver, hvis udbetalingsbeskatning ikke er `PersonalIncome` — altså både fra en `TaxFree` og fra en `Chargeable` — og hvad flytningen koster, følger af afgiverens variant frem for at være en egenskab ved overførslen.

Kapitalpensionen passer ikke i det skel, ADR-0022 tegnede. Dens udbetaling er hverken skattefri eller personlig indkomst: den koster en afgift af beløbet, og den passerer ingen indkomstopgørelse. Den udløser hverken AM-bidrag, rører intet skattelag og indgår ikke i `TaperBase`. En procent, der på papiret ligner ratepensionens marginalskat i lige netop ét år, opfører sig dermed helt anderledes — den er ufølsom over for alt andet i planen, hvor ratepensionens tal flytter sig med hvert eneste andet valg husstanden træffer. Det er også hele grunden til, at ordningen er værd at planlægge med, og en model, der pressede den ned i en af de to eksisterende værdier, ville miste præcis den egenskab.

De tre kandidater til at flytte pengene ud er de samme, ADR-0022 vejede. En `PayoutSchedule` ville opfinde en lovregel: kapitalpensionen har hverken en varighed eller et beregningsprincip, og fra sin `PayoutAge` hæver ejeren, hvad hun vil, når hun vil. En fjerde udbetalingsform ville kunne nøjagtig det samme som en overførsel, blot udtrykt i en ny figur med sin egen periode, sin egen gentagelse og sit eget forfald. Overførslen kunne det hele i forvejen; det eneste, den manglede, var lov til at pege på en afgiftspligtig ordning.

Skellet, der afgør hvem der må afgive, flytter sig dermed fra "hvor der ingen skat udløses" til **"hvor loven ikke binder både start, varighed og årligt beløb"**. Det er det skarpere af de to, og det var i virkeligheden altid den bærende begrundelse: ratepensionen og livrenten skal gennem en plan, fordi loven binder dem, og ikke fordi de koster skat. At de to hidtil faldt sammen, var et sammentræf, kapitalpensionen bringer til ophør.

At afgiften følger afgiveren og ikke overførslen, er samme greb som ADR-0016's. Dér kendes indbetalingen på sin destination — fradragsretten er destinationens variants og aldrig et felt på bidraget. Her kendes overførslen på sin kilde. Overførslen bærer fortsat ingen skattemæssig egenskab selv; den slår blot op ét sted mere. Alternativet, et felt på overførslen, ville tillade kombinationer der ikke findes — en afgiftsfri hævning fra en kapitalpension — og gøre beskatningen til noget, der skal valideres, frem for noget, der er umuligt at skrive forkert.

## Konsekvenser

Beløbet på en overførsel måles hos afgiveren. Det er kroner ud af beholdningen og ikke kroner ind i de frie midler, ganske som en indbetaling fra lønnen måles på bruttolønnen. Den anden vej ville sætte to enheder på samme linje: afkortningen til afgiverens saldo måles i forvejen i afgiverens ende, og en `TransferYear`, hvis `requested` stod i modtagerkroner og `moved` i afgiverkroner, kunne ikke efterregnes af sig selv. Brugeren ville desuden ikke kunne skrive "tøm kontoen" uden først at regne baglæns gennem afgiften.

`TransferYear` bliver en union på afgiverens `PayoutTaxation`, som `CapYear` er det på loftets form. En `Chargeable`-afgiver giver linjen et tredje beløb — det, der landede — hvor en `TaxFree`-afgiver ingen kile har og derfor ikke skal have et felt, hvor to tal altid var ens. Afgiften selv står ikke på linjen: den er de to tals difference og udledes, hvor den vises, ligesom `NetReturn` og `CapYear`s råderum.

Afgiften ligger i balanceinvariantens `tax`-led som en fjerde bærer ved siden af `TaxAssessment`, `HouseholdTaxAssessment` og `HoldingTax`. Den fik ikke sit eget led, sådan som `conversion` gjorde. Omsætningen har et, fordi pengene ikke forlader nogen — de bliver til en livsvarig ydelse, og der er ingen modtager at bogføre dem hos. Afgiften forlader husstanden til staten, præcis som `HoldingTax` gør, og `HoldingTax` er allerede en bærer, der aldrig passerer nogen persons indkomst, aldrig rører bufferen og alligevel ligger i det led. Skulle afgiften have sit eget, skulle beholdningsskatten konsekvent også have et. Glossarets skel består: afgiften er ikke *en* skat — den giver ingen marginalskat og rører intet `TaxLayer` — men invariantens led svarer på, hvad staten fik, og dér hører den hjemme.

Afgiften bliver ikke et `SurplusBand`. De otte bånd afgøres af, hvad der bevæger sig på bufferen, og afgiften trækkes, før pengene ankommer — den passerer aldrig bufferen, akkurat som beholdningsskatten, der derfor ligger intet sted. Båndet for overførsler ind viser det, der landede. Prisen er, at afgiften kun er synlig på overførslens egen linje i forklar-året; det er samme pris, `HoldingTax` allerede betaler.

`BufferState` måler nu likviditet andetsteds netto. Summen af de nåbare beholdningers saldi var rigtig, så længe hver nåbar krone landede ubeskåret, og bliver forkert i samme øjeblik en kapitalpension er blandt dem: en buffer på −70.000 og en kapitalpension på 100.000 ville hedde `Incomplete`, selv om en fuldstændig tømning kun lander 60.000. `Incomplete` lover, at en overførsel kan lukke hullet, og det løfte skal kunne indfries. Spørgsmålet har derfor to halvdele — hvilke beholdninger, og hvor meget af dem der ankommer.

Varianttabellen får to kolonner. `chargeRate` navngiver afgiftens sats i satsåret, som `holdingTaxRate` navngiver beholdningsskattens, og den er typebundet til de `Chargeable` varianter, sådan som `cap` er bundet til de loftbelagte: en variant, der er afgiftspligtig uden en sats at slå op, skal være en oversætterfejl og ikke en beholdning, der tømmes gratis i et årsresultat. `OpenToContributions` er den anden, og den er kapitalpensionens egen — ordningen kan ikke modtage en krone, og en indbetaling til den afvises ved indgangen som den strukturelle umulighed, den er.

Reglen om hvem der må afgive sidder tre steder — `payoutAge.ts`, `validatePlan.ts` og `planEdits.ts` — og alle tre spørger gennem `payoutTaxation`. Det er derfor ét opslag, der ændres, og ikke tre betingelser, der kan komme ud af trit.

Den nye variant lander i det gemte skema, men kræver intet led i migrationskæden: ingen eksisterende plan indeholder den, og gamle planer læses uændret.

## Se også

- [ADR-0022](./0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md) — afløses af denne på afgiverreglen alene; dens valg af overførslen frem for en udbetalingsplan og frem for en fjerde figur står uændret og bærer også denne
- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — beskatningen er variantens akse, og en tredje form er derfor en værdi i en kolonne og ikke en betingelse
- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — indbetalingen kendes på sin destination; her kendes overførslen på sin kilde
- [ADR-0008](./0008-holdbarhed-maales-paa-bufferen-alene.md) — holdbarheden måles på bufferen, og det er derfor afgiften skal med i målingen
- [ADR-0020](./0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md) — den lukkede ordning og det umulige udbetalingsregime hører ved indgangen
- [docs/diagrams/01-domaenemodel.md](../diagrams/01-domaenemodel.md) — varianttabellens række for kapitalpensionen og de to nye kolonner
