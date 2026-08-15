# Livscyklusser

Tre tilstandsmaskiner, der tilsammen forklarer, hvad "pensioneret" betyder i modellen. De er adskilte med vilje: `workEndAge`, en ordnings `payoutAge` og `statePensionAge` er tre uafhængige tidspunkter, og hele værktøjets pointe er afstanden mellem dem.

## `Holding`

Tilstandene gælder de to varianter, der har en `PayoutSchedule` — `InstalmentPension` her, `LifeAnnuity` nedenfor. En `OldAgeSavings` og en `ShareSavingsAccount` forlader aldrig `Accumulating`: de tømmes af en `Transfer`, jf. [ADR-0022](../adr/0022-den-skattefri-ordning-toemmes-af-en-overfoersel-ikke-af-en-udbetalingsplan.md), og saldoen falder uden at tilstanden skifter.

```mermaid
stateDiagram-v2
    [*] --> Accumulating
    Accumulating --> Accumulating : contributions + return − PalTax
    Accumulating --> PayingOut : PayoutSchedule.start, an AgeBound
    PayingOut --> PayingOut : instalment recomputed from opening balance
    PayingOut --> Depleted : duration elapsed, last instalment sweeps the rest
    Depleted --> [*]

    note right of Accumulating
        Contribution cap for InstalmentPension.
        The high OldAgeSavings cap applies in
        the last 7 years before statePensionAge.
    end note

    note right of PayingOut
        Starts no earlier than payoutAge().
        At least 10 years, and the last
        instalment no later than 30 years
        after payoutAge().
    end note
```

## `LifeAnnuity`

```mermaid
stateDiagram-v2
    [*] --> Accumulating
    Accumulating --> Accumulating : contributions + return − PalTax
    Accumulating --> Annuitised : reserve × conversionFactor(), once
    Annuitised --> Annuitised : bonusRate only
    Annuitised --> Ceased : death
    Ceased --> [*]

    note right of Accumulating
        A Holding like any other, so the
        reserve responds to workEndAge:
        fewer working years, lower benefit.
    end note

    note right of Annuitised
        Guaranteed and flat. The reserve
        plays no further part — there is
        nothing left to recompute.
    end note

    note right of Ceased
        Deferred until after v1.
        Spouse cover must be bought BEFORE
        payout starts.
    end note
```

## `Person`

```mermaid
stateDiagram-v2
    [*] --> Working
    Working --> Bridge : workEndAge
    Working --> DrawingPension : workEndAge after payoutAge()
    Bridge --> DrawingPension : first holding may pay out
    DrawingPension --> StatePensioner : statePensionAge
    StatePensioner --> [*] : horizon

    note right of Bridge
        Carried by FreeAssets alone.
        Its length is the gap between two
        freely chosen numbers — it may be zero.
    end note

    note right of StatePensioner
        The taper threshold for the OTHER
        person's PensionSupplement changes here.
    end note
```

## Åbne punkter

- **`Bridge` kan mangle helt.** Ligger `workEndAge` efter første ordnings `payoutAge()`, findes fasen ikke. Brugerfladen skal sige noget fornuftigt frem for at vise en tom periode.
- **`Depleted` er ikke det samme som slettet.** En tømt ratepension skal blive stående i årstabellen med saldo nul, ellers knækker formuegrafens stablede areal. Saldoen bliver præcis nul, fordi den sidste rate fejer resten med efter afkast og beholdningsskat.
- **`Ceased` er den eneste tilstand, der afhænger af en anden persons tilstand.** Det er indgangen til efterladtescenariet.
- **Omsætningen er irreversibel.** Ændrer man `workEndAge` efter at have set resultatet, genberegnes hele forløbet — men inden for én kørsel sker omsætningen præcis én gang, jf. [ADR-0009](../adr/0009-livrenten-omsaettes-en-gang-ved-udbetalingsstart.md).
