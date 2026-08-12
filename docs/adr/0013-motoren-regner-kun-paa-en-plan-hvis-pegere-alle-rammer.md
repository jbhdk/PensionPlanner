# Motoren regner kun på en plan, hvis pegere alle rammer

En `Plan` peger tre steder hen med et id frem for med en reference: bufferen udpeger en beholdning, en overførsel har en afgiver og en modtager, og en post har en ejer. Rammer en af de pegere ikke noget, er planen ikke en dårlig plan — den er ikke en plan. `validatePlan` afviser den ved indgangen, og `simulate` kaster frem for at regne videre.

Det var ikke sådan før. `validateBuffer` kontrollerede den ene peger, og de to andre gik urørte igennem. En overførsel mod en beholdning, der ikke fandtes, trak sit beløb ud af afgiveren og lagde det i et opslag, der ikke var der: `balances.get(transfer.from)!` gav `undefined`, `undefined - amount` gav `NaN`, og `NaN` blev båret videre som ultimosaldo resten af årsrækken. Balanceinvarianten knækkede ikke — den blev `NaN`, hvilket er værre, for `NaN` består ingen sammenligning og udløser derfor heller ingen. En post uden ejer var lige så stille: beløbet talte med i årets indtægter, men ingen persons skatteopgørelse så det, så det gik ubeskattet i formuen.

Hullet var nåeligt fra fladen. `removeHolding` ryddede overførslerne op efter en slettet beholdning, men `removePerson` gjorde det ikke, selvom beholdningerne er nestet under personen og forsvinder med hende.

Alternativet var at lade motoren tolerere en hængende peger — springe overførslen over, lade posten være ubeskattet. Det er hurtigere at skrive og umuligt at forsvare: en overførsel, der springes over, er en anden plan end den, brugeren tastede, og motoren ville træffe den beslutning uden at sige det. Modellen har ét sted at melde, at planen ikke går op, og det er bufferens fortegn, jf. [ADR-0008](./0008-holdbarhed-maales-paa-bufferen-alene.md) — ikke en tavs udeladelse.

## Konsekvenser

`validatePlan` er ét kald med ét svar: en dansk besked ved den første hængende peger, ellers intet. De tre kaldere er `simulate`, som kaster på den, fladen, som viser den i resultatspalten frem for en tom graf, og persistenslaget, som afviser en fil, der bærer den. Det er samme svar til alle tre — der er ikke to udgaver af "kan planen regnes" alt efter, hvem der spørger.

En plan, der allerede er gemt med skaden, ville dermed blive uindlæselig. Kæden rydder den op i stedet: leddet til skemaversion 4 dropper overførsler uden begge ender og poster uden ejer. Værktøjet afviser ikke data, det selv har lavet.

Årets beholdningsrækker fik samtidig ét opslagssted, der kaster på en beholdning, bogen ikke blev åbnet med. Den vagt kan ikke nås gennem `simulate`, fordi kontrollen løber først, og den er derfor ikke testet — den står som en assertion, der fanger en fremtidig vej udenom, ikke som adfærd nogen har lovet.

Kontrollen dækker pegere og intet andet. En tom husstand, en negativ saldo, en post på nul kroner er planer, brugeren gerne må lave. Grænsen er ikke "er planen fornuftig", men "kan motoren overhovedet regne på den".

## Se også

- [ADR-0004](./0004-frie-midler-pr-person-med-udpeget-buffer.md) — hvorfor bufferen er en udpegning og dermed en peger, der kan hænge
- [ADR-0008](./0008-holdbarhed-maales-paa-bufferen-alene.md) — modellens ene sted at melde, at planen ikke går op
- [diagram 01](../diagrams/01-domaenemodel.md) — de tre pegere selv: buffer, from, to og owner
