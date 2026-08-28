# Følger erhvervsophør peger på en navngiven person, ikke periodens udledte ejer

En `PersonAge`-forankret periodes endepunkt sat til "Følger erhvervsophør" har hidtil fulgt `periodOwner` — den person, figurens struktur udleder som ejer (posten sin egen, overførslen afgiverens, det beholdningskildede bidrag destinationens). I den sammenlagte Overførsel-skærm kan "Fra" og "Til" have hver sin ejer, og hvilken af de to der reelt blev målt mod, flyttede sig usynligt med, hvad brugeren valgte som "Til" — det var problemet, [ADR-0047](./0047-overfoerslen-kendes-paa-sin-kilde-i-skuffen-ikke-paa-sin-destination-i-motoren.md) måtte parkere, i stedet for at løse, ved at kræve samme ejer på Fra og Til, når Fra er frie midler. Idéen om et eksplicit personvalg blev noteret i [docs/udskudt.md](../udskudt.md) og tages nu op — i sin snævre form.

Et endepunkt kan nu i stedet eksplicit navngive, hvis erhvervsophør det følger, uafhængigt af `periodOwner`. Det er en ny type, `PersonAgeBound`, brugt alene af `Period`s `PersonAge`-gren — ikke en udvidelse af `AgeBound`, som `PayoutSchedule.start` også bruger: en beholdning har præcis én ejer, og det valg ville aldrig have et andet svar end det, der allerede står der. De to typer deler form (et tal, eller en henvisning til erhvervsophør) men ikke navn.

Valget er altid eksplicit — der findes ikke længere en stiltiende "følger den udledte ejer"-værdi for `Period`s endepunkter. Krydses fluebenet i fladen, udfyldes personen med den i dag udledte `anchorOwner`, så adfærden er uændret, medmindre nogen aktivt vælger den anden — men *data* siger fra da af altid hvem. Det kræver et migrationsskridt: eksisterende `Period`-endepunkter sat til `'WorkEndAge'` skrives om til en eksplicit reference til den ejer, `periodOwner` ville have udledt på migrationstidspunktet.

Valget står for hvert endepunkt for sig — "Fra" og "Til" kan følge hver sin person, ligesom fluebenet allerede i dag sættes uafhængigt på de to.

## Konsekvenser

ADR-0047's ejerregel lempes for netop det tilfælde, hvor den ikke længere har noget at forhindre: `PersonAge`-forankring med forskellig ejer på Fra og Til er tilladt, når intet af de to satte endepunkter er et fast alderstal — hvert er enten åbent eller en eksplicit navngiven "følger". Et fast alderstal er stadig tvetydigt uden en udledt fælles ejer og forbliver spærret. Lempelsen er, ligesom resten af reglen, en klemning i skuffen og ikke en ny afvisning i `validatePlan`.

Fjernes den navngivne person fra husstanden, mens en anden figur følger hendes erhvervsophør, reparerer `repairPlan` referencen til en fast alder — det årstal, endepunktet ramte lige før fjernelsen — frem for at falde tilbage på figurens egen udledte ejer eller rydde endepunktet. Tallet, brugeren sidst så, står uændret; kun autopiloten forsvinder.

En indtægtsposts eget horisont-loft (`personLastYear(entry.owner)`, [ADR-0030](./0030-en-persons-horisont-stopper-hendes-egen-indkomst-ikke-husstandens-udgifter-eller-hendes-beholdninger.md)) afkobles, når postens slutpunkt eksplicit følger en *anden* person end postens egen ejer. Følger slutpunktet i stedet postens egen ejer — eksplicit eller ej — gælder loftet som hidtil.

## Se også

- [ADR-0047](./0047-overfoerslen-kendes-paa-sin-kilde-i-skuffen-ikke-paa-sin-destination-i-motoren.md) — ejerreglen, denne beslutning lemper dele af, og det parkerede punkt, den tager op.
- [ADR-0028](./0028-det-beholdningskildede-bidrag-maa-krydse-ejerskellet.md) — hvorfor et beholdningskildet bidrag måler alder fra destinationens ejer, som `periodOwner` fortsat udleder uændret.
- [ADR-0030](./0030-en-persons-horisont-stopper-hendes-egen-indkomst-ikke-husstandens-udgifter-eller-hendes-beholdninger.md) — indtægtspostens horisont-loft, som denne beslutning afkobler i det navngivne tilfælde.
- [ADR-0031](./0031-erhvervsophoersaaret-taeller-med-som-from-og-ikke-med-som-to.md) — `from`/`to`-skellet, `PersonAgeBound` arver uændret fra `AgeBound`.
- [ADR-0045](./0045-fladen-klemmer-og-siger-hvorfor-indgangskontrollen-er-bagstopperen.md) — klemningen, både den oprindelige ejerregel og lempelsen her er bygget med.
- [docs/udskudt.md](../udskudt.md) — den fulde generalisering (et `periodOwner`-uafhængigt felt for alle figurer og alle endepunktsformer), som forbliver udskudt.
