# Satser er referencedata; en plan pinner dem ikke

En gemt plan indeholder husstanden og alle dens antagelser, men ikke satstabellerne. `RateYear` er delt referencedata, og enhver beregning bruger altid det nyeste kendte sæt. `YearResult` stempler til gengæld hvilket satsgrundlag, det er regnet på, og JSON-eksporten skriver versionen med som proveniens.

Alternativet — at planen pinner sit satsdatasæt ved oprettelsen — blev fravalgt, fordi to planer oprettet på hver sin side af en satsopdatering så ville regne på hvert sit grundlag, uden at sammenligningen mellem dem sagde det. Værktøjets kerneopgave er netop at sammenligne planer.

## Konsekvenser

Satsdata er en fejlrettelsesflade, ikke en brugerbeslutning: når en verificeret beløbsgrænse retter et tidligere gæt, slår rettelsen igennem i alle planer med det samme. Prisen er, at en beregning fra i fjor ikke nødvendigvis reproducerer i år. Behovet for at dokumentere en truffet beslutning dækkes af eksporten og af satsstemplet på `YearResult` — ikke af at fastfryse planen.
