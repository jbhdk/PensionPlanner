# Indbetalinger er bevægelser, og lønnen angives brutto

En `Contribution` er hverken en indtægt eller en udgift, men en bevægelse fra husstandens pengestrøm ind i en beholdning — samme form som en `Transfer`, blot med en skattevirkning og et loft. Lønposter angives derfor brutto, inklusive arbejdsgiverens pensionsbidrag, og bidraget flyttes eksplicit til ordningen.

Balanceinvarianten afgør det. Med 700.000 kr. i bruttoløn, hvoraf 105.000 kr. er arbejdsgiverbidrag: bogføres bidraget som en udgift, tælles det to gange, fordi pengene både forlader pengestrømmen og dukker op som formue i ordningen. Indtastes lønnen i stedet som de 595.000 kr., der udbetales, vokser formuen med 105.000 kr. uden modpost. Kun brutto ind og bidraget som bevægelse får `formue ultimo − formue primo = indtægter + afkast − skat − udgifter` til at gå op.

## Konsekvenser

`Contribution` er en selvstændig figur og ikke et felt på lønposten, fordi lofterne hænger på bidraget: ratepensionens fradragsloft, aldersopsparingens lave og høje sats, og det syvårige vindue før `statePensionAge`. Et procentbidrag peger til gengæld på sin lønpost, så det ophører af sig selv ved `workEndAge` i stedet for at have en periode, der kan komme ud af trit.

Brugeren skal indtaste bruttolønnen inklusive pension frem for det, der går ind på kontoen. Det står på lønsedlen, men det er ikke det tal, folk normalt kalder deres løn — brugerfladen skal sige det udtrykkeligt.
