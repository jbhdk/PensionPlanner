# Pensionsudbetalingsalderen tastes direkte, den udledes ikke af oprettelsestidspunktet

En `PensionSchemeHolding` bar indtil nu `OpenedOn` — år og måned for aftalen, der oprettede ordningen — og `payoutAge()` slog dette tidspunkt op i en tabel over tre lovregimer (`BeforeMay2007`, `May2007ToDecember2017`, `FromJanuary2018`) for at udlede den tidligste lovlige udbetalingsalder. Var en lavere alder bevaret gennem en overførsel mellem selskaber, kunne `PayoutAgeOverride` overtrumfe den udledte værdi.

Fremover tastes `PayoutAge` direkte på ordningen. `OpenedOn`, regimetabellen og `PayoutAgeOverride` forsvinder alle tre fra skemaet.

Begrundelsen er, hvor let tallet i forvejen ligger klar: et pensionsselskab oplyser sin kundes tidligste udbetalingsalder direkte på pensionsoverblikket, uafhængigt af om kunden selv kender oprettelsesmåneden eller det regelsæt, den falder under. At bede brugeren taste et oprettelsestidspunkt og lade motoren udlede alderen var en omvej om et tal, der allerede findes ét sted — og en omvej, der desuden krævede en tabel over lovens egne datoskel, holdt vedlige i `payoutAge.ts` og dokumenteret i `docs/satser/pensionsudbetalingsalder.md`.

Den udledte model havde en reel styrke, som forsvinder med den: to af de tre regimer måler folkepensionsalderen minus fem eller tre år, og en udledt alder rettede sig derfor af sig selv, hvis skønnet for en ufastsat årgangs folkepensionsalder senere blev justeret. Et tastet tal gør ikke det — det ligger fast, til brugeren selv retter det. For en ordning under et af de to relative regimer, hvis ejer har en årgang uden vedtaget folkepensionsalder, kan planen derfor komme til at stå med en forældet udbetalingsalder uden varsel. Det er en kendt og accepteret bagside af at bytte lovtro udledning ud med brugerens eget, opdaterede tal fra selskabet — den slags drift findes ikke i den udledte model, men den model krævede til gengæld, at brugeren kendte og korrekt tastede et oprettelsestidspunkt, hun ofte ikke selv har liggende.

## Konsekvenser

`PayoutAgeOverride` bliver overflødig af sig selv og forsvinder på alle fire varianter, ikke kun livrenten: når `PayoutAge` ikke længere er noget, motoren udleder, er der intet tilbage at overtrumfe — det tastede tal er alderen, uanset om ordningen er oprindelig eller har taget en lavere alder med sig gennem en overførsel.

`capitalPensionClosedForNewSchemes` i `validatePlan` afvises hermed sit datagrundlag og fjernes. Reglen brugte `holding.openedOn` til at afvise en kapitalpension "oprettet" efter udgangen af 2012, jf. [ADR-0020](./0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md). Uden et oprettelsestidspunkt er der intet felt tilbage, brugeren kan udfylde forkert på en måde, der beskriver en umulig ordning — værktøjet modellerer husstandens eksisterende pensioner, det opfinder ikke nye.

Migrationskæden får et nyt led, der udleder hver eksisterende ordnings `PayoutAge` én gang ved opgraderingen, af de gamle `openedOn`- og `payoutAgeOverride`-felter og ejerens fødselsdato — præcis den beregning, `payoutAge()` foretog. Leddet bærer sin egen frosne kopi af regimetabellens tre datoskel og formel, fremfor at importere den fra motoren: ingen af kædens øvrige led importerer fra motoren, og et led, der gjorde det, ville risikere at ændre mening, den dag nogen rørte ved den nu døde motorkode af en helt anden grund. `payoutRegime`, `reached` og regimetabellen slettes derfor fra `payoutAge.ts`.

`docs/satser/pensionsudbetalingsalder.md` udgår. Filens indhold — kildehenvisningen til pensionsbeskatningslovens § 1 a og det åbne punkt om § 1 a, stk. 2's særtabel for personer født før 1961 — flytter ind som kommentar på migrationstrinet, det eneste sted, tallene fremover bruges. En satsårsfil er data, motoren slår op løbende; denne bliver ren historik, bagt ind i ét migrationstrin, og ville ellers ligge og foregive at være aktiv.

## Se også

- [ADR-0012](./0012-fladen-laeser-motorens-svar-frem-for-at-gentage-udledningen.md) — princippet, som ikke gælder for dette felt: her er der intet at udlede
- [ADR-0020](./0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md) — mister sin kapitalpensions-instans, når oprettelsestidspunktet ikke længere findes at validere
- [docs/diagrams/01-domaenemodel.md](../diagrams/01-domaenemodel.md) — klassekortets `Holding`-felter `openedOn` og `payoutAgeOverride` udgår
