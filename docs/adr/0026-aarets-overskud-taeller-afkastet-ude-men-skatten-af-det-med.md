# Årets overskud tæller afkastet ude, men skatten af det med

`Surplus` er summen af alt, der bevæger sig på bufferen i ét simuleringsår, undtagen dens eget afkast: indtægtsposter, ydelser, rater og overførsler ind, minus skat, udgiftsposter, indbetalinger og overførsler ud. Afkastet på husstandens beholdninger indgår ikke — heller ikke bufferens eget. Skatten af det afkast indgår, fordi den forlader bufferen som enhver anden regning.

Et år kan derfor vise underskud, mens formuen vokser. Det er ikke en unøjagtighed, der skal bæres; det er hele svaret.

## Hvad de tre kandidater sagde om det samme år

Bufferen er Jespers lønkonto. Ved siden af den står hans aktiedepot på 6.000.000 til 5 % og Annes opsparingskonto på 2.000.000 til 3 %. Året giver 100.000 i folkepension og 300.000 i rate, koster 500.000 i udgifter og 298.000 i skat — hvoraf de 148.000 er aktie- og kapitalindkomstskat af de to depoters afkast — og 150.000 flyttes fra Annes konto over på lønkontoen.

| | 2050 | Hvad nul-linjen betyder |
|---|---|---|
| Strømmene alene | **−248.000** | Det, der kom ind, betalte året |
| Bufferens ændring, dens eget afkast med | +52.000 | Bufferen stod stille |
| Alle frie midlers ændring | −38.000 | Den likvide formue stod stille |

De to sidste er mere korrekte som formueopgørelse. Den første er den eneste, der svarer på det spørgsmål, grafen blev bygget for: er der penge nok i år, og hvor mange mangler der. Afkastet på 360.000 er ikke penge, husstanden kan bruge — det bliver stående på de to depoter, indtil nogen flytter det — mens de 148.000 i skat af det er en regning, lønkontoen betaler i januar. Set fra transaktionskontoen er det ikke en skævhed, men året, som det faktisk er.

Den fulde symmetri var i øvrigt ikke til at få. At trække skatten af afkastet ud igen ville kræve, at aktieindkomstskatten kunne henføres til én beholdning, og det kan den ikke: progressionsgrænsen er husstandens og overførbar, jf. [ADR-0014](./0014-skattesoemmet-er-husstandens-ikke-personens.md). Valget stod derfor mellem at tælle afkastet med eller lade skatten af det stå alene, og ikke mellem at gøre det rigtigt og gøre det forkert.

## Nettoresultatet afløses

Årstabellens kolonne **Nettoresultat** — `income + return − tax − expenses` — bliver til **Overskud** og regner `Surplus` i stedet.

Den gamle kolonne sagde det modsatte om netop de år, værktøjet findes for. En rate er ikke `income`, men dens skat er `tax`, og nettoresultatet falder derfor med ratens skat, den dag en ratepension åbner. Året, hvor ordningen betalte regningerne, tegnede sig som det værste. To kolonner, der begge lyder som "sådan gik året" og er hundredtusinder fra hinanden, er værre end én, og formuens historie er ikke tabt: forskellen mellem to rækker i **Formue** er årets formueændring.

## Konsekvenser

`Surplus` gemmes ikke. Den udledes af fire tal på bufferens `HoldingYear` — ultimo minus primo, minus afkastet, plus beholdningsskatten — og fladen regner den selv, ganske som `NetReturn`, `CapYear`s råderum og `TaperBase`s sum udledes frem for at stå på en linje. [ADR-0012](./0012-fladen-laeser-motorens-svar-frem-for-at-gentage-udledningen.md) forbyder ikke det: den blev skrevet, fordi fladen kørte motorens *udledninger* en gang til, og fire tal fra én række, der lægges sammen, kan ikke blive uenige med motoren.

Grafen måler planen og ikke formuen. Et underskud på 248.000 betyder, at der mangler en overførsel på 248.000 — ikke at husstanden ikke har pengene. Er overførslerne skrevet ind, som de skal være, står kurven på nul, og det er efter hensigten: den er en huskeseddel over, hvad der skal flyttes hvert år. Spørgsmålet om, hvorvidt der overhovedet er noget at flytte, hører til `Sustainable` og `BufferState`, jf. [ADR-0008](./0008-holdbarhed-maales-paa-bufferen-alene.md), og besvares i formuegrafen.

Skattebåndet i grafen bliver større, end de synlige indtægter kan forklare. Forskellen er afkastets skat, og den er en direkte følge af beslutningen. Opdelingen findes i forklar-året, hvor skattelagene står pr. person ved siden af aktieindkomstens.

Den divergerende stablede søjlegraf, fladekortet forkastede, er genindført. Indvendingen var, at et fortegnsskift i én størrelse forsvinder i en stabling af mange kategorier — den er besvaret ved at tegne netop den størrelse i sit eget panel under stablingen, med sin egen skala. Kravlisten i `docs/mockup/README.md` er rettet tilsvarende; [ADR-0011](./0011-formuegrafen-tegnes-i-raat-svg-med-d3-scale-og-d3-shape.md) står uændret, for `d3-shape` stabler divergerende uden videre.

## Se også

- [ADR-0008](./0008-holdbarhed-maales-paa-bufferen-alene.md) — det andet spørgsmål, og hvorfor de to grafer ikke overlapper
- [ADR-0002](./0002-plan-drevet-motor-med-frie-midler-som-buffer.md) — overførslen er brugerens beslutning, og underskuddet er dens målestok
- [ADR-0012](./0012-fladen-laeser-motorens-svar-frem-for-at-gentage-udledningen.md) — hvad fladen må regne selv
- [ADR-0024](./0024-gennemloebet-forrenter-sig-ikke-og-afkastet-krediteres-foer-aarets-drift.md) — afkastet krediteres før årets drift, og bufferens jævne strømme vejer nul
- `CONTEXT.md` — opslagene `Surplus` og `Buffer`
- `docs/mockup/README.md` — `#cashflow`, hvis form var forkastet
