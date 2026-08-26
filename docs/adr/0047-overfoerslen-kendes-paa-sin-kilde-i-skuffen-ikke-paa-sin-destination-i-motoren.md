# Overførslen kendes på sin kilde i skuffen, ikke på sin destination i motoren

En beholdningskildet `Contribution` — penge fra frie midler ind i en ordning som aktiesparekontoen eller aldersopsparingen — har hidtil heddet en "indbetaling" i skuffen, fordi den er det i motoren, jf. [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md). For en bruger, der vil flytte penge fra sin egen konto til en anden, er "indbetaling" det forkerte ord: det bruges om penge, der kommer fra en løn, ikke om penge, der allerede ligger et sted i husstanden. Skellet mellem "Overførsel" og "Indbetaling" i fladen følger derfor ikke længere motorens type eller destinationen — det følger kilden. Kommer pengene fra en beholdning, hedder det Overførsel, eller Udbetaling, når afgiverens `PayoutTaxation` ikke er `TaxFree` for frie midler (uændret fra [ADR-0022](./0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md)). Kommer de fra en lønpost, hedder det Indbetaling.

Skuffen samler derfor `Transfer` og den beholdningskildede `Contribution` i én sektion, "Overførsler", med ét fælles Fra/Til-felt-par. Hvad brugeren vælger som "Til" afgør usynligt, hvilken af de to figurer der skrives — frie midler giver et `Transfer`, en ordning giver en `Contribution`. Omklassificeringen sker live, også når en allerede oprettet overførsel redigeres bagefter, og den er alene en handling i `src/ui/planEdits.ts`: motoren kender intet til den, dens to typer og det gemte skema er uændrede, og `validatePlan`s regler (`transferEnds`, `contributionEnds` med flere) står som de gjorde.

Den lønkildede `Contribution` er ikke en del af sammenlægningen. Den beholder sin egen sektion, sin egen "+"-knap og sit eget Fra/Til-par — kilden er aldrig en beholdning dér, og ordet "Indbetaling" var allerede det rigtige.

## Konsekvenser

Aldersforankring kræver samme ejer på Fra og Til, men kun når "Fra" er frie midler. Det er dér, og kun dér, at "Til" reelt afgør, om perioden skal måles fra afgiverens ejer (bliver et `Transfer`) eller destinationens (bliver en `Contribution`, jf. [ADR-0028](./0028-det-beholdningskildede-bidrag-maa-krydse-ejerskellet.md)) — en ejerforskel ville gøre svaret tvetydigt. Er "Fra" en låst ordning, er destinationen altid frie midler, svaret er altid afgiverens ejer, og en ejerforskel er uden virkning; reglen rammer derfor ikke Udbetalings-tilfældet, som fortsat kan aldersforankres på tværs af ejere som i dag. Begrænsningen er en klemning i skuffen (jf. [ADR-0045](./0045-fladen-klemmer-og-siger-hvorfor-indgangskontrollen-er-bagstopperen.md)), ikke en ny afvisning i `validatePlan`: en håndredigeret fil med forskellig ejer og en aldersforankret periode er stadig gyldig data efter motorens egne regler, den kan blot ikke opstå gennem den sammenlagte skærm.

`ContributionFields`' felt "Kilde" mister sin gruppe "Beholdninger" — den vej går nu gennem Overførsel-skærmen — og omdøbes sammen med "Destination" til "Fra"/"Til", så navngivningen er ens i begge skærme. Feltforklaringen for det sammenlagte "Fra"/"Til" følger den aktuelle klassificering dynamisk, ligesom selve ordet på skærmen allerede gjorde det for Overførsel/Udbetaling.

Ideen om at lade brugeren vælge aldersforankringens person eksplicit, uafhængigt af figurens struktur, blev overvejet undervejs og parkeret — se [docs/udskudt.md](../udskudt.md).

## Se også

- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — skellet, denne beslutning låner ordet hen over, uden at ændre det.
- [ADR-0022](./0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md) — det første lån af et ord, "Udbetaling", som dette bygger videre på.
- [ADR-0028](./0028-det-beholdningskildede-bidrag-maa-krydse-ejerskellet.md) — hvorfor en beholdningskildet indbetaling måler alder fra destinationens ejer, som den nye ejerregel her beskytter mod at blive tvetydig.
- [ADR-0045](./0045-fladen-klemmer-og-siger-hvorfor-indgangskontrollen-er-bagstopperen.md) — klemningen, ejerreglen er bygget med.
- [docs/udskudt.md](../udskudt.md) — den parkerede idé om en eksplicit personvalgt aldersforankring.
