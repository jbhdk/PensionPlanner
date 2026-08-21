# Hovedgrafen har fast højde, og mini-graferne står i en søjle til højre

ADR-0033 lagde de tre grafer i ét fast lag: hovedgraf øverst, de to mini-grafer side om side nedenunder, og hele laget fyldte resten af resultatspalten. Det arrangement ændres nu på to punkter, af samme grund: der skal være plads under graferne til det tidslinjeværktøj, der kommer næste gang, og hovedgrafen var større, end den behøvede at være, for at vise sin form.

Mini-graferne flytter fra en række under hovedgrafen til en søjle til højre for den, stablet oven på hinanden. Graf-laget får en fast pixelhøjde i stedet for at fylde resten af spalten — resten af spalten står nu tom under laget, klar til tidslinjeværktøjet.

Den faste højde er en afvigelse fra kravet i `docs/mockup/README.md`: *"Grafen bliver ... målt efter den plads, den har, og tegnet om, når vinduet skifter størrelse. Det er en oplysning til grafbiblioteket: en fast højde duer ikke."* Kravet gælder stadig for grafbiblioteket selv — `useMeasuredPlot` måler stadig plotcontainerens faktiske størrelse og tegner om efter den, og intet i `WealthChart`, `SurplusBandsChart` eller `SurplusChart` antager en bestemt højde. Det, der er fast nu, er rammen uden om grafen — CSS-kortets højde — og ikke grafens egen evne til at tegne sig efter en vilkårlig plads. De to er ikke det samme krav.

## Se også

- [ADR-0033](./0033-graferne-staar-i-tre-faste-pladser-en-mini-bytter-sig-ind-ved-klik.md) — de tre faste pladser og byt-ved-klik, som står uændret; kun arrangementet af pladserne og lagets højde ændres her
- `docs/mockup/README.md` — kravene til grafbiblioteket, herunder den nu præciserede grænse for hvad "ingen fast højde" dækker
