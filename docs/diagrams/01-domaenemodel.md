# Domænemodellen

Strukturen bag begreberne i [CONTEXT.md](../../CONTEXT.md). Navnene er de engelske identifiers fra glossaret — de er dem koden bruger.

Diagrammet viser **planens indhold**: det brugeren opretter og redigerer. Motorens output (`YearResult`) er bevidst holdt udenfor, fordi det er en projektion af planen, ikke en del af den.

```mermaid
classDiagram
    direction TB

    class Plan {
        +name
        +schemaVersion
        +startYear
        +inflationAssumption
        +s20Projection
        +statePensionProjection
        +buffer
    }

    class Household

    class Person {
        +birthYear
        +birthMonth
        +workEndAge
        +statePensionAge()
        +horizon
        +municipality
        +churchMember
    }

    class Holding {
        +variant
        +balance
        +grossReturn
        +annualCostRate
        +payoutAge
        +payoutTaxation()
    }

    class PayoutSchedule {
        +start
        +duration
        +principle
    }

    class LifeAnnuity {
        +quotedAnnualBenefit
        +quotedReserve
        +bonusRate
        +conversionFactor()
    }

    class Entry {
        +name
        +amountInRealKroner
        +period
        +anchor
        +recurrence
        +timing
        +regulationRate
        +taxTreatment
    }

    class PensionAgreement {
        +employerContribution
        +employeeContribution
        +fee
        +insurancePremium
    }

    class AllocationLine {
        +to
        +form
        +percentage
        +amountInRealKroner
    }

    class Contribution {
        +name
        +source
        +percentageOfEntry
        +amountInRealKroner
        +period
        +anchor
        +recurrence
        +timing
    }

    class Transfer {
        +name
        +from
        +to
        +amount
        +period
        +anchor
        +recurrence
        +timing
    }

    class Property {
        <<skitse>>
        +marketValue
        +publicValuation
        +taxRebate
    }

    class Loan {
        <<skitse>>
        +principal
        +interestRate
        +term
        +interestOnlyPeriod
    }

    Plan *-- Household
    Plan *-- "0..*" Entry
    Plan *-- "0..*" Transfer
    Plan *-- "0..*" Contribution
    Plan *-- "0..1" Property
    Plan *-- "0..*" Loan
    Household *-- "1..2" Person
    Person *-- "0..*" Holding
    Holding <|-- LifeAnnuity
    Holding *-- "0..1" PayoutSchedule
    Entry --> "1" Person : owner
    Entry *-- "0..1" PensionAgreement
    PensionAgreement *-- "1..*" AllocationLine
    AllocationLine --> "1" Holding : to
    Loan --> "0..1" Property : secured on
    Plan --> "1" Holding : buffer
    Contribution --> "1" Holding : to
    Contribution --> "0..1" Entry : source
    Contribution --> "0..1" Holding : source
    Transfer --> "1" Holding : from
    Transfer --> "1" Holding : to

    note for Holding "Syv varianter: InstalmentPension, LifeAnnuity, OldAgeSavings, CapitalPension, ShareSavingsAccount, ShareDepot og SavingsAccount. De adskiller sig ved beskatning på vejen ind, på afkastet og på vejen ud, og ved loft. payoutAge bæres kun af de fire, der er en PensionScheme: en ShareSavingsAccount, en ShareDepot og en SavingsAccount har ingen udbetalingsalder og dermed heller ikke feltet."
    note for Property "Skitse: tegnet efter PRD'en, ikke efter glossaret. Afgøres i etape 4."
    note for Contribution "To former efter kilden, og felterne er tegnet som fællesmængden af dem. Lønkildet peger på en Entry og arver dens periode, anchor, recurrence og timing; det bærer kun percentageOfEntry eller amountInRealKroner. Beholdningskildet peger på en Holding og bærer selv det hele."
    note for PensionAgreement "Firmaordningen på en lønpost. Højst én pr. Entry, og kun på indtægtsgrenen. Den bærer hverken periode, anchor, recurrence eller timing — den arver lønpostens og ophører derfor af sig selv ved workEndAge. De to bidrag måler lønpostens eget beløb, aldrig brutto: employerContribution lægges til lønnen af aftalen selv, jf. ADR-0040. fee og insurancePremium er kronebeløb i nutidskroner, der trækkes efter AM-bidraget og før fordelingen; de måles ikke mod noget loft og bliver aldrig til formue, jf. ADR-0042. Regnestykket står i PensionAgreementYear, ikke som en Contribution, jf. ADR-0041."
    note for AllocationLine "Fordelingen. Tre former efter andelen, og felterne er tegnet som fællesmængden af dem: Percentage bærer percentage, Amount bærer amountInRealKroner, og Remainder bærer ingen af dem. Præcis én linje er Remainder, og det er dét, der får fordelingen til at gå op i hvert simuleringsår i kraft af sin form. Procenterne måler det placerede beløb og aldrig lønnen; kronebeløbene fremskrives med lønpostens RegulationRate. Destinationen skal være EmployerAdministered og tilhøre lønpostens ejer, ingen to linjer må pege på den samme, og procenterne må ikke summe til mere end det hele — alle fire afvises ved indgangen. Rækker det placerede beløb ikke til kronelinjerne i ét år, er det derimod et årsresultat og står som PensionAgreementYears to tal pr. destination. Formen UpToCap er endnu ikke bygget."
    note for Transfer "Flytning fra en holding til FreeAssets. Afgiverens payoutTaxation må ikke være PersonalIncome — det er den, der tømmer OldAgeSavings, ShareSavingsAccount og CapitalPension. En TaxFree afgiver koster intet; en Chargeable koster en afgift af det, der forlader beholdningen. Destinationen er altid FreeAssets: en flytning ind i en ordning er en indbetaling, ikke en Transfer. Beløbet måles hos afgiveren og afkortes til dennes saldo."
    note for LifeAnnuity "Den sjette variant, ikke en underklasse: pilen er mermaids eneste måde at tegne et unionsmedlem, der bærer egne felter. En Holding indtil udbetalingsstart, derefter en garanteret livsvarig ydelse. Dens PayoutSchedule bærer kun start — der er hverken duration eller principle at bære. quotedReserve og quotedAnnualBenefit er enhedsløse: kun deres kvotient bruges."
```

