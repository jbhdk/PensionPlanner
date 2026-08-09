# Diagrammer

Fire views af designet. De er skrevet i Mermaid direkte i markdown, så de kan diffes i git, rettes én pil ad gangen og renderes af både GitHub og VS Code uden værktøjskæde.

| # | Diagram | Spørgsmål det besvarer |
|---|---------|------------------------|
| 1 | [Domænemodellen](./01-domaenemodel.md) | Hvilke typer findes der, og hvad ejer hvad? |
| 2 | [Ét simuleringsår](./02-simuleringsaaret.md) | I hvilken rækkefølge regner motoren? |
| 3 | [Livscyklusser](./03-livscyklus.md) | Hvad betyder "pensioneret", og hvornår skifter noget tilstand? |
| 4 | [Pengestrømmen](./04-pengestroem.md) | Hvor lander en krone, og hvad beskatter og aftrapper den undervejs? |

Begreberne er defineret i [CONTEXT.md](../../CONTEXT.md). Beslutningerne bag dem står i [ADR'erne](../adr/). Diagrammerne tilføjer ingen nye begreber — finder du et ord her, som ikke står i CONTEXT.md, er det en fejl i diagrammet.

Med én undtagelse: en klasse mærket `<<skitse>>` er tegnet efter PRD'en og ikke efter glossaret. Den viser en form, der endnu ikke er afgjort, og dens navne er ikke bindende for koden. Mærket forsvinder, når termerne er grillet på plads.

Hver fil slutter med et afsnit **Åbne punkter**: steder hvor diagrammet er tegnet efter en antagelse, der ikke er afgjort endnu.
