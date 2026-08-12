# Livrenten er en sjette variant, ikke en underklasse

`HoldingVariant` udvides fra fem til seks værdier med `LifeAnnuity`, og `Holding` bliver en diskrimineret union på `variant`, hvor livrentens medlem bærer omsætningsfelterne. [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md)'s "lukket sæt på fem" er dermed afløst på antallet — men ikke på sin egentlige påstand, som står uændret: varianten er aksen, der findes ikke et `taxTreatment`-felt ved siden af den, og indkomsten føres pr. person.

[Diagram 01](../diagrams/01-domaenemodel.md) tegnede livrenten som en underklasse af `Holding`. "Underklasse" er et UML-ord, og modellen er en ren datatype uden klasser: det tætteste, sproget har, er et medlem af en diskrimineret union, og diskriminanten ville netop være `variant`. Underklassen *er* den sjette værdi, skrevet i det sprog koden faktisk er i.

Prisen skal siges højt, for den rammer ADR-0010 i dens begrundelse. Varianterne er opkaldt efter skattespanden og ikke efter aktivet, og livrenten deler spand fuldstændigt med `InstalmentPension`: `HoldingTax` med PAL-satsen på afkastet, personlig indkomst ved udbetaling, med i `TaperBase`. `LifeAnnuity` er altså den første variant, der er opkaldt efter produktet, og den første, hvor to varianter deler en skatterække.

Det, der faktisk skiller dem, er udbetalingsformen — og loftet følger den akse frem for skatteaksen. Pensionsbeskatningslovens § 16 lægger fradragsloftet på ratepension og *ophørende* alderspension, altså ordninger med en tidsbegrænset udbetaling; den livsvarige ordning bærer det ikke. Forskellen er derfor reel, men den ligger ikke der, hvor `variant` påstår at måle.

Alternativet var at give pensionsbeholdningerne en anden akse: en udbetalingsform ved siden af varianten, hvor loftet og omsætningen begge kunne hænge. Det er præcis den konstruktion, ADR-0010 afviste. Et felt ved siden af varianten tillader kombinationer, der ikke findes — en `ShareIncome`-beholdning med livsvarig udbetalingsform — og gør dermed noget, der burde være uskriveligt, til noget der skal valideres. Prisen ved den sjette variant er, at ét opslag får seks rækker i stedet for fem. Prisen ved den anden akse er en valideringsregel, der aldrig bliver færdig.

## Konsekvenser

Varianttabellen får en `LifeAnnuity`-række, der er identisk med `InstalmentPension`s på afkast, udbetaling og `TaperBase`, og som adskiller sig på loftet alene. To ens rækker er ikke en dublet, der skal foldes sammen: de er ens i dag, og de er ens af hver sin grund.

Felterne lander i det gemte skema ad to omgange og koster to led i migrationskæden. Etape 2 tilføjer værdien `LifeAnnuity` uden ekstra felter, fordi opsparingsfasen ikke har brug for dem; etape 3 tilføjer `quotedAnnualBenefit`, `quotedReserve` og `bonusRate` sammen med omsætningen. Alternativet — at lægge omsætningsfelterne ind nu og lade dem stå ubrugte — er værre: et dødt felt i et gemt skema er en løgn, der aldrig fejler.

Hjemlen for, at den arbejdsgiveradministrerede livsvarige ordning er uden årligt loft, skal stå i satsåret med kilde, før den bliver til kode — som ethvert andet tal i `docs/satser/`. Det samme gælder behandlingen af den privattegnede livrentes fordelingsregel, som enten skal modelleres eller bevidst fravælges i `docs/udskudt.md`.

## Se også

- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — afløst på antallet af varianter, urørt på alt andet.
- [ADR-0009](./0009-livrenten-omsaettes-en-gang-ved-udbetalingsstart.md) — hvorfor depotet bliver i opsparingsfasen, og hvad omsætningsfelterne skal bruges til.
- [Diagram: Domænemodellen](../diagrams/01-domaenemodel.md) — varianttabellen og livrentens plads i den.
