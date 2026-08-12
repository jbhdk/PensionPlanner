# Fladen læser motorens svar frem for at gentage udledningen

Har brugerfladen brug for noget, motoren allerede regner, får den `YearResult` ind og slår op i det. Den udleder ikke det samme igen fra `Plan` med motorens egne hjælpefunktioner, og motoren eksporterer ikke mellemregninger til brug for fremvisning.

Det var ellers, hvad der skete. Skuffen forklarede en post — hvilke år den løber i, og hvad en engangspost koster i det år, den falder — ved at kalde `entryProjection` og `periodBounds`, som `simulate.ts` eksporterede med doc-kommentarer, der begrundede eksporten med fladen og roste udledningen for at være "samme udledning som motoren selv bruger". Den ros er duplikationens eget forsvar: to steder kan kun være enige, så længe nogen holder dem enige.

De var da også allerede uenige. `periodBounds` oversætter en periodes endepunkter til kalenderår og standser dér, mens motoren desuden klipper perioden mod horisonten i `withinPeriod`. En post med et endepunkt efter horisonten fik derfor en note om et år, den aldrig faldt i.

Alternativet var et delt module — motorens udledning samlet ét sted, kaldt af `simulate` indefra og af skuffen udefra. Det fjerner duplikationen af *koden*, men ikke af *regnestykket*: udledningen ville stadig køre to gange, og den anden gang uden at være bundet af det, den første gang kom frem til. Klipningen mod horisonten sker i simuleringens gennemløb, ikke i udledningen af én post, og et sådant module ville have arvet præcis den fejl, det skulle rette. `simulate(plan)` er allerede det dybe module; fladen brugte det bare ikke.

## Konsekvenser

Skuffen tager `YearResult[]` ind ved siden af `Plan`. `App` regner dem i forvejen i samme render, så der er ingen ny beregning — kun et argument, der ikke længere kastes væk.

Noten om en post spørger, hvor mange år posten optræder i, og intet andet. Tre svar dækker alt: ingen år betyder uden for horisonten, ét år får beløbet i det års egne kroner, flere år får det første og det sidste. Den forgrener dermed hverken på `Recurrence`, `Anchor` eller `Direction` — kombinationer, den før tegnede hver for sig. `EveryNYears`' spring mellem årene står fortsat usagt.

En knækket bufferpeger giver en tom årsrække, mens skuffen står åben — det er dér, fejlen rettes. Uden år er der intet udledt at sige, og noten udelades. Det er ikke et tab: resultatspalten siger allerede højlydt, hvorfor planen ikke kan simuleres.

Prisen er, at fladen bliver afhængig af, at det, den vil forklare, er noget motoren rent faktisk fører på `YearResult`. Vil skuffen forklare noget, motoren regner internt og smider væk, er svaret at føre det ud på `YearResult` — ikke at eksportere mellemregningen. `YearResult` er i forvejen defineret som "alle mellemregninger, ikke kun totaler".

`returnWeight` bliver, hvor den er. Den er ikke en gentaget udledning, men en oversættelse af én regel — `Timing` til en vægt, jf. [ADR-0006](./0006-maaneden-er-en-afkastvaegt-ikke-et-tidsskridt.md) — og `EntryYear` udelader bevidst forfaldet, fordi det er en egenskab ved posten og ikke ved året.

## Se også

- [ADR-0001](./0001-nominel-regning-real-visning.md) — den anden regel om, hvad fladen selv må gøre ved motorens tal
- [ADR-0005](./0005-satser-er-referencedata-planen-pinner-ikke.md) — `YearResult` stempler sit eget grundlag frem for at lade læseren udlede det
- [diagram 02](../diagrams/02-simuleringsaaret.md) — hvor klipningen mod horisonten sker
