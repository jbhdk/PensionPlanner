# En persons horisont stopper hendes egen indkomst, ikke husstandens udgifter eller hendes beholdninger

`Person.horizon` bruges i dag kun ét sted i motoren: til at finde husstandens sidste simuleringsår som `Math.max` af alle personers `birthYear + horizon`. I en husstand med to personer og forskellig horisont betyder det, at den, hvis horisont nås først, alligevel bliver ved med at få folkepension, ATP og livrenteydelse regnet med helt frem til den andens horisont — feltforklaringen lover "løber til og med for denne person", men intet i koden holder det løfte for den enkelte.

Rettelsen er snæver: en indtægtspost (`Entry` med `direction: 'Income'`), folkepensionen og en omsat livrentes ydelse stopper alle ved ejerens egen horisont — også selvom en indtægtspost eksplicit har fået sat et slutpunkt, der ligger senere. Udgiftsposter er upåvirkede, uanset hvilken persons alder deres periode måtte være forankret til, og beholdninger — ratepension, aldersopsparing, frie midler, aktiesparekonto — fortsætter helt uændret: de forrentes, beskattes og tømmes af deres udbetalingsplaner og overførsler præcis som før.

De to undtagelser er bevidste, ikke en tilfældig afgrænsning. `Entry.owner` bruges til to ting, der falder fra hinanden her: hvis personlige indkomst beløbet er, og hvis alder en aldersforankret periode måles fra. Kun det første er en grund til at stoppe noget — en udgift er husstandens, ikke personens, ligesom bufferen er det, og fortsætter derfor til husstandens fælles sidste år. Beholdninger blev overvejet frosset (ingen mere afkast, skat eller udbetaling), men det er lige så urealistisk som at lade dem køre: en beholdning forsvinder ikke og fryser ikke, den går til den efterlevende under uskiftet bo. En rigtig overførsel til den efterlevende blev også overvejet og forkastet — den ville skulle vælge, hvilken af den efterlevendes beholdninger pengene lander på, håndtere at aktiesparekontoen kun må være én pr. person (`UniquePerPerson`), og afgøre den fremtidige skattebehandling, og det er præcis den kompleksitet, `docs/udskudt.md`s efterladtescenarie allerede har udskudt.

## Konsekvenser

Efter en persons horisont fortsætter hendes beholdninger med at blive beskattet og indgå i skatteopgørelsen, som var hun her endnu — en kendt, accepteret unøjagtighed, ikke en fejl der skal rettes her. Den efterlevendes `CivilStatus` og pensionstillæggets aftrapningsgrundlag skifter heller ikke til enlig-sats, og husstandens udgifter falder ikke til de ca. 70 %, et reelt dødsfald ville give. Alle tre hører til det udskudte efterladtescenarie.

`docs/udskudt.md`s note om, at "`Person` har et slutår fra dag ét, så mekanikken kan slås til" er nu delvist indfriet — indkomstsiden er bygget, og det resterende, når efterladtescenariet tages op, er overførslen af beholdninger og den efterlevendes ændrede skatteforhold.

## Se også

- [ADR-0023](./0023-atp-er-en-post-folkepensionen-en-udledning-og-benefit-ingen-type.md) — hvorfor ATP er en almindelig `Entry` og dermed omfattet af samme regel som enhver anden indtægtspost
- [ADR-0004](./0004-frie-midler-pr-person-med-udpeget-buffer.md) — hvorfor en udgift, ligesom bufferen, er husstandens og ikke personens
- [docs/udskudt.md](../udskudt.md) — efterladtescenariet, som denne rettelse indsnævrer men ikke bygger
