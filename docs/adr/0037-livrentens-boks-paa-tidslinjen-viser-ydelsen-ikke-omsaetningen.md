# Livrentens boks på tidslinjen viser ydelsen, ikke omsætningen

ADR-0036 lod livrenten få et punkt på tidslinjen — en rombe ved `payout.start`, fordi omsætningen (`Conversion`) er "ét tidspunkt, ikke en periode, fordi omsætningen er en engangshandling". Punktet viser kun selve engangshandlingen, hvor depotet forlader formuen; det siger intet om, at husstanden derefter modtager en ydelse hvert år, ofte i årtier frem. Set fra tidslinjens eget formål — at kunne verificere en boks visuelt mod Formuegrafens kurver — er omsætningstidspunktet mindre interessant end den strøm, det udløser.

Livrenten får derfor i stedet en boks, ligesom ratepensionens `PayoutSchedule`: venstre kant ved `payout.start`, højre kant ved ejerens egen horisont — det tidspunkt, hvor aksens eget aldersmærke for horisonten sidder. Det stemmer med ADR-0030, hvor en omsat livrentes ydelse allerede i motoren stopper ved ejerens egen horisont og ikke husstandens fælles længste. Højre kant har intet håndtag og kan ikke trækkes; kun venstre kant kan. Der er ikke længere en rombe — omsætningen som begivenhed er ikke det, boksen viser, og bærer derfor ikke sit eget symbol mere.

Boksens `to` gemmes som ejerens sidste inkluderede år minus ét (`personLastYear(person) - 1`), ikke som `personLastYear` selv. `boxStyle` lægger allerede ét helt år til `to` for at dække det sidste inkluderede år visuelt — samme regel, en `to` låst til erhvervsophør bruger, jf. ADR-0036. Uden fradraget ville boksens højre kant lande ét år forbi horisontens eget mærke på aksen i stedet for på det, ganske som en boks låst til erhvervsophør ville gøre det, hvis `WorkEndAge` ikke selv var oversat til året før.

Venstre kants træk klemmes til det interval, boksen selv kan vise: tidligst ordningens pensionsudbetalingsalder (`payoutYear` i `payoutAge.ts`), samme grænse `validatePlan`s `payoutSchedules`-regel allerede stiller op, og senest ét år før ejerens horisont — ikke horisontens eget sidste år, for der sidder boksens højre kant allerede, og et træk helt derop ville vende boksen om. Uden den nedre klemning kunne et træk sætte planen i en tilstand, `validatePlan` afviser — resultatspalten viste da en fejlbesked i stedet for grafen, midt i et træk brugeren ikke kunne se gik galt. Klemningen gør den ugyldige tilstand umulig at nå med musen, samme mønster `clampWorkEndAge` allerede bruger til erhvervsophørs-håndtaget.

Mock-uppen i `docs/mockup/tidslinje.js` viser fortsat det gamle punkt-design. Den er ikke længere referencen for denne del af fladen og rettes ikke til at følge med.

## Se også

- [ADR-0036](./0036-tidslinjen-pakker-poster-i-raekker-og-ruller-vandret-uafhaengigt-af-graf-laget.md) — punkt-mod-boks-skellet, denne ADR afløser for livrentens `payout`; ratepensionens boks og de fire øvrige gruppers farvevalg står uændret
- [ADR-0030](./0030-en-persons-horisont-stopper-hendes-egen-indkomst-ikke-husstandens-udgifter-eller-hendes-beholdninger.md) — reglen om at en omsat livrentes ydelse stopper ved ejerens egen horisont, som boksens højre kant nu også viser
- `CONTEXT.md` — opslagene `Omsætning`, `Ydelse` og `PayoutSchedule`, som denne ADR bruger uændret
- `src/ui/timelineLayout.ts`, `src/ui/timelineDrag.ts` — hvor boksens grænser afledes og trækket klemmes
