# ATP er en post, folkepensionen en udledning, og `Benefit` ingen type

`Plan` får ingen ydelsesfigur. ATP skrives som en `Entry` med `TaxTreatment` `PensionIncome`; folkepensionens grundbeløb og pensionstillæg udledes af satsåret og folkepensionsalderen og står intet sted i planen; og `Benefit` bliver stående i glossaret som et begreb, der ikke navngiver en type.

Diagram 01 tegnede oprindeligt `Person *-- "0..*" Benefit` med felterne `startAge`, `annualAmount` og `regulationRate`, og lod folkepensionen og ATP dele klassen. De to ligner kun hinanden udefra.

Folkepensionen har intet, brugeren kan taste. Grundbeløbet og pensionstillægget står i satsåret, starten udledes af fødselsdatoen, aftrapningen følger af regler, og fremskrivningen er planens egen antagelse. Skrev vi den som et objekt i planen, ville planen bære satsdata — som ADR-0005 forbyder — og et beløb, der kunne komme til at modsige det satsår, det blev skrevet af.

ATP har derimod ét tal, kun ejeren kender, fra PensionsInfo. Men da vi listede, hvad en ydelsesfigur skulle bære — navn, ejer, årligt beløb i nutidskroner, startalder, egen reguleringssats — stod der en strengt fattigere kopi af `Entry`. Posten kan det hele i forvejen og desuden gentagelse, forfald og et slutpunkt. Det eneste, den manglede, var en skattebehandling, der siger "personlig indkomst uden AM-bidrag, og den tæller i aftrapningsgrundlaget". Det er en værdi i en union, ikke en figur.

Alternativet var `Benefit` som egen type. Det ville have givet en renere sætning i diagrammet og fem duplikerede felter i skemaet, i fladen og i migrationskæden — og en anden vej gennem motoren for penge, der opfører sig som en indtægtspost. To figurer for den samme bevægelse er én for mange; det er samme argument som i ADR-0022.

Ordet `Benefit` overlever alligevel, fordi det har en referent: den omsatte livrentes årlige strøm er en ydelse uden saldo i renkultur, og `quotedAnnualBenefit` er et felt, brugeren taster. Termen beskriver altså en strøm og ikke en figur — og navnefælden mellem `payout` og `benefit` bliver dermed vigtigere, ikke mindre vigtig, for livrenten er netop stedet, hvor den kan gå galt.

## Konsekvenser

`benefitProjectionAssumption` hedder nu `statePensionProjectionAssumption`, og den danske term er **Folkepensionsregulering** frem for Satsregulering. Feltet skalerede i forvejen kun `statePension` og intet andet, så navnet lovede mere, end det holdt. Det ligger i det gemte skema og koster derfor **ét nyt led i migrationskæden**.

ATP fremskrives med sin egen `RegulationRate` som enhver anden indtægtspost, og ikke med folkepensionens regulering. Det er rigtigt: ATP er ikke satsreguleret.

En `Entry` kan nu bære en skattebehandling, hvis virkning rækker uden for skatten — `PensionIncome` afgør også medlemskab af `TaperBase`. Det er ikke nyt: `EarnedIncome` afgør allerede, at posten *ikke* aftrapper.

Folkepensionen har ingen plads i planen og skal derfor have en i resultatet. `PersonYear` bærer grundbeløbet, det aftrappede tillæg og det aftrapningsgrundlag, tillægget blev aftrappet af — ellers kan forklar-året ikke vise en udregning, brugeren aldrig har indtastet.

## Se også

- [ADR-0005](./0005-satser-er-referencedata-planen-pinner-ikke.md) — hvorfor folkepensionens beløb ikke må skrives ind i en plan
- [ADR-0009](./0009-livrenten-omsaettes-en-gang-ved-udbetalingsstart.md) — den ene ydelse, brugeren faktisk taster to tal for
- [ADR-0022](./0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md) — samme argument mod to figurer for én bevægelse
- [docs/diagrams/01-domaenemodel.md](../diagrams/01-domaenemodel.md) — klassen `Benefit` er fjernet herfra
