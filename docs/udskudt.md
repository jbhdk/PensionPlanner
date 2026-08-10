# Bevidst udskudt

Ting vi har undersøgt, forstået og valgt ikke at bygge endnu. Ikke en backlog af idéer — en liste over beslutninger, så de ikke skal tages forfra.

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

## Sammenligning af flere planer side om side

**Status:** Afvist, ikke udskudt. Tegnet i fladekortets `#sammenlign` og forkastet dér.

**Hvorfor:** Den koster en tilstand i resultatspalten — grafen skal kunne bære flere serier af samme slags oven i hinanden — og den efterlader et ubesvaret spørgsmål om, hvad planspalten viser, mens to planer er fremme. Til gengæld svarer den ikke på mere, end to browserfaner gør: en plan er en selvstændig fil, ikke en variant af en fælles kerne, og to af dem kan stå ved siden af hinanden uden at værktøjet gør noget særligt.

**Konsekvens:** Planvælgeren i topbjælken bliver — man skifter mellem planer, man ser dem ikke samtidig. Grafbiblioteket skal ikke kunne stable flere sæt serier, hvilket fjerner et krav fra [#18](https://github.com/jbhdk/PensionPlanner/issues/18). Ordene fra `#sammenlign` skal aldrig gennem glossaret.

## PensionsInfo-import

**Status:** Afvist, ikke udskudt. Undersøgt og lukket.

**Hvorfor:** Adgang kræver MitID, der findes ingen offentlig API for privatpersoner, og de eksisterende B2B-integrationer er forbeholdt regulerede finansielle virksomheder. En SPA uden backend kan ikke autentificere mod MitID uanset. Den eneste farbare vej ville være lokal parsing af den downloadede PDF med pdf.js — fravalgt, fordi 6-10 poster opdateres én gang om året.
