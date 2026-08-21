# Graferne står i tre faste pladser, og en mini-graf bytter sig ind ved klik

Overskudsgrafen var ét React-komponent med to paneler over samme x-akse — den stablede fordeling af de otte `SurplusBand`, og søjlen med `Surplus` selv, jf. [ADR-0026](./0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md). De to bliver nu til to selvstændige grafer, **Fordelingen** og **Overskuddet**, der sammen med **Formuen** står i et fast graf-lag: én hovedgraf øverst, to mini-grafer side om side nedenunder. Alle tre er synlige samtidig, hvor resultatspaltens tre faner før viste kun én ad gangen. Årsagen er dobbelt: at kunne se alle tre på én gang, og at få plads til et kommende tidslinjeværktøj under dem.

Klikker man en mini-graf, bytter den plads med hovedgrafen — den anden mini rører sig ikke. De to mini-pladser har derfor ingen egen identitet; kun de tre grafer har. En mini-graf har hverken akse eller signaturforklaring, kun formen — et præcist tal kræver, at grafen først byttes frem som hovedgraf. Kun hovedgrafen bærer en signaturforklaring, og den følger med grafen, når den bytter plads.

Resultatspaltens omskifter indskrænkes fra tre faner til to: **Planlæggeren** (de tre grafer og tidslinjeværktøjet) og **Årstabellen**.

ADR-0026 står uændret: grunden til at `Surplus` har sin egen skala, adskilt fra båndene, er stadig at et fortegnsskift i én størrelse forsvinder i en stabling af mange kategorier. Det, der ændrer sig her, er formen alene — to paneler i én graf bliver til to grafer i ét lag.

## Se også

- [ADR-0026](./0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md) — hvorfor `Surplus` har sin egen skala
- [ADR-0011](./0011-formuegrafen-tegnes-i-raat-svg-med-d3-scale-og-d3-shape.md) — råt SVG med `d3-scale`/`d3-shape`, som graf-laget fortsat bygger på
- `CONTEXT.md` — opslagene `Surplus` og `SurplusBand`
- `docs/mockup/README.md` — kravene til grafbiblioteket, som graf-laget fortsat skal opfylde
