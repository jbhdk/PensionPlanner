# Gebyret og præmien deler fradragsretten, men ikke det ekstra pensionsfradrags grundlag

En `PensionAgreement`s `Fee` og `InsurancePremium` nedsætter den personlige indkomst. De er en del af § 19-indbetalingen, og hele den har bortseelsesret — også den del, selskabet siden bruger på en risikodækning eller på sin egen administration, jf. [ADR-0042](./0042-forsikringspraemien-er-en-udgift-med-en-skattevirkning.md).

Motoren førte indtil nu ét tal over skattesømmet til begge de virkninger, en indbetaling har. `TaxAssessmentInput.contribution.withDeductibility` blev både holdt uden for den personlige indkomst og brugt som grundlag for det ekstra pensionsfradrag efter LL § 9 L, og `docs/satser/2026.md` gjorde det til en pointe: *"Grundlaget for det ekstra pensionsfradrag er dermed de samme indbetalinger, som har `Deductibility`."*

De to beløb knækker den identitet. Fradragsretten følger dem uanset destination, hvor grundlaget ikke gør: aldersopsparingen er hverken fradragsberettiget efter PBL § 18 eller bortseelsesberettiget efter § 19, og en aftale, hvis penge går derind, har intet grundlag efter § 9 L — heller ikke for de to beløb, der alligevel nedsatte indkomsten. Prøvet på de to destinationer med en løn på 400.000 kr., 60.000 kr. i bidrag, 4.800 kr. i AM-bidrag og 6.000 kr. i gebyr og præmie:

| Destination | Landede | Uden for personlig indkomst | § 9 L-grundlag |
|---|---|---|---|
| Ratepension, livrente | 49.200 | 55.200 | 55.200 |
| Aldersopsparing | 49.200 | 6.000 | 0 |

Ét tal kan ikke sige begge linjer. Sattes det til 55.200 for begge, ville en ren aldersopsparingsaftale få et fradrag på 32 % af 6.000 kr., den ikke har; sattes det til 49.200 for begge, ville ratepensionens grundlag mangle den del af § 19-indbetalingen, selskabet selv indberetter. `contribution` bærer derfor to beløb, og `extraPensionAllowanceBase` er det ene af dem.

Delingen flytter ikke viden ind over sømmet. Skatteopgørelsen ser fortsat aldrig en `HoldingVariant` — hvilke indbetalinger der er hvad, opgøres på motorens side og krydser som to færdige summer, ganske som `withDeductibility` altid har gjort. Det er samme snit som før, blot med et tal mere.

## Konsekvenser

`docs/satser/2026.md` skrev, at motoren fører ét tal og ikke to. Sætningen er rettet samme sted; afsnittet om *hvilke* indbetalinger der er i grundlaget står urørt, for det er stadig sandt om ordningerne.

Fordelingen har præcis én linje, så længe `Remainder` er `AllocationShare`s eneste form. Får den flere linjer med hver sin variant, skal delingen af gebyret og præmien mellem et fradragsberettiget og et ikke-fradragsberettiget grundlag afgøres — den falder ikke ud af noget, der står her.

Det ekstra pensionsfradrags grundlag har sit eget maksimum på 87.800 kr. (2026). Det måler nu det ene af de to tal, og et loft, der ikke bandt før, kan derfor godt binde efter — men kun i den retning, hvor grundlaget voksede.

## Se også

- [ADR-0042](./0042-forsikringspraemien-er-en-udgift-med-en-skattevirkning.md) — hvorfor de to hører til aftalen og ikke til `Entry`
- [ADR-0041](./0041-pensionsaftalen-baerer-sit-eget-regnestykke-i-aarsresultatet.md) — aftalens regnestykke, hvor de to står hver for sig
- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — at skattevirkningen følger destinationens variant, som er dét, der skiller de to tal
- [ADR-0014](./0014-hele-husstandens-skat-bag-eet-soem.md) — sømmet, de to tal krydser
