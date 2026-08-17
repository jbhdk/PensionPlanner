# Det beholdningskildede bidrag må krydse ejerskellet, det lønkildede må ikke

En `Contribution` med en `Holding` som kilde må gå fra én persons frie midler til en anden persons ordning. Den lønkildede form må ikke: dér skal posten og ordningen tilhøre samme person.

Reglen var hidtil den samme for begge former, og begrundelsen stod i `validatePlan`: fradragsretten nedsætter den personlige indkomst, og den hører hos den, der ejer ordningen — en indbetaling til ægtefællens ordning ville placere skattevirkningen hos den forkerte. Den frygt var ubegrundet. `contributionsByPerson` går husstandens personer igennem og samler hver persons indbetalinger op over `byVariant(person)`, altså over de beholdninger, personen selv ejer. Både `withDeductibility` og hvert `CapYear` bliver dermed henført til destinationens ejer, uanset hvor pengene forlod. Reglen værnede om noget, motoren allerede gjorde rigtigt.

Til gengæld kostede den. Bufferen er én udpeget beholdning med én ejer, jf. [ADR-0004](./0004-frie-midler-pr-person-med-udpeget-buffer.md), og årets overskud lander dér og ingen andre steder. Ejede den ene person bufferen, kunne intet nå den andens aktiesparekonto eller aldersopsparing — de to ordninger, der netop fyldes af beskattede penge og ikke af en løn. Vejen fandtes kun om ad en mellemstation: en overførsel til ægtefællens egne frie midler og en indbetaling derfra. To figurer, hvor der er én bevægelse, en beholdning i formuegrafen der findes udelukkende for at være gennemgang, og et lille utilsigtet afkast i de år, hvor de to forfald ikke er ens.

Og mellemstationen beviste, at grænsen ikke blev holdt noget andet sted: `transferEnds` stiller ingen ejerbetingelse. Husstandens frie midler flytter sig allerede uhindret mellem ejerne uden skattevirkning — gaver mellem ægtefæller er afgiftsfri efter [boafgiftslovens § 22, stk. 3](https://danskelove.dk/boafgiftsloven/22) — og en regel, der forbød det samme på tværs af ordningens dør, forbød ikke bevægelsen, kun den korte vej.

Alternativet var at lade reglen stå og i stedet gøre mellemstationen let at skrive i fladen. Det blev fravalgt: prisen ville være en beholdning i enhver husstand med to sæt frie midler, som ikke svarer til noget i virkeligheden, og planen ville skulle læses med den mellemstation i hovedet for at forstå, hvor pengene kom fra.

Den lønkildede form er en anden sag. En ordning, en arbejdsgiver administrerer, står i lønmodtagerens eget navn, og person 1's løn kan ikke lande i person 2's ratepension. Det er en strukturel umulighed og ikke en skatteattribution — netop den slags, der afvises ved indgangen frem for at blive regnet, jf. [ADR-0020](./0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md). Den regel bliver stående, og med den også fladens greb, hvor et skift til ægtefællens lønpost flytter destinationen med over.

## Konsekvenser

Aldersforankringen måler fra destinationens ejer. Det gjorde den i forvejen, men den kunne før læses som en tilfældighed, fordi de to ender delte ejer; nu er den et valg, og det er destinationen, der er den rigtige at måle fra — det er hendes ordning, hendes loft og hendes fradragsret, året handler om.

Skuffens to lister skilles ad. Kildelisten tilbyder alle husstandens frie midler, og et skift af kilde lader destinationen stå. Destinationslisten er lønmodtagerens egne ordninger, når kilden er en lønpost, og husstandens alle, når den er en beholdning.

En løsnet valideringsregel udvider, hvad en gemt plan må indeholde. Den kan derfor ikke uden videre strammes igen: planer skrevet efter dette ville blive ugyldige, og der findes ikke et led i migrationskæden, der kan gætte, hvad de skulle have været i stedet.

## Se også

- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — skellet mod overførslen, som denne beslutning skærper den ene halvdel af.
- [ADR-0018](./0018-loftet-maales-pr-person-pr-loft-og-det-overskydende-bliver-liggende.md) — loftet måles pr. person, og det er destinationens ejer, personen er.
- [ADR-0020](./0020-kan-det-ikke-findes-i-virkeligheden-afvises-det-ved-indgangen.md) — hvorfor den lønkildede form fortsat afvises ved indgangen.
- [ADR-0004](./0004-frie-midler-pr-person-med-udpeget-buffer.md) — bufferens ene ejer, som er grunden til at det overhovedet bandt.
- [Diagram: Domænemodellen](../diagrams/01-domaenemodel.md) — `Contribution`s to former og deres to kilder.
