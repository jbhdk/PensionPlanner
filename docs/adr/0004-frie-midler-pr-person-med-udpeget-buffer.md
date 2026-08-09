# Frie midler ejes pr. person, og bufferrollen er udpeget

Frie midler var oprindeligt beskrevet som husstandens ene konto. De er nu en almindelig `Holding` ejet af en `Person` — husstanden kan altså have to sæt — mens bufferrollen er skilt ud som en selvstændig egenskab: præcis én `Holding` pr. `Plan` er udpeget som `buffer` og absorberer årets samlede over- eller underskud.

Grunden er skatteattribution. Nettokapitalindkomst indgår i `TaperBase`, og ægtefællens indkomst tæller kun med 54 % bortseelse. Med 80.000 kr. kapitalindkomst er forskellen på, om depotet står i den ene eller den anden ægtefælles navn, omkring 14.000 kr. om året i aftrappet pensionstillæg — i vores tilfælde i 15+ år. En husstandsmodel kan ikke stille det spørgsmål, og det er et af de spørgsmål, værktøjet er bygget for at besvare.

## Konsekvenser

Motoren forbliver plan-drevet: brugeren udpeger bufferen, motoren vælger den ikke. Til gengæld ændrer en `FreeAssets`, der ikke er buffer, sig kun ved sit eget afkast. Den kan derfor kun bruges gennem en `Transfer` — to modgående `Entry`-poster nettes til nul på bufferen og flytter ingenting. `Transfer` er af den grund en del af etape 1, ikke en senere tilføjelse: uden den kan bufferen stå negativt, mens den anden konto er fuld, og søgningen efter tidligste holdbare `workEndAge` giver falsk alarm.

Se [ADR-0002](./0002-plan-drevet-motor-med-frie-midler-som-buffer.md) for hvorfor bufferen overhovedet må gå negativt, og [diagram 01](../diagrams/01-domaenemodel.md) for figuren.
