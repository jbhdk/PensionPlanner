# Skattesømmet er husstandens, ikke personens

Motorens anden testsøm har hidtil været `assessTax(input, rates)` — skatten for ét år og én person. Den flytter sig ud til `assessHousehold(input, rates)`, husstandens skat for ét år, og `TaxAssessment` bliver en del inde bag sømmet frem for sømmet selv. Antallet af testsømme er uændret to.

Grunden er, at aktieindkomstskatten aldrig kunne komme igennem det gamle søm. Progressionsgrænsen mellem 27 % og 42 % er fælles og overførbar mellem ægtefæller, så skatten regnes af husstandens samlede aktieindkomst mod husstandens samlede grænse. Det er ikke en personberegning, og den lå derfor som en privat funktion i `simulate.ts`, hvor den kun kunne prøves gennem en hel fremskrivning. Reglen havde ingen søm at stå ved, og `simulate` lagde til gengæld `personalTax + shareTax` sammen i hånden — nøjagtig den fejl, `totalTax` blev en funktion for at forhindre, bare et niveau højere oppe.

Det viste sig på skærmen. Forklar-året bar skatten i balancestriben som husstandens tal og i personblokkene som `totalTax` af den personlige opgørelse alene, og for en enlig med 100.000 kr. i aktieindkomst stod der derfor 30.090 kr. i striben og 0 kr. i den eneste persons blok. De 30.090 kr. fandtes ingen steder på en side, hvis eneste formål er, at et tal kan efterregnes i hånden.

Alternativet var at lade sømmet blive og eksportere aktieindkomstskatten ved siden af det. Det ville have givet et tredje sted at skrive tests mod, og det er netop det, to-sømsreglen findes for at forhindre: en søm om en mellemregning binder testene til, hvordan skatten er stykket sammen, frem for til hvad den er.

## Konsekvenser

Aktieindkomstskatten bæres som to `LayerAmount` med hver sit grundlag og sin egen sats, ikke som ét beløb. Invarianten `amount = base * rate` gælder også her, så en linje kan efterregnes af sig selv, og `ShareIncomeLayer` er navngivet efter satsnøglerne i satsåret, så laget slår sin egen sats op. Den ligger ved siden af `TaxLayer` og ikke inden i den — de lag er en persons.

`YearResult` får `shareIncomeTax` og ikke hele husstandsopgørelsen. Bar den hele opgørelsen, ville de samme `TaxAssessment`-objekter stå to steder i det samme årsresultat, én gang under `persons[].tax` og én gang inde i husstandens. Årsresultatet bærer hvert tal ét sted; husstandsopgørelsen er sømmets form, ikke resultatets. ADR-0010 er dermed urørt: aktie- og kapitalindkomst står stadig pr. person, og kun skatten er husstandens.

Skatten kan ikke vises i en persons blok. Der findes ingen fordelingsnøgle i loven, og en pro rata-fordeling ville producere et tal, der ligner et facit uden at svare til noget uden for programmet. Forklar-året får derfor en egen blok, og fladekortet er rettet efter det — både layoutet i `flade.js` og regnestykket i `plan.js`, som prøvede hver person mod den doblede grænse og dermed talte de 158.800 kr. to gange.

Sømmet kan ikke håndhæves. TypeScript har ingen pakkeprivat synlighed, så `assessTax` og `marginalTaxRate` er stadig `export`, for at `assessHousehold` kan bruge dem. At de kun kaldes indefra er en konvention, ikke en garanti, og en fremtidig kalder kan gå udenom uden at compileren siger fra. Prøven på, om konventionen holder, er `simulate.ts`: den importerer kun `assessHousehold` og `totalHouseholdTax`.

Til gengæld blev invarianten kontrollerbar udefra. `simulateChecked` efterprøver nu, at årets skat er summen af personernes lag plus aktieindkomstens — for hvert år i hver eneste test mod den primære søm, ved siden af balanceinvarianten.

## Se også

- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — hvorfor aktie- og kapitalindkomst føres pr. person, og hvorfor skatten alligevel er husstandens.
- [ADR-0012](./0012-fladen-laeser-motorens-svar-frem-for-at-gentage-udledningen.md) — hvorfor fladen viser motorens egne tal frem for at regne dem om.
- [Diagram: Simuleringsåret](../diagrams/02-simuleringsaaret.md) — skattens plads i årets rækkefølge.
