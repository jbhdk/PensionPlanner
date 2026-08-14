# Bevidst udskudt

Ting vi har undersøgt, forstået og valgt ikke at bygge endnu. Ikke en backlog af idéer — en liste over beslutninger, så de ikke skal tages forfra.

## Det ekstra pensionsfradrags modregning af udbetalinger

**Status:** Udskudt, undersøgt og belagt i [satsår 2026](./satser/2026.md). Fradragets grundlag er bygget som årets indbetalinger med `Deductibility` alene.

**Hvorfor det betyder noget:** [Ligningslovens § 9 L, stk. 2](https://danskelove.dk/ligningsloven/9l), nedsætter beregningsgrundlaget med samme indkomstårs skattepligtige udbetalinger fra pensionsordninger med løbende udbetalinger, rateforsikringer og rateopsparinger — med undtagelse af blandt andet invalidepension, ægtefælle- og samleverpension, udbetaling til efterladte og børnepension ([C.A.4.3.9](https://info.skat.dk/data.aspx?oid=2273726)). Et år, hvor husstanden både indbetaler og hæver, får dermed et mindre fradrag, end motoren regner. Reglen bider kun dér, hvor de to overlapper: i et rent indbetalende arbejdsår er der ingen udbetalinger at fragå, og i et rent udbetalende år er der intet fradrag at nedsætte.

**Prisen ved at lade den ligge:** Overlappet er ikke hypotetisk. En person, der er holdt op med at arbejde, men fortsat skyder ind på en aldersopsparing i vinduet før folkepensionsalderen, hæver typisk af ratepensionen samtidig — men netop aldersopsparingens indbetalinger giver intet fradrag at nedsætte, så dét tilfælde rammes ikke. Det, der rammes, er en delvis tilbagetrækning, hvor en løn og en rateudbetaling løber side om side. Fradraget er højst 10.536 eller 28.096 kr., og skatteværdien af det er 26 % af den; fejlen er dermed loftet til nogle få tusind kroner om året i de år, overlappet findes.

**Hvad der skal bygges, når det tages op:** Årets skattepligtige pensionsudbetalinger pr. person skal krydse skattesømmet ved siden af indbetalingen — samme gruppering som `withDeductibility`, og af samme grund et tal frem for en `HoldingVariant`. Undtagelserne i stk. 2, nr. 1-7, kræver, at en udbetaling kan kendes fra en efterladtepension, og den skelnen findes ikke i modellen i dag.

## Afgiften på indbetalinger over aldersopsparingens loft

**Status:** Fravalgt, undersøgt og belagt i [satsår 2026](./satser/2026.md). Loftet selv er bygget, jf. [ADR-0018](./adr/0018-loftet-maales-pr-person-pr-loft-og-det-overskydende-bliver-liggende.md); det er alene afgiften, der ikke er.

**Hvorfor det betyder noget:** [PBL § 25 A](https://danskelove.dk/pensionsbeskatningsloven/25a) lægger 20 % afgift på årets indbetaling over det loft, der gælder personen, 40 % hvis der er sket en diskvalificerende udbetaling, og 4 % på det beløb, der føres ud af ordningen året efter. Ratepensionens loft er derimod et skatteloft, og dets konsekvens *er* modelleret: det overskydende mister sin fradragsret og hæver årets skat.

**Prisen ved at lade den ligge:** Aldersopsparingens 20 % er en administrativ konsekvens af en fejl, ikke en pris på en plan. En plan, der år efter år skyder mere ind, end loven tillader, er en plan, der skal rettes — ikke en plan, hvis afgift skal fremskrives. Motoren markerer i stedet året som `Chargeable`, så fejlen er synlig, og lader den koste nul. Prisen er, at et brudt aldersopsparingsloft ser gratis ud i formuen; det er accepteret, fordi markeringen står i årstabellen og i forklar-årets loftlinje.

**Hvad der skal bygges, når det tages op:** Afgiften som en fjerde bærer ved siden af `TaxAssessment`, `HouseholdTaxAssessment` og `HoldingTax` — den er hverken personens, husstandens eller beholdningens afkastskat — plus de 40 %'s afhængighed af, om der er sket en udbetaling fra en ratepension eller livrente fra og med det tiende indkomstår før folkepensionsalderen. Den skelnen findes ikke i modellen i dag.

## Den privattegnede livrentes tiårsfordeling

**Status:** Fravalgt til v1, undersøgt og belagt i [satsår 2026](./satser/2026.md). Den arbejdsgiveradministrerede livrente er uden årligt loft, og det er den form, husstandens livrenter har.

**Hvorfor det betyder noget:** Hvor ratepensionen har et loft, har den privattegnede livrente en fordelingsregel. Fradraget for et engangsindskud, og for en indbetalingsperiode kortere end 10 år, skal fordeles med 1/10 om året over ti år ([PBL § 18, stk. 3 og 4](https://danskelove.dk/pensionsbeskatningsloven/18)). Alternativet er opfyldningsfradraget i stk. 5 — 63.200 kr. i 2026 — som lader hele indskuddet komme til fradrag hurtigere, når 1/10 er mindre end det beløb. Reglen bider kun to steder: ved et engangsindskud, og ved en aftalt indbetalingsperiode under ti år. Løbende indbetaling over mindst ti år efter bindende aftale giver fuldt fradrag i indbetalingsåret.

**Prisen ved at lade den ligge:** Motoren regner et år ad gangen ud fra planen. En fordelingsregel bryder med det: fradraget for årets indbetaling ville skulle huskes ni år frem, og valget mellem de to fordelinger er brugerens og ikke en konsekvens af planen. Det er et flerårigt fradragsregnskab i skatteopgørelsen, ikke en parameter — og det er hele prisen ved at bygge det.

**Hvad der skal bygges, når det tages op:** Et fradragsregnskab pr. indbetaling med restsaldo og valgt fordeling, opfyldningsfradraget som satstal i `RateYear`, og et felt på livrenten der skiller den privattegnede fra den arbejdsgiveradministrerede. Så længe kun den arbejdsgiveradministrerede findes, findes den skelnen ikke, og det er den billige del af fravalget.

## Efterladtescenarie (dødsfald)

**Status:** Udskudt til efter v1. `Person` har et slutår fra dag ét, så mekanikken kan slås til uden at rive domænemodellen op.

**Hvorfor det betyder noget:** Med 12 års aldersforskel og kvinders højere levealder er det mest sandsynlige forløb, at hustruen står alene i cirka 18 år. Ved dødsfald ophører den livsvarige livrente, ATP og folkepensionen for afdøde på én gang, mens udgifterne kun falder til omkring 70 %. Den efterlevendes folkepension skifter til enlig-sats: højere tillæg, men aftrapningsgrænsen falder fra 198.800 til 99.200 kr.

**Hvad der skal bygges, når det tages op:** Livrentens ophør og eventuel garantiperiode eller ægtefælledækning, folkepensionens enlig-satser med den lavere aftrapningsgrænse, ATP's ophør, og behandlingen af restsaldi. En billig forenkling: antag at den efterlevende overtager rateudbetalingerne og beskattes af dem som almindelig indkomst — så undgås 40 %-afgiften i det almindelige tilfælde.

**Tidsfølsomhed:** Ægtefælledækning på en livrente skal købes, før udbetalingen starter, og kan ikke tilføjes bagefter. Beslutningen skal derfor være regnet igennem inden den ældste fylder 60.

## Markedsrente-livrenter

**Status:** Udskudt. Modellen antager gennemsnitsrente, hvor den årlige ydelse er garanteret og kun ændres ved bonustildeling.

**Hvorfor det betyder noget:** En markedsrente-livrente genberegner ydelsen hvert år som depot divideret med en annuitetsfaktor, der falder med alderen. Afkastet slår derfor direkte igennem i den årlige ydelse, og en levetidsmodel bliver nødvendig. Med gennemsnitsrente er ydelsen i stedet et tal, selskabet har garanteret.

**Hvad der skal bygges, når det tages op:** En annuitetsfaktor pr. alder — Finanstilsynets levetidsbenchmark er den offentlige standard, selskaberne måles mod — diskonteret med beholdningens eget nettoafkast, plus en produkttype pr. livrente så begge former kan sameksistere. Det er en reel udvidelse af domænemodellen, ikke en parameterændring.

## Monte Carlo-simulation

**Status:** Udskudt. Afkast angives som ét fast tal pr. beholdning, jf. [ADR-0003](./adr/0003-fast-afkast-pr-beholdning.md).

**Konsekvens:** Afkastmodellen skal bygges om, når det tages op — stokastisk simulation kræver volatilitet og korrelation, som et enkelt forventet afkast ikke indeholder. Prisen er kendt og accepteret.

## Behøvsdrevne udbetalinger

**Status:** Udskudt. Motoren er plan-drevet, jf. [ADR-0002](./adr/0002-plan-drevet-motor-med-frie-midler-som-buffer.md).

**Konsekvens:** Beholdninger designes med en udbetalingsstrategi, så en prioriteret dækningsrækkefølge kan slås til pr. beholdning senere.

## Aktieindkomstgrænsen for ugifte samlevende

**Status:** Udskudt. Motoren deler progressionsgrænsen ud fra antallet af personer i husstanden og spørger ikke, om de er gift.

**Hvorfor det betyder noget:** Grænsen på 79.400 kr. er fælles og overførbar **mellem ægtefæller** ([satsår 2026](./satser/2026.md)), men en husstand er defineret som "én eller to personer der er gift **eller samlevende**" ([CONTEXT.md](../CONTEXT.md)). For et ugift samlevende par har hver person sin egen grænse, og den ubrugte del kan ikke overføres. Med 40.000 kr. hos den ene og 140.000 kr. hos den anden regner motoren 51.780 kr. i skat, hvor de rigtige tal er 10.800 + 46.890 = 57.690 kr. — knap 6.000 kr. for lidt om året, og forskellen vokser, jo skævere aktieindkomsten er fordelt.

Asymmetrien er værd at bemærke, for den går kun den ene vej: pensionstillæggets 54 % bortseelse gælder efter § 49 både en ægtefælle **og** en samlever, så aftrapningen er rigtig i begge tilfælde. Det er alene aktieindkomstens grænse, der kræver en vielsesattest.

**Hvad der skal bygges, når det tages op:** Et civilstandsbegreb på husstanden — ikke `CivilStatus` fra satsåret, som er pensionstillæggets aftrapningsakse (`Single` / `WithNonPensioner` / `WithPensioner`) og siger noget helt andet. Grænsen i `assessHousehold` bliver da husstandens egen frem for `persons.length`, jf. [ADR-0014](./adr/0014-skattesoemmet-er-husstandens-ikke-personens.md). Feltet lander i det gemte skema og kræver et led i migrationskæden.

## Sammenligning af flere planer side om side

**Status:** Afvist, ikke udskudt. Tegnet i fladekortets `#sammenlign` og forkastet dér.

**Hvorfor:** Den koster en tilstand i resultatspalten — grafen skal kunne bære flere serier af samme slags oven i hinanden — og den efterlader et ubesvaret spørgsmål om, hvad planspalten viser, mens to planer er fremme. Til gengæld svarer den ikke på mere, end to browserfaner gør: en plan er en selvstændig fil, ikke en variant af en fælles kerne, og to af dem kan stå ved siden af hinanden uden at værktøjet gør noget særligt.

**Konsekvens:** Planvælgeren i topbjælken bliver — man skifter mellem planer, man ser dem ikke samtidig. Grafbiblioteket skal ikke kunne stable flere sæt serier, hvilket fjerner et krav fra [#18](https://github.com/jbhdk/PensionPlanner/issues/18). Ordene fra `#sammenlign` skal aldrig gennem glossaret.

## PensionsInfo-import

**Status:** Afvist, ikke udskudt. Undersøgt og lukket.

**Hvorfor:** Adgang kræver MitID, der findes ingen offentlig API for privatpersoner, og de eksisterende B2B-integrationer er forbeholdt regulerede finansielle virksomheder. En SPA uden backend kan ikke autentificere mod MitID uanset. Den eneste farbare vej ville være lokal parsing af den downloadede PDF med pdf.js — fravalgt, fordi 6-10 poster opdateres én gang om året.
