# Inspektørskuffen er en fast tredje spalte, ikke et lag der glider ind

`docs/mockup/README.md` vejede tre udgaver af navigatoren mod hinanden — B1 og B2 med fast inspektørspalte, B3 med en skuffe, der glider hen over resultatet ved valg — og landede på B3, netop fordi den fulde spalte koster grafen omkring en tredjedel af sin bredde permanent. Den beslutning ændres nu: skuffen bliver en fast tredje spalte i `.spalter`s grid, ved siden af navigatoren og resultatspalten, og står synlig hele tiden.

Årsagen er brug snarere end plads. Skuffen stod i praksis åben det meste af tiden alligevel, så den smalle graf var den bredde, man vænnede sig til — og B3s glidende variant viste sig at have sin egen pris: en absolut positioneret boks retter sig ikke selv ind efter grid'ets kolonner, og lagde sig et par pixels ind over mini-graferne, når den åbnede oven på det nye graf-lag fra ADR-0034. En fast spalte kan ikke overlappe noget, den står ved siden af — problemet forsvinder med årsagen.

Skuffen viser nu planens egne felter (`selected.kind === 'plan'`), når intet andet er valgt — den kan ikke længere stå tom, og har derfor altid noget at vise. Klikker man en anden linje i navigatoren, skifter den til den; luk-knappen (×) fører tilbage til planens felter i stedet for at skjule spalten, som den ikke længere kan.

## Se også

- [ADR-0034](./0034-hovedgrafen-har-fast-hoejde-og-mini-graferne-staar-i-en-soejle-til-hoejre.md) — graf-laget, hvis mini-grafer skuffen tidligere lagde sig ind over
- `docs/mockup/README.md` — B1/B2/B3-sammenligningen, som denne ADR afgør til fordel for den faste spalte
