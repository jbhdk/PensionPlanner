/** Feltforklaringerne: én tekst pr. felt og pr. kolonne, hentet frem ved at
    pege på etiketten.

    Teksterne her er ikke glossarets. CONTEXT.md skriver til den, der bygger,
    og skal kunne sige "andel pr. år, ikke procent" og nævne et feltnavn i
    koden. Registret her skriver til den, der planlægger sin pension, og må
    ingen af delene, jf. ADR-0021.

    ## Sådan skrives en forklaring

    1. **Sig hvad feltet betyder for planen — ikke hvad kontrollen gør.**
       Ikke "vælg en kommune i listen", men hvad kommunen afgør.
    2. **Ordet i etiketten må ikke være ordet i forklaringen.** En hjælpetekst
       til *Reguleringssats*, der siger "postens reguleringssats", er værre
       end ingen. Kan sætningen ikke skrives uden ordet, er ordet ikke
       forstået endnu.
    3. **Anden sætning svarer på "hvad betyder det for mig".** Første sætning
       siger, hvad feltet er; anden siger, hvad der sker, når man skruer på
       det. Har feltet intet at sige dér, så lad være — men de fleste har.
    4. **Ingen kodeord og ingen henvisninger indad.** Ingen feltnavne fra
       koden, ingen typenavne, ingen "jf. ADR-0007", ingen henvisning til
       glossaret. En lovhenvisning er tilladt, når loven selv er svaret.
    5. **To til tre sætninger.** Browserens boble forsvinder af sig selv, og
       en fjerde sætning når ikke at blive læst.
    6. **Skriv om tingen, ikke til brugeren.** "Beløbet er brutto", ikke
       "Indtast beløbet brutto". Ingen imperativer, intet "du".

    ## Hvad der ikke hører hjemme her

    En forklaring er statisk og gælder feltet. Skal fladen sige noget om
    *denne* plan lige nu — et spærret valg, en alder der er et skøn, en post
    der ikke falder i noget år — er det en `Hint` ved siden af feltet og ikke
    en forklaring på det. De to kan sagtens stå på samme felt: bufferen har
    en forklaring på, hvad en buffer er, og en `Hint` på, hvorfor netop denne
    beholdning ikke kan vælges.

    ## Nøglen

    Nøglen navngiver den ting, forklaringen handler om, i kodens eget sprog.
    Det, der er én ting, får én tekst — men to felter, der deler ord på
    skærmen, er to ting: `Transfer.from` er en beholdning, `Period.from` er
    et årstal.

    For skuffens felter er "én ting" feltet i modellen, uanset hvor mange
    skuffer der viser det: postens og overførslens periode er den samme
    `Period` og deler forklaring. For en tabelkolonne er "én ting" kolonnen,
    for en kolonne kan lægge sammen, trække fra eller skifte felt under
    overskriften, og læseren ser stadig kun én ting — se `CapYear.paid`, som
    viser to forskellige tal alt efter loftets form, og `YearTable.netResult`,
    som ikke har noget felt bag sig.

    Dækningen er total: hver etiket i skuffen og hver kolonneoverskrift i
    tabellerne har et opslag, uden undtagelse. Netop derfor er der ingen
    markering på skærmen af, at en etiket kan forklares — et mærke, der
    sidder på alt, siger ingenting. Garantien læres én gang og gælder
    overalt, og den holdes af typen: feltkomponenterne kræver en nøgle, så et
    nyt felt uden forklaring ikke oversætter. */
