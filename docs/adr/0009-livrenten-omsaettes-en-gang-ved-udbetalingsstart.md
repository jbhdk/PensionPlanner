# Livrenten omsættes én gang ved udbetalingsstart

Livrenten er en `Holding` i opsparingsfasen: den modtager indbetalinger, forrentes og betaler PAL som enhver anden beholdning. Ved udbetalingsstart omsættes depotet én gang til en garanteret livsvarig ydelse med en `ConversionFactor` — selskabets oplyste årlige ydelse divideret med dets oplyste depot på samme tidspunkt — og derefter er ydelsen fast og reguleres kun med en bonusantagelse.

Modellen antager gennemsnitsrente, hvor den årlige ydelse er garanteret. Netop derfor er der ingen aldersprofil at skalere efter: PRD'ens oprindelige "indbyggede dødelighedsafledte profil" var et opfundet tal uden kilde i et værktøj, hvor alt andet har en kilde-URL. Markedsrente er udskudt, se [docs/udskudt.md](../udskudt.md).

## Konsekvenser

Depotet må ikke fjernes fra opsparingsfasen, selvom ydelsen er garanteret. Uden det ville livrenten ikke reagere på `workEndAge` — otte års manglende indbetalinger ville ikke sænke den livsvarige ydelse, og scenariesammenligningen, som er hele værktøjets formål, ville være forkert på den længstløbende indkomststrøm i planen.

Begge tal i omsætningsfaktoren står på pensionsoverblikket, så faktoren er efterprøvelig. `Duration` og `principle` på livrentens udbetalingsplan er uden betydning: den er livsvarig.