## Hvad diagrammet gør krav på

- **`Holding` er én type med syv varianter, ikke syv typer.** De deler saldo, afkast og udbetalingsplan og adskiller sig i beskatning og i loft. Se [ADR-0003](../adr/0003-fast-afkast-pr-beholdning.md) for hvorfor afkastet er ét fast tal pr. beholdning.
- **`variant` er én akse, ikke to.** Beskatningen er ikke et selvstændigt felt ved siden af varianten, for så ville kombinationer, der ikke findes — en aldersopsparing beskattet som kapitalindkomst — skulle valideres frem for at være uskrivelige. Hele beholdningssiden af skattemotoren bliver dermed ét opslag:

  | Variant | Afkast | `PayoutTaxation` | Tømmes af | I `TaperBase` | `Deductibility` | `Cap` | `ChargeRate` |
  |---|---|---|---|---|---|---|---|
  | `InstalmentPension` | `HoldingTax`, PAL-satsen | `PersonalIncome` | `PayoutSchedule` | ja | ja | `PerYear` | — |
  | `LifeAnnuity` | `HoldingTax`, PAL-satsen | `PersonalIncome` | omsætning ved start | ja | ja | intet ved arbejdsgiverordning | — |
  | `OldAgeSavings` | `HoldingTax`, PAL-satsen | `TaxFree` | `Transfer` | nej | nej | `PerYear`, med trappe | — |
  | `CapitalPension` | `HoldingTax`, PAL-satsen | `Chargeable` | `Transfer` | nej | nej | intet | `CapitalPensionChargeRate` |
  | `ShareSavingsAccount` | `HoldingTax`, aktiesparekontoens sats | `TaxFree` | `Transfer` | nej | nej | `OnBalance` | — |
  | `ShareDepot` | 27/42 % lager, fælles overførbar grænse | `TaxFree` | `Transfer` | ja | — | intet | — |
  | `SavingsAccount` | kapitalindkomst | `TaxFree` | `Transfer` | ja, kun når positiv | — | intet | — |

  `LifeAnnuity` deler `InstalmentPension`s beskatning fuldstændigt og har sin egen række alligevel, fordi loftet skiller dem, jf. [ADR-0015](../adr/0015-livrenten-er-en-sjette-variant-ikke-en-underklasse.md). Varianten hedder det, beholdningen er, og ikke det, dens afkast bliver til: et aktiedepot er ikke en aktieindkomst, jf. [ADR-0017](../adr/0017-beholdningen-hedder-hvad-den-er-ikke-hvad-dens-afkast-bliver-til.md). Hvilket felt afkastet lander i, står derfor i `simulate` og ikke i navnet.
