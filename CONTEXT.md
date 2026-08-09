# Pensionsplanner

Et personligt værktøj til at fremskrive én husstands økonomi år for år fra i dag og gennem hele pensionen, med danske skatte- og pensionsregler indregnet.

## Language

### Husstanden

**Husstand**:
Den samlede enhed der simuleres: én eller to personer der er gift eller samlevende og fuldt skattepligtige i Danmark hele forløbet igennem.
_Avoid_: Familie, hjem, bruger

**Person**:
Et individ i husstanden med egen fødselsdato, egne konti og egen skatteopgørelse.
_Avoid_: Bruger, ægtefælle, medlem

### Tid og penge

**Simuleringsår**:
Ét kalenderår. Den mindste tidsenhed motoren regner i, og den enhed al skat opgøres i.
_Avoid_: Periode, step, tick

**Løbende priser**:
Beløb i det pågældende simuleringsårs egne kroner. Alt internt i motoren regnes i løbende priser.
_Avoid_: Nominelle kroner, fremskrevne beløb

**Dagens kroner**:
Beløb deflateret tilbage til startårets prisniveau. Standardvisningen i brugerfladen.
_Avoid_: Reale kroner, faste priser, nutidskroner

### Formue og pensioner

**Beholdning**:
En pensions- eller opsparingspost med en saldo, du ejer: den forrentes, beskattes løbende og tømmes af en udbetalingsplan. Ratepension, aldersopsparing, aktiesparekonto og frie midler er beholdninger.
_Avoid_: Konto, depot, opsparing

**Ydelse**:
En årlig strøm uden en saldo du ejer, fastlagt af regler eller af et selskabs tilsagn. Folkepension og ATP er ydelser.
_Avoid_: Udbetaling, indtægt, ret

**Livrente**:
En pensionspost med både en saldo og et livsvarigt udbetalingstilsagn: saldoen forrentes som en beholdning, men omsættes ved udbetalingsstart til en livsvarig årlig strøm.
_Avoid_: Livsvarig alderspension, annuitet

**Annuitetsdivisor**:
Det tal en livrentes saldo divideres med for at give årets livsvarige ydelse. Udledes af selskabets oplyste ydelse ved udbetalingsstart og skaleres derefter med alderen.
_Avoid_: Annuitetsfaktor, omregningsfaktor, kapitaliseringsfaktor

**Frie midler**:
Husstandens beskattede opsparing uden bindinger. Fungerer som buffer: årets samlede over- eller underskud lander her, og en negativ saldo betyder, at planen ikke holder.
_Avoid_: Kontanter, bankkonto, opsparing, likvider

**Udbetalingsplan**:
Angivelsen af hvornår en beholdning begynder at blive tømt, over hvor mange år, og efter hvilket beregningsprincip. Brugeren vælger start og varighed — ikke det årlige beløb, som følger af princippet og saldoen.
_Avoid_: Udbetalingsstrategi, hæveplan, profil

**Serieprincippet**:
Beregningsprincip hvor årets rate er saldoen ved årets begyndelse divideret med antallet af resterende udbetalingsår. Giver stigende rater ved positivt afkast.
_Avoid_: Lineær udbetaling, ligedeling

**Annuitetsprincippet**:
Beregningsprincip hvor årets rate beregnes som en annuitet ud fra saldoen ved årets begyndelse og en lovfastsat amortisationsrente. Giver tilnærmelsesvis lige store rater.
_Avoid_: Fast rate, konstant udbetaling

### Skat og satser

**Satsår**:
Et komplet sæt af officielle satser og beløbsgrænser gældende for ét kalenderår, med kildeangivelse. Simuleringsår efter det sidst kendte satsår får satser ved fremskrivning.
_Avoid_: Skatteår, satssæt, parametre

**Topskat**:
Udelukkende det 7,5 %-lag der rammer personlig indkomst over topskattegrænsen. Bruges aldrig som samlebetegnelse for mellemskat, topskat og top-topskat — de tre lag benævnes hver for sig.
_Avoid_: Topskat brugt om progressionen som helhed

### Pengestrømme

**Post**:
En navngiven ind- eller udbetaling med beløb i dagens kroner, ejer, periode, gentagelse og egen reguleringssats. Indtægtsposter bærer desuden en skattebehandling; udgiftsposter gør ikke.
_Avoid_: Linje, række, cashflow, transaktion

**Forankring**:
Om en posts periode er bundet til kalenderår eller til en persons alder. Aldersforankrede poster flytter sig automatisk, når pensioneringstidspunktet ændres.
_Avoid_: Tidsbinding, reference

**Gentagelse**:
Hvor ofte en post falder inden for sin periode: hvert år, én gang, eller hvert N. år.
_Avoid_: Frekvens, interval, kadence

### Plan og resultat

**Plan**:
En komplet, selvstændig beskrivelse af husstanden og alle dens antagelser og beslutninger. Scenarier er uafhængige planer, ikke varianter af en fælles kerne.
_Avoid_: Scenarie, opsætning, konfiguration, model

**Årsresultat**:
Motorens fulde output for ét simuleringsår, inklusive alle mellemregninger — ikke kun totaler. Grundlaget for både tabel, graf og forklaring af et enkelt år.
_Avoid_: Række, resultat, output, snapshot

**Aftrapningsgrundlag**:
Den indkomst der reducerer pensionstillægget. Omfatter ATP, livrente- og ratepensionsudbetalinger samt nettokapitalindkomst — men hverken arbejdsindkomst eller udbetalinger fra aldersopsparing. Ægtefællens indkomst indgår med 54 % bortseelse, og ægtefællens arbejdsindkomst indgår slet ikke.
_Avoid_: Modregningsgrundlag, indtægtsgrundlag

### Aldre

**Erhvervsophør**:
Det år en person holder op med at arbejde. En fri beslutning, ikke en lovbestemt alder, og det primære håndtag når scenarier sammenlignes.
_Avoid_: Pensionsalder, pensionering, tilbagetrækning

**Pensionsudbetalingsalder**:
Den tidligste alder hvor en bestemt ordning lovligt må udbetales. En egenskab ved ordningen, ikke ved personen — samme person kan have flere ordninger med hver sin.
_Avoid_: Udbetalingsalder, pensionsalder

**Udbetalingsregime**:
Det regelsæt der fastlægger en ordnings pensionsudbetalingsalder, afgjort af oprettelsestidspunktet: før 1. maj 2007 giver fast 60 år, 1. maj 2007 til 31. december 2017 giver fem år før folkepensionsalderen, og fra 1. januar 2018 tre år før. Det er aftaletidspunktet for oprettelsen der tæller, ikke hvornår der er indbetalt.
_Avoid_: Overgangsregel, aldersgrænse, grandfathering

**Folkepensionsalder**:
Den lovbestemte alder hvor folkepensionen begynder, fastsat efter fødselsår. For fødselsår hvor den endnu ikke er vedtaget, er den et fremskrevet skøn der kan overstyres.
_Avoid_: Pensionsalder, officiel pensionsalder

**Broperiode**:
Årene mellem en persons erhvervsophør og det tidspunkt hvor personens første ordning må udbetales. Skal finansieres af frie midler alene.
_Avoid_: Overgangsperiode, ventetid, gap
