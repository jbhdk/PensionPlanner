# Hovedgrafens markør følger musen og snapper til året, og Formuen opgiver sin egen valgmekanik

Graf-laget fra ADR-0033 til -0035 lader et klik på et år i Overskuddet eller Fordelingen springe direkte til den fulde `YearExplanation` — der er intet mellemtrin, og Formuen har slet ingen års-interaktion, kun et legend-klik der vælger en beholdning og dæmper de andre bånd. Det giver ingen let vej til at se ét års tal uden enten at forlade graf-laget helt eller selv aflæse det af stablingens højde.

Hovedgrafen — uanset hvilken af de tre den lige nu er, jf. ADR-0033 — får derfor en lodret stiplet markør, af samme slags som milepælene og bufferspændets kanter allerede tegner. Markøren følger musen og snapper til det nærmeste år; der er intet klik og intet træk for at placere den. Så længe musen står over et år i plottet, viser et fast dataglimt i øverste højre hjørne det års tal for netop den graf, der er hovedgraf: Formuens beholdninger med en sum-linje, Fordelingens otte faste bånd, eller Overskuddets ene tal. Glimtet står i et fast hjørne og ikke klæbet til musen, fordi Formuens ni linjer ellers næsten garanteret ville dække det bånd, de beskriver — samme begrundelse, der allerede holder bufferspændets mærkatplade og aksemærkaterne væk fra dataene. Alle linjer vises, også dem på 0 kr., som en første udgave; bliver boksen for høj i praksis, tages filtrering op igen. Mini-graferne får en tynd, rent visuel ekko af markørens x-position, uden eget dataglimt — de har hverken akse eller legend i forvejen, jf. ADR-0033, og et præcist tal dér ville love en læsbarhed, pladsen ikke har.

Det eksisterende klik — spring til `YearExplanation` — ændres ikke på Overskuddet og Fordelingen, og udvides til Formuen, så alle tre grafer nu opfører sig ens på det punkt. Til gengæld mister Formuen sin nuværende legend-klik og sin lytning til valg sat andre steder i fladen (Navigatoren, Tidslinjen): en beholdning valgt i Navigatoren dæmpede før de andre bånd i Formuegrafen, men den krydsreference forsvinder nu sammen med selve valgmekanikken. Legenden bliver stående som en ren, ikke-klikbar farve-navn-liste — dataglimtet overtager ikke navngivningen alene, for det er kun synligt, mens musen er over grafen.

## Se også

- [ADR-0033](./0033-graferne-staar-i-tre-faste-pladser-en-mini-bytter-sig-ind-ved-klik.md) — de tre faste pladser og byt-ved-klik, som hovedgraf/mini-graf-skellet her bygger videre på
- [ADR-0034](./0034-hovedgrafen-har-fast-hoejde-og-mini-graferne-staar-i-en-soejle-til-hoejre.md) — graf-lagets faste ramme, som markøren og dataglimtet tegnes inden i
- [ADR-0011](./0011-formuegrafen-tegnes-i-raat-svg-med-d3-scale-og-d3-shape.md) — råt SVG med `d3-scale`/`d3-shape`, som markøren og dataglimtet fortsætter i
- [ADR-0026](./0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md) — hvorfor `Surplus` og `SurplusBand` er to grafer med hver sin skala, som dataglimtets indhold følger
- `CONTEXT.md` — opslagene `Surplus`, `SurplusBand` og `Holding`
- `src/ui/chartFrame.tsx` — grafernes fælles ramme, hvor markøren og dataglimtet hører hjemme ved siden af `KroneAxisMarks`/`YearAxisMarks`
- `src/ui/WealthChart.tsx`, `src/ui/SurplusChart.tsx`, `src/ui/SurplusBandsChart.tsx` — de tre grafer, ADR'en retter sig mod
- `src/ui/selection.ts` — `Selection`/`Target`, som Formuen opgiver at lytte til med denne ADR
