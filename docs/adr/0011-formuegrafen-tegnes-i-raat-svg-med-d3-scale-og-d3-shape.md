# Formuegrafen tegnes i råt SVG med d3-scale og d3-shape, ikke Recharts

Spiket i [#18](https://github.com/jbhdk/PensionPlanner/issues/18) afprøvede begge kandidater med kode, mod de tre krav, der reelt skiller dem: et stablet areal floored ved nul, en tonet baggrundsmarkering af et årsspænd bag serierne, og en graf, der tegnes om, når containeren skifter størrelse — ved vinduesskift og ved skuffens åbning og lukning. Begge kandidater opfylder alle tre lige godt. Recharts' `ResponsiveContainer` og en håndrullet `ResizeObserver`-hook reagerer begge korrekt på en breddeændring fra 1074 px til 754 px; en `ReferenceArea` sat før `Area`-elementerne i Recharts, og en `<rect>` sat før `<path>`-elementerne i råt SVG, maler begge båndet bagved stablingen — bekræftet ved at læse den fulde DOM-malerækkefølge, ikke kun det umiddelbare børneled.

Det, der skiller dem, er bundtstørrelsen — det fjerde krav i #18. Målt som forskellen til en identisk baseline (React, ReactDOM og de samme 55×9-datapunkter, ingen graf: 216 kB / 66,4 kB gzip):

| Kandidat | Ekstra, minified | Ekstra, gzip |
|---|---|---|
| Råt SVG + `d3-scale` + `d3-shape` | 29,8 kB | 11,5 kB |
| Recharts | 351,0 kB | 102,1 kB |

Recharts koster ni gange så meget som råt SVG for præcis den samme graf. Det stemmer med, at Recharts trækker `react-smooth`, `d3-interpolate`, `decimal.js` og en vendoret d3-underskov med ind, uanset at kun `AreaChart`, `Area`, `ReferenceArea` og `ResponsiveContainer` bruges — biblioteket er ikke tree-shakeable nok til, at den ubrugte funktionalitet forsvinder. `d3-scale` og `d3-shape` importeret direkte er det, de bruges til, og intet andet.

Spiket brugte rigtige tal — `simuler('uholdbar')` fra `docs/mockup/plan.js`, 55 år × 9 beholdninger på satsår 2026 — og gengav de samme to spænd, mock-uppen selv viser: ufuldstændig fra 2055, uholdbar fra 2059. Selve spike-koden er engangskode uden for repoet, jf. #18; kun denne konklusion overlever.

## Prisen ved at gulve bufferen ved nul

Når en beholdnings værdi floores til `max(0, v)` før stablingen, er stablens overkant ikke længere formuen i de år, bufferen er tom eller i minus — den overvurderer med præcis det, bufferen mangler. Det er en bevidst byttehandel, afgjort i #18 inden spiket: en tom buffer er et hul i planen, ikke en beholdning med negativ udstrækning, og hullet vises i stedet som det tonede spænd bag stablingen. Tabellen har det rigtige tal; grafen viser hvornår og markerer det, den ikke selv kan tegne.

## Konsekvenser

Skalering (`x`/`y`), stabling og areal-generering hentes fra `d3-scale`/`d3-shape`; selve SVG-opmærkningen, resize-håndteringen og klik-til-år skrives i egen kode, som fladekortets `flade.js` allerede har vist formen på — men `flade.js` er stadig ikke forlæg for koden, kun for kravene, jf. `docs/mockup/README.md`.

Mærkaterne på de tonede spænd kan støde sammen, når to spænd ligger få år fra hinanden — synligt i spikets uholdbare variant, hvor det fireårige "ufuldstændig"-spænd og det efterfølgende "uholdbar"-spænd ligger side om side. Ingen af kandidaterne løser det automatisk; begge skal bruge den samme trappe-logik, `flade.js` allerede har (`etageM`). Det er ikke et biblioteksvalg og hører hjemme i selve implementeringen af #12, ikke i denne ADR.

## Se også

- [#18](https://github.com/jbhdk/PensionPlanner/issues/18) — spiket, kravene og de to bortfaldne krav
- [#12](https://github.com/jbhdk/PensionPlanner/issues/12) — formuegrafen, som denne beslutning låser op for
- [#13](https://github.com/jbhdk/PensionPlanner/issues/13) — forklar-året, hvor klik-på-år-koblingen bruges
- `docs/mockup/README.md`, afsnittet **Kravene til grafbiblioteket**
- `docs/mockup/flade.js`, `tegnFormuegraf()` — kravenes form, ikke koden
