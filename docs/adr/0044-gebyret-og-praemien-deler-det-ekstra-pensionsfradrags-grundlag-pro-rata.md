# Gebyret og præmien deler det ekstra pensionsfradrags grundlag pro rata

[ADR-0043](./0043-gebyret-og-praemien-deler-fradragsretten-men-ikke-det-ekstra-pensionsfradrags-grundlag.md) delte en `PensionAgreement`s `Fee` og `InsurancePremium` i to virkninger: de nedsætter den personlige indkomst uanset destination, men de er kun med i grundlaget for det ekstra pensionsfradrag efter LL § 9 L, når pengene går ind i en ordning, der er omfattet af PBL § 18 eller § 19. Dengang havde fordelingen præcis én linje, og svaret var derfor destinationens eget. Den ADR skrev selv, at spørgsmålet stod åbent, når fordelingen fik flere linjer med hver sin variant — og det har den nu.

De to beløb trækkes af den samlede indbetaling, før fordelingen møder den. De har ingen destination af sig selv, og delingen kan derfor ikke aflæses noget sted; den skal afgøres. Prøvet på en løn på 400.000 kr., et arbejdsgiverbidrag på 15 %, 4.800 kr. i AM-bidrag og 6.000 kr. i gebyr og præmie, hvor de 49.200 kr., der er tilbage, deles ligeligt mellem en ratepension og en aldersopsparing:

| Deling | § 9 L-grundlag | Fradraget ved 12 % |
|---|---|---|
| Pro rata efter det landede beløb | 27.600 | 3.312 |
| Alt eller intet: kun når hver destination bærer fradragsretten | 24.600 | 2.952 |
| Alt, når bare én destination bærer den | 30.600 | 3.672 |

**Pro rata.** De to yderpunkter lader den sidste krone afgøre hele grundlaget for de 6.000: 1 kr. til en aldersopsparing koster planlæggeren hele beløbet i det ene, og 1 kr. til en ratepension giver hende det hele i det andet. Ingen af de to spring findes i virkeligheden, og de ville begge være usynlige på skærmen — fradraget ville flytte sig, uden at noget felt, planlæggeren rørte, kunne gøre rede for hvorfor. Pro rata flytter sig derimod jævnt med den fordeling, hun selv har skrevet.

Andelen måles på det, destinationerne **fik**, og ikke på det, deres andele bad om. Et magert år, hvor en kronelinje blev afkortet, flyttede rigtige penge, og det er de penge, § 9 L måler på. Er der intet placeret at måle med — gebyret og præmien tog det hele — er andelen nul; der er da heller ingen indbetaling at give et fradrag for.

Fradragsretten selv rører det ikke. Den følger de to beløb uanset destination, præcis som ADR-0043 fastslog, og den er stadig ét tal, der krydser skattesømmet ved siden af grundlaget.

## Konsekvenser

`deductibleShareOf` afløser den `every`, ADR-0043 efterlod i motoren som en midlertidig ret på en fordeling, der kun kunne have én linje.

Delingen flytter fortsat ingen viden ind over skattesømmet: andelen regnes på motorens side, og skatteopgørelsen ser stadig kun to færdige summer og aldrig en `HoldingVariant`.

## Se også

- [ADR-0043](./0043-gebyret-og-praemien-deler-fradragsretten-men-ikke-det-ekstra-pensionsfradrags-grundlag.md) — delingen i to tal, og spørgsmålet denne besvarer
- [ADR-0042](./0042-forsikringspraemien-er-en-udgift-med-en-skattevirkning.md) — hvorfor de to hører til aftalen og ikke til `Entry`
- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — at skattevirkningen følger destinationens variant
- [ADR-0014](./0014-hele-husstandens-skat-bag-eet-soem.md) — sømmet, de to tal krydser
