# Forsikringspræmien er en udgift med en skattevirkning

En `PensionAgreement`s `InsurancePremium` køber en risikodækning. Pengene forlader husstanden og bliver aldrig til formue, og balanceinvarianten `closingWealth − openingWealth = income + return − tax − expenses − conversion` har derfor kun ét led tilbage til dem. Præmien er en udgift, og det er ikke et valg.

Samtidig har den bortseelsesret som resten af § 19-indbetalingen og nedsætter den personlige indkomst. Den kombination kan `Entry` ikke skrive: unionen er diskrimineret på `direction`, og udgiftsgrenen bærer ingen `TaxTreatment` — *"en udgiftspost med en skattebehandling er ikke noget, motoren skal validere sig ud af — den kan ikke skrives."*

Det ligner en grund til at åbne unionen. Det er det ikke. Et `taxTreatment` på udgiftsgrenen ville tillade en `EarnedIncome`-udgift og en skattefri udgift, og det er præcis den konstruktion, [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) afviste for beholdningen og [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) for indbetalingen: et felt ved siden af den akse, der faktisk bestemmer, tillader kombinationer, der ikke findes, og gør dermed noget uskriveligt til noget, der skal valideres.

Præmien er i stedet en del af `PensionAgreement` og ingen `Entry`. Den nedsætter den personlige indkomst ad den vej, indbetalingerne allerede går — summen af det, der bærer `Deductibility` — og den forlader `expenses` uden at have en destination. `Fee` opfører sig ens og af samme grund.

Det, der gør det holdbart, er, at fradragsretten ikke er præmiens eget felt. Den følger, ligesom en indbetalings, af hvad pengene er en del af, nemlig en § 19-indbetaling. En præmie uden for en pensionsaftale findes ikke i modellen, og der er derfor ingen kombination at vælge forkert. Aksen er den samme som altid; det er blot en anden figur, der bærer den.

## Konsekvenser

Årstabellens Udgifter-kolonne vokser med præmien og gebyret, uden at der står en udgiftspost bag dem. Kolonnens forklaring skal sige det — ellers er der et tal på skærmen, planen ikke kan gøre rede for.

Overskudsbåndene er urørte. `ExpenseEntries` regnes af `year.entries` og ikke af `year.expenses`, så præmien kan ligge i `Contributions`-båndet, hvor den rent faktisk forlader bufferen, uden at de to kommer i konflikt.

Præmien måles ikke mod noget loft og trækkes før fordelingen: risikodækningen er en anden ordning end den, loftet gælder. Det gør fordelingsgrundlaget en anelse mindre, end pensionsselskabet ville indberette, og forskellen er accepteret — alternativet er to grundlag gennem hele fordelingen, ét til lofterne og ét til saldiene.

Bliver der en dag brug for en udgift med en skattevirkning uden for en pensionsaftale, er dette ikke præcedensen for at give `Entry` et felt. Det er præcedensen for at lade den figur, udgiften hører til, bære sit eget regnestykke.

## Se også

- [ADR-0041](./0041-pensionsaftalen-baerer-sit-eget-regnestykke-i-aarsresultatet.md) — aftalens regnestykke, som præmien står i
- [ADR-0010](./0010-beskatningsformen-er-variantens-akse-og-indkomsten-foeres-pr-person.md) — hvorfor et felt ved siden af den bestemmende akse er den forkerte konstruktion
- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — samme afvisning, dengang for indbetalingens skattevirkning
- [ADR-0026](./0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md) — hvad der bevæger sig på bufferen, og hvad der ikke gør
