# Lønposten er lønsedlens løn, og arbejdsgiverbidraget lægges til af pensionsaftalen

[ADR-0007](./0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md) afgjorde, at lønposter angives brutto, inklusive arbejdsgiverens pensionsbidrag. Regnestykket bag den er urørt: bogføres bidraget som en udgift, tælles det to gange, og indtastes lønnen som det, der udbetales, vokser formuen uden modpost. Det er alene indtastningsreglen, der falder — brugeren taster ikke længere bruttotallet.

Grunden er, at ingen lønseddel skriver det. Den skriver lønnen, arbejdsgiverens bidrag og eget bidrag hver for sig, og brugeren skulle lægge de to første sammen i hovedet. Værre bliver det, når `EmployerContribution` er en procent: måler den lønposten, og er lønposten brutto, skal de 12 %, der står på sedlen, tastes som 10,714 % for at ramme de 72.000 kr., de i virkeligheden er. Den, der taster de 12, hun har fået oplyst, rammer 8.640 kr. for højt — hvert år, resten af arbejdslivet, uden at noget nogensinde spørger, om tallet var ment. 80.640 kr. er en fuldstændig lovlig indbetaling.

Herefter er `Entry.amountInRealKroner` for en lønpost det, lønsedlen kalder løn, og `EmployerContribution` lægges oven i den af `PensionAgreement`. Motorens `ActiveEntry.amount` bliver ved med at være brutto — det er dér, de to tal lægges sammen — så skattesømmet, bufferens vægtning, indtægtsbåndet og balanceinvarianten er urørte. Ændringen er i, hvem der lægger sammen, ikke i hvad der lægges sammen.

Alternativet var at lade lønposten holde op med at være en indtægt på hele beløbet — altså at arbejdsgiverbidraget aldrig passerede pengestrømmen. Det er ADR-0007's regnestykke, og det knækker: de 72.000 kr. ville dukke op i ordningen uden at have været forbi `income`, og invarianten ville ikke gå op.

## Konsekvenser

Et gemt beløb skifter betydning uden at skifte form. Migrationskæden får et led, som ikke kan regne det om — motoren ved ikke, hvor meget af en gemt lønpost på 672.000 kr. der var arbejdsgiverens. Leddet lader tallet stå og overlader rettelsen til brugeren.

`EntryYear` er lønnen alene; arbejdsgiverbidraget står i `PensionAgreementYear`, jf. [ADR-0041](./0041-pensionsaftalen-baerer-sit-eget-regnestykke-i-aarsresultatet.md). Det er ikke bogholderi for bogholderiets skyld: AM-bidraget af en pensionsindbetaling indeholdes og indberettes i virkeligheden af pensionsselskabet og ikke af arbejdsgiveren, og de to tal står hvert sit sted på årsopgørelsen af samme grund, som de gør det her.

Årstabellens Indtægter-kolonne viser fortsat summen og er dermed større end nogen post i planen. Forklar-året skal kunne vise, hvor forskellen kommer fra.

Hinten i indbetalingsruden og de to i fladekortet, der beder om brutto, siger det modsatte af dette og skal skrives om.

## Se også

- [ADR-0007](./0007-indbetalinger-er-bevaegelser-og-loennen-er-brutto.md) — figuren og regnestykket, som står. Det er alene dens sidste afsnit, denne afløser
- [ADR-0041](./0041-pensionsaftalen-baerer-sit-eget-regnestykke-i-aarsresultatet.md) — hvor arbejdsgiverbidraget så står i årsresultatet
- [ADR-0016](./0016-indbetalingen-kendes-paa-sin-destination.md) — det lønkildede bidrag arver lønpostens periode; aftalen gør det af samme grund
