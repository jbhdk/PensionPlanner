# Hjælpeteksten skriver til brugeren, glossaret til den, der bygger

Hver etiket i skuffen og hver kolonneoverskrift i tabellerne har en forklaring, man henter frem ved at pege på den. Teksterne er nyskrevne og står i `src/ui/fieldHelp.ts`. De er altså ikke [CONTEXT.md](../../CONTEXT.md)s definitioner, selv om de fleste af dem forklarer nøjagtig de samme ord.

Det er en dublet, og den er valgt med åbne øjne. Glossaret er bindende for koden og skal kunne sige *"andel pr. år, ikke procent"* og nævne `inflationAssumption` ved navn — det er dets arbejde at være præcist over for den, der bygger. Men netop dét gør det ubrugeligt på skærmen. **Reguleringssats** står i glossaret som *"en indtægtsposts egen fremskrivningssats, uafhængig af planens `inflationAssumption`"*, hvor den, der planlægger sin pension, skal have at vide, at en løn typisk stiger hurtigere end priserne, og at netop den forskel afgør, hvor meget der er lagt til side ved erhvervsophøret. Samme begreb, to læsere, to tekster.

De to alternativer blev prøvet af og faldt hver på sit. At vise glossarteksten direkte er gratis og kræver ingen ny prosa — men så løber typenavne, kodefelter og *Avoid*-lister ud på skærmen, og hjælpeteksten arver en præcision, der ikke hjælper nogen. At skrive glossaret om i brugersprog og bruge det begge steder fjerner dubletten helt — men CONTEXT.md er bindende for koden, og et glossar, der har lagt sin præcision fra sig for at kunne læses af en lægmand, kan ikke længere afgøre, om et ord må stå i en type.

Prisen for at have to er, at et begreb nu er beskrevet to steder og kan drive fra hinanden. Modgiften er nøglen: hvert opslag i registret hedder det, koden kalder feltet, så en term og dens brugerforklaring findes af den samme søgning. Der er ingen automatik, der holder de to enige — der er kun det, at de kan findes ved siden af hinanden.

**Registret forklarer felter, ikke tilstande.** Fladen havde i forvejen en kanal for prosa, `Hint`, og uden et skel ville de to sige det samme om det samme felt, hvoraf kun den ene bliver læst korrektur på. Skellet er, at en forklaring er statisk og hører til feltet, mens en `Hint` er begrundet i planens tilstand lige nu: et spærret valg, et beløb der er brutto, en alder der er et skøn, en post der ikke falder i noget år. De to kan stå på samme felt og gør det for bufferen. Tre `Hint`s var i virkeligheden feltforklaringer — horisontens, bopælskommunens og de to fremskrivningssatsers — og er flyttet ind i registret. Brutto-hinten blev, hvor den er: [ADR-0007](./0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md)s forpligtelse er en *fast* forklaring under feltet, og bag en hover er den ikke længere fast.

## Konsekvenser

Dækningen er total, og derfor er der ingen markering på skærmen af, at en etiket kan forklares — et mærke, der sidder på alt, siger ingenting. Kun markøren skifter. Delvis dækning ville omvendt have tvunget et mærke frem på alle 71 opslag, for ellers kan man aldrig vide, om der ikke kom noget, fordi der intet er, eller fordi man pegede forkert.

Garantien holdes af typen frem for af omhu: feltkomponenterne i `fields.tsx` kræver en nøgle, så et nyt felt uden forklaring ikke oversætter. Kolonneoverskrifter kan oversætteren ikke se, og dem dækker `fieldHelp.test.tsx` i stedet, sammen med de mekaniske af stilreglerne — ingen kodeord, ingen henvisning indad, intet "du", og en øvre grænse på tekstlængden.

Nøglen navngiver tingen og ikke ordet. To felter, der deler ord på skærmen, er to ting: `Transfer.from` er en beholdning, `Period.from` et årstal. Omvendt er ét felt vist i to skuffer stadig én ting — postens og overførslens periode deler forklaring. For en kolonne er "én ting" kolonnen selv, for en kolonne kan lægge sammen, trække fra eller skifte felt under overskriften: `CapYear.paid` viser to forskellige tal alt efter loftets form og har alligevel én tekst, som selv bærer forskellen.

Browserens egen `title` er mekanismen, som den allerede var det for årstabellens satsårsstjerne. Den koster ingenting og kan ikke klippes af navigatorens rullecontainere, men den giver ingen tastaturadgang, venter et sekund, tager kun ren tekst og forsvinder af sig selv. Det sidste er samtidig grunden til, at forklaringerne er korte. Skal mekanismen skiftes til en selvbygget boble, er det to komponenter og nul tekster — det er registret og stilreglerne, der er svære at rulle tilbage, ikke hvordan de tegnes.

Feltforklaring står ikke i glossaret. CONTEXT.md rummer ingen fladeord — hverken *inspektør*, *skuffe* eller *navigator* — og en flademekanisme skal ikke ind i et domæneglossar, fordi den er ny.

Stilreglerne står som prosa i registrets egen dokumentationskommentar og ikke her. En vedtaget ADR må aldrig rettes til noget andet, og reglerne skal kunne få en syvende; de skal desuden læses af den, der tilføjer felt nummer 72, og vedkommende står i `fieldHelp.ts`.

## Se også

- [ADR-0001](./0001-nominel-regning-real-visning.md) — hvorfor etiketterne siger *nutidskroner*, og hvorfor en forklaring, der nævner et beløb, skal mene det samme som tallet ved siden af
- [ADR-0007](./0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md) — den ene `Hint`, der ikke måtte flyttes bag en hover
- [ADR-0012](./0012-fladen-laeser-motorens-svar-frem-for-at-gentage-udledningen.md) — en forklaring beskriver, hvad en kolonne er, og regner aldrig selv efter, hvad der står i den