- **`Cap`-kolonnen måles pr. person og pr. slags ordning, ikke pr. beholdning.** Loftet gælder årets samlede indbetaling til personens ordninger af varianten — to ratepensioner deler ét loft — og det overskydende bliver liggende i ordningen uden fradragsret frem for at blive skubbet tilbage. Se [ADR-0018](../adr/0018-loftet-maales-pr-person-pr-loft-og-det-overskydende-bliver-liggende.md).
- **Varianttabellen svarer også på to ting, der ikke handler om skat.** `UniquePerPerson` er sand alene for `ShareSavingsAccount` — en person kan kun have én, jf. ASKL § 3 — og `EmployerAdministered` er falsk netop dér, så en lønkildet indbetaling til kontoen ikke kan skrives. Begge er strukturelle umuligheder uden årstal og afvises ved indgangen af `validatePlan`, jf. [ADR-0020](../adr/0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md).
- **`FreeAssets` er en kategori, ikke en variant.** Den dækker `ShareDepot` og `SavingsAccount` under ét, og det er den, buffer- og overførselsreglerne taler om. Aktiesparekontoen hører ikke med — den har et indskudsloft.
- **`PayoutSchedule` hænger på beholdningen, ikke på personen — og kun på to af dem.** Det er dét, der gør motoren plan-drevet, se [ADR-0002](../adr/0002-plan-drevet-motor-med-frie-midler-som-buffer.md). Kun ratepensionen og livrenten har en, fordi kun de har en `PayoutTaxation` på `PersonalIncome`, og loven binder derfor både start, længde og årligt beløb. De skattefri ordninger tømmes af en `Transfer`, jf. [ADR-0022](../adr/0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md), og den afgiftspligtige af samme figur, jf. [ADR-0029](../adr/0029-den-afgiftspligtige-ordning-toemmes-ogsaa-af-en-overfoersel-og-afgiften-foelger-afgiveren.md). Startpunktet er en `AgeBound` og ikke et årstal, så udbetalingerne flytter sig med `WorkEndAge`.
- **`PayoutTaxation` er kolonnen, der afgør, hvem der kan tømme hvad.** Beskatningen på vejen ud er en egenskab ved varianten, ganske som `Deductibility` er det på vejen ind. Skellet går ikke mellem pension og ikke-pension: aldersopsparingen er efter `PayoutAge` en konto, ejeren hæver af som hun vil, og loven giver den ingen udbetalingsplan at vælge. Det går heller ikke mellem "koster noget" og "koster ingenting": kapitalpensionen koster en afgift og tømmes alligevel af en `Transfer`, fordi loven hverken binder dens varighed eller dens årlige beløb, jf. [ADR-0029](../adr/0029-den-afgiftspligtige-ordning-toemmes-ogsaa-af-en-overfoersel-og-afgiften-foelger-afgiveren.md). `ChargeRate` navngiver afgiftens sats i satsåret, som `HoldingTax`-kolonnen navngiver beholdningsskattens, og den står udfyldt netop i den ene række, der er `Chargeable`.
- **`payoutAge` er tastet, ikke afledt.** Brugeren skriver den, som pensionsselskabet oplyser den, jf. [ADR-0032](../adr/0032-pensionsudbetalingsalderen-tastes-direkte-den-udledes-ikke-af-oprettelsestidspunktet.md). Sammenligningen mod den sker i kalenderår gennem `yearAtAge` og aldrig som aldre: alderen kan være en brøk, og året, hvor personen fylder 62,5, indeholder lovlige udbetalingsmåneder.
- **`Person.statePensionAge()` er afledt, og tabellen er eneste kilde.** Den udledes af `birthYear` og `birthMonth` efter den lovfastsatte fødselsdatotabel i docs/satser/folkepensionsalder.md, også for de fødselsår hvor trinnet kun er fremskrevet — det tal er det bedste, der findes, og der er intet håndtag ved siden af det. Tabellen er ikke et `RateYear` — den ændrer sig ikke fra satsår til satsår, kun når Folketinget vedtager et nyt trin, og så rettes datagrundlaget. Fordi alderen er en brøk for de fleste årgange, er året, den nås, `birthYear + floor(alder + (birthMonth − 1) / 12)` og ikke `birthYear + alder`.
- **`Entry` er én figur for både indtægt og udgift — og også for ATP.** Kun indtægtsposter bærer en `taxTreatment` og en `regulationRate`. Der findes ingen `Benefit`-klasse: ATP er en post med `taxTreatment` `PensionIncome`, og folkepensionen udledes af satsåret og folkepensionsalderen og står slet ikke i planen, jf. [ADR-0023](../adr/0023-atp-er-en-post-folkepensionen-en-udledning-og-benefit-ingen-type.md). En udgift har intet eget tempo og følger planens `inflationAssumption`, som en `Transfer` gør.
- **`LifeAnnuity` er en `Holding`, indtil den omsættes.** Den modtager indbetalinger og forrentes som alle andre beholdninger; ved udbetalingsstart ganges det fremskrevne depot med `conversionFactor()` og bliver til en fast livsvarig ydelse. Se [ADR-0009](../adr/0009-livrenten-omsaettes-en-gang-ved-udbetalingsstart.md).
- **`Contribution` er en bevægelse, ikke en udgift.** Alt andet knækker balanceinvarianten. Lofterne hænger på bidraget, ikke på lønnen, og derfor er det en selvstændig figur. Se [ADR-0007](../adr/0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md).

