# Formuegrafens palet udvides til 16 farver på bekostning af CVD-sikkerheden

`palette.ts`s kategoriske palet fulgte dataviz-skillets metode til punkt og prikke: otte kulører i fast rækkefølge, aldrig cyklet, hver valideret mod appens mørke flade med ≥ 8 ΔE adskillelse under simuleret rødgrøn-farveblindhed. En husstand har ingen kodet grænse for antal beholdninger, og en niende beholdning genbrugte allerede paletten modulo 8 — en accepteret, men uudtalt kompromis. Otte farver rækker ikke til en husstand med to personer og flere beholdninger hver.

Paletten er derfor udvidet til 16 farver, genereret som kulører jævnt fordelt på farvehjulet og tildelt i et springmønster (hver 7. plads i stedet for hver 1.), så to farver, der står ved siden af hinanden i paletten — og dermed kan ende som naboer i et bånd — altid ligger langt fra hinanden i kulør. Ved lyshed L=0,58 og mætning C=0,165 klarer alle 16 lyshedsbånd, mætningsgulv, kontrast mod fladen og normalsyns-gulvet (værste par ΔE 26,6 mod et krav på 15) uden problemer. CVD-adskillelsen er derimod opgivet: værste par lander på ΔE 0,8 under simuleret deuteranopi, langt under både målet på 8 og gulvet på 6. Det blev afprøvet grundigt — selv med håndplaceret lyshed og mætning inden for det bånd, appens mørke flade tillader, kunne 16 indbyrdes CVD-sikre farver ikke opnås; fysikken i OKLCH-rummet tillader det ikke ved den tæthed. Tolv farver ville kunne holde CVD-kravet, men blev fravalgt til fordel for at ramme det oprindelige mål på 16, efter en udtrykkelig beslutning om, at en rødgrøn-farveblind bruger må leve med farver, der ikke kan skelnes.

Det, der gør det forsvarligt, er at ingen beholdning i denne flade nogensinde vises med farve alene: legenden, dataglimtet og inspektørskuffen navngiver den altid ved siden af prøven. Overskudsgrafens `SURPLUS`/`DEFICIT`-par er undtagelsen, der bekræfter reglen — det sidder på plads 13 og 5, valgt 180° fra hinanden på farvehjulet, og er derfor det eneste par i paletten, der stadig klarer CVD-målet (ΔE 18,2).

## Se også

- `src/ui/palette.ts` — `CATEGORICAL_PALETTE`, `SURPLUS`, `DEFICIT`
- `src/ui/WealthChart.tsx` — `holdingColor`, som cykler paletten modulo dens længde for en 17. beholdning
- dataviz-skillets `references/color-formula.md` — de seks tjek og reglen om otte farver, aldrig cyklet, som denne ADR fraviger
