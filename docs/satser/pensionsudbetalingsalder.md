# Pensionsudbetalingsalderen efter oprettelsestidspunkt

Verificeret 15. august 2026, delvist — se **Åbent punkt** nederst. Dette er kilden `payoutAge` slår op i — ikke et satsår, jf. [docs/satser/2026.md](./2026.md#ikke-satsdata): tabellen er indekseret efter ordningens oprettelsestidspunkt og ændrer sig kun, når Folketinget vedtager en ny regulering, ikke fra år til år.

## Fælde: alderen hænger på ordningen, ikke på personen

Folkepensionsalderen er én pr. person. Pensionsudbetalingsalderen er én **pr. ordning**: samme person kan have en ratepension fra 2003, der må udbetales som 60-årig, og en fra 2020, der først må som 67-årig. To af de tre regimer måler relativt til folkepensionsalderen og flytter sig derfor med den; det ældste gør ikke.

## De tre regimer

| Ordningen oprettet | Pensionsudbetalingsalder | Regime |
|---|---|---|
| Før 1. maj 2007 | 60 år, fast | `BeforeMay2007` |
| 1. maj 2007 – 31. december 2017 | Folkepensionsalder − 5 år | `May2007ToDecember2017` |
| Fra 1. januar 2018 | Folkepensionsalder − 3 år | `FromJanuary2018` |

Det er aftaletidspunktet for oprettelsen, der tæller, og ikke hvornår der er indbetalt. Måneden afgør begge skel, dagen ingen af dem: begge falder på den første i en måned.

Kilde: [pensionsbeskatningslovens § 1 a](https://danskelove.dk/pensionsbeskatningsloven/1a) for det gældende regime ⚠︎ — stk. 1 er bekræftet i lovteksten og lyder "tidspunktet 3 år før folkepensionsalderen, jf. § 1 a i lov om social pension". De to ældre regimer og deres datoskel er **ikke** fundet i den paragraf og hviler indtil videre på sekundære kilder.

## Selvkontrol

De to relative regimer skal give samme differens for enhver årgang, og det faste skal give samme tal for dem alle. For årgang 1973, hvis folkepensionsalder er 70 år:

| Regime | Udledt alder | Differens til folkepensionsalderen |
|---|---|---|
| `BeforeMay2007` | 60 | −10 — og differensen er tilfældig, ikke reglen |
| `May2007ToDecember2017` | 65 | −5 |
| `FromJanuary2018` | 67 | −3 |

For årgang 1985, hvis folkepensionsalder er 72½ år, skal de to relative give 67½ og 69½ — og den faste stadig 60. Det er den invariant, `payoutAge.test.ts` prøver: differensen er regimets, aldrig årgangens.

## Åbent punkt: § 1 a, stk. 2, er en anden slags overgangsregel

Lovteksten bærer ved siden af stk. 1 en tabel indekseret efter **fødselsdato** og ikke efter oprettelsestidspunkt:

| Født | Pensionsudbetalingsalder |
|---|---|
| Til og med 31. december 1958 | 60 år |
| 1. januar – 30. juni 1959 | 60½ år |
| 1. juli – 31. december 1959 | 61 år |
| 1. januar – 30. juni 1960 | 61½ år |

Modellen regner den ikke. Den rammer alene personer født før 1961, som alle er fyldt 65 i 2026, og den ville for dem sætte en **lavere** alder end de tre regimer giver — altså aldrig gøre en plan mere fri, end den er. Skal husstanden rumme en person født før 1961, er det her, tabellen skal ind.
