# Måneden er en afkastvægt, ikke et tidsskridt

Pengestrømme falder ikke 31. december. Hver strøm bærer derfor et `Timing` — enten jævnt fordelt over årets måneder eller i én bestemt måned — som oversættes til en vægt, og årets afkast beregnes på den vægtede gennemsnitssaldo efter Modified Dietz: `afkast = nettoafkastsats × (primosaldo + Σ vægt × strøm)`. Motoren skridter fortsat i hele år.

Alternativet — at simulere måned for måned — blev fravalgt. Gevinsten er forsvindende: 100.000 kr. indbetalt månedligt ved 7 % afkast giver 103.160 kr. med ægte månedlig rentesrente mod 103.208 kr. med vægten. Prisen ville være, at hver eneste regel skulle svare på, hvad den gør midt i et år, og alt det svære er årligt af lov — skatteopgørelsen, PAL, fradragslofterne, aftrapningen af pensionstillæg og selve rateberegningen, der udtrykkeligt bygger på saldoen ved årets begyndelse.

## Konsekvenser

Jævnt fordelte strømme får vægt ½, hvilket er det matematisk rigtige for månedlige indbetalinger og udbetalinger — ikke en tilnærmelse. Måneden er kun pengene værd for klumpede beløb: et boligsalg, et nyt tag, en `Transfer`. En overførsel på 800.000 kr. i februar frem for i november er cirka 23.000 kr. i afkastforskel ved 7 %.

Rækkefølgen i motoren ændrer sig som følge: alle årets strømme skal være kendt, før afkastet kan beregnes. Det opløser til gengæld to tidligere åbne spørgsmål — raten regnes altid af primosaldoen, fordi det er en lovregel, og PAL-skatten regnes altid af årets faktiske afkast. Se [diagram 02](../diagrams/02-simuleringsaaret.md).

## Se også

- [ADR-0024](./0024-gennemloebet-forrenter-sig-ikke-og-afkastet-krediteres-foer-aarets-drift.md) — indsnævrer denne på to punkter. Vægten er en egenskab ved strømmens **ende** og ikke ved strømmen selv: på bufferen, som er husstandens transaktionskonto, vejer en jævn strøm nul, mens afgiverens ende beholder sin. Og det er de **daterede** bevægelser og ikke alle årets strømme, der skal være kendt, før afkastet kan beregnes. Selve påstanden — at måneden er en vægt og ikke et tidsskridt, og at en dateret klump er pengene værd — står uændret.
