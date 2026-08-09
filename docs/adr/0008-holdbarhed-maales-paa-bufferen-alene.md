# Holdbarhed måles på bufferen alene

En plan er holdbar, når `buffer`-beholdningen aldrig går negativt inden for horisonten. Husstandens samlede frie midler indgår ikke i kriteriet, og søgningen efter tidligste holdbare `workEndAge` bruger samme snævre mål.

Alternativet — at måle på husstandens samlede likviditet — ville lade motoren stiltiende antage en overførsel, brugeren ikke har lagt ind. Det er præcis den optimering, [ADR-0002](./0002-plan-drevet-motor-med-frie-midler-som-buffer.md) placerede hos brugeren. Rettelsen er i brugerens hånd: læg en `Transfer` ind og kør igen.

## Konsekvenser

Brugerfladen skal skelne mellem to tilstande, der ellers ville se ens ud som en rød række:

- **Bufferen er negativ, men husstanden har likviditet andetsteds.** Planen er ufuldstændig, ikke uholdbar — der mangler en overførsel.
- **Husstandens samlede frie midler er negative.** Planen holder ikke.

Uden den skelnen ville det første tilfælde sende brugeren et helt år længere på arbejde end nødvendigt.

Renten på en negativ saldo påvirker ikke søgningen. Kriteriet er, *om* saldoen bliver negativ, ikke hvor negativ: enhver kandidatalder, der består, rører aldrig renten, og enhver, der falder, falder uanset satsen. Renten betyder kun noget for, hvor slemt et allerede fejlende forløb ser ud, og er derfor ikke blokerende.
