# Fladekortet

En mock-up af brugerfladen til **det færdige system** — ikke til etape 1. Den findes for
at afgøre to ting, før der skrives kode: om skelettet i
[issue #17](https://github.com/jbhdk/PensionPlanner/issues/17) bærer alle fem etaper, og
hvilke krav grafbiblioteket faktisk skal opfylde.

Åbn [`index.html`](./index.html) direkte i en browser. Ingen værktøjskæde, ingen Node,
intet bibliotek. Hver skærm har sin egen adresse, så en tilstand kan linkes fra et issue:
`#hoved`, `#forklar:2043`, `#cashflow`, `#sammenlign`, `#fejl`.

`index.html` er det første udkast. Skelettet er siden afgjort i
[`navigator.html`](./navigator.html) — **B3 med tabellen på egen fane**, `#b3-fane`. Hvad
der er afgjort om `index.html`s øvrige skærme, står under **De fem skærme** nedenfor.

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

**B** viser hele planen på én gang — alle 36 objekter står i navigatoren, og listen står
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

**Valgt: B3 med tabellen på egen fane.** De to andre bliver stående som dokumentation af,
hvad der blev fravalgt.

Det andet svar er, hvordan navigatoren holdes kort:

| | Navigatoren | Inspektøren | Bredde før resultatet |
|---|---|---|---|
| **B1 · Foldbar** | Alle grupper synlige, hver kan foldes | Fast spalte | 608 px |
| **B2 · Faner** | Én gruppe ad gangen, valgt i et fanebånd | Fast spalte | 602 px |
| **B3 · Skuffe** | Som B1 | Skuffe hen over resultatet | 300 px, 656 px når skuffen er åben |

En foldet gruppe må ikke være tavs. De fleste grupper har derfor et resumé, der træder i
stedet for listen: Beholdninger folder sammen til `11.082.000 kr.`, Husstanden til
`Jesper · Anne`. Foldet er altså ikke skjult — det er sammenfattet.

Indtægter og Udgifter er undtagelsen. Poster kan have en begrænset periode eller en
gentagelse, der ikke rammer hvert år, så et samlet kronetal i resuméet ville love en
regelmæssighed, planen ikke har — det var oprindeligt afprøvet som `−512.000 kr./år fast`
for udgifterne alene, men tallet er droppet igen. De to grupper folder derfor sammen til
kun deres antal, badge'en de allerede har; de nøjagtige tal står i årstabellen.

**Indbetalinger er den tredje uden resumé**, og af en grund mere. Et procentbidrag har
intet kronebeløb, før året er regnet, og et samlet tal ville derfor være et årsafhængigt
resultat i en spalte, der kun viser planen. Rækkerne hedder kilde → destination, så de to
former står side om side i den samme liste.

**B1** lader alle otte grupper stå, så man altid kan se, hvad planen består af. Med kun
Beholdninger foldet ud fylder navigatoren godt halvdelen af spaltens højde — der er luft. Prisen er, at man
selv skal folde: åbner man tre grupper, ruller spalten igen.

**B2** kan aldrig blive for høj, for den viser kun én gruppe. Til gengæld kan man ikke se
Udgifter og Beholdninger samtidig, og fanebåndet koster tre linjer i toppen, uanset hvor lidt
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

## Indbetalingernes rude

Tegnet i alle tre udgaver af planspalten, så beholdningens rude ser ens ud, uanset hvilken
man åbner. Seks ting står fast efter den, og de tre andre skiver i etape 2 bygger dem.

**Kilden er ét felt, ikke to spørgsmål.** Én vælger med to grupper — Lønposter og
Beholdninger — og resten af ruden retter sig efter svaret. Alternativet var en kontakt
*Lønpost · Beholdning* og derefter en vælger, men den gør kilden til to greb og får de to
former til at ligne to dialoger. De er én figur.

**Det arvede står som én linje og aldrig som felter.** Et lønkildet bidrag peger på sin
post og arver dens periode, forankring, gentagelse og forfald. De felter findes ikke på
bidraget, og de må derfor hverken stå tomme eller grå i ruden — i stedet siger afsnittet
*Følger Løn · Jesper* med postens tre værdier på én linje. Et beholdningskildet bidrag har
ingen post at låne af og bærer dem alle selv, i afsnittet *Perioden*, på samme plads i
ruden. Det er hele forskellen mellem de to udgaver.

**Perioden er lønpostens periodeafsnit, én til én.** Bærer bidraget sin egen periode, gør
afsnittet præcis det, `EntryFields` allerede gør i appen: gentagelsen først, et *Hvert*-felt
når den er `EveryNYears`, så forankringen, så endepunkterne — ét felt når gentagelsen er
`Once`, ellers *Fra* og *Til* i den form, forankringen bestemmer, årstal eller `AgeBound` —
og til sidst forfaldet med de valg, gentagelsen tillader. Mock-uppen viser ikke den
dynamik: dens vælgere svarer ikke, og *Fra* og *Til* står fast uanset det valgte. Forlægget
for den del af ruden er lønpostens rude i appen og ikke fladekortet.

**Beløbet er én segmenteret kontakt over ét felt** — dér, hvor der er noget at vælge
imellem. `% af posten · kr.`, og enheden skifter med valget. Begge muligheder er synlige
uden at åbne noget. Er kilden en beholdning, er der ingen post at måle en procent af, og så
står linjen der slet ikke: feltet hedder *Fast beløb* og er det eneste, der spørges om. Et
slukket segment ville vise et valg, der aldrig kan træffes.

**Lønnen tastes brutto, og etiketten bærer det.** Feltet hedder *Beløb, brutto*, og under
det står, hvad det betyder — tallet på lønsedlen og ikke det, der går ind på kontoen. Det
er ADR-0007's egen forpligtelse, og den er indfriet med en etiket og en fast forklaring
frem for en advarselsblok eller et flueben: fladen har ingen advarselsblokke, og et
afkrydsningsfelt uden et felt bag sig i modellen ville være en løgn i formen. Lønpostens
rude viser desuden, hvilke bidrag der trækker på den.

**Loftet står ikke i skuffen.** Om et loft bandt afhænger af årets fremskrevne beløb målt
mod årets satsår, og det er et resultat. Skuffen siger kun, at destinationen har et loft og
hvilken form det har — `pr. år` eller `på saldoen` — og henviser til forklar-året. Der står
loftlinjen med sine tre tal på samme linje: indbetalt, loftet det blev målt mod, og den del
der fik fradragsret.

## Hvad det ikke er

`plan.js` indeholder en fixtur og en grov fremskrivning. **Den er ikke motoren.** Den er
skrevet for at give fladen tal i den rigtige størrelsesorden og med den rigtige form —
den kender ikke alle regler, den runder hjørner af, og den må aldrig blive forlæg for en
ADR eller for koden. Satserne i den er hentet fra [satsår 2026](../satser/2026.md), men
sammenstillingen af dem er ikke verificeret.

Indbetalingerne regnes med — de flytter penge, betaler AM-bidrag på vejen ind fra en post,
og prøves mod destinationens loft — fordi forklar-årets loftlinje ellers ville vise tal,
der ikke stemmer med beholdningerne. Overførslen mellem de to sæt frie midler regnes
derimod ikke: den er formueneutral og flytter kun mellem to bånd i grafen.

Fixturen er husstanden fra [PRD'en](https://github.com/jbhdk/PensionPlanner/issues/1):
Jesper født 1973 med tre ratepensioner oprettet før 1. maj 2007, Anne født 1985, og et
forløb forskudt med tolv år. Beløbene er opdigtede, men størrelsesordenen er valgt, så
planen akkurat holder — bufferen bunder i 782.198 kr. i sidste år, under ét års udgifter. Det er med vilje: en
plan med rigelig margin viser ikke, hvor fladen skal være præcis.

## Skitsekonventionen

Fladen taler dansk efter [CONTEXT.md](../../CONTEXT.md), og et ord, der ikke står i
glossaret, må ikke stå på skærmen. Mock-uppen bryder den regel bevidst nogle steder, og
de steder er mærket — stiplet ramme og et **skitse**-mærke, ligesom `<<skitse>>` i
diagrammerne. Et skitsemærket ord er ikke afgjort og skal gennem glossaret, før det
bliver til kode.

Mærket sidder på: **Bolig og lån** (hele etape 4) og **milepælene** i formuegrafen. Det
sad også på **sammenligningen af planer**, som nu er droppet — ordet skal derfor aldrig
gennem glossaret. Og det sad på **cashflow-grafen**, som er nået igennem: den hedder nu
`Surplus` · årets overskud i CONTEXT.md, og ordet "cashflow" står på `Entry`s _Avoid_-liste.

## De fem skærme

| Skærm | Hvad den afgør | Status |
|---|---|---|
| `#hoved` | Om planspalten bærer alle etaper, og om årstabellen tåler tolv kolonner | Afløst af `navigator.html#b3-fane` |
| `#forklar:2043` | Det tætteste skærmbillede i hele appen. Bygges allerede i etape 1 ([#13](https://github.com/jbhdk/PensionPlanner/issues/13)) | Bærer |
| `#cashflow` | Divergerende stablet søjlegraf | Formen genindført, jf. [ADR-0026](../adr/0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md) |
| `#sammenlign` | Flere planer oven i hinanden, og hvad planspalten så viser | Droppet |
| `#fejl` | Ugyldig plan mod uholdbar plan, og markeringen af de år, hvor bufferen er tom | Bærer |

De tre sidste står stadig i `index.html`, som de blev tegnet. De bliver stående som
dokumentation af, hvad der blev prøvet — ikke som forlæg. Hvad der er afgjort om hver af
dem:

**`#forklar:2043` bærer.** Indholdet er rigtigt: skattelagene pr. person, afkastet pr.
beholdning, posterne med forfald og vægt. Det, der mangler, er B3's udtryk — samme
spaltehoved, samme kort, samme talformat som navigatoren. Formen skal ikke opfindes igen,
kun styles.

**`#cashflow`s form er genindført med indvendingen indbygget.** Den blev forkastet, fordi
det interessante er, om årets resultat — løn plus ordninger plus ydelser minus skat minus
udgifter — nogensinde bliver negativt, og et fortegnsskift i én størrelse er præcis det, en
stabling af mange kategorier skjuler. Den størrelse hedder nu `Surplus` og tegnes i sit
eget panel under stablingen med sin egen skala, så fortegnsskiftet ikke kan forsvinde i
båndene. Stablingen ovenover har syv faste bånd, som alle er begreber fra CONTEXT.md —
indtægtsposter, ydelser, udbetalinger og overførsler ind, mod skat, udgiftsposter og
indbetalinger — og ikke ét bånd pr. post, hvis antal ville følge planen frem for designet.
Se [ADR-0026](../adr/0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md).
Skærmen herunder står som den blev tegnet og er ikke rettet efter beslutningen.

**`#sammenlign` er droppet, ikke udskudt.** Den koster en tilstand i resultatspalten og et
ubesvaret spørgsmål om, hvad planspalten så viser, og den svarer ikke på mere, end to
browserfaner gør. Planvælgeren i topbjælken bliver.

Klik på en række i årstabellen for at åbne forklar-året. Klik på en beholdning i venstre
spalte for at folde detaljeruden ud. Omskifteren mellem dagens kroner og løbende priser
virker.

**2043 er årsvalget, der betyder noget.** Ratepensionerne er tømt året før, så de rammer
aldrig pensionstillægget — præcis den manøvre, PRD'en handler om. Og alligevel er
tillægget nul, fordi 8,5 mio. kr. i lagerbeskattede frie midler aftrapper det helt af sig
selv. Se også 2054, hvor Annes ordninger begynder, og 2057, hvor hun selv bliver
pensionist og aftrapningssatsen falder fra 32 % til 16 %.

**Loftet ses bedst i `#forklar:2029.`** Dér binder Jespers ratepensionsloft — 8 % af en
bruttoløn på 1,15 mio. kr. er mere end fradragsloftet, og det overskydende går stadig ind i
ordningen, blot uden fradragsret. Samme år står aktiesparekontoen med et råderum på nul, så
årets indbetaling til den blev afvist og blev liggende. I 2043 er kun Annes to bidrag
tilbage, og intet loft binder.

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

**En flytning ind i en ordning var bogført som en overførsel.** Fixturens 15.000 kr. om
året fra Jespers frie midler til aktiesparekontoen stod blandt overførslerne. Destinationen
er en ordning med et loft, og så er det en indbetaling, uanset hvor pengene kom fra —
[ADR-0016](../adr/0016-indbetalingen-kendes-paa-sin-destination.md). Flytningen står nu
blandt indbetalingerne, og det viser samtidig, hvad et `OnBalance`-loft gør: råderummet er
loftet minus saldoen primo, og da kontoen allerede stod tæt på loftet, kom kun 12.200 kr.
ind det første år og ingenting derefter. Pengene blev liggende i kilden, og intet er
markeret — der er ikke sket noget ulovligt.

**Aktiesparekontoens skat blev betalt af bufferen.** Beholdningsskatten bæres af
beholdningen selv og trækkes af dens saldo; det gælder også aktiesparekontoens egen sats,
som mock-motoren lod husstandens pengestrøm bære. Den er nu trukket i beholdningen, og
forklar-årets regnetabel har fået **Beholdningsskat** som sin egen kolonne ved siden af
afkastet — én kolonne for begge satser, så afkast og skat kan efterregnes hver for sig.

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
   markeres i stedet — én tone for *ufuldstændig* og én for *uholdbar* — og dybden står
   som beløb i mærkatet og i tabellens bufferkolonne. Se `#fejl`.

   Det var oprindeligt krav 1, at et bånd skulle kunne krydse nul, og det er dét krav,
   flest biblioteker fejler på. Det er nu afgjort, at det ikke er nødvendigt. Prisen er,
   at stablens overkant ikke er formuen i de år: den overvurderer med det, bufferen
   mangler. Tabellen har det rigtige tal.
2. **En markering af et interval på x-aksen, foran serierne.** Egen tone pr. tilstand og et
   mærkat pr. spænd. Det er krav 1's anden halvdel, og det er dét, der er kommet i stedet
   for det krydsende bånd. Se `#fejl`.

   Markeringen lå oprindelig *bag* serierne, og dér forsvandt den præcis, når stablingen
   var høj — hvilket er netop, hvad en ufuldstændig plan har: pengene er der, de står bare
   bundet. Foran må den til gengæld ikke lægge en flade over dataene, for en tone hen over
   båndene ændrer de farver, legenden lover. I stedet **dæmpes serierne inden for spændet**
   (trukket mod gråt og mørknet), så markeringen bæres af kanterne og mærkatet.
   Det kræver, at biblioteket kan klippe og filtrere et lag pr. spænd.
3. **Klik på et år**, der åbner forklar-året, og som holder grafen og tabelrækken
   synkroniseret.
4. **Grafen måles efter den plads, den har, og tegnes om** — ved vinduesskift, og når
   inspektørskuffen åbner eller lukker. En fast højde duer ikke.
5. Dansk talformatering, `tabular-nums`, og en akse i millioner. Begge akser bærer deres
   enhed — `mio. kr.` som overskrift over mærkatsøjlen, `år` under årstallene — og
   y-margenen retter sig efter det længste mærkat, så intet ciffer klippes af kanten.
   Hvilke kroner det er, siger omskifteren over grafen, og det gentages ikke på aksen.

Ét krav er faldet bort: **flere serier af samme slags oven i hinanden** stod som krav 3 til
plansammenligningen, som er droppet. Den **divergerende stablede søjlegraf** stod som krav 2
med henvisning til `#cashflow` og faldt bort med den form — men er tilbage som krav, nu med
to paneler over en delt x-akse og hver sin y-skala, jf.
[ADR-0026](../adr/0026-aarets-overskud-taeller-afkastet-ude-men-skatten-af-det-med.md).
Kravet ændrer ikke ADR-0011: `d3-shape` stabler divergerende uden videre, og et panel mere
er et `<svg>` mere.

Recharts står nævnt i #17 med et "eller tilsvarende". Punkt 1, 2 og 4 er dem, der skal
afprøves med kode, før det bliver til en beslutning — og den beslutning hører i en ADR.
Spiket er [#18](https://github.com/jbhdk/PensionPlanner/issues/18).

## Åbne punkter

- **Milepælene i formuegrafen** (erhvervsophør, udbetalingsstart, folkepension) er
  fladekortets eget påfund. De er ikke i glossaret og ikke lovet nogen steder.
- **Farverne** er en tonal ramp valgt for at kunne skelne ni bånd. Det er ikke et
  designforslag, og især ikke afprøvet for farveblindhed.
- **Etape 4's ord** — bolig, lån, restgæld, ejendomsværdiskat, grundskyld, nedsparingslån
  — mangler i glossaret. Afsnittet står tomt og skitsemærket, indtil de er der.
