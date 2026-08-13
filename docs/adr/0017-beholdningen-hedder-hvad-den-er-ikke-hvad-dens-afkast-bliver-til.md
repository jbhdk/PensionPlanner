# Beholdningen hedder, hvad den er, og ikke hvad dens afkast bliver til

De to frie varianter skifter navn: `ShareIncome` bliver `ShareDepot` · aktiedepot, og `CapitalIncome` bliver `SavingsAccount` · opsparingskonto. Feltet, de vælges i, hedder **type** på skærmen og ikke variant. [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md)'s egentlige påstand står uændret — varianten er aksen, der findes ikke et `taxTreatment`-felt ved siden af den, og indkomsten føres pr. person — men dens navngivning er afløst.

En `Holding` er en saldo, du ejer. En indkomst er det, saldoens afkast bliver til hos personen. De gamle navne påstod, at de to var det samme, og skuffen sagde derfor "Type: Kapitalindkomst" om en bankkonto. Det er ikke en kluntet etikette, der kan oversættes væk på vejen ud: glossaret binder begge veje, så det ord, skærmen viser, er det ord, koden bruger. Netop derfor kunne fejlen heller ikke skjules ved at oversætte `CapitalIncome` til noget pænere på dansk — så ville begrebet hedde to ting, og det er præcis den tilstand, glossaret findes for at forhindre.

ADR-0010 valgte skattespandens navne med vilje og sagde hvorfor: *"navnet siger, hvilket felt afkastet lander i"*. Den egenskab var virkelig. Prisen var bare, at kontoen blev opkaldt efter noget, den ikke er, og gevinsten er mindre, end den lyder — sammenhængen mellem variant og indkomstfelt er to linjer i `simulate`, og de to linjer skal skrives uanset hvad navnene er. Et navn behøver ikke bære en afbildning, koden allerede har.

**Indkomstnavnene bliver, hvor de er.** `PersonYear.shareIncome` og `capitalIncome`, `YearResult.shareIncomeTax`, `ShareIncomeLayer` og `CapitalIncomeLayer` er urørte, for dér *er* det indkomster: personens aktie- og kapitalindkomst for året, og aktieindkomstens to skattelag. Omdøbningen skiller to ting, der hidtil delte ét ord — den fjerner ikke det ene af dem.

Alternativet var at lade det stå. Navnene virkede, og de kostede kun et ubehag, hver gang skuffen blev åbnet. Men et gemt skema bliver dyrere at rette med tiden, ikke billigere, og ADR-0010 forudsagde selv denne regning: *"Ændres de senere, kræver det et led i migrationskæden — det er prisen for at træffe valget nu."* Leddet er nu skrevet, mens der er én bruger og få gemte planer.

## Konsekvenser

Kæden får et led fra v4 til v5, der alene omdøber variantværdien i beholdningerne. En gemt plan fra etape 1 indlæses dermed stadig uden datatab; de tre nye pensionsvarianter kræver fortsat intet led, for en udvidet union er bagudkompatibel.

`SavingsAccount` er en delstreng af `ShareSavingsAccount`, som kommer i etape 3, og `Savings` deles desuden med `OldAgeSavings`. Det er valgt bevidst frem for et fjernere ord: typerne kan ikke forveksles af oversætteren, kun af øjnene, og de to danske navne — opsparingskonto og aktiesparekonto — er lovens egne og forveksles alligevel ikke.

Varianttabellen siger efter dette ikke længere selv, hvilket felt afkastet lander i. Det gør `simulate`, hvor aktiedepotets afkast slås op som personens aktieindkomst og opsparingskontoens som kapitalindkomst.

Ordene *konto* og *depot* står på `Holding`s _Avoid_-liste i glossaret, fordi den generelle beholdning ikke må kaldes en konto. De to nye variantnavne bruger dem alligevel, og det er ikke en modsigelse: forbuddet gælder samlebetegnelsen, navnene gælder hver sin variant. Glossaret siger det nu selv, så den næste læser ikke skal regne det ud.

## Se også

- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — afløst på navngivningen; aksen, persongrundlaget og forbuddet mod et felt ved siden af varianten står uændret.
- [ADR-0015](./0015-livrenten-er-en-sjette-variant-ikke-en-underklasse.md) — afløste den samme ADR på antallet af varianter.
- [Diagram: Domænemodellen](../diagrams/01-domaenemodel.md) — varianttabellen med de nye navne.
