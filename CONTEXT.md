# Pensionsplanner

Et personligt værktøj til at fremskrive én husstands økonomi år for år fra i dag og gennem hele pensionen, med danske skatte- og pensionsregler indregnet.

Strukturen bag begreberne herunder er tegnet i [docs/diagrams/](./docs/diagrams/), og beslutningerne bag den står i [docs/adr/](./docs/adr/).

PRD'er og issues ligger på GitHub, ikke i repoet: [hoved-PRD'en](https://github.com/jbhdk/PensionPlanner/issues/1) beskriver hele værktøjet, og hver etape har sit eget issue. Repoet rummer det varige — glossaret, ADR'erne, diagrammerne og satsårene.

## Language

Hver term har et dansk navn — det vi taler — og et engelsk identifier i backticks, som er det navn koden, typerne og diagrammerne bruger. Parret er bindende begge veje: findes ordet ikke her, findes det heller ikke i koden.

Seks navnefælder, der er lette at falde i:

- Dansk **rate** (én årlig udbetaling fra en ratepension) hedder `instalment` på engelsk. Dansk **sats** hedder `rate`. De to må aldrig bytte plads.
- Dansk **udbetaling** dækker både `payout` (penge ud af en beholdning) og `benefit` (en ydelse uden saldo). Vælg det snævre ord.
- `Allowance` er de tre ligningsmæssige fradrag under ét. `PersonalAllowance` er ikke et af dem, selv om det deler ordet — personfradraget nedsætter også bundskattens grundlag.
- `Annuity` optræder i to ubeslægtede sammenhænge: `LifeAnnuity` (livrente, en beholdning der omsættes) og `AnnuityPrinciple` (annuitetsprincippet, en beregningsmåde for en ratepension). De har intet med hinanden at gøre.
- `PensionIncome` er ikke `TaperBase`. De to summer overlapper, men aftrapningsgrundlaget indeholder også positiv kapitalindkomst og aktieindkomst, og det indeholder ikke folkepensionen selv. Kaldes de begge „pensionsindkomst“, er den forskel væk.
- `Deductibility` (fradragsretten på en indbetaling) er ikke et `Allowance`. Den nedsætter den **personlige** indkomst og dermed alle lag ovenpå, hvor et ligningsmæssigt fradrag kun rører den skattepligtige indkomst. Kaldes begge bare "fradrag", er den forskel væk.

Ordninger og beskatningsformer, der ikke har en egen term herunder, men som koden navngiver:
`InstalmentPension` (ratepension), `OldAgeSavings` (aldersopsparing), `ShareSavingsAccount` (aktiesparekonto), `ShareDepot` (aktiedepot) og `SavingsAccount` (opsparingskonto), `StatePension` (folkepension), `BasicAmount` (grundbeløb), `PensionSupplement` (pensionstillæg), `PalTax` (PAL-skat), `AnnualCostRate` (ÅOP), `BottomBracketTax` / `MiddleBracketTax` / `TopBracketTax` / `AdditionalTopBracketTax` (bund-, mellem-, top- og top-topskat, efter skat.dk's egne engelske betegnelser), `LabourMarketContribution` (AM-bidrag), `PersonalAllowance` (personfradrag), `MunicipalTax` (kommuneskat), `ChurchTax` (kirkeskat), `EarnedIncome` (arbejdsindkomst), `PersonalIncome` (personlig indkomst) og `TaxableIncome` (skattepligtig indkomst).

Fradrag, lofter og øvrige satsbegreber, som koden navngiver:
`TaxCeiling` (skråt skatteloft), `EmploymentAllowance` (beskæftigelsesfradrag), `JobAllowance` (jobfradrag), `ExtraPensionAllowance` (ekstra pensionsfradrag), `Taper` (aftrapningen af pensionstillægget, hvis `spouseDisregard` er de 54 % af ægtefællens indtægt, der ses bort fra, så længe hun ikke selv modtager social pension, og hvis `fullSupplement` er tillægget for civilstanden, før aftrapningen skar i det), `AmortisationRate` (amortisationsrenten) og `CivilStatus` (civilstand).

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
_Avoid_: Konto, depot, opsparing brugt som samlebetegnelse for dem alle. De to ord er derimod de rigtige i `ShareDepot` og `SavingsAccount`, som er navne på hver sin variant.

**Pensionsordning** · `PensionScheme`:
De tre varianter, hvis udbetaling loven binder til en alder: `InstalmentPension`, `LifeAnnuity` og `OldAgeSavings`. En kategori og ikke en variant, ganske som `FreeAssets` er det, og den er hverken det ene eller det andet af de to skel, den ligner: aktiesparekontoen er ikke frie midler, men den er heller ingen pensionsordning — den har intet `OpenedOn` og ingen `PayoutAge`, og ejeren hæver af den, når hun vil.
_Avoid_: Pension, ordning brugt om alt der ikke er frie midler, pensionsprodukt

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
En årlig strøm uden en saldo du ejer, fastlagt af regler eller af et selskabs tilsagn. Aldrig en selvstændig figur i planen: livrentens ydelse udledes af omsætningen, folkepensionens grundbeløb og pensionstillæg af satsåret og folkepensionsalderen, og ATP skrives som en indtægtspost med `TaxTreatment` `PensionIncome`, fordi beløbet er brugerens eget tal fra PensionsInfo og ikke en sats. Ordet navngiver strømmen, og det eneste ydelsestal brugeren taster, er livrentens `quotedAnnualBenefit`.
_Avoid_: Udbetaling, indtægt, ret. Ydelse brugt om en type i planen

**Livrente** · `LifeAnnuity`:
En beholdning, der ved udbetalingsstart omsættes én gang til en garanteret livsvarig årlig ydelse. Depotet forrentes og modtager indbetalinger indtil da, men styrer intet bagefter.
_Avoid_: Livsvarig alderspension, annuitet

**Omsætning** · `Conversion`:
Engangshandlingen hvor en livrentes saldo ved udbetalingsstart bliver til en livsvarig ydelse. Saldoen forlader husstandens formue og styrer intet bagefter. Beløbet er hverken en udgift eller en skat, og det indgår derfor med sit eget led i balanceinvarianten — i omsætningsåret, og kun der.
_Avoid_: Kapitalisering, annuitisering, konvertering, ophør

**Omsætningsfaktor** · `ConversionFactor`:
Forholdet mellem selskabets oplyste årlige ydelse og dets oplyste depot ved udbetalingsstart. Anvendes én gang på det faktisk fremskrevne depot og ændres aldrig derefter. De to oplyste tal er hverken dagens kroner eller løbende priser, men enhedsløse: de bruges kun som kvotient, og prisniveauet går ud med sig selv i divisionen. Brugeren taster dem, som selskabet oplyser dem, og fladen hverken deflaterer eller fremskriver dem.
_Avoid_: Annuitetsdivisor, annuitetsfaktor, kapitaliseringsfaktor

**Frie midler** · `FreeAssets`:
En persons beskattede opsparing uden bindinger, i to varianter efter beskatning: `ShareDepot`, hvis afkast er lagerbeskattet aktieindkomst, og `SavingsAccount`, hvis afkast er kapitalindkomst. Varianterne hedder det, de er, og ikke det, deres afkast bliver til, jf. [ADR-0017](./docs/adr/0017-beholdningen-hedder-hvad-den-er-ikke-hvad-dens-afkast-bliver-til.md). Husstanden kan have flere sæt, ét pr. person, og de beskattes hver for sig. Aktiesparekontoen er ikke frie midler — den har et indskudsloft.
_Avoid_: Kontanter, bankkonto, opsparing, likvider

**Buffer** · `Buffer`:
Den ene beholdning i planen, som `Surplus` lander på. Den er husstandens transaktionskonto, og det er dét, der adskiller den fra enhver anden beholdning: årets jævne drift passerer den blot — indtægter, rater og ydelser kommer ind, udgifter og skat går ud — og det eneste, den efterlader, er årets overskud. Kun primosaldoen og de bevægelser, der har en dato, forrenter sig derfor på den. En jævn strøm mister kun sin vægt i bufferens ende; ordningen, den kom fra, mister den ikke.
_Avoid_: Bufferkonto, restpost, kassekredit

**Holdbar plan** · `Sustainable`:
En plan hvor bufferen aldrig går negativt inden for horisonten. En negativ buffer med likviditet andetsteds i husstanden er ikke en uholdbar plan, men en ufuldstændig — der mangler en overførsel.
_Avoid_: Bæredygtig, gyldig, robust

**Bufferens tilstand** · `BufferState`:
Hvorfor bufferen er negativ i ét simuleringsår: `Incomplete`, når husstanden har likviditet andetsteds og blot mangler en overførsel, eller `Unsustainable`, når den ikke har. Likviditet andetsteds er præcis de beholdninger, en overførsel kan nå i netop det år — de øvrige frie midler, aktiesparekontoen, og en aldersopsparing, hvis året har passeret dens `PayoutAge`. En ratepension tæller ikke med: den kan kun nås af en udbetalingsplan, der binder ti år frem, og det er en anden plan og ikke en manglende overførsel. Et resultat på linje med resten af `YearResult`, ikke en valideringsfejl, og afgjort år for år — samme plan kan være `Incomplete` i de tidlige år og `Unsustainable` senere, jf. ADR-0008.
_Avoid_: Ufuldstændig og uholdbar brugt om hele planen frem for om ét år, fejltilstand, valideringsfejl

**Udbetalingsplan** · `PayoutSchedule`:
Angivelsen af hvornår en beholdning begynder at blive tømt, over hvor mange år, og efter hvilket beregningsprincip. Findes kun på de varianter, hvis `PayoutTaxation` er `PersonalIncome` — ratepensionen, som bærer alle tre, og livrenten, som kun bærer starten, fordi den er livsvarig. De skattefri ordninger har ingen: de tømmes af en overførsel. Starten er en `AgeBound` og aldrig et kalenderår: en beholdning har en ejer at måle alderen fra, og en plan, hvis udbetalinger ikke flytter sig med `WorkEndAge`, kan ikke sammenlignes med sig selv. Brugeren vælger start og varighed — ikke det årlige beløb, som følger af princippet og saldoen. Den sidste rate er resten: når årets afkast er tilskrevet og beholdningsskatten trukket, fejes det, der står tilbage, med i den, så beholdningen lukker på nul. En plan, der efterlod en splint, ville lade den stå i formuegrafen for evigt.
_Avoid_: Udbetalingsstrategi, hæveplan, profil

**Udbetalingsprincip** · `PayoutPrinciple`:
Den af de to beregningsmåder, en udbetalingsplan regner årets rate efter: serieprincippet eller annuitetsprincippet. Et valg brugeren træffer og aldrig noget, der følger af ordningen — samme saldo og samme varighed giver hver sin ratekurve efter, hvad der er valgt. Livrenten har ingen: dens plan bærer kun starten.
_Avoid_: Udbetalingsmetode, beregningsmetode, profil, strategi

**Serieprincippet** · `SerialPrinciple`:
Beregningsprincip hvor årets rate er saldoen ved årets begyndelse divideret med antallet af resterende udbetalingsår. Giver stigende rater ved positivt afkast.
_Avoid_: Lineær udbetaling, ligedeling

**Annuitetsprincippet** · `AnnuityPrinciple`:
Beregningsprincip hvor årets rate beregnes som en annuitet ud fra saldoen ved årets begyndelse og en lovfastsat amortisationsrente. Amortisationsrenten er satsdata og aldrig beholdningens eget nettoafkast: den fastsættes for hvert udbetalingsår af Finans Danmark efter PBL § 11 A, stk. 3, og hører derfor i `RateYear`. Er nettoafkastet højere end den, stiger raterne let år for år — deraf tilnærmelsesvis lige store rater og ikke lige store.
_Avoid_: Fast rate, konstant udbetaling

### Skat og satser

**Satsår** · `RateYear`:
Et komplet sæt af officielle satser og beløbsgrænser gældende for ét kalenderår, med kildeangivelse. Delt referencedata, aldrig en del af en plan. Simuleringsår efter det sidst kendte satsår får satser ved fremskrivning.
_Avoid_: Skatteår, satssæt, parametre

**§ 20-fremskrivning** · `Section20ProjectionAssumption`:
Planens antagelse om den årlige stigning i de beløbsgrænser, personskattelovens § 20 regulerer, for simuleringsår efter det sidst kendte satsår. Andel pr. år, ikke procent. Selvstændig af `inflationAssumption` og `StatePensionProjectionAssumption`, fordi de tre følger hvert sit indeks.
_Avoid_: Fremskrivning, beløbsregulering, indeksering

**Folkepensionsregulering** · `StatePensionProjectionAssumption`:
Planens antagelse om den årlige stigning i folkepensionens grundbeløb og pensionstillæg for simuleringsår efter det sidst kendte satsår. Andel pr. år, ikke procent. Rører kun de to kronebeløb, aldrig aftrapningens procent. Navnet siger folkepension og ikke ydelser, fordi det er det eneste, feltet løfter: ATP bærer sin egen `RegulationRate` som enhver anden indtægtspost, og livrentens ydelse følger sin bonusantagelse.
_Avoid_: Satsregulering brugt om feltet — satsreguleringsprocenten regulerer meget mere end folkepensionen. Ydelsesregulering, satsfremskrivning

**Satsgrundlag** · `RateBasis`:
Om et `YearResult` er regnet på et kendt satsår eller på et fremskrevet, og i så fald hvilket kendt satsår fremskrivningen løber fra. Tilføjes et nyt kendt satsår, overtager det automatisk de simuleringsår, der før blev fremskrevet.
_Avoid_: Satsår brugt som om det altid var kendt, fremskrivningsgrundlag

**Topskat** · `TopBracketTax`:
Udelukkende det 7,5 %-lag der rammer personlig indkomst over topskattegrænsen. Bruges aldrig som samlebetegnelse for mellemskat, topskat og top-topskat — de tre lag benævnes hver for sig.
_Avoid_: Topskat brugt om progressionen som helhed

**Skattelag** · `TaxLayer`:
Ét af de lag, en persons skat falder i — AM-bidrag, bundskat, kommuneskat, kirkeskat og progressionslagene — samt loftnedslaget, som er det ene lag med negativt fortegn. Lagene opgøres og vises hver for sig; kun summen af dem er skatten. Aktieindkomstens to lag er ikke blandt dem: de er husstandens og hører til `HouseholdTaxAssessment`.
_Avoid_: Skattetrin, skatteart, bracket

**Progressionslag** · `ProgressionLayer`:
De tre skattelag over mellemskattegrænsen — mellemskat, topskat og top-topskat — under ét. Hvert har sin egen grænse, sin egen sats og sit eget trin på det skrå skatteloft, og de tre ligger oven på hinanden frem for at afløse hinanden. Ordet findes for at `TopBracketTax` aldrig skal bruges som samlebetegnelse for dem.
_Avoid_: Topskat brugt om de tre, progressionstrin, bracket

**Loftnedslag** · `TaxCeilingRelief`:
Det, staten giver afkald på, når kommuneskatten er så høj, at den sammenlagte sats ville bryde et skatteloft. Et skattelag som de øvrige — med grundlag, sats og beløb — men det ene med negativ sats og negativt beløb. Grundlaget er grundlaget for det lag, der bærer nedslaget, og satsen er de procentpoint, summen lå over loftet. Kommunen får sit fulde; nedslaget ligger i statens lag. De to lofter har hvert sit nedslag: den personlige indkomsts står blandt skattelagene og bliver stående som et tomt lag, når loftet ikke binder, mens kapitalindkomstens hører til dens egne lag og udelades ligesom dem, når det er tomt.
_Avoid_: Skatteloftsnedslag, nedslag brugt alene, loftrabat

**Ligningsmæssigt fradrag** · `Allowance`:
Et fradrag der kun nedsætter den skattepligtige indkomst — grundlaget for kommune- og kirkeskat — og ikke den personlige indkomst. De tre er beskæftigelsesfradraget, jobfradraget og det ekstra pensionsfradrag, og de opgøres hver for sig ligesom skattelagene. Personfradraget er ikke et af dem: det hører til de enkelte lag og nedsætter også bundskattens grundlag.
_Avoid_: Fradrag, ligningsfradrag, deduction

**Fradragsret** · `Deductibility`:
Den virkning at en indbetaling holdes uden for den personlige indkomst. Loven har to hjemler for den — bortseelsesret for den arbejdsgiveradministrerede ordning, fradragsret for den private — men de er numerisk identiske, og modellen skelner ikke. Hvorvidt en indbetaling har den, følger af destinationens variant: `InstalmentPension` og `LifeAnnuity` har den, `OldAgeSavings` og `ShareSavingsAccount` har den ikke. Er den loftbelagt, gælder den kun op til loftet; resten af indbetalingen går stadig ind i beholdningen, men uden virkning på skatten.
_Avoid_: Bortseelse, bortseelsesret brugt som modsætning til fradragsret, fradrag brugt alene

**Udbetalingsbeskatning** · `PayoutTaxation`:
Hvad der sker i skatten, når penge forlader en beholdning: `PersonalIncome` for ratepensionen og livrenten, `TaxFree` for aldersopsparingen, aktiesparekontoen og de to frie varianter. En egenskab ved varianten og aldrig ved den enkelte udbetaling, ligesom `Deductibility` på vejen ind. `PersonalIncome` er ikke `EarnedIncome`: en pensionsudbetaling er personlig indkomst uden AM-bidrag og giver hverken beskæftigelsesfradrag eller jobfradrag. Den afgør også, hvad der kan tømme beholdningen — kun en `TaxFree` kan tømmes af en overførsel.
_Avoid_: Udbetalingsskat, hæveskat, exit-beskatning

**Pensionsindkomst** · `PensionIncome`:
Personlig indkomst, der ikke er AM-bidragspligtig — i denne model udelukkende udbetalinger fra ratepension og livrente samt folkepension og ATP. Den indgår i den personlige indkomst og dermed i alle lag ovenpå, men den udløser hverken AM-bidrag, beskæftigelsesfradrag eller jobfradrag: bidraget er betalt på vejen ind, og de to fradrag følger arbejde. Det er derfor, den krydser skattesømmet som sit eget tal og ikke lagt sammen med `EarnedIncome`.
_Avoid_: Pensionsudbetaling brugt om summen, ikke-arbejdsindkomst, øvrig personlig indkomst

**Skatteopgørelse** · `TaxAssessment`:
Skatten for ét simuleringsår og én person, opgjort med hvert lag for sig og stemplet med det satsår, den er regnet på. Totalen er summen af lagene, ikke et felt ved siden af dem.
_Avoid_: Skatteberegning, årsopgørelse, skattetotal

**Husstandsskatteopgørelse** · `HouseholdTaxAssessment`:
Husstandens samlede skat for ét simuleringsår: hver persons egen skatteopgørelse og marginalskat, plus aktieindkomstens skat, som er husstandens og ikke nogen enkelt persons — progressionsgrænsen er fælles og overførbar mellem ægtefæller og kan derfor ikke fordeles. Totalen er summen af det hele og aldrig et felt ved siden af delene, ligesom i `TaxAssessment`.
_Avoid_: Husstandsskat, samlet skatteopgørelse, familieopgørelse

**Beholdningsskat** · `HoldingTax`:
Skatten på en beholdnings årlige afkast, båret af beholdningen selv og trukket af dens saldo. Den passerer aldrig nogen persons indkomst, og den er dermed den tredje bærer ved siden af `TaxAssessment`, som er personens, og `HouseholdTaxAssessment`, som er husstandens. Satsen følger varianten: `PalTax` for `InstalmentPension`, `OldAgeSavings` og `LifeAnnuity`, og aktiesparekontoens egen for `ShareSavingsAccount`. De to frie varianter har ingen — deres afkast beskattes hos personen eller husstanden i stedet.
_Avoid_: Lagerskat, afkastskat, depotskat

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
Det skattemæssige spor en indtægtspost lander i: `EarnedIncome`, som er AM-pligtig, indgår i den personlige indkomst, giver beskæftigelses- og jobfradrag og ikke aftrapper pensionstillægget; `PensionIncome`, som indgår i den personlige indkomst uden AM-bidrag, giver ingen af de to fradrag og tæller i `TaperBase`; eller `TaxFree`, som ikke beskattes. Hver værdi bærer hele indkomstens skattemæssige opførsel og ikke ét enkelt træk — derfor er de tre værdier og ikke tre felter. Kun indtægtsposter bærer den — en udgiftspost har ikke feltet.
_Avoid_: Skattetype, skattekode, indkomstart

**Forankring** · `Anchor`:
Om en posts periode er bundet til kalenderår eller til en persons alder. Aldersforankrede poster flytter sig automatisk, når en af personens navngivne aldre ændres.
_Avoid_: Tidsbinding, reference

**Periode** · `Period`:
Den tidsstrækning en post er aktiv i. Formen på dens endepunkter følger `Anchor`: årstal ved kalenderårsforankring, alder ved aldersforankring. Et udeladt endepunkt betyder "fra planens start" henholdsvis "til horisontens slut" — sådan skrives en post, der løber hele forløbet.
_Avoid_: Interval, tidsrum. Forveksl den ikke med et enkelt `SimulationYear`.

**Aldersendepunkt** · `AgeBound`:
Et tidspunkt angivet ved alder: enten en fast alder, eller en henvisning til `WorkEndAge`. Bruges to steder — som endepunkt i en posts periode, og som start på en beholdnings udbetalingsplan. Sat til erhvervsophør følger punktet `Person.workEndAge` og flytter sig automatisk, uden at posten eller planen selv redigeres. Alderen behøver ikke være et helt år — folkepensionsalderen er 65,5 for én årgang og 72,5 for en anden — og hvilket kalenderår endepunktet rammer, afhænger derfor også af fødselsmåneden.
_Avoid_: Aldersgrænse, tidspunkt

**Indbetaling** · `Contribution`:
En bevægelse af penge ind i en beholdning, der ikke er frie midler — altså ind i en ordning med et loft på vejen ind og regler på vejen ud. Kilden er enten en indtægtspost eller en anden beholdning. Hverken skattevirkningen eller loftet er noget, indbetalingen selv bærer: skattevirkningen følger destinationens variant, og AM-behandlingen følger kilden.
_Avoid_: Bidrag, indskud, præmie, opsparing

**Loft** · `Cap`:
Den øvre grænse for, hvad der må skydes ind i en ordning. Formen afgør, hvad loftet måler, og om pengene overhovedet kommer ind — men ikke hvad et brud koster; det følger destinationens variant. `PerYear` måler årets samlede indbetaling til ordningen og gælder ratepensionen og aldersopsparingen: pengene kommer ind, og året er markeret. Hvad markeringen dækker over, er ikke det samme de to steder. `InstalmentPension` har en fradragsret, og det overskydende mister den; `OldAgeSavings` har ingen at miste og betaler i stedet en afgift af det overskydende. De to er én form og to regler, ikke samme regel skrevet to gange. `OnBalance` måler beholdningens saldo ved årets begyndelse og gælder aktiesparekontoen: indbetalingen afkortes til råderummet, det uindskudte beløb bliver liggende i kilden, og året er ikke markeret. Ikke fordi indskuddet ville have været lovligt — det overskydende skal udloddes igen og koster en afgift — men fordi pengeinstituttet ikke tager imod det. Loftet forhindrer indskuddet frem for at straffe det, og der er derfor intet brud at markere, jf. [ADR-0019](./docs/adr/0019-aktiesparekontoens-loft-forhindrer-indskuddet-frem-for-at-straffe-det.md). Råderummet under et `OnBalance`-loft er loftet minus saldoen og ånder derfor med afkastet; vokser en saldo over sit loft af afkast alene, er intet loft brudt.
_Avoid_: Fradragsloft og indskudsloft brugt som fællesbetegnelse — de er lovens navne for hver sin enkelt ordning. Fortabt skattevirkning brugt om aldersopsparingens loft, som ingen har at fortabe. Grænse, maksimum

**Én pr. person** · `UniquePerPerson`:
Om en person kan have mere end én beholdning af varianten. Aktiesparekontoen er den eneste, der ikke kan — [ASKL § 3](https://danskelove.dk/aktiesparekontoloven/3) tillader kun én — mens flere ratepensioner, aldersopsparinger og livrenter er lovlige og skal kunne skrives: at to ratepensioner deler ét loft, er netop det, `CapYear` måler. En egenskab ved varianten og ikke ved den enkelte beholdning. Svaret er det samme i alle simuleringsår, og reglen hører derfor ved indgangen og ikke i årsresultatet, jf. [ADR-0020](./docs/adr/0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md).
_Avoid_: Enekonto, dubletregel, kun én konto

**Arbejdsgiveradministreret** · `EmployerAdministered`:
Om ordningen kan oprettes og administreres af en arbejdsgiver, så en indbetaling kan komme fra lønnen. Ratepensionen, livrenten og aldersopsparingen kan; aktiesparekontoen kan ikke — dens penge er ejerens egne, fuldt beskattede midler, og der findes ingen arbejdsgiveradministreret af slagsen. Egenskaben afgør alene, om en lønkildet indbetaling kan skrives, og aldrig hvad den koster: AM-behandlingen følger kilden, jf. [ADR-0016](./docs/adr/0016-indbetalingen-kendes-paa-sin-destination.md). En strukturel umulighed som `UniquePerPerson` og ikke et årsafhængigt brud.
_Avoid_: Firmaordning, arbejdsgiverordning, bortseelsesret

**Overførsel** · `Transfer`:
En dateret flytning af penge fra én af husstandens beholdninger til dens frie midler. Hverken en indtægt eller en udgift, og uden skattevirkning — afgiveren skal derfor være en variant, hvis `PayoutTaxation` er `TaxFree`. Det er også den, der tømmer en aldersopsparing og en aktiesparekonto: efter pensionsudbetalingsalderen er de konti, ejeren hæver af som hun vil, og en udbetalingsplan ville påstå en lovregel, der ikke findes, jf. [ADR-0022](./docs/adr/0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md). Destinationen er det, der skiller overførslen fra en indbetaling: går pengene ind i en ordning, er det en indbetaling, uanset hvor de kom fra. Perioden kan aldersforankres som en posts, og alderen måles på afgiverbeholdningens ejer — en beholdning har præcis én. Beløbet afkortes til afgiverens saldo, og forskellen står på `TransferYear`. Fladen må skrive "udbetaling" om en overførsel ud af en ordning, fordi det er det, den er i virkeligheden; det er en etiket og ikke et begreb.
_Avoid_: Flytning, indskud, indbetaling, omplacering

**Forfald** · `Timing`:
Hvornår inden for et simuleringsår en pengestrøm falder: jævnt fordelt over årets måneder (`'Even'`), eller i én bestemt måned (1–12). Oversættes til en vægt på årets afkast, aldrig til et tidsskridt: `Even` giver ½, måned N giver `(12 − N + 1) / 12`. Den ene undtagelse er bufferens ende, hvor `Even` giver nul, jf. `Buffer` — en strøm uden forfald er ikke en begivenhed, den er et niveau, og en transaktionskonto beholder ikke et niveau.
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
Én beholdnings tal for ét simuleringsår: primo- og ultimosaldo, årets afkast, den vægtede strøm afkastet blev regnet af, og årets udbetaling, når en udbetalingsplan tømmer den. En omsat livrentes ydelse står ikke her — den har ingen saldo at forlade og er en `Benefit`, ikke en `payout`. Beholdningens navn og satser står i planen og gentages ikke her.
_Avoid_: Beholdningsresultat, saldolinje, kontoudtog

**Årets overskud** · `Surplus`:
Summen af alt, der bevæger sig på bufferen i ét simuleringsår, undtagen dens eget afkast: løn og øvrige indtægtsposter, folkepension, ATP og livrenteydelser, rater og overførsler ind — minus skat, udgiftsposter, indbetalinger og overførsler ud. Er tallet negativt, er det årets underskud; det er ét begreb og to ord, og fortegnet er det, der skiller dem. Svarer på, om året bar sig selv, hvor `Sustainable` svarer på, om husstanden havde noget at tage af — et underskud er derfor ikke i sig selv en fejl, men det beløb, der skal flyttes, før året går op. Afkastet står udenfor, fordi det ikke er penge, husstanden kan bruge, før der hæves, mens skatten af det forlader bufferen som enhver anden regning: et år kan vise underskud, mens formuen vokser, og det er efter hensigten. Udledt af fire tal på bufferens `HoldingYear` — ultimo minus primo, minus afkastet, plus beholdningsskatten — og aldrig et selvstændigt gemt felt, ligesom `NetReturn`.
_Avoid_: Nettoresultat, årets resultat, cashflow, kontantstrøm, likviditet, difference

**Postår** · `EntryYear`:
Én posts beløb i ét simuleringsår, i årets egne løbende priser — kun for de poster der faktisk falder i året. Forfaldet står ikke her; det er en egenskab ved posten selv.
_Avoid_: Postresultat, årspost, betaling

**Indbetalingsår** · `ContributionYear`:
Én indbetalings to beløb i ét simuleringsår, i årets egne løbende priser — kun for de indbetalinger der faktisk falder i året. Det ene er, hvad der forlod kilden; det andet, hvad der landede i beholdningen. Forskellen er AM-bidraget, som allerede står i personens eget skattelag og derfor ikke gentages her.
_Avoid_: Bidragsår, indbetalingsresultat, indskud

**Overførselsår** · `TransferYear`:
Én overførsels to beløb i ét simuleringsår, i årets egne løbende priser — kun for de overførsler der faktisk falder i året. Det ene er, hvad planen bad om; det andet, hvad der faktisk blev flyttet, når afgiverens saldo ikke rakte. De to er ens i næsten alle år, og linjen findes for de år, hvor de ikke er: en tavs afkortning er den slags fejl, der aldrig viser sig. Forfaldet står ikke her; det er en egenskab ved overførslen selv.
_Avoid_: Overførselsresultat, flytning, hævning

**Personår** · `PersonYear`:
Én persons skatteopgørelse for ét simuleringsår, sammen med årets aktie- og kapitalindkomst, personens marginalskat på hver sin indkomstart — hvad næste krone `EarnedIncome` koster, og hvad næste krone `PensionIncome` koster husstanden, hvor aftrapningen af pensionstillægget lægger sig oveni — og de ydelser uden saldo, personen modtog: folkepensionens grundbeløb, det aftrappede pensionstillæg med hele det regnestykke det kom af — `Taper`-rækkens `fullSupplement`, `allowance`, `rate` og `spouseDisregard`, og `TaperBase`s bestanddele — og hver omsat livrentes årlige ydelse. Aktieindkomstens skat står ikke her: den er en husstandsberegning.
_Avoid_: Personresultat, skatteår, opgørelse

**Loftår** · `CapYear`:
Én persons indbetaling til én slags loftbelagt ordning i ét simuleringsår, målt mod det loft der gjaldt. Tallene følger loftets form, så linjen kan efterregnes af sig selv: ved `PerYear` hvad der landede i alt, loftet, og den del der beholdt sin fradragsret; ved `OnBalance` hvad der blev bedt om, loftet, saldoen ved årets begyndelse, og hvad der faktisk blev indskudt. Råderummet er de to mellemste trukket fra hinanden og står derfor ikke selv på linjen, ligesom `NetReturn` udledes frem for at gemmes. Måles pr. person og pr. slags og aldrig pr. beholdning eller pr. indbetaling — to ratepensioner deler ét loft. En variant uden loft har ingen linje, og linjen findes, når året **bad om** noget, ikke når noget landede: et indskud, der blev afkortet til nul, er netop det år, brugeren skal kunne se.
_Avoid_: Loftlinje, loftresultat, indbetalingsloft

**Loftbrud** · `CapBreach`:
Hvorfor et loft er brudt i ét simuleringsår: `LostDeductibility`, når det overskydende mistede sin fradragsret, eller `Chargeable`, når det i stedet er afgiftspligtigt. Et resultat på linje med `BufferState` og ikke en valideringsfejl — det samme bidrag kan være lovligt i ét år og et brud i et senere, fordi bidraget og loftet vokser med hver sin antagelse. Sker begge dele samme år, står `LostDeductibility`, som er den, der flytter årets skat.
_Avoid_: Overskridelse, loftfejl, brudt loft brugt om planen frem for om ét år

**Aftrapningsgrundlag** · `TaperBase`:
Den indkomst der reducerer pensionstillægget. Omfatter ATP, livrente- og ratepensionsudbetalinger, positiv kapitalindkomst og aktieindkomst — men hverken arbejdsindkomst, udbetalinger fra aldersopsparing eller afkast på en aktiesparekonto. Kapitalindkomsten tæller kun når den er positiv: en negativ nettokapitalindkomst lemper ikke grundlaget. Folkepensionen indgår ikke i sit eget grundlag, jf. PL § 29, stk. 4, nr. 1 — hvilket er det, der gør husstandskoblingen til ét gennemløb frem for en iteration: den ene persons tillæg afhænger aldrig af den andens tillæg, kun af den andens øvrige indkomst. Ægtefællens arbejdsindkomst indgår slet ikke, og af hendes øvrige indkomst ses bort fra 54 %, men kun så længe hun ikke selv modtager social pension, jf. PL § 49, stk. 1, nr. 4. Gør hun det, indgår hendes indkomst fuldt ud — og aftrapningsprocenten halveres samtidig. Bortseelsen er en ren procent uden maksimumbeløb. Grundlaget føres som sine bestanddele og aldrig som ét tal: egen `pensionIncome` uden folkepensionen, egen positiv `capitalIncome`, egen `shareIncome` og ægtefællens andel efter bortseelsen — summen udledes af de fire og gemmes ikke, ganske som `NetReturn` gør det. Summen er ikke bestanddelenes rå total: den opgjorte indtægt rundes nedad til nærmeste beløb deleligt med 100, jf. PL § 29, stk. 6, og nedrundingen rammer summen efter bortseelsen og før fradragsbeløbet. Bestanddelene står derfor præcist, hvor summen står afrundet.
_Avoid_: Modregningsgrundlag, indtægtsgrundlag

### Aldre

**Erhvervsophør** · `WorkEndAge`:
Det år en person holder op med at arbejde. En fri beslutning, ikke en lovbestemt alder, og det primære håndtag når scenarier sammenlignes.
_Avoid_: Pensionsalder, pensionering, tilbagetrækning

**Pensionsudbetalingsalder** · `PayoutAge`:
Den tidligste alder hvor en bestemt ordning lovligt må udbetales. En egenskab ved ordningen, ikke ved personen — samme person kan have flere ordninger med hver sin. Ofte en brøkalder, fordi to af de tre regimer er folkepensionsalderen minus fem eller tre år, og sammenligningen sker derfor i kalenderår og ikke i aldre: året, hvor personen fylder 62,5, indeholder lovlige udbetalingsmåneder, og en plan, der starter dér, findes i virkeligheden.
_Avoid_: Udbetalingsalder, pensionsalder

**Udbetalingsregime** · `PayoutRegime`:
Det regelsæt der fastlægger en ordnings pensionsudbetalingsalder, afgjort af oprettelsestidspunktet: `BeforeMay2007` giver fast 60 år, `May2007ToDecember2017` giver fem år før folkepensionsalderen, og `FromJanuary2018` tre år før. Det er aftaletidspunktet for oprettelsen der tæller, ikke hvornår der er indbetalt. De to sidste er relative, og en ordnings alder retter sig derfor af sig selv, når skønnet for ejerens folkepensionsalder ændres.
_Avoid_: Overgangsregel, aldersgrænse, grandfathering

**Oprettelsestidspunkt** · `OpenedOn`:
År og måned for den aftale, der oprettede en pensionsordning. Det er den, `PayoutRegime` slås op på, og derfor står den kun på de tre varianter, der har et regime — en aktiesparekonto og frie midler har intet at have den i. Måneden er med, fordi begge lovskel falder midt i et år; dagen er ikke, fordi ingen af dem falder midt i en måned.
_Avoid_: Oprettelsesdato, startdato, tegningstidspunkt, første indbetaling

**Bevaret udbetalingsalder** · `PayoutAgeOverride`:
Den lavere pensionsudbetalingsalder, en ordning har taget med sig gennem en overførsel, sat direkte på ordningen frem for udledt af dens `PayoutRegime`. Er den sat, vinder den. Findes, fordi en overført ordning kan bevare den alder, den blev oprettet under, uden at bære det oprettelsestidspunkt, der ville udlede den.
_Avoid_: Manuel udbetalingsalder, undtagelse, dispensation

**Folkepensionsalder** · `StatePensionAge`:
Den lovbestemte alder hvor folkepensionen begynder, fastsat efter fødselsår. For fødselsår hvor den endnu ikke er vedtaget, er den et fremskrevet skøn, som bruges som det står — ændres skønnet, er det tabellen der rettes, ikke den enkelte person.
_Avoid_: Pensionsalder, officiel pensionsalder

**Broperiode** · `BridgePeriod`:
Årene mellem en persons erhvervsophør og det tidspunkt hvor personens første ordning må udbetales. Skal finansieres af frie midler alene.
_Avoid_: Overgangsperiode, ventetid, gap
