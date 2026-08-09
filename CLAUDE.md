# Arbejdet i dette repo

Pensionsplanneren er et personligt værktøj til at fremskrive én husstands økonomi år for år gennem hele pensionen, med danske skatte- og pensionsregler indregnet. Læs [CONTEXT.md](./CONTEXT.md) før du gør noget som helst — den er glossaret, og den er bindende.

**Status:** Der er endnu ingen kode. Designet er grillet igennem og dokumenteret; etape 1 er beskrevet i [issue #2](https://github.com/jbhdk/PensionPlanner/issues/2). Node og npm er ikke installeret på maskinen — det skal på plads, før der kan skrives kode.

## Sproget

Prosa, commits, issues og dokumentation skrives på dansk. Kode, typer, felter og diagramnavne bruger de engelske identifiers fra glossaret.

Parret **dansk term · `EnglishIdentifier`** i CONTEXT.md er bindende begge veje: står ordet ikke der, må det ikke stå i koden. Skal du bruge et nyt begreb, så tilføj det til glossaret først — det er en glossarudvidelse, ikke en navngivning i forbifarten. Tre fælder står øverst i CONTEXT.md (`rate` mod `instalment`, `payout` mod `benefit`, de to slags `annuity`); læs dem, de rammer let.

CONTEXT.md er et glossar og intet andet. Ingen implementeringsdetaljer, ingen spec, ingen noter.

## Hvor tingene hører hjemme

| Slags | Sted |
|---|---|
| Begreber | `CONTEXT.md` |
| Beslutninger | `docs/adr/` |
| Struktur og rækkefølge | `docs/diagrams/` |
| Officielle satser pr. år | `docs/satser/` |
| Bevidst fravalgt til senere | `docs/udskudt.md` |
| PRD'er, issues, planer | **GitHub — aldrig i repoet** |

Repoet rummer det varige. En PRD er forældet, så snart etapen er bygget, og to kopier af samme plan driver fra hinanden — skriv PRD-indholdet direkte i issue-teksten frem for at lægge en fil og linke til den.

## ADR'er

Skriv kun en ADR når alle tre gælder: beslutningen er **svær at rulle tilbage**, den er **overraskende uden kontekst**, og den er resultatet af et **reelt valg mellem alternativer**. Mangler ét af de tre, så lad være.

Følg formen i de eksisterende: overskriften er selve påstanden i ét udsagn, brødteksten er prosa uden skabelonafsnit, og til sidst et **Se også** med links til de diagrammer og ADR'er, beslutningen rører ved. Nummerér fortløbende. Ret aldrig en vedtaget ADR til noget andet — skriv en ny, der afløser den.

## Diagrammer

Mermaid skrevet direkte i markdown, så de kan diffes i git og renderes af GitHub og VS Code uden værktøjskæde. De tilføjer ingen begreber: et ord i et diagram, som ikke står i CONTEXT.md, er en fejl i diagrammet. Hver fil slutter med **Åbne punkter** — antagelser der ikke er afgjort. Bliver et punkt afgjort, så fjern det samme dag; en besvaret åben post er værre end ingen.

En klasse mærket `<<skitse>>` er tegnet efter PRD'en og ikke efter glossaret. Behandl den ikke som afgjort.

## Satser

Et satsår er delt referencedata, aldrig en del af en plan ([ADR-0005](./docs/adr/0005-satser-er-referencedata-planen-pinner-ikke.md)). Hvert tal skal have en kilde; foretræk skm.dk's egen § 20-tabel frem for sekundære kilder, som ofte citerer beløbsgrænser **før** AM-bidrag, hvor loven måler **efter**. Tal, der er krydstjekket men ikke bekræftet officielt, mærkes ⚠︎. Hvert satsår slutter med en **Selvkontrol**, der udleder aftrapningsprocenterne af ydelse ÷ interval — den relation er invarianten, et satsår skal testes på.

## Regnereglerne, der binder al kode

- Motoren regner i **løbende priser**; brugerfladen viser **dagens kroner** ([ADR-0001](./docs/adr/0001-nominel-regning-real-visning.md)).
- Motoren er en ren funktion: `simulate(plan) → YearResult[]`. Ingen backend, intet netværk, ingen skjult tilstand.
- **Balanceinvarianten** er den fælles assertion: `closingWealth − openingWealth = income + return − tax − expenses`. Knækker den, er modellen forkert — ikke testen.
- To testsømme, og ikke flere: hele `simulate(plan)`, og skatteopgørelsen for ét år og én person. Test udefra; læg ikke en søm om en mellemregning.

## Stakken, når koden kommer

React + TypeScript + Vite, ingen backend. Motoren er rene funktioner uden React-afhængighed. Persistens er localStorage med `schemaVersion` og en migrationskæde, plus JSON-eksport og -import. Beslutninger, der ligger i det gemte skema, kan kun ændres via et nyt led i kæden — nævn det, når du rører dem.

## Commits

Dansk, imperativ, én sammenhængende ændring pr. commit ("Afklar aktieindkomstens rolle i aftrapningsgrundlaget"). Commit og push kun når du bliver bedt om det.
