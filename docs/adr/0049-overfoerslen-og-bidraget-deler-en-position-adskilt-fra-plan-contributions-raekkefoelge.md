# Overførslen og bidraget deler en `position`, adskilt fra `plan.contributions`s rækkefølge

Den sammenlagte Overførsel-sektion, [ADR-0047](./0047-overfoerslen-kendes-paa-sin-kilde-i-skuffen-ikke-paa-sin-destination-i-motoren.md) skrev, var i virkeligheden to lister limet sammen: `Transfer`-figurer fra `plan.transfers`, tegnet før alle beholdningskildede `Contribution`-figurer fra `plan.contributions`, uanset hvad brugeren faktisk havde bygget op af rækkefølge på skærmen. En ny figur landede nederst i sit eget array, og det array kunne ligge midt i det, brugeren så som listen — en overførsel, tilføjet efter et bidrag i skærmens forstand, kunne stadig tegnes over det, fordi Transfer-blokken altid gik forud for bidrags-blokken.

Ingen af de to arrays kan alene sige, hvor en overførsel hører hjemme mellem bidrag nr. 2 og nr. 3. Løsningen er et nyt felt, `position: number`, på `Transfer` og på `HoldingSourced Contribution` — de to grene, sektionen viser sammen. Navigatoren tegner nu de to arrays som én, sorteret på `position`, og en ny figur får den højeste eksisterende position blandt begge plus én, så den altid lander nederst i det, brugeren ser.

`position` er ikke et begreb i CONTEXT.md-forstand. Det er et strukturelt felt som `id` — det navngiver ingen ny ting i domænet, det holder styr på en plads i en liste — og det hører derfor hjemme i `plan.ts` og ikke i glossaret.

Feltet er bevidst adskilt fra `plan.contributions`s egen rækkefølge, som stadig betyder noget: [ADR-0019](./0019-aktiesparekontoens-loft-forhindrer-indskuddet-frem-for-at-straffe-det.md) lader den første indbetaling i arrayet tage sit fulde beløb, når flere deler et loft. Havde `position` erstattet den rækkefølge i stedet for at ligge ved siden af den, ville en omprioritering af skuffens visning stille og roligt også omprioritere, hvem der får råderummet først på en fælles aktiesparekonto — to spørgsmål, der ligner hinanden, men ikke er det samme. De to felter kan derfor godt komme ud af trit: et bidrags plads i den sammenlagte liste og dets prioritet blandt bidrag til samme loft er to forskellige tal, og begge er nødvendige.

En reklassificering — en figur, der krydser grænsen mellem `Transfer` og `Contribution`, jf. ADR-0047 og [ADR-0048](./0048-et-fra-valg-krydser-ogsaa-graensen-mellem-overfoersel-og-bidrag-naar-det-kolliderer-med-til.md) — bevarer `position` uændret, ligesom den allerede bevarer `id`. En figur, der skifter type midt i en redigering, må ikke også hoppe i listen.

En gemt plan får sin `position` af migrationen v15 → v16: alle overførsler i deres nuværende `plan.transfers`-rækkefølge, derefter alle beholdningskildede bidrag i deres nuværende relative rækkefølge i `plan.contributions`. Det er præcis den rækkefølge, den gamle to-blokke-visning allerede tegnede, så en migreret plan ser visuelt uændret ud.

Selve trækket i skuffen er ikke koblet til den sammenlagte blok endnu — den kan i denne skive ikke omsorteres derfra. Fjernelsen er bevidst og ikke en forglemmelse: at lade et træk flytte `position` på tværs af to arrays, samtidig med at `plan.contributions`s egen prioritetsrækkefølge skal stå urørt, er et selvstændigt stykke arbejde, som hører til [issue #84](https://github.com/jbhdk/PensionPlanner/issues/84).

## Se også

- [ADR-0047](./0047-overfoerslen-kendes-paa-sin-kilde-i-skuffen-ikke-paa-sin-destination-i-motoren.md) — den sammenlagte sektion, `position` ordner
- [ADR-0048](./0048-et-fra-valg-krydser-ogsaa-graensen-mellem-overfoersel-og-bidrag-naar-det-kolliderer-med-til.md) — reklassificeringen, `position` skal overleve uændret
- [ADR-0019](./0019-aktiesparekontoens-loft-forhindrer-indskuddet-frem-for-at-straffe-det.md) — den anden rækkefølge, `plan.contributions`s egen, som `position` bevidst ikke rører
