# ADR-0018: Loftet måles pr. person pr. loft, og det overskydende bliver liggende

Et loft på en pensionsindbetaling kunne måles tre steder: på det enkelte bidrag, på den enkelte beholdning, eller på personens samlede indbetaling til den slags ordning. Fladekortet tegnede det på beholdningen, og det er den nærliggende læsning — beholdningen er dér, pengene lander, og den bærer allerede sin variant og sin beskatning. Men det er ikke det, loven måler. Pensionsbeskatningslovens § 16 lægger loftet på indkomstårets indbetalinger til ordningerne af en slags, ikke på den enkelte police. To ratepensioner med 40.000 kr. hver er ét brud på 11.300 kr., ikke to lovlige indbetalinger, og en husstand med en gammel og en ny ratepension er ikke et sjældent tilfælde — det er det almindelige.

Loftet måles derfor pr. person og pr. slags ordning: årets samlede indbetaling til personens `InstalmentPension`-beholdninger mod ratepensionens loft, og til personens `OldAgeSavings`-beholdninger mod aldersopsparingens. Livrenten har intet loft og indgår i ingen af dem. Grupperingen er varianten, fordi varianten allerede er beskatningens akse (ADR-0010) — og det gør `CappedVariant` til den delmængde af `HoldingVariant`, der bærer et loft, frem for en ny akse ved siden af den.

**Det overskydende bliver liggende i ordningen.** Motoren flytter ikke pengene tilbage på bufferen. Hele indbetalingen lander, præcis som brugeren har skrevet den; det er alene skattevirkningen, der begrænses. Den anden vej — at skubbe det overskydende retur — ville være den stiltiende rettelse af brugerens plan, som ADR-0002 forbyder, og den ville skjule fejlen bag et resultat, der ser rigtigt ud. Det, der koster, er fradragsretten: den del af ratepensionsindbetalingen, der ligger over loftet, holdes ikke uden for den personlige indkomst, og den hæver dermed hvert lag ovenpå. Aldersopsparingen har ingen fradragsret at miste, og dens overskydende er afgiftspligtigt efter PBL § 25 A i stedet — den afgift er ikke modelleret, jf. [udskudt.md](../udskudt.md).

**Bruddet er årets svar og ikke planens.** Bidraget vokser med sin egen reguleringssats, loftet med § 20-fremskrivningen, og de to er selvstændige antagelser. Det samme bidrag kan derfor være lovligt i 2030 og et brud i 2040. `validatePlan` kender ikke et år og kan ikke svare på det; formen er `BufferState`s. `CapBreach` står på `YearResult` ved siden af `bufferState` og siger, hvad bruddet kostede — `LostDeductibility` eller `Chargeable` — mens `CapYear` på `PersonYear` bærer de tre tal, linjen kan efterregnes af: indbetalt, loft, og den del der beholdt sin fradragsret. Fladen markerer årets række fra det ene felt og laver ingen aritmetik (ADR-0012).

**Loftet anvendes bag skattesømmet.** Det begrænser den gruppering, ADR-0016 og ADR-0014 allerede lader krydse som ét tal, og skatteopgørelsen ser derfor fortsat aldrig en `HoldingVariant`. Loftlinjerne og det tal, sømmet får, kommer fra samme opgørelse — regnede de hver sit sted, kunne forklar-året komme til at vise en linje, der ikke kan efterregne den skat, den står ved siden af.

Prisen er, at en fremtidig ordning, der deler loft med en anden slags — lovens § 16, stk. 2, opremser både ratepensionen og de ophørende livrenter — ikke kan nøjes med en ny variant: den kræver, at grupperingen skilles fra varianten. Den ordning findes ikke i modellen, og prisen er derfor kendt og udskudt frem for betalt nu.

## Se også

- [ADR-0002](./0002-plan-drevet-motor-med-frie-midler-som-buffer.md) — værktøjet retter aldrig brugerens plan i det skjulte
- [ADR-0008](./0008-holdbarhed-maales-paa-bufferen-alene.md) — formen for et årsresultat, der ikke er en valideringsfejl
- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — varianten er aksen
- [ADR-0014](./0014-skattesoemmet-er-husstandens-ikke-personens.md) — hvad der må krydse skattesømmet
- [ADR-0015](./0015-livrenten-er-en-sjette-variant-ikke-en-underklasse.md) — loftet er dét, der skiller livrenten fra ratepensionen
- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — hverken skattevirkningen eller loftet bæres af indbetalingen
- [docs/satser/2026.md](../satser/2026.md) — lofternes måleform, årstælling og afgift
- [docs/diagrams/01-domaenemodel.md](../diagrams/01-domaenemodel.md) — varianttabellens `Cap`-kolonne
