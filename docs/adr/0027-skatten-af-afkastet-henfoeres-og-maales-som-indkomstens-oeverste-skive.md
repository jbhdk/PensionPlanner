# Skatten af afkastet henføres og måles som indkomstens øverste skive

`ReturnTax` er den del af husstandens egen skat, der måler på afkastet af de frie beholdninger. ADR-0026 lod årets overskud tælle afkastet ude og skatten af det med, og den efterlod dermed netop det spørgsmål, brugeren garanteret stiller: skatten er større, end de synlige indtægter forklarer. Forskellen skal kunne læses af skærmen uden at nogen trækker fra i hånden, og det kræver et tal.

Tallet kan opgøres på to måder. **Henførende** lægger de lag sammen, der måler på afkastet — aktieindkomstens to, kapitalindkomstens bidrag til bund- og topskat med sit eget loftnedslag, og kapitalindkomstens andel af kommune- og kirkeskatten. **Kontrafaktisk** regner året om uden afkastet og kalder differencen skatten af det.

Den henførende vinder, fordi den kan efterregnes. Hvert led står som sin egen linje andre steder i forklar-året, og en bruger, der ikke tror på tallet, kan finde leddene og lægge dem sammen. Det kontrafaktiske tal er en difference mellem to opgørelser, hvoraf den ene aldrig vises nogen steder — det kan kun tros. Motoren har desuden allerede truffet det tilsvarende valg: `capitalIncomeContribution` er kapitalindkomstens eget bidrag til bund- og topskat, opgjort som et lag ved siden af den personlige indkomsts og ikke som en omregning.

## Hvilken skive kapitalindkomsten er

Den henførende opgørelse har selv et valg i sig, og det er dét, der gør beslutningen svær at rulle tilbage. Kommune- og kirkeskatten måles af den skattepligtige indkomst under ét, hvor kapitalindkomsten indgår sammen med alt andet. Hvor stor en del af den skat der er afkastets, afhænger af, hvor i indkomsten kapitalindkomsten placeres.

Tag et år uden anden indkomst end afkastet: et aktiedepot på 6.000.000 til 5 % og en opsparingskonto på 2.000.000 til 3 %, i Hvidovre, med kirkeskat, på satsåret 2026.

| | Skat af afkast | Årets skat i alt |
|---|---|---|
| Fladt: hele kapitalindkomsten ganget med kommunesatsen | 137.197,50 | 123.066,58 |
| Øverste skive: kapitalindkomsten målt mod det, personfradraget lod stå | **123.066,58** | 123.066,58 |

Den flade fordeling påstår 14.130 kroner mere i skat af afkast, end husstanden overhovedet betalte i skat det år. Fejlen er ikke en afrunding: personfradraget åd den skattepligtige indkomst ned til 5.900 kroner, og den flade fordeling regner videre på 60.000, som om fradraget ikke fandtes.

Den øverste skive rammer i stedet præcis. Er der ingen anden indkomst, er hele årets skat skat af afkast, og det er også det rigtige svar. Er der løn nok til at bære personfradraget, er de to fordelinger ens, og valget koster ingenting. Placeringen er samtidig den samme, motoren allerede har givet kapitalindkomsten i bund- og topskatten, hvor den lægges oven på den personlige indkomst frem for under den.

## Konsekvenser

`ReturnTax` gemmes ikke. Den udledes af felter, der står på det samme årsresultat — aktieindkomstskattens lag, personens `capitalIncomeContribution`, og personens kapitalindkomst målt mod grundlaget og satserne i hans egne kommune- og kirkeskattelag — ganske som `Surplus` udledes af fire tal på bufferens beholdningsår. Motoren får hverken et nyt felt eller en ny beregning.

`HoldingTax` er ikke en del af tallet. Den er også skat af afkast i ordets almindelige betydning, men den bæres af beholdningen selv og trækkes af dens saldo; den passerer aldrig bufferen og indgår derfor hverken i `Surplus` eller i det, `ReturnTax` skal forklare. De to ord ligger tæt, og glossaret holder dem fra hinanden.

Tallet er husstandens og ikke personens, fordi aktieindkomstskatten er det, jf. ADR-0014. Det kan ikke deles ud på de to i husstanden og står derfor som én linje under skattebåndet i forklar-året.

## Se også

- [ADR-0026](./0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md) — beslutningen, der efterlod spørgsmålet
- [ADR-0014](./0014-skattesoemmet-er-husstandens-ikke-personens.md) — hvorfor aktieindkomstens skat ikke kan fordeles på personer
- [ADR-0012](./0012-fladen-laeser-motorens-svar-frem-for-at-gentage-udledningen.md) — hvad fladen må regne selv, og hvorfor en sum af felter fra samme række er tilladt
- `CONTEXT.md` — opslagene `ReturnTax`, `HoldingTax` og `Surplus`