- **Lønposten er lønsedlens løn, og `PensionAgreement` lægger arbejdsgiverbidraget til.** ADR-0007's regnestykke er urørt — bidraget passerer stadig pengestrømmen, ellers vokser formuen uden modpost — men det er aftalen og ikke brugeren, der lægger de to tal sammen, jf. [ADR-0040](../adr/0040-loenposten-er-loensedlens-loen-og-arbejdsgiverbidraget-laegges-til-af-pensionsaftalen.md). Derfor måler begge aftalens procenter lønposten selv: de 12 %, der står på lønsedlen, er de 12 %, der tastes.

- **Aftalen bærer sit eget regnestykke og forklæder sig ikke som indbetalinger.** `ContributionYear`s ene difference er AM-bidraget, og for en aftales penge er kilen bredere — gebyret og præmien har ingen anden adresse. Se [ADR-0041](../adr/0041-pensionsaftalen-baerer-sit-eget-regnestykke-i-aarsresultatet.md) og [ADR-0042](../adr/0042-forsikringspraemien-er-en-udgift-med-en-skattevirkning.md). Lofterne måler derimod begge kilder under ét: loftet er personens og pr. slags ordning, aldrig pr. indbetaling.
- **`Contribution` er to former, delt af kilden.** Et lønkildet bidrag peger på sin `Entry` og arver dens periode, så det ophører af sig selv ved `workEndAge` og ikke kan komme ud af trit med lønnen; det bærer kun en procent eller et fast beløb. Et beholdningskildet bidrag har ingen lønpost at arve fra og bærer selv beløb, periode, gentagelse og forfald, som en `Transfer`. Det er den form, aldersopsparingens vindue efter erhvervsophør skrives i.
- **Ejerskellet binder kun den lønkildede form.** Et lønkildet bidrag skal ende i lønmodtagerens egen ordning — en `Holding`, en arbejdsgiver administrerer, står i ejerens eget navn. Et beholdningskildet bidrag må gå fra én `Person`s `FreeAssets` til en andens ordning, ganske som en `Transfer` allerede må: loftet og fradragsretten følger destinationens ejer. Se [ADR-0028](../adr/0028-det-beholdningskildede-bidrag-maa-krydse-ejerskellet.md).
- **Skellet mellem `Contribution` og `Transfer` måles på destinationen.** En indbetaling går ind i en beholdning, der ikke er `FreeAssets`; en overførsel flytter mellem frie midler. Hverken skattevirkningen eller loftet kan bære skellet: aldersopsparingen har et `Cap` og ingen `Deductibility`.
- **`timing` er en afkastvægt, ikke et tidsskridt.** Jævnt fordelt giver vægt ½; en bestemt måned giver `(12 − N + 1) / 12`. Se [ADR-0006](../adr/0006-maaneden-er-en-afkastvaegt-ikke-et-tidsskridt.md).
- **`FreeAssets` ejes af en `Person`, ikke af husstanden, og bufferrollen er skilt ud.** Præcis én `Holding` pr. `Plan` er udpeget som `buffer` og absorberer årets restpost. Se [ADR-0004](../adr/0004-frie-midler-pr-person-med-udpeget-buffer.md).
- **`RateYear` er ikke med, og det er meningen.** Satser er delt referencedata; planen bærer kun fremskrivningsantagelserne. `YearResult` stempler hvilket satsgrundlag, det er regnet på. Se [ADR-0005](../adr/0005-satser-er-referencedata-planen-pinner-ikke.md).
- **`Transfer` er den eneste måde en ikke-buffer-`FreeAssets`, en aldersopsparing og en aktiesparekonto kan bruges på.** Uden den ændrer den sig kun ved sit eget afkast. `Transfer` er ikke en `Entry`: to modgående poster ville nettes til nul på bufferen og flytte ingenting.

## Åbne punkter


- **`Property` og `Loan` er mærket `<<skitse>>`.** De er tegnet efter [hoved-PRD'en](https://github.com/jbhdk/PensionPlanner/issues/1), ikke efter glossaret, og deres termer afgøres først i etape 4 — ejendomsskattereformens rabatordning og dens bortfald ved salg er et hjørne, der skal grilles for sig. Mærket betyder: brug dem ikke som om de var afgjorte.
