# Et fast alderstal på et periodeendepunkt kan pege eksplicit på en navngiven person

[ADR-0050](./0050-foelger-erhvervsophoer-peger-paa-en-navngiven-person-ikke-periodens-udledte-ejer.md) gjorde "Følger erhvervsophør" personvalgt, men lod et fast alderstal stå tilbage: dets "hvis alder?" er stadig altid `periodOwner`, figurens strukturelt udledte ejer, og der findes intet felt hvor brugeren vælger den person direkte. Det var netop derfor ADR-0047's ejerregel-lempelse kun rakte til det tilfælde, hvor intet af periodens satte endepunkter er et fast alderstal — er blot ét af dem, er der stadig ingen navngivet person at læse tallet mod, og forankringen forbliver spærret ved forskellig ejer. Denne beslutning tager resten op.

`PersonAgeBound` udvides med en tredje form, `{ person: PersonId; age: number }`, ved siden af det urørte tal (implicit `periodOwner`, uændret) og `{ person: PersonId }` (følger erhvervsophør, fra ADR-0050):

```ts
type PersonAgeBound =
  | number
  | { person: PersonId }
  | { person: PersonId; age: number }
```

Valget stod mellem at brede typen ud på den måde eller at give endepunktet et selvstændigt personfelt ved siden af tallet. Den brede type vinder, fordi den følger den diskriminerede-union-stil, koden allerede bruger til `AllocationShare`: en form uden en person kan ikke få én, og en med kan ikke undvære den — et separat felt ville kunne stå sat uden noget tal at høre til, eller med et tal uden nogen periode at gælde for.

Generaliseringen når også `Entry`, selv om en posts `periodOwner` aldrig er tvetydig — den er altid postens eget `owner`-felt. Her løser den tredje form ikke en tvetydighed, men giver en ny mulighed: at lade en posts endepunkt følge en anden persons alder end postens egen ejer, fx en fælles udgiftspost skrevet på Person 1, hvis "Til" skal måles på Person 2's alder.

## Konsekvenser

ADR-0047's ejerregel-lempelse (udmøntet i `guardTransferOrContributionAnchor`) skal udvides til at behandle `{ person, age }` som utvetydig på linje med `{ person }` — kun det bare tal forbliver tvetydigt ved forskellig ejer på Fra og Til. `followedPersonsExist` i `validatePlan.ts` generaliserer sig selv, fordi den allerede kun tester feltet `.person` uanset formens øvrige indhold.

Mindst fire ADR'er (ADR-0016, ADR-0022, ADR-0028, ADR-0031) bygger på antagelsen "ejeren udledes af strukturen" for et fast alderstal og skal genlæses, når feltet bygges. Ikke afgjort her — overladt til den, der tager opgaven.

## Se også

- [ADR-0050](./0050-foelger-erhvervsophoer-peger-paa-en-navngiven-person-ikke-periodens-udledte-ejer.md) — den oprindelige beslutning, denne udvider.
- [ADR-0047](./0047-overfoerslen-kendes-paa-sin-kilde-i-skuffen-ikke-paa-sin-destination-i-motoren.md) — ejerreglen, som lempes yderligere.
- [ADR-0028](./0028-det-beholdningskildede-bidrag-maa-krydse-ejerskellet.md), [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md), [ADR-0022](./0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md) og [ADR-0031](./0031-erhvervsophoersaaret-taeller-med-som-from-og-ikke-med-som-to.md) — antager "ejeren udledes af strukturen" for et fast alderstal og skal genlæses.
- [docs/udskudt.md](../udskudt.md) — punktet, denne beslutning tager op.
