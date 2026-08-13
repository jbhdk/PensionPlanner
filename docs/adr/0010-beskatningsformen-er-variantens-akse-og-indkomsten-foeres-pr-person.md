# Beskatningsformen er beholdningens variant, og indkomsten føres pr. person

`Holding.variant` er et lukket sæt på fem — `InstalmentPension`, `OldAgeSavings`, `ShareSavingsAccount`, `ShareIncome` og `CapitalIncome` — hvor varianten *er* beskatningsformen og ikke blot ledsages af den. Glossarets `FreeAssets` splittes derfor i to varianter, og `YearResult` fører aktieindkomst og kapitalindkomst pr. `Person`, aldrig som husstandssum.

Grunden er aftrapningsgrundlaget. Pensionslovens § 29 tæller aktieindkomst og positiv kapitalindkomst med i grundlaget, men hverken aldersopsparing eller afkast på en aktiesparekonto — og med varianten som eneste akse bliver `TaperBase` et opslag i en tabel med fem rækker frem for spredte betingelser i motoren. Alternativet, et selvstændigt `taxTreatment`-felt ved siden af varianten, tillader kombinationer der ikke findes, såsom en aldersopsparing beskattet som kapitalindkomst, og gør dermed beskatningen til noget der skal valideres frem for noget der er umuligt at skrive forkert.

Personniveauet er nødvendigt, fordi det samme tal aggregeres på to uforenelige måder. Skatten summerer aktieindkomsten over husstanden, fordi progressionsgrænsen mellem 27 % og 42 % er fælles og overførbar mellem ægtefæller; aftrapningen bruger derimod persongrundlaget, fordi ægtefællens indkomst kun indgår med 54 % bortseelse. En gemt husstandssum kan ikke splittes tilbage, og feltet findes derfor ikke.

## Konsekvenser

`FreeAssets` overlever som glossarterm for kategorien — buffer- og overførselsreglerne taler om begge varianter under ét — men er ikke længere et navn motoren kan instantiere. Et blandet virkeligt depot med både aktier og obligationer må modelleres som to beholdninger; det følger allerede af [ADR-0003](./0003-fast-afkast-pr-beholdning.md), som forbyder aktivallokering inden i én beholdning.

Varianterne er opkaldt efter skattespanden og ikke efter aktivet, så `ShareIncome` optræder både som variantnavn og som feltnavn på `YearResult`. Det er tilsigtet: navnet siger, hvilket felt afkastet lander i.

Begge dele sidder i det gemte skema. Ændres de senere, kræver det et led i migrationskæden — det er prisen for at træffe valget nu frem for i etape 3, hvor aftrapningen først bliver synlig.

## Se også

- [Diagram: Domænemodellen](../diagrams/01-domaenemodel.md) — `variant`-feltet og hele varianttabellen.
- [ADR-0004](./0004-frie-midler-pr-person-med-udpeget-buffer.md) — hvorfor frie midler i forvejen ejes pr. person.
- [ADR-0015](./0015-livrenten-er-en-sjette-variant-ikke-en-underklasse.md) — afløser denne på antallet af varianter; aksen og persongrundlaget står uændret.
- [ADR-0017](./0017-beholdningen-hedder-hvad-den-er-ikke-hvad-dens-afkast-bliver-til.md) — afløser denne på de to frie varianters navne; aksen og persongrundlaget står uændret.
