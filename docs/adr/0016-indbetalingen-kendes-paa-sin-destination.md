# Indbetalingen kendes på sin destination, ikke på sin skattevirkning

En `Contribution` er en bevægelse ind i en beholdning, der ikke er `FreeAssets`. En `Transfer` flytter mellem frie midler. Destinationen er hele skellet, og hverken skattevirkningen eller loftet indgår i det.

Glossaret målte hidtil på skattevirkningen: *"Bærer en skattevirkning og et loft — til forskel fra en overførsel, der har ingen af delene."* Det holdt, så længe de eneste ordninger var ratepensionen og livrenten. Det knækkede i det øjeblik aldersopsparingen og aktiesparekontoen kom med, for begge har et `Cap` og ingen `Deductibility`: de betales af beskattede penge og giver intet fradrag. En indbetaling til en aldersopsparing var dermed en kombination, glossaret påstod ikke fandtes.

Skellet skulle altså måles et andet sted, og destinationen var allerede halvt valgt. [Diagram 01](../diagrams/01-domaenemodel.md) havde noten stående i forvejen — *"I v1 kun `FreeAssets` til `FreeAssets` — en flytning ind i en pensionsordning er en indbetaling, ikke en `Transfer`"* — den var bare ikke den regel, definitionen brugte.

Med destinationen som skel bliver to ting **udledt frem for indtastet**. Skattevirkningen følger destinationens variant: `InstalmentPension` og `LifeAnnuity` har `Deductibility`, `OldAgeSavings` og `ShareSavingsAccount` har den ikke. Og AM-behandlingen følger kilden: kommer pengene fra en lønpost, trækkes AM-bidraget af indbetalingen på vejen ind, så der lander 92 % i ordningen; kommer de fra en beholdning, er AM'en betalt for længst eller aldrig relevant. Ingen af de to er felter, brugeren skal svare på.

Alternativet var at give `Contribution` et felt for sin skattevirkning. Det er præcis den konstruktion, [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) afviste for beholdningen: et felt ved siden af den akse, der faktisk bestemmer, tillader kombinationer der ikke findes — en indbetaling til en aldersopsparing med fradragsret — og gør dermed noget uskriveligt til noget, der skal valideres.

## Konsekvenser

Kilden er enten en `Entry` eller en `Holding`, og `Contribution` er en diskrimineret union på den. Det lønkildede bidrag peger på sin lønpost og arver dens periode, forankring, gentagelse og forfald; det bærer kun en procent eller et fast beløb. Det er [ADR-0007](./0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md)'s egen forudsigelse gjort til type — *"et procentbidrag peger på sin lønpost, så det ophører af sig selv ved `workEndAge` i stedet for at have en periode, der kan komme ud af trit"* — og udenfor typen findes tilstanden ikke længere.

Det beholdningskildede bidrag er ikke en bekvemmelighed, men et krav. Aldersopsparingens høje loft gælder de sidste syv år før folkepensionsalderen, og for en husstand, der holder op med at arbejde før, ligger hele det vindue efter sidste lønkrone. Uden en kilde, der er en beholdning, kan hoved-PRD'ens punkt 22 ikke skrives.

Modsat en `Transfer` kan et bidrag aldersforankres. Begrundelsen for, at overførslen ikke kan — *"en overførsel har ingen ejer at binde en alder til"* — gælder ikke her: destinationsbeholdningen tilhører en person, og bidraget har dermed den ejer, forankringen mangler.

Loftet er efter dette ikke længere bevis for noget. En aldersopsparing har et `Cap` og ingen `Deductibility`, en arbejdsgiveradministreret livrente har `Deductibility` og intet `Cap`. De to egenskaber er uafhængige opslag i varianttabellen, og hverken den ene eller den anden kan bruges til at genkende en indbetaling.

Begge dele sidder i det gemte skema og koster et led i migrationskæden.

## Se også

- [ADR-0007](./0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md) — hvorfor indbetalingen er en bevægelse og en selvstændig figur, og hvorfor lønnen er brutto.
- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — hvorfor et felt ved siden af varianten er den forkerte konstruktion.
- [ADR-0015](./0015-livrenten-er-en-sjette-variant-ikke-en-underklasse.md) — den sjette variant, som skellet her skal kunne rumme.
- [Diagram: Domænemodellen](../diagrams/01-domaenemodel.md) — varianttabellens `Deductibility`- og `Cap`-kolonner.
