# Bevidst udskudt

Ting vi har undersøgt, forstået og valgt ikke at bygge endnu. Ikke en backlog af idéer — en liste over beslutninger, så de ikke skal tages forfra.

## Pensionsindbetalingens skattevirkning

**Status:** Udskudt til etape 2, hvor `Contribution` og pensionsbeholdningerne bygges. Det ekstra pensionsfradrag regnes allerede — det er indbetalingens *anden* skattevirkning, der mangler.

**Hvorfor det betyder noget:** En indbetaling til en ratepension eller en livrente holdes uden for den personlige indkomst: bortseelsesret for den arbejdsgiveradministrerede ordning, fradrag i personlig indkomst for den private. Med 700.000 kr. i bruttoløn og 105.000 kr. i bidrag falder den personlige indkomst fra 644.000 til omkring 547.400 kr., mens AM-bidraget stadig betales af hele bruttolønnen. Den virkning er langt større end det ekstra pensionsfradrag på 12/32 %, og en skatteopgørelse for et indbetalende år er derfor for høj, indtil den er bygget.

**Hvad der skal bygges, når det tages op:** `Contribution` som figur på planen, jf. [ADR-0007](./adr/0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md), bortseelsesretten i skatteopgørelsen, og ratepensionens fradragsloft på 68.700 kr. med behandling af det overskydende. Facitcasen *pensionsindbetalende arbejdsår* i `src/engine/tax/testing/workedExamples.ts` siger selv, at den kun dækker fradragene, og skal regnes om samtidig.

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
