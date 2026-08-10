# Fladekortet

En mock-up af brugerfladen til **det færdige system** — ikke til etape 1. Den findes for
at afgøre to ting, før der skrives kode: om skelettet i
[issue #17](https://github.com/jbhdk/PensionPlanner/issues/17) bærer alle fem etaper, og
hvilke krav grafbiblioteket faktisk skal opfylde.

Åbn [`index.html`](./index.html) direkte i en browser. Ingen værktøjskæde, ingen Node,
intet bibliotek. Hver skærm har sin egen adresse, så en tilstand kan linkes fra et issue:
`#hoved`, `#forklar:2043`, `#cashflow`, `#sammenlign`, `#fejl`.

## Udtrykkene

[`udtryk.html`](./udtryk.html) er noget andet og enklere: grundtoner for den samme flade,
hvor kun farver, skrift og rytme skifter. Indholdet er identisk i alle, så det kun er
tonen, der sammenlignes.

| | Tone | Skrift | Greb |
|---|---|---|---|
| **1 · Papir** | Trykt årsrapport. Varm bund, dyb blå accent | Cambria til titler og tal, Segoe UI til brødtekst | Hårfine streger, ingen kasser, ingen runde hjørner |
| **2 · Nordisk** | Moderne værktøj. Kølig grå-blå, én mættet blå accent | Segoe UI Variable hele vejen | Hvide kort med bløde kanter og luft imellem |
| **3 · Instrument** | Mørkt instrumentbræt, næsten sort. Rav som eneste accent | Cascadia Mono til alt, også tekstfelter | Høj tæthed, lav pynt, næsten ingen radius |
| **4a · Aften** | Mørk skifer frem for sort. Rav som eneste accent | Cascadia Mono til tal, Segoe UI til tekst | Afsnit samlet i flader — strammere end Nordisks |
| **4b · Aften, flad** | Som 4a | Som 4a | Ingen flader, kun hårfine streger |

**Aften er retningen.** Den er Instrument med tre rettelser: bunden er hævet fra `#0f1318`
til `#191e25`, den faste bredde er forbeholdt tal — et tekstfelt som *Ophør som 58* står i
etiketskriften — og grafen har lånt Papirs dæmpede toner, løftet så de bærer på mørk bund
uden at lyse. Årstabellen er uændret fra Instrument.

4a og 4b er den samme tone i to tætheder. Fladerne koster cirka én tabelrække og et par
hundrede pixels i venstre spalte; til gengæld holder de afsnittene fra hinanden uden en
streg. Det er en afvejning og ikke et designspørgsmål — vælg den, der er nemmest at
arbejde i.

Skrifterne er alle installeret på Windows — ingen af skitserne henter noget udefra.
Tallene kommer fra `plan.js`, så tætheden er ægte; en skitse med runde tal lyver om, hvor
svær tabellen er at læse.

## Venstre spalte — fire strukturer

[`venstre.html`](./venstre.html) udforsker planspalten alene. Alle fire har udtryk 4a og
den samme resultatspalte, så det kun er strukturen, der sammenlignes. `#a`, `#b`, `#c`, `#d`.

Venstre spalte gør to ting på én gang: den **viser** planen og den **redigerer** den. Det
er to uafhængige valg, og de fire modeller er lagt ud, så de dækker begge akser:

| | Grupperet efter | Redigeres |
|---|---|---|
| **A · Harmonika** | Type | Inline, folder ud på stedet |
| **B · Navigator** | Type | Fast inspektørrude |
| **C · Dokument** | Person | I teksten, ved at klikke på tallet |
| **D · Tidslinje** | Tid | Fast inspektørrude |

Akserne kan kombineres frit — B's navigator kunne grupperes efter person, D's tidslinje
kunne redigere inline. De fire er stikprøver, ikke et katalog.

**A** er den, fladekortet foreslår. Den er velkendt, men detaljeruden skubber alt under
sig ud af syne: med Danica åben ses 4 af 9 beholdninger, og Ydelser, Poster og Overførsler
ligger under kanten. Listen flytter sig, mens man redigerer i den.

**B** viser hele planen på én gang — alle 31 objekter står i navigatoren, og listen står
stille, mens inspektøren skifter. Prisen er 576 px, før resultatspalten begynder; grafen
og tabellen mister omkring en tredjedel af deres bredde.

**C** kan læses uden at klikke på noget. Den grupperer efter person, hvilket passer
domænet — konti, skat og aldre føres alle pr. person. To ting er uafklarede: hvor objekter
uden ejer hører hjemme (fladekortet kalder gruppen *Fælles*, som ikke står i glossaret), og
at redigering i prosa kræver en popover, som er et mønster, der skal bygges.

**D** fortæller planens historie, og erhvervsophøret bliver visuelt det, det også er i
PRD'en: det primære håndtag. Svagheden er, at en beholdnings saldo ikke har noget årstal —
*Hele forløbet* bliver en samlekasse. Til gengæld tvinger den et rigtigt spørgsmål frem,
når noget nyt tilføjes: hvornår i forløbet hører det til?

Ordene **Forudsætninger**, **Begivenhed**, **Tidslinje** og **Fælles** står ikke i
glossaret. De er skitse, indtil en model er valgt.

**C og D er lagt væk.** Navigatoren med inspektørrude er retningen.

## Navigatoren — tre udgaver

[`navigator.html`](./navigator.html) forfølger B. To ting skulle løses: spalten var for
høj til at kunne ses uden at rulle, og tabellen tog plads fra grafen, selv om det er
grafen, man aflæser planen på.

Det ene svar er fælles for alle tre udgaver og bør ikke stå til diskussion igen: **siden
ruller ikke**. Fladen fylder præcis vinduet, hver spalte ruller for sig, og spaltehovedet
bliver stående. Man kan ikke længere komme til at rulle grafen ud af syne, mens man leder
efter en post.

**Valgt: B3 med tabellen på egen fane.** De to andre bliver staaende som dokumentation af,
hvad der blev fravalgt.

Det andet svar er, hvordan navigatoren holdes kort:

| | Navigatoren | Inspektøren | Bredde før resultatet |
|---|---|---|---|
| **B1 · Foldbar** | Alle grupper synlige, hver kan foldes | Fast spalte | 608 px |
| **B2 · Faner** | Én gruppe ad gangen, valgt i et fanebånd | Fast spalte | 602 px |
| **B3 · Skuffe** | Som B1 | Skuffe hen over resultatet | 300 px, 656 px når skuffen er åben |

En foldet gruppe må ikke være tavs. Hver gruppe har derfor et resumé, der træder i stedet
for listen: Beholdninger folder sammen til `11.082.000 kr.`, Poster til
`−512.000 kr./år fast`, Husstanden til `Jesper · Anne`. Foldet er altså ikke skjult — det
er sammenfattet, og hele planen kan læses på syv linjer.

**B1** lader alle seks grupper stå, så man altid kan se, hvad planen består af. Med kun
Beholdninger foldet ud fylder navigatoren godt halvdelen af spaltens højde — der er luft. Prisen er, at man
selv skal folde: åbner man tre grupper, ruller spalten igen.

**B2** kan aldrig blive for høj, for den viser kun én gruppe. Til gengæld kan man ikke se
Poster og Beholdninger samtidig, og fanebåndet koster tre linjer i toppen, uanset hvor lidt
man har valgt.

**B3** giver grafen 300 px mere, når intet er valgt, og skuffen skubber resultatet fri af
sig, når den åbnes — den dækker aldrig tabellens sidste kolonne. Til gengæld flytter
resultatet sig hver gang, man vælger noget, og grafen skifter bredde under hånden på én.

### Tabellen

Kontakten **Tabel under grafen · Tabel på egen fane** er uafhængig af de tre og kan vælges
for sig.

*Under grafen* giver grafen knap to tredjedele af spaltens højde og lader tabellens øverste
ti rækker titte frem under en skillelinje, så man kan se, at der er mere. Man kan rulle ned
til tabellen uden at skifte kontekst, og grafen forsvinder, mens man læser.

*På egen fane* giver grafen hele spalten og gør tabellen til et
bevidst valg. Den er hurtigere at læse planens form på, men et lag længere væk fra tallene
bag den.

Grafen bliver i begge tilfælde målt efter den plads, den har, og tegnet om, når vinduet
skifter størrelse. Det er en oplysning til grafbiblioteket: en fast højde duer ikke.

**Åbne punkter for navigatoren**

- Hvilke grupper er foldet ud, når planen åbnes første gang? Og huskes foldningen mellem
  besøg — altså hører den til i det gemte skema?
- B2's fanebånd bruger forkortede etiketter, når spalten er smal. Det er ikke afprøvet
  under 1000 px.
- Resuméet for Ydelser (`fra 2043`) siger mindre end de andre. Det skyldes, at ydelserne
  ikke har ét tal, før de er beregnet — spørgsmålet er, om et resumé må vise et beregnet
  tal, eller kun det, der er skrevet ind.

## Hvad det ikke er

`plan.js` indeholder en fixtur og en grov fremskrivning. **Den er ikke motoren.** Den er
skrevet for at give fladen tal i den rigtige størrelsesorden og med den rigtige form —
den kender ikke alle regler, den runder hjørner af, og den må aldrig blive forlæg for en
ADR eller for koden. Satserne i den er hentet fra [satsår 2026](../satser/2026.md), men
sammenstillingen af dem er ikke verificeret.

Fixturen er husstanden fra [PRD'en](https://github.com/jbhdk/PensionPlanner/issues/1):
Jesper født 1973 med tre ratepensioner oprettet før 1. maj 2007, Anne født 1985, og et
forløb forskudt med tolv år. Beløbene er opdigtede, men størrelsesordenen er valgt, så
planen akkurat holder — bufferen bunder i 439.589 kr. i sidste år. Det er med vilje: en
plan med rigelig margin viser ikke, hvor fladen skal være præcis.

## Skitsekonventionen

Fladen taler dansk efter [CONTEXT.md](../../CONTEXT.md), og et ord, der ikke står i
glossaret, må ikke stå på skærmen. Mock-uppen bryder den regel bevidst nogle steder, og
de steder er mærket — stiplet ramme og et **skitse**-mærke, ligesom `<<skitse>>` i
diagrammerne. Et skitsemærket ord er ikke afgjort og skal gennem glossaret, før det
bliver til kode.

Mærket sidder på: **Bolig og lån** (hele etape 4), **cashflow-grafen**,
**sammenligningen af planer** og **milepælene** i formuegrafen.

## De fem skærme

| Skærm | Hvad den afgør |
|---|---|
| `#hoved` | Om venstre spalte bærer alle etaper, og om årstabellen tåler tolv kolonner |
| `#forklar:2043` | Det tætteste skærmbillede i hele appen. Bygges allerede i etape 1 ([#13](https://github.com/jbhdk/PensionPlanner/issues/13)) |
| `#cashflow` | Divergerende stablet søjlegraf — det ene af de to hårde grafkrav |
| `#sammenlign` | Flere planer oven i hinanden, og hvad venstre spalte så viser |
| `#fejl` | Ugyldig plan mod uholdbar plan, og markeringen af de år, hvor bufferen er tom |

Klik på en række i årstabellen for at åbne forklar-året. Klik på en beholdning i venstre
spalte for at folde detaljeruden ud. Omskifteren mellem dagens kroner og løbende priser
virker.

**2043 er årsvalget, der betyder noget.** Ratepensionerne er tømt året før, så de rammer
aldrig pensionstillægget — præcis den manøvre, PRD'en handler om. Og alligevel er
tillægget nul, fordi 8,5 mio. kr. i lagerbeskattede frie midler aftrapper det helt af sig
selv. Se også 2054, hvor Annes ordninger begynder, og 2057, hvor hun selv bliver
pensionist og aftrapningssatsen falder fra 32 % til 16 %.

## Hvad det at bygge fladekortet afslørede

**Beholdningen kan ikke være en flad liste.** I etape 1 har en beholdning tre felter. I
det færdige system har den navn, ejer, saldo, beskatningsform, bufferudpegning,
bruttoafkast, ÅOP, udledt nettoafkast, oprettelsestidspunkt, udledt
pensionsudbetalingsalder, udbetalingsplan med start, varighed og princip — og en
indbetaling. Ni beholdninger gange det tal kan ikke stå udfoldet i en spalte på 400 px.
Fladekortet foreslår **liste med kompakte linjer plus en detaljerude, der folder ud på
den valgte**. Det er en beslutning, der skal træffes i [#3](https://github.com/jbhdk/PensionPlanner/issues/3),
ikke bagefter.

**Balanceinvarianten manglede et led.** `closingWealth − openingWealth =
income + return − tax − expenses` knækkede i mock-motoren med 1,85 mio. kr. i 2054 —
året hvor livrentedepotet omsættes. Depotet forlader formuen uden at være hverken en
udgift eller en udbetaling, jf. [ADR-0009](../adr/0009-livrenten-omsaettes-en-gang-ved-udbetalingsstart.md).
Invarianten har nu `− conversion` som sit eget led, og **Omsætning · `Conversion`** er
skrevet ind i glossaret. Med det led afviger fremskrivningen 0,000000 kr. i alle 55 år.

**Livrenten skifter art undervejs.** Før omsætningen er den en `Holding` med en saldo;
bagefter er dens årlige beløb en `Benefit` uden saldo. I mock-motoren var det først
bogført som en `payout` fra en beholdning, og så forsvandt der 167.000 kr. om året ud af
regnskabet. Skellet er ikke kosmetisk — det bestemmer, hvilken kolonne beløbet står i, og
hvad `YearResult` skal rumme.

**Ufuldstændig og uholdbar er tilstande pr. år, ikke domme over planen.** Den samme plan
er ufuldstændig i 2055, hvor bufferen mangler penge, men husstanden har dem andetsteds —
og uholdbar senere, hvor der ikke er noget at hente. Skellet i
[#11](https://github.com/jbhdk/PensionPlanner/issues/11) skal derfor bo i tabelrækken.

**Enhedsfælden rammer også noterne.** En note som "7,50 % over 641.200" ved siden af et
beløb i dagens kroner skal deflateres på samme måde som beløbet. Det stod forkert i
første udkast og var ikke til at se uden at regne efter.

**Årstabellens Netto-kolonne ser forkert ud i omsætningsåret.** 2054 viser −1.214.111,
fordi livrentedepotet forlader balancen. Uden en kolonne eller en markør til omsætningen
ligner det en fejl i motoren.

## Kravene til grafbiblioteket

Fladekortets grafer er råt SVG, netop fordi valget ikke er truffet. Det, de viser, er
kravspecifikationen:

1. **Stablet areal med gulv ved nul, og et markeret spænd af år.** Bufferen kan blive
   negativ, men tegnes ikke under aksen: en tom buffer er ikke en beholdning med negativ
   værdi, det er et hul i planen, og et hul har ingen udstrækning på formueaksen. Årene
   markeres i stedet med en tonet baggrund bag stablingen — én tone for *ufuldstændig*
   og én for *uholdbar* — og dybden står som beløb i mærkatet og i tabellens
   bufferkolonne. Se `#fejl`.

   Det var oprindeligt krav 1, at et bånd skulle kunne krydse nul, og det er dét krav,
   flest biblioteker fejler på. Det er nu afgjort, at det ikke er nødvendigt. Prisen er,
   at stablens overkant ikke er formuen i de år: den overvurderer med det, bufferen
   mangler. Tabellen har det rigtige tal.
2. **Divergerende stablet søjlegraf** med indtægter opad og skat og udgifter nedad, 55
   kategorier på x-aksen. Se `#cashflow`.
3. **Flere serier af samme slags oven i hinanden** til plansammenligningen. Se
   `#sammenlign`.
4. **Klik på et år**, der åbner forklar-året, og som holder grafen og tabelrækken
   synkroniseret.
5. Dansk talformatering, `tabular-nums`, og en akse i millioner.

Recharts står nævnt i #17 med et "eller tilsvarende". Punkt 1 og 2 er dem, der skal
afprøves med kode, før det bliver til en beslutning — og den beslutning hører i en ADR.

## Åbne punkter

- **Hvad venstre spalte viser, når to planer sammenlignes.** Fladekortet foreslår, at den
  bliver ved med at vise den aktive plan, og at sammenligningen er en tilstand i højre
  spalte alene. Ikke afprøvet mod etape 5.
- **Milepælene i formuegrafen** (erhvervsophør, udbetalingsstart, folkepension) er
  fladekortets eget påfund. De er ikke i glossaret og ikke lovet nogen steder.
- **Farverne** er en tonal ramp valgt for at kunne skelne ni bånd. Det er ikke et
  designforslag, og især ikke afprøvet for farveblindhed.
- **Etape 4's ord** — bolig, lån, restgæld, ejendomsværdiskat, grundskyld, nedsparingslån
  — mangler i glossaret. Afsnittet står tomt og skitsemærket, indtil de er der.
- **Indbetalinger** (etape 2) er kun en skitsemærket tom rude i detaljeruden. Lofter og
  fradragsregler har ingen flade endnu.
