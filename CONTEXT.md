# Pensionsplanner

Et personligt værktøj til at fremskrive én husstands økonomi år for år fra i dag og gennem hele pensionen, med danske skatte- og pensionsregler indregnet.

Strukturen bag begreberne herunder er tegnet i [docs/diagrams/](./docs/diagrams/), og beslutningerne bag den står i [docs/adr/](./docs/adr/).

PRD'er og issues ligger på GitHub, ikke i repoet: [hoved-PRD'en](https://github.com/jbhdk/PensionPlanner/issues/1) beskriver hele værktøjet, og hver etape har sit eget issue. Repoet rummer det varige — glossaret, ADR'erne, diagrammerne og satsårene.

## Language

Hver term har et dansk navn — det vi taler — og et engelsk identifier i backticks, som er det navn koden, typerne og diagrammerne bruger. Parret er bindende begge veje: findes ordet ikke her, findes det heller ikke i koden.

Tre navnefælder, der er lette at falde i:

- Dansk **rate** (én årlig udbetaling fra en ratepension) hedder `instalment` på engelsk. Dansk **sats** hedder `rate`. De to må aldrig bytte plads.
- Dansk **udbetaling** dækker både `payout` (penge ud af en beholdning) og `benefit` (en ydelse uden saldo). Vælg det snævre ord.
- `Annuity` optræder i to ubeslægtede sammenhænge: `LifeAnnuity` (livrente, en beholdning der omsættes) og `AnnuityPrinciple` (annuitetsprincippet, en beregningsmåde for en ratepension). De har intet med hinanden at gøre.

Ordninger og beskatningsformer, der ikke har en egen term herunder, men som koden navngiver:
`InstalmentPension` (ratepension), `OldAgeSavings` (aldersopsparing), `ShareSavingsAccount` (aktiesparekonto), `ShareIncome` og `CapitalIncome` (de to beskatningsformer for frie midler), `StatePension` (folkepension), `BasicAmount` (grundbeløb), `PensionSupplement` (pensionstillæg), `PalTax` (PAL-skat), `AnnualCostRate` (ÅOP), `BottomBracketTax` / `MiddleBracketTax` / `TopBracketTax` / `AdditionalTopBracketTax` (bund-, mellem-, top- og top-topskat, efter skat.dk's egne engelske betegnelser).

### Husstanden

**Husstand** · `Household`:
Den samlede enhed der simuleres: én eller to personer der er gift eller samlevende og fuldt skattepligtige i Danmark hele forløbet igennem.
_Avoid_: Familie, hjem, bruger

**Person** · `Person`:
Et individ i husstanden med egen fødselsdato, egne konti og egen skatteopgørelse.
_Avoid_: Bruger, ægtefælle, medlem

### Tid og penge

**Simuleringsår** · `SimulationYear`:
Ét kalenderår. Den mindste tidsenhed motoren regner i, og den enhed al skat opgøres i.
_Avoid_: Periode, step, tick

**Løbende priser** · `Nominal`:
Beløb i det pågældende simuleringsårs egne kroner. Alt internt i motoren regnes i løbende priser.
_Avoid_: Nominelle kroner, fremskrevne beløb

**Dagens kroner** · `Real`:
Beløb deflateret tilbage til startårets prisniveau. Standardvisningen i brugerfladen.
_Avoid_: Reale kroner, faste priser, nutidskroner

### Formue og pensioner

**Beholdning** · `Holding`:
En pensions- eller opsparingspost med en saldo, du ejer: den forrentes, beskattes løbende og tømmes af en udbetalingsplan. Ratepension, aldersopsparing, aktiesparekonto og frie midler er beholdninger.
_Avoid_: Konto, depot, opsparing

**Ydelse** · `Benefit`:
En årlig strøm uden en saldo du ejer, fastlagt af regler eller af et selskabs tilsagn. Folkepension og ATP er ydelser.
_Avoid_: Udbetaling, indtægt, ret

**Livrente** · `LifeAnnuity`:
En beholdning, der ved udbetalingsstart omsættes én gang til en garanteret livsvarig årlig ydelse. Depotet forrentes og modtager indbetalinger indtil da, men styrer intet bagefter.
_Avoid_: Livsvarig alderspension, annuitet

**Omsætning** · `Conversion`:
Engangshandlingen hvor en livrentes saldo ved udbetalingsstart bliver til en livsvarig ydelse. Saldoen forlader husstandens formue og styrer intet bagefter. Beløbet er hverken en udgift eller en skat, og det indgår derfor med sit eget led i balanceinvarianten — i omsætningsåret, og kun der.
_Avoid_: Kapitalisering, annuitisering, konvertering, ophør

**Omsætningsfaktor** · `ConversionFactor`:
Forholdet mellem selskabets oplyste årlige ydelse og dets oplyste depot ved udbetalingsstart. Anvendes én gang på det faktisk fremskrevne depot og ændres aldrig derefter.
_Avoid_: Annuitetsdivisor, annuitetsfaktor, kapitaliseringsfaktor

**Frie midler** · `FreeAssets`:
En persons beskattede opsparing uden bindinger, i to former efter beskatning: lagerbeskattet aktieindkomst og kapitalindkomst. Husstanden kan have flere sæt, ét pr. person, og de beskattes hver for sig. Aktiesparekontoen er ikke frie midler — den har et indskudsloft.
_Avoid_: Kontanter, bankkonto, opsparing, likvider

**Buffer** · `Buffer`:
Den ene beholdning i planen, som årets samlede over- eller underskud lander på.
_Avoid_: Bufferkonto, restpost, kassekredit

**Holdbar plan** · `Sustainable`:
En plan hvor bufferen aldrig går negativt inden for horisonten. En negativ buffer med likviditet andetsteds i husstanden er ikke en uholdbar plan, men en ufuldstændig — der mangler en overførsel.
_Avoid_: Bæredygtig, gyldig, robust

**Udbetalingsplan** · `PayoutSchedule`:
Angivelsen af hvornår en beholdning begynder at blive tømt, over hvor mange år, og efter hvilket beregningsprincip. Brugeren vælger start og varighed — ikke det årlige beløb, som følger af princippet og saldoen.
_Avoid_: Udbetalingsstrategi, hæveplan, profil

**Serieprincippet** · `SerialPrinciple`:
Beregningsprincip hvor årets rate er saldoen ved årets begyndelse divideret med antallet af resterende udbetalingsår. Giver stigende rater ved positivt afkast.
_Avoid_: Lineær udbetaling, ligedeling

**Annuitetsprincippet** · `AnnuityPrinciple`:
Beregningsprincip hvor årets rate beregnes som en annuitet ud fra saldoen ved årets begyndelse og en lovfastsat amortisationsrente. Giver tilnærmelsesvis lige store rater.
_Avoid_: Fast rate, konstant udbetaling

### Skat og satser

**Satsår** · `RateYear`:
Et komplet sæt af officielle satser og beløbsgrænser gældende for ét kalenderår, med kildeangivelse. Delt referencedata, aldrig en del af en plan. Simuleringsår efter det sidst kendte satsår får satser ved fremskrivning.
_Avoid_: Skatteår, satssæt, parametre

**Topskat** · `TopBracketTax`:
Udelukkende det 7,5 %-lag der rammer personlig indkomst over topskattegrænsen. Bruges aldrig som samlebetegnelse for mellemskat, topskat og top-topskat — de tre lag benævnes hver for sig.
_Avoid_: Topskat brugt om progressionen som helhed

### Pengestrømme

**Post** · `Entry`:
En navngiven ind- eller udbetaling med beløb i dagens kroner, ejer, periode, gentagelse og egen reguleringssats. Indtægtsposter bærer desuden en skattebehandling; udgiftsposter gør ikke.
_Avoid_: Linje, række, cashflow, transaktion

**Retning** · `Direction`:
Om en post lægger til eller trækker fra husstandens pengestrøm: `Income` eller `Expense`. Beløbet er positivt i begge retninger — fortegnet er retningens arbejde, ikke beløbets. Kun `Income` bærer en skattebehandling.
_Avoid_: Fortegn, type, ind/ud

**Forankring** · `Anchor`:
Om en posts periode er bundet til kalenderår eller til en persons alder. Aldersforankrede poster flytter sig automatisk, når pensioneringstidspunktet ændres.
_Avoid_: Tidsbinding, reference

**Indbetaling** · `Contribution`:
En bevægelse af penge fra husstandens pengestrøm ind i en beholdning. Bærer en skattevirkning og et loft — til forskel fra en overførsel, der har ingen af delene.
_Avoid_: Bidrag, indskud, præmie, opsparing

**Overførsel** · `Transfer`:
En dateret flytning af penge fra én beholdning til en anden inden for husstanden. Hverken en indtægt eller en udgift, og uden skattevirkning — en flytning ind i en pensionsordning er en indbetaling, ikke en overførsel.
_Avoid_: Flytning, indskud, indbetaling, omplacering

**Forfald** · `Timing`:
Hvornår inden for et simuleringsår en pengestrøm falder: jævnt fordelt over årets måneder, eller i én bestemt måned. Oversættes til en vægt på årets afkast, aldrig til et tidsskridt.
_Avoid_: Måned, dato, betalingstidspunkt

**Gentagelse** · `Recurrence`:
Hvor ofte en post falder inden for sin periode: hvert år, én gang, eller hvert N. år.
_Avoid_: Frekvens, interval, kadence

### Plan og resultat

**Plan** · `Plan`:
En komplet, selvstændig beskrivelse af husstanden og alle dens antagelser og beslutninger — men ikke af satserne, som er delt referencedata. Scenarier er uafhængige planer, ikke varianter af en fælles kerne.
_Avoid_: Scenarie, opsætning, konfiguration, model

**Årsresultat** · `YearResult`:
Motorens fulde output for ét simuleringsår, inklusive alle mellemregninger og hvilket satsgrundlag de er regnet på — ikke kun totaler. Grundlaget for både tabel, graf og forklaring af et enkelt år.
_Avoid_: Række, resultat, output, snapshot

**Aftrapningsgrundlag** · `TaperBase`:
Den indkomst der reducerer pensionstillægget. Omfatter ATP, livrente- og ratepensionsudbetalinger, positiv kapitalindkomst og aktieindkomst — men hverken arbejdsindkomst, udbetalinger fra aldersopsparing eller afkast på en aktiesparekonto. Kapitalindkomsten tæller kun når den er positiv: en negativ nettokapitalindkomst lemper ikke grundlaget. Ægtefællens indkomst indgår med 54 % bortseelse, og ægtefællens arbejdsindkomst indgår slet ikke.
_Avoid_: Modregningsgrundlag, indtægtsgrundlag

### Aldre

**Erhvervsophør** · `WorkEndAge`:
Det år en person holder op med at arbejde. En fri beslutning, ikke en lovbestemt alder, og det primære håndtag når scenarier sammenlignes.
_Avoid_: Pensionsalder, pensionering, tilbagetrækning

**Pensionsudbetalingsalder** · `PayoutAge`:
Den tidligste alder hvor en bestemt ordning lovligt må udbetales. En egenskab ved ordningen, ikke ved personen — samme person kan have flere ordninger med hver sin.
_Avoid_: Udbetalingsalder, pensionsalder

**Udbetalingsregime** · `PayoutRegime`:
Det regelsæt der fastlægger en ordnings pensionsudbetalingsalder, afgjort af oprettelsestidspunktet: før 1. maj 2007 giver fast 60 år, 1. maj 2007 til 31. december 2017 giver fem år før folkepensionsalderen, og fra 1. januar 2018 tre år før. Det er aftaletidspunktet for oprettelsen der tæller, ikke hvornår der er indbetalt.
_Avoid_: Overgangsregel, aldersgrænse, grandfathering

**Folkepensionsalder** · `StatePensionAge`:
Den lovbestemte alder hvor folkepensionen begynder, fastsat efter fødselsår. For fødselsår hvor den endnu ikke er vedtaget, er den et fremskrevet skøn der kan overstyres.
_Avoid_: Pensionsalder, officiel pensionsalder

**Broperiode** · `BridgePeriod`:
Årene mellem en persons erhvervsophør og det tidspunkt hvor personens første ordning må udbetales. Skal finansieres af frie midler alene.
_Avoid_: Overgangsperiode, ventetid, gap
