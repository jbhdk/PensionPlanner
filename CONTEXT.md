# Pensionsplanner

Et personligt værktøj til at fremskrive én husstands økonomi år for år fra i dag og gennem hele pensionen, med danske skatte- og pensionsregler indregnet.

Strukturen bag begreberne herunder er tegnet i [docs/diagrams/](./docs/diagrams/), og beslutningerne bag den står i [docs/adr/](./docs/adr/).

PRD'er og issues ligger på GitHub, ikke i repoet: [hoved-PRD'en](https://github.com/jbhdk/PensionPlanner/issues/1) beskriver hele værktøjet, og hver etape har sit eget issue. Repoet rummer det varige — glossaret, ADR'erne, diagrammerne og satsårene.

## Language

Hver term har et dansk navn — det vi taler — og et engelsk identifier i backticks, som er det navn koden, typerne og diagrammerne bruger. Parret er bindende begge veje: findes ordet ikke her, findes det heller ikke i koden.

Fire navnefælder, der er lette at falde i:

- Dansk **rate** (én årlig udbetaling fra en ratepension) hedder `instalment` på engelsk. Dansk **sats** hedder `rate`. De to må aldrig bytte plads.
- Dansk **udbetaling** dækker både `payout` (penge ud af en beholdning) og `benefit` (en ydelse uden saldo). Vælg det snævre ord.
- `Allowance` er de tre ligningsmæssige fradrag under ét. `PersonalAllowance` er ikke et af dem, selv om det deler ordet — personfradraget nedsætter også bundskattens grundlag.
- `Annuity` optræder i to ubeslægtede sammenhænge: `LifeAnnuity` (livrente, en beholdning der omsættes) og `AnnuityPrinciple` (annuitetsprincippet, en beregningsmåde for en ratepension). De har intet med hinanden at gøre.

Ordninger og beskatningsformer, der ikke har en egen term herunder, men som koden navngiver:
`InstalmentPension` (ratepension), `OldAgeSavings` (aldersopsparing), `ShareSavingsAccount` (aktiesparekonto), `ShareIncome` og `CapitalIncome` (de to beskatningsformer for frie midler), `StatePension` (folkepension), `BasicAmount` (grundbeløb), `PensionSupplement` (pensionstillæg), `PalTax` (PAL-skat), `AnnualCostRate` (ÅOP), `BottomBracketTax` / `MiddleBracketTax` / `TopBracketTax` / `AdditionalTopBracketTax` (bund-, mellem-, top- og top-topskat, efter skat.dk's egne engelske betegnelser), `LabourMarketContribution` (AM-bidrag), `PersonalAllowance` (personfradrag), `MunicipalTax` (kommuneskat), `ChurchTax` (kirkeskat), `EarnedIncome` (arbejdsindkomst), `PersonalIncome` (personlig indkomst) og `TaxableIncome` (skattepligtig indkomst).

Fradrag, lofter og øvrige satsbegreber, som koden navngiver:
`TaxCeiling` (skråt skatteloft), `EmploymentAllowance` (beskæftigelsesfradrag), `JobAllowance` (jobfradrag), `ExtraPensionAllowance` (ekstra pensionsfradrag), `Taper` (aftrapningen af pensionstillægget) og `CivilStatus` (civilstand).

### Husstanden

**Husstand** · `Household`:
Den samlede enhed der simuleres: én eller to personer der er gift eller samlevende og fuldt skattepligtige i Danmark hele forløbet igennem.
_Avoid_: Familie, hjem, bruger

**Person** · `Person`:
Et individ i husstanden med egen fødselsdato, egne konti og egen skatteopgørelse.
_Avoid_: Bruger, ægtefælle, medlem

**Kommune** · `Municipality`:
Den kommune en person er bosat i. Vælges fra en liste, ikke skrives som et tal — kommune- og kirkeskatteprocenten hører til satsåret og slås op dér for hvert simuleringsår, ikke gemt som et tal på personen selv.
_Avoid_: Bopælskommune, adresse

**Medlem af folkekirken** · `ChurchMember`:
Om en person betaler kirkeskat. Uafhængig af `Municipality`: to personer i samme kommune kan have hver sit svar.
_Avoid_: Kirkeskattepligtig

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

**Afkast** · `Return`:
Årets forrentning af en beholdnings saldo. Tilskrives saldoen som en sidesløjfe og passerer aldrig årets pengestrøm — det bliver først til penge, husstanden kan bruge, når der hæves.
_Avoid_: Rente, gevinst, forrentning brugt om andet end selve tilskrivningen

**Bruttoafkast** · `GrossReturn`:
Beholdningens faste forventede afkast før omkostninger, angivet pr. beholdning frem for som aktivallokering, jf. [ADR-0003](./docs/adr/0003-fast-afkast-pr-beholdning.md).
_Avoid_: Forventet afkast, markedsafkast

**Nettoafkastsats** · `NetReturn`:
Bruttoafkast minus ÅOP — den sats motoren rent faktisk forrenter saldoen med. Udledt af de to og aldrig et selvstændigt gemt felt.
_Avoid_: Nettoafkast brugt som et felt på `Holding`, realafkast

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

**Bufferens tilstand** · `BufferState`:
Hvorfor bufferen er negativ i ét simuleringsår: `Incomplete`, når husstanden har likviditet andetsteds og blot mangler en overførsel, eller `Unsustainable`, når husstandens samlede frie midler også er negative. Et resultat på linje med resten af `YearResult`, ikke en valideringsfejl, og afgjort år for år — samme plan kan være `Incomplete` i de tidlige år og `Unsustainable` senere, jf. ADR-0008.
_Avoid_: Ufuldstændig og uholdbar brugt om hele planen frem for om ét år, fejltilstand, valideringsfejl

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

**§ 20-fremskrivning** · `Section20ProjectionAssumption`:
Planens antagelse om den årlige stigning i de beløbsgrænser, personskattelovens § 20 regulerer, for simuleringsår efter det sidst kendte satsår. Andel pr. år, ikke procent. Selvstændig af `inflationAssumption` og `BenefitProjectionAssumption`, fordi de tre følger hvert sit indeks.
_Avoid_: Fremskrivning, beløbsregulering, indeksering

**Satsregulering** · `BenefitProjectionAssumption`:
Planens antagelse om den årlige stigning i satsregulerede ydelser — folkepensionens grundbeløb og pensionstillæg — for simuleringsår efter det sidst kendte satsår. Andel pr. år, ikke procent. Rører kun ydelsernes kronebeløb, aldrig aftrapningens procent.
_Avoid_: Ydelsesregulering, satsfremskrivning

**Satsgrundlag** · `RateBasis`:
Om et `YearResult` er regnet på et kendt satsår eller på et fremskrevet, og i så fald hvilket kendt satsår fremskrivningen løber fra. Tilføjes et nyt kendt satsår, overtager det automatisk de simuleringsår, der før blev fremskrevet.
_Avoid_: Satsår brugt som om det altid var kendt, fremskrivningsgrundlag

**Topskat** · `TopBracketTax`:
Udelukkende det 7,5 %-lag der rammer personlig indkomst over topskattegrænsen. Bruges aldrig som samlebetegnelse for mellemskat, topskat og top-topskat — de tre lag benævnes hver for sig.
_Avoid_: Topskat brugt om progressionen som helhed

**Skattelag** · `TaxLayer`:
Ét af de lag, en persons skat falder i — AM-bidrag, bundskat, kommuneskat, kirkeskat og progressionslagene. Lagene opgøres og vises hver for sig; kun summen af dem er skatten. Aktieindkomstens to lag er ikke blandt dem: de er husstandens og hører til `HouseholdTaxAssessment`.
_Avoid_: Skattetrin, skatteart, bracket

**Progressionslag** · `ProgressionLayer`:
De tre skattelag over mellemskattegrænsen — mellemskat, topskat og top-topskat — under ét. Hvert har sin egen grænse, sin egen sats og sit eget trin på det skrå skatteloft, og de tre ligger oven på hinanden frem for at afløse hinanden. Ordet findes for at `TopBracketTax` aldrig skal bruges som samlebetegnelse for dem.
_Avoid_: Topskat brugt om de tre, progressionstrin, bracket

**Ligningsmæssigt fradrag** · `Allowance`:
Et fradrag der kun nedsætter den skattepligtige indkomst — grundlaget for kommune- og kirkeskat — og ikke den personlige indkomst. De tre er beskæftigelsesfradraget, jobfradraget og det ekstra pensionsfradrag, og de opgøres hver for sig ligesom skattelagene. Personfradraget er ikke et af dem: det hører til de enkelte lag og nedsætter også bundskattens grundlag.
_Avoid_: Fradrag, ligningsfradrag, deduction

**Skatteopgørelse** · `TaxAssessment`:
Skatten for ét simuleringsår og én person, opgjort med hvert lag for sig og stemplet med det satsår, den er regnet på. Totalen er summen af lagene, ikke et felt ved siden af dem.
_Avoid_: Skatteberegning, årsopgørelse, skattetotal

**Husstandsskatteopgørelse** · `HouseholdTaxAssessment`:
Husstandens samlede skat for ét simuleringsår: hver persons egen skatteopgørelse og marginalskat, plus aktieindkomstens skat, som er husstandens og ikke nogen enkelt persons — progressionsgrænsen er fælles og overførbar mellem ægtefæller og kan derfor ikke fordeles. Totalen er summen af det hele og aldrig et felt ved siden af delene, ligesom i `TaxAssessment`.
_Avoid_: Husstandsskat, samlet skatteopgørelse, familieopgørelse

**Facitcase** · `WorkedExample`:
Et gennemregnet eksempel med kilde og verifikationsdato, som skatteopgørelsen prøves imod. Tallene står som data frem for som assertions spredt ud i en test, så det kan ses, hvor de kommer fra, og hvornår de sidst er efterset. Bygger casen på et satstal, der endnu ikke er officielt bekræftet, siger den det selv.
_Avoid_: Testcase, eksempel, referenceberegning

### Pengestrømme

**Post** · `Entry`:
En navngiven ind- eller udbetaling med beløb i dagens kroner, ejer, periode og gentagelse. Indtægtsposter bærer desuden en skattebehandling og en egen reguleringssats; udgiftsposter har ingen af delene og følger planens inflationsantagelse.
_Avoid_: Linje, række, cashflow, transaktion

**Retning** · `Direction`:
Om en post lægger til eller trækker fra husstandens pengestrøm: `Income` eller `Expense`. Beløbet er positivt i begge retninger — fortegnet er retningens arbejde, ikke beløbets. Kun `Income` bærer en skattebehandling.
_Avoid_: Fortegn, type, ind/ud

**Skattebehandling** · `TaxTreatment`:
Det skattemæssige spor en indtægtspost lander i: `EarnedIncome`, som er AM-pligtig og indgår i den personlige indkomst, eller `TaxFree`, som ikke beskattes. Kun indtægtsposter bærer den — en udgiftspost har ikke feltet.
_Avoid_: Skattetype, skattekode, indkomstart

**Forankring** · `Anchor`:
Om en posts periode er bundet til kalenderår eller til en persons alder. Aldersforankrede poster flytter sig automatisk, når erhvervsophørsalderen ændres.
_Avoid_: Tidsbinding, reference

**Periode** · `Period`:
Den tidsstrækning en post er aktiv i. Formen på dens endepunkter følger `Anchor`: årstal ved kalenderårsforankring, alder ved aldersforankring. Et udeladt endepunkt betyder "fra planens start" henholdsvis "til horisontens slut" — sådan skrives en post, der løber hele forløbet.
_Avoid_: Interval, tidsrum. Forveksl den ikke med et enkelt `SimulationYear`.

**Aldersendepunkt** · `AgeBound`:
Et periodeendepunkt ved aldersforankring: enten en fast alder, eller en henvisning til `WorkEndAge`. Sat til erhvervsophør følger endepunktet `Person.workEndAge` og flytter sig automatisk, uden at posten selv redigeres.
_Avoid_: Aldersgrænse, tidspunkt

**Indbetaling** · `Contribution`:
En bevægelse af penge fra husstandens pengestrøm ind i en beholdning. Bærer en skattevirkning og et loft — til forskel fra en overførsel, der har ingen af delene.
_Avoid_: Bidrag, indskud, præmie, opsparing

**Overførsel** · `Transfer`:
En dateret flytning af penge fra én beholdning til en anden inden for husstanden. Hverken en indtægt eller en udgift, og uden skattevirkning — en flytning ind i en pensionsordning er en indbetaling, ikke en overførsel.
_Avoid_: Flytning, indskud, indbetaling, omplacering

**Forfald** · `Timing`:
Hvornår inden for et simuleringsår en pengestrøm falder: jævnt fordelt over årets måneder (`'Even'`), eller i én bestemt måned (1–12). Oversættes til en vægt på årets afkast, aldrig til et tidsskridt: `Even` giver ½, måned N giver `(12 − N + 1) / 12`.
_Avoid_: Måned, dato, betalingstidspunkt

**Gentagelse** · `Recurrence`:
Hvor ofte en post falder inden for sin periode: hvert år, én gang, eller hvert N. år.
_Avoid_: Frekvens, interval, kadence

**Reguleringssats** · `RegulationRate`:
En indtægtsposts egen fremskrivningssats, uafhængig af planens `inflationAssumption` — to indtægter med hver sin sats vokser hver sit tempo. Andel pr. år, ikke procent. Kun indtægtsposter har den: en løn stiger hurtigere end priserne, og den forskel afgør, hvor meget der er lagt til side ved erhvervsophør. Udgiftsposter og overførsler følger planens inflationsantagelse og har ikke feltet.
_Avoid_: Inflation brugt om en enkelt post, fremskrivningsprocent

### Plan og resultat

**Plan** · `Plan`:
En komplet, selvstændig beskrivelse af husstanden og alle dens antagelser og beslutninger — men ikke af satserne, som er delt referencedata. Scenarier er uafhængige planer, ikke varianter af en fælles kerne.
_Avoid_: Scenarie, opsætning, konfiguration, model

**Årsresultat** · `YearResult`:
Motorens fulde output for ét simuleringsår, inklusive alle mellemregninger og hvilket satsgrundlag de er regnet på — ikke kun totaler. Grundlaget for både tabel, graf og forklaring af et enkelt år.
_Avoid_: Række, resultat, output, snapshot

**Beholdningsår** · `HoldingYear`:
Én beholdnings tal for ét simuleringsår: primo- og ultimosaldo, årets afkast, og den vægtede strøm afkastet blev regnet af. Beholdningens navn og satser står i planen og gentages ikke her.
_Avoid_: Beholdningsresultat, saldolinje, kontoudtog

**Postår** · `EntryYear`:
Én posts beløb i ét simuleringsår, i årets egne løbende priser — kun for de poster der faktisk falder i året. Forfaldet står ikke her; det er en egenskab ved posten selv.
_Avoid_: Postresultat, årspost, betaling

**Personår** · `PersonYear`:
Én persons skatteopgørelse for ét simuleringsår, sammen med årets aktie- og kapitalindkomst og personens marginalskat. Aktieindkomstens skat står ikke her: den er en husstandsberegning.
_Avoid_: Personresultat, skatteår, opgørelse

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
