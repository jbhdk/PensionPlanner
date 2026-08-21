# Erhvervsophørsåret tæller med som `from` og ikke med som `to`

`resolveAgeBound` i `age.ts` oversatte `'WorkEndAge'` til samme kalenderår, uanset om den løste periodens `from` eller dens `to`. Det gav modstridende planer: en udbetalingsplans `start: 'WorkEndAge'` betaler sin første rate erhvervsophørsåret — retten regner personen for pensioneret allerede dér — mens en lønpost eller en overførsel med `period.to: 'WorkEndAge'` løb *igennem* det samme år, som var personen stadig i arbejde. Samme sentinel, samme år, to modsatte antagelser om, hvad der foregår i det.

Rettelsen er en asymmetri i `resolveAgeBound`: som `from` regnes erhvervsophørsåret med, som `to` regnes det ikke med — den løste `to`-værdi er året før. Erhvervsophørsåret er det første år uden arbejde, aldrig det sidste med, og reglen gælder kun sentinellen `'WorkEndAge'`; en fast alder eller et kalenderår er brugerens eget tal og læses ens i begge roller, fordi brugeren allerede har taget stilling til, om året skal med.

Alternativet var at lade `to: 'WorkEndAge'` blive stående og i stedet ændre `PayoutSchedule.start`, så udbetalingen først begynder året *efter* erhvervsophør. Det blev fravalgt: en udbetalingsplans start er allerede en `AgeBound`, der bruges som `from`, og den følger samme regel som ethvert andet `from` i en periode — det er `to`, der er den særlige rolle her, fordi kun den kan efterlade en overlappende eller manglende overgang.

## Konsekvenser

Enhver eksisterende `to: 'WorkEndAge'` flytter sig et år tidligere — en lønpost, der før løb igennem erhvervsophørsåret, stopper nu året før, og en overførsel, der før tog sin sidste hævning i erhvervsophørsåret, gør det nu året før. Ingen af planens tal ændrer sig for et fast alderstal; kun sentinellen rammes.

Idiomet `{ from: 'WorkEndAge', to: 'WorkEndAge' }` for "præcis erhvervsophørsåret" holder ikke længere — det bliver et tomt interval, fordi det løste `to` nu ligger et år før det løste `from`. Det udtrykkes i stedet som `{ from: 'WorkEndAge' }` med `recurrence: { kind: 'Once' }`, som allerede findes til formålet.

## Se også

- [ADR-0022](./0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md) — overførslens periode aldersforankres på afgiverbeholdningens ejer, og det er præcis den type periode, denne rettelse retter
- [ADR-0006](./0006-maaneden-er-en-afkastvaegt-ikke-et-tidsskridt.md) — motoren skridter i hele år og deler ikke et overgangsår i to; denne rettelse afgør i stedet, hvilket hele år overgangen hører til