export const fieldHelp = {
  // ---------- Planen ----------

  'Plan.name':
    'Det, planen kaldes i vælgeren foroven. To fremskrivninger af den samme husstand kan hedde hver sit, så de kan skelnes — ordet indgår ikke i nogen beregning.',

  'Plan.startYear':
    'Det første år, fremskrivningen regner. Det er samtidig det år, alle beløb i dagens kroner måles i: 20.000 kr. tastet et sted i planen er 20.000 kr., som de er værd netop dette år.',

  'Plan.inflationAssumption':
    'Hvor meget priserne ventes at stige om året. Den gør to ting: udgifterne vokser med den gennem hele forløbet, og den regner de fremskrevne beløb tilbage igen, når visningen står i dagens kroner.',

  'Plan.section20ProjectionAssumption':
    'Hvor meget skattens beløbsgrænser ventes at stige om året, efter det sidste år hvor de officielle satser kendes. Den afgør, hvornår en voksende indkomst rammer topskatten — sat lavt rammer den tidligere.',

  'Plan.benefitProjectionAssumption':
    'Hvor meget folkepensionens grundbeløb og pensionstillæg ventes at stige om året, efter det sidste år hvor de officielle satser kendes. Den løfter kun kronebeløbene; hvor hårdt tillægget skæres af anden indkomst, ligger fast.',

  'Plan.buffer':
    'Den ene beholdning, hvor årets over- eller underskud lander. Alt, der bliver til overs, samler sig dér, og alt, der mangler, tages derfra — derfor er det den, man aflæser for at se, om planen holder hele vejen.',

  // ---------- Personen ----------

  'Person.name':
    'Det, personen kaldes i listerne, i årstabellens kolonneoverskrift og i forklaringen af et år. Det indgår ikke i nogen beregning.',

  'Person.birthYear':
    'Det år, personen er født. Det afgør folkepensionsalderen og dermed også, hvornår pensionsordningerne tidligst må udbetales.',

  'Person.birthMonth':
    'Den måned, personen er født i. Den er med, fordi flere folkepensionsaldre ikke er hele år — er den 65 og et halvt, afgør måneden, om folkepensionen begynder i det ene kalenderår eller det næste.',

  'Person.horizon':
    'Den alder, fremskrivningen løber til og med for denne person. Sat for lavt stopper regnestykket, før pengene er brugt op, og planen ser mere holdbar ud, end den er.',

  'Person.municipality':
    'Den kommune, personen bor i. Kommune- og kirkeskatteprocenten hentes derfra for hvert enkelt år og tastes ikke ind — det er også her, en flytning til en billigere kommune afprøves.',

  'Person.churchMember':
    'Om personen betaler kirkeskat. To personer i samme kommune kan svare hver sit, og skatten regnes for hver af dem for sig.',

  'Person.statePensionAge':
    'Den alder, hvor folkepensionen begynder. Den følger af fødselsdatoen efter lovens egen tabel og kan derfor ikke vælges — er trinnet endnu ikke vedtaget, står det som det skøn, det er.',

  // ---------- Beholdningen ----------

  'Holding.name':
    'Det, beholdningen kaldes i listen, i grafens bånd og i forklaringen af et år. Skriv gerne selskabet med, så to ratepensioner kan skelnes fra hinanden.',

  'Holding.variant':
    'Hvilken slags ordning eller opsparing der er tale om. Valget afgør alt det, der ikke tastes: hvordan afkastet beskattes, om der er et loft på vejen ind, og om penge ind i den nedsætter skatten.',

  'Holding.owner':
    'Hvem af husstandens personer der ejer beholdningen. Ejeren afgør, hvis skat afkastet indgår i, og hvis loft indbetalinger til den måles mod.',

  'Holding.balance':
    'Hvad der står på beholdningen i dag, ved planens første år. Herfra forrentes den år for år — det er et startpunkt og ikke et beløb, der gentages.',

  'Holding.grossReturn':
    'Hvor meget beholdningen ventes at vokse om året, før omkostninger. Det er ét fast skøn for hele forløbet og ikke en markedsudvikling — og det er det tal, planen er allermest følsom over for.',

  'Holding.openedOn':
    'Tidspunktet for den aftale, der satte ordningen i verden. Det afgør, efter hvilket regelsæt den tidligste udbetaling regnes, og måneden er med, fordi begge lovskel falder midt i et år — en ordning fra april 2007 må tømmes tidligere end en fra maj samme år.',

  'Holding.payoutRegime':
    'Det regelsæt, ordningens tidligste udbetaling regnes efter, afgjort af hvornår den blev tegnet. De to nyeste sætter grænsen fem eller tre år før folkepensionsalderen og flytter sig derfor med den; det ældste er fast 60 år og rører sig ikke.',

  'Holding.payoutAge':
    'Det tidligste tidspunkt, loven tillader penge trukket ud af netop denne ordning. Falder det efter det år, arbejdet stopper, skal årene imellem betales af frie midler — og to ordninger hos samme person kan have hver sit.',

  'Holding.payoutAgeOverride':
    'Den lavere grænse, en ordning har taget med sig fra en flytning mellem selskaber, sat direkte frem for udledt af tegningstidspunktet. Står feltet tomt, gælder det, regelsættet giver; står der et tal, er det tallet, der tæller.',

  'Holding.annualCostRate':
    'Den samlede årlige pris for at have pengene stående hos selskabet eller banken, opgjort i procent af saldoen. Den trækkes fra det forventede afkast, før pengene forrentes.',

  'Holding.netReturn':
    'Det, der er tilbage af det forventede afkast, når de årlige omkostninger er trukket fra. Det er den sats, pengene faktisk vokser med, og den følger af de to andre satser frem for at blive tastet.',

  // ---------- Posten ----------

  'Entry.name':
    'Det, posten kaldes i listen og i forklaringen af et år. Det indgår ikke i nogen beregning.',

  'Entry.amountInRealKroner':
    'Hvor stort beløbet er, målt i dagens kroner. Det skrives én gang og vokser selv gennem forløbet — en indtægt med sin egen reguleringssats, en udgift med planens inflation.',

  'Entry.direction':
    'Om beløbet kommer ind i husstanden eller går ud af den. Tallet skrives positivt begge veje; det er valget her, der afgør fortegnet.',

  'Entry.owner':
    'Hvem af husstandens personer beløbet tilhører. For en indtægt afgør det, hvis skat den indgår i, og hvis aldre perioden kan måles fra.',

  'Entry.taxTreatment':
    'Hvordan indtægten beskattes. Arbejdsindkomst betaler AM-bidrag og indgår i den personlige indkomst; skattefri gør ingen af delene og går ubeskåret ind i husstandens økonomi.',

  'Entry.regulationRate':
    'Hvor meget denne indtægt stiger om året. Den er uafhængig af planens inflation, netop fordi en løn typisk stiger hurtigere end priserne — og den forskel afgør, hvor meget der når at blive lagt til side inden erhvervsophøret.',

  // ---------- Perioden, delt af posten og overførslen ----------

  'Recurrence.kind':
    'Hvor tit beløbet falder inden for sin periode: hvert år, én enkelt gang, eller med et fast antal år imellem.',

  'Recurrence.n':
    'Hvor mange år der går mellem to gange. To betyder hvert andet år, fem betyder hvert femte.',

  'Period.anchor':
    'Om perioden er bundet til bestemte kalenderår eller til ejerens alder. Med alder flytter perioden sig af sig selv, hvis der senere skrues på, hvornår personen holder op med at arbejde.',

  'Period.once':
    'Hvornår den ene gang falder — som årstal eller som alder, alt efter forankringen. Der er ingen slutning at sætte, når beløbet kun kommer én gang.',

  'Period.from':
    'Hvornår beløbet begynder at falde. Står feltet tomt, løber det fra planens allerførste år.',

  'Period.to':
    'Hvornår beløbet holder op med at falde. Står feltet tomt, løber det forløbet ud.',

  'Period.followsWorkEnd':
    'Binder endepunktet til det år, personen holder op med at arbejde, i stedet for til en fast alder. Flyttes erhvervsophøret senere, flytter beløbet sig med, uden at posten skal rettes.',

  Timing:
    'Hvornår på året pengene falder. Det afgør, hvor længe de når at forrente sig, inden året er omme — et beløb i januar tæller et helt års afkast med, et i december næsten intet.',

  // ---------- Indbetalingen ----------

  'Contribution.source':
    'Hvor pengene til indbetalingen kommer fra. Er det en lønpost, trækkes de af lønnen før skat; er det en beholdning, flyttes allerede beskattede penge.',

  'Contribution.to':
    'Hvilken ordning pengene lander i. Valget afgør resten: om indbetalingen nedsætter skatten, hvilket loft den måles mod, og hvordan pengene beskattes, mens de står der.',

  'Contribution.amountForm':
    'Om indbetalingen er en andel af lønnen eller et bestemt kronebeløb. En andel følger lønnen op af sig selv; et kronebeløb skal rettes i hånden, hvis det skal følge med.',

  'Contribution.percentageOfEntry':
    'Hvor stor en del af lønposten der går ind i ordningen. Stiger lønnen, stiger indbetalingen med den, uden at noget skal rettes.',

  'Contribution.amountInRealKroner':
    'Hvor meget der indbetales, målt i dagens kroner. Beløbet følger planens inflation gennem forløbet og ikke lønnens eget tempo.',

  // ---------- Overførslen ----------

  'Transfer.from':
    'Den beholdning, pengene tages fra. En overførsel flytter kun mellem husstandens frie midler — skal pengene ind i en pensionsordning, er det en indbetaling i stedet.',

  'Transfer.to':
    'Den beholdning, pengene lander i. Flytningen er hverken en indtægt eller en udgift og beskattes ikke; den omplacerer penge, husstanden allerede har.',

  'Transfer.amountInRealKroner':
    'Hvor meget der flyttes, målt i dagens kroner. Beløbet følger planens inflation gennem forløbet.',

  // ---------- Årstabellens kolonner ----------

  'YearTable.year':
    'Kalenderåret, rækken gælder. En stjerne betyder, at årets satser ikke er officielt kendte endnu, men fremskrevet fra det sidste år, hvor de er.',

  'YearTable.personAge':
    'Personens alder ved udgangen af året. Den står her, fordi de fleste beslutninger i en plan hænger på en alder frem for på et årstal.',

  'YearResult.income':
    'Alt, hvad husstanden fik ind i året fra sine indtægtsposter. Afkastet er ikke med — det bliver stående på beholdningerne og har sin egen kolonne.',

  'YearTable.contributions':
    'Hvad der i alt landede i ordningerne i året. Det er penge, husstanden stadig har — de er blot flyttet — og de indgår derfor ikke i nettoresultatet længere til højre.',

  'YearResult.return':
    'Hvad alle beholdninger tilsammen forrentede sig med i året, før den skat beholdningerne selv betaler. Pengene bliver stående og bliver først til noget, der kan bruges, når der hæves.',

  'YearResult.tax':
    'Al skat, året kostede: husstandens personskatter og den skat, ordningerne selv betaler af deres afkast.',

  'YearResult.expenses':
    'Alt, hvad husstanden brugte i året, lagt sammen fra planens udgiftsposter.',

  'YearTable.netResult':
    'Hvad året gav eller kostede i alt — indtægter og afkast, minus skat og udgifter. Er tallet negativt, tærede året på formuen.',

  'YearTable.buffer':
    'Hvad der stod tilbage på bufferbeholdningen ved årets udgang. Går den i minus, mangler planen penge netop dér — enten fordi de står bundet et andet sted, eller fordi de slet ikke er der.',

  'YearResult.closingWealth':
    'Alt, husstanden ejer ved årets udgang, lagt sammen på tværs af beholdningerne. Er en livrente skiftet til en livsvarig ydelse i året, forlader depotet formuen, og tallet falder uden at der er brugt noget.',

  // ---------- Forklar-årets kolonner ----------

  'LayerAmount.layer':
    'Det enkelte trin i skatten — AM-bidrag, bundskat, kommuneskat og så videre. De opgøres hver for sig, og skatten er summen af dem, så hvert trin kan efterprøves alene.',

  'LayerAmount.base':
    'Det beløb, netop dette trin regnes af. Trinnene måler ikke det samme: nogle rammer hele indkomsten, andre kun det, der ligger over en bestemt grænse.',

  'LayerAmount.rate':
    'Den procent, trinnet opkræves med. Et loftnedslag står med negativ sats — dér er det, staten giver afkald på, når skatten ellers ville bryde skatteloftet.',

  'LayerAmount.amount':
    'Hvad trinnet kostede: grundlaget ganget med satsen. De to tal til venstre giver altid dette, så linjen kan efterregnes i hånden.',

  'EntryYear.entry':
    'Hvilken af planens ind- eller udbetalinger linjen gælder. Kun de poster, der faktisk falder i året, står her.',

  'EntryYear.amount':
    'Hvad posten var værd i netop dette år. Det er ikke det tal, der er tastet: beløbet er vokset fra planens første år med postens egen regulering eller med inflationen.',

  'EntryYear.returnWeight':
    'Hvor stor en del af året pengene nåede at være med i. Falder de i januar, tæller de næsten et helt års afkast med; falder de i december, næsten intet.',

  'ContributionYear.contribution':
    'Hvilken indbetaling linjen gælder, skrevet som hvor pengene kom fra, og hvor de gik hen.',

  'ContributionYear.fromSource':
    'Hvad der blev trukket ved kilden — af lønnen, før den blev udbetalt, eller af den beholdning pengene kom fra.',

  'ContributionYear.intoHolding':
    'Hvad der rent faktisk kom ind i ordningen. Er der forskel på de to tal, er forskellen AM-bidraget, som blev betalt på vejen ind.',

  'CapYear.variant':
    'Hvilken slags ordning loftet gælder, og hvem af husstanden det er gjort op for. Loftet er personens og deles af alle vedkommendes ordninger af den slags — to ratepensioner har ét loft mellem sig.',

  'CapYear.paid':
    'Hvad året lagde i ordningen. For aktiesparekontoen står i stedet det, der blev bedt om — hvor meget der kom ind, står i noten, for kontoen tager ikke imod mere, end der er plads til.',

  'CapYear.cap':
    'Hvor meget der højst måtte lægges ind i året. De fleste lofter måler årets samlede indbetaling; aktiesparekontoens måler i stedet, hvad der allerede står på den.',

  'CapYear.withDeductibility':
    'Hvor stor en del af indbetalingen der nedsatte årets skat. Ligger noget over loftet, bliver pengene stående i ordningen, men uden at give noget fradrag. En tankestreg betyder, at ordningen slet ikke giver fradrag.',

  'CapYear.note':
    'De tal, de faste kolonner ikke har plads til. For aktiesparekontoen står her, hvad der stod på den ved årets begyndelse, hvor meget der var plads til, og hvad der faktisk kom ind.',

  'HoldingYear.holding':
    'Hvilken af husstandens beholdninger linjen gælder. Alle står her, også dem der hverken fik eller mistede noget i året.',

  'HoldingYear.openingBalance':
    'Hvad der stod på beholdningen ved årets begyndelse — altså det, forrige år sluttede med.',

  'HoldingYear.weightedFlow':
    'De penge, der kom til eller forsvandt undervejs i året, talt med efter hvor længe de nåede at være der. Sammen med saldoen ved årets begyndelse er det grundlaget, afkastet regnes af.',

  'HoldingYear.return':
    'Hvad netop denne beholdning gav i året, før dens egen skat. Grundlaget ganget med satsen til venstre giver dette tal, så linjen kan efterregnes for sig.',

  'HoldingYear.tax':
    'Den skat, beholdningen selv betaler af sit afkast, og som trækkes af dens saldo. Den passerer ingen persons indkomst — pensionsordninger betaler PAL-skat, aktiesparekontoen sin egen sats, og de frie beholdninger ingen.',
} as const satisfies Record<string, string>

/** Nøglerne i registret. Feltkomponenterne kræver en af dem, så et felt uden
    forklaring er en oversætterfejl og ikke noget, nogen skal opdage. */
export type FieldHelpKey = keyof typeof fieldHelp
