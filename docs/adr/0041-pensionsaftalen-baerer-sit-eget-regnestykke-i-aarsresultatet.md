# Pensionsaftalen bærer sit eget regnestykke i årsresultatet

En `PensionAgreement` gør en løn til indbetalinger på en eller flere ordninger. Den nærliggende bygning er at lade den udlede en `Contribution` pr. destination, så alt nedstrøms er urørt.

Den knækker på én sætning. `ContributionYear` er *"én indbetalings to beløb i ét simuleringsår … Det ene er, hvad der forlod kilden; det andet, hvad der landede i beholdningen. Forskellen er AM-bidraget, som allerede står i personens eget skattelag og derfor ikke gentages her."* For en aftales penge er forskellen ikke AM-bidraget. Den er AM plus `InsurancePremium` plus `Fee`, og de to sidste står ingen andre steder — præmien er ikke en `Entry`, jf. [ADR-0042](./0042-forsikringspraemien-er-en-udgift-med-en-skattevirkning.md), og gebyret er det heller ikke. Lånte aftalen `ContributionYear`, ville linjen sige, at 102.000 kr. forlod og 86.640 kr. landede, og de 15.360 kr. imellem ville ingen adresse have. Forklar-året kunne ikke efterregne sin egen linje.

`PensionAgreementYear` bærer i stedet hele regnestykket: de to bidrag, AM-bidraget, gebyret, præmien og det, der landede på hver destination. Det er samme form som `Taper`-rækken i `PersonYear`, der af samme grund fører *"hele det regnestykke det kom af"* frem for kun facit.

Alternativet — at give `ContributionYear` to felter mere, som er nul for enhver anden indbetaling — er den konstruktion, `TransferYear` allerede afviser: *"et felt, hvor de to altid var ens, ville påstå, at der var noget at se."*

## Konsekvenser

`CapYear` læser fra to steder: planens indbetalinger og aftalernes landede beløb. Loftet var i forvejen en sum over flere kilder — det måles *"pr. person og pr. slags og aldrig pr. beholdning eller pr. indbetaling"* — så der kommer alene én slags mere. `Contributions`-båndet og årstabellens Indbetalinger-kolonne skal ligeledes læse begge steder.

Fordelingens `UpToCap`-form beder om det, der er tilbage under ordningens `Cap`, når årets øvrige indbetalinger til den er talt med. Den afgør dermed en rækkefølge: **aftalerne regnes efter de selvstændige indbetalinger.** Rækkefølgen falder ud af afhængigheden og ikke af en listeposition — en selvstændig indbetaling skal aldrig vide, hvad en aftale tog. [ADR-0019](./0019-aktiesparekontoens-loft-forhindrer-indskuddet-frem-for-at-straffe-det.md)'s rækkefølge i `plan.contributions` er urørt: den handlede om `OnBalance`-loftet, som ingen fordeling kan ramme, fordi aktiesparekontoen ikke er `EmployerAdministered`.

En kronelinje, der ikke kan være der i et bestemt år, behøver ingen ny fejltype. Hver destination bærer to tal — hvad andelen bad om, og hvad der landede — og forskellen er synlig i sig selv, ganske som `TransferYear`s to. Det skiller den fra `CapBreach`, som findes, fordi et brudt loft flytter årets skat; en afkortet fordeling flytter kun pengene.

Aftalen opkræver ikke AM-bidrag. Hele indbetalingen er en del af `EarnedIncome`, og bidraget står allerede i personens eget skattelag; aftalen trækker det alene fra på vejen ind, som `entrySourcedInYear` gør. Bygges det som en opkrævning, betales AM to gange.

## Se også

- [ADR-0042](./0042-forsikringspraemien-er-en-udgift-med-en-skattevirkning.md) — præmien, som er den ene af de to grunde til, at kilen ikke er AM-bidraget alene
- [ADR-0040](./0040-loenposten-er-loensedlens-loen-og-arbejdsgiverbidraget-laegges-til-af-pensionsaftalen.md) — arbejdsgiverbidraget, som står i dette regnestykke frem for i `EntryYear`
- [ADR-0018](./0018-loftet-maales-pr-person-pr-loft-og-det-overskydende-bliver-liggende.md) — loftet måles pr. person pr. loft; aftalen er én kilde mere til den sum
- [ADR-0019](./0019-aktiesparekontoens-loft-forhindrer-indskuddet-frem-for-at-straffe-det.md) — den rækkefølge, denne ikke rører
- [ADR-0023](./0023-atp-er-en-post-folkepensionen-en-udledning-og-benefit-ingen-type.md) — båndene navngives efter bevægelsen og ikke efter ordet
