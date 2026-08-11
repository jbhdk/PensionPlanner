# Folkepensionsalderen efter fødselsdato

Verificeret 11. august 2026. Dette er kilden `deriveStatePensionAge` slår op i — ikke et satsår, jf. [docs/satser/2026.md](./2026.md#ikke-satsdata): tabellen er indekseret efter fødselsdato, og ændrer sig kun når Folketinget vedtager en ny regulering, ikke fra år til år.

## Fælde: dagsprecise lovgrænser mod et årstal i modellen

Loven (pensionslovens § 1 a) sætter grænserne på **fødselsdato**, ofte midt i et kalenderår — "født fra 1. juli 1955" er et andet skel end "født fra 1. januar 1955". `Person` bærer `birthYear` og `birthMonth`, ikke en fuld dato, så udledningen rammer den rigtige måned, men ikke den rigtige dag. For de fleste fødselsår er det uden betydning; det rammer kun de fødselsår, hvor et skel falder midt i året (1954, 1955, 1983, 1987, 1996 herunder).

## Den lovfastsatte tabel

Kilde: [pensionslovens § 1 a](https://danskelove.dk/pensionsloven/1a), krydstjekket mod [Styrelsen for Arbejdsmarked og Rekruttering](https://star.dk/ydelser/pension-og-efterloen/folkepension-tidlig-pension-foertidspension-og-seniorpension/folkepension/folkepensionsalderen-nu-og-fremover/), som også har trinene efter 1966.

| Født fra og med | Folkepensionsalder |
|---|---|
| (før 1. januar 1954) | 65 år |
| 1. januar 1954 | 65½ år |
| 1. juli 1954 | 66 år |
| 1. januar 1955 | 66½ år |
| 1. juli 1955 | 67 år |
| 1. januar 1963 | 68 år |
| 1. januar 1967 | 69 år |
| 1. januar 1971 | 70 år |

Alle otte trin er vedtaget af Folketinget (`enacted: true`).

## De fremskrevne skøn

Kilde: [star.dk](https://star.dk/ydelser/pension-og-efterloen/folkepension-tidlig-pension-foertidspension-og-seniorpension/folkepension/folkepensionsalderen-nu-og-fremover/) ⚠︎ — siden siger selv, at trinene her **ikke er vedtaget**: "Folkepensionsalderen fra 2045 er et skøn og skal først vedtages af Folketinget i 2030." Ikke fundet i en officiel lovtabel, kun i styrelsens egen fremskrivning.

| Født fra og med | Folkepensionsalder | Skønnet gælder fra |
|---|---|---|
| 1. januar 1975 | 71 år | 2045 |
| 1. januar 1979 | 71½ år | 2050 |
| 1. januar 1983 | 72½ år | 2055 |
| 1. juli 1987 | 73 år | 2060 |
| 1. januar 1992 | 73½ år | 2065 |
| 1. juli 1996 | 74 år | 2070 |

Alle seks trin er `enacted: false`. Springet fra 71½ til 72½ år (intet 72-årstrin) står som kilden angiver det — reguleringen følger den faktiske levetidsudvikling i femårsvinduet og er ikke en lineær trappe.

## Selvkontrol

De to talrækker er hentet fra to uafhængige kilder — lovteksten for de vedtagne trin, styrelsens fremskrivning for skønnene — og de mødes uden spring ved 1971-trinnet: begge angiver 70 år som sidste vedtagne og laveste fremskrevne alder. Et hul eller overlap dér ville have været et tegn på, at de to kilder talte om forskellige ting.

## Ikke omfattet

Reguleringer, der falder efter 1. juli 1996-trinnet, er ikke offentliggjort endnu og har ingen linje i tabellen. `deriveStatePensionAge` bruger det sidste kendte trin (74 år, `enacted: false`) for fødselsår derefter, med samme begrundelse som satsårets fremskrivning efter sidste kendte år: den bedste tilgængelige antagelse er "som sidst", ikke en fejl.
