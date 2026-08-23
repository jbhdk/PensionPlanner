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
    viser to forskellige tal alt efter loftets form, og `Surplus`, som
    lægger fire tal fra samme beholdningsår sammen.

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
    'Det første år, fremskrivningen regner. Det er samtidig det år, alle beløb i nutidskroner måles i: 20.000 kr. tastet et sted i planen er 20.000 kr., som de er værd netop dette år.',

  'Plan.inflationAssumption':
    'Hvor meget priserne ventes at stige om året. Den gør to ting: udgifterne vokser med den gennem hele forløbet, og den regner de fremskrevne beløb tilbage igen, når visningen står i nutidskroner.',

  'Plan.section20ProjectionAssumption':
    'Hvor meget skattens beløbsgrænser ventes at stige om året, efter det sidste år hvor de officielle satser kendes. Den afgør, hvornår en voksende indkomst rammer topskatten — sat lavt rammer den tidligere.',

  'Plan.statePensionProjectionAssumption':
    'Hvor meget folkepensionens grundbeløb og pensionstillæg ventes at stige om året, efter det sidste år hvor de officielle satser kendes. Den løfter kun de to kronebeløb — ATP og andre indtægter har hver deres egen sats, og hvor hårdt tillægget skæres af anden indkomst, ligger fast.',

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

  'Person.workEndAge':
    'Den alder, hvor lønnen og anden arbejdsindkomst ophører. Poster og udbetalingsplaner sat til at følge den, flytter sig automatisk, når alderen ændres, så forskellige stoptidspunkter er lette at sammenligne.',

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

  'Holding.payoutAge':
    'Det tidligste tidspunkt, pensionsselskabet oplyser, at netop denne ordning må udbetales. Falder det efter det år, arbejdet stopper, skal årene imellem betales af frie midler — og to ordninger hos samme person kan have hver sit.',

  'PayoutSchedule.start':
    'Den alder, hvor ordningen begynder at blive tømt. Bundet til erhvervsophør flytter hele forløbet sig, hvis året for arbejdets ophør senere ændres — og tidligere end lovens egen grænse kan den ikke sættes.',

  'PayoutSchedule.duration':
    'Hvor mange år ordningen tømmes over. Loven kræver mindst ti år, og den sidste rate skal falde senest tredive år efter den tidligste lovlige udbetaling. Flere år giver mindre om året og dermed en lavere skat af hvert enkelt beløb.',

  'PayoutSchedule.principle':
    'Hvordan årets beløb regnes af det, der står på ordningen ved årets begyndelse. Serieprincippet deler saldoen med de resterende år og giver stigende beløb, når afkastet er positivt; annuitetsprincippet regner med en lovfastsat rente og giver beløb, der er næsten lige store.',

  // ---------- Livrentens omsætning ----------

  'LifeAnnuity.payoutStart':
    'Den alder, hvor opsparingen bliver til en garanteret livsvarig ydelse. Tidligere end lovens egen grænse kan den ikke sættes, og bundet til erhvervsophør flytter tidspunktet sig, hvis året for arbejdets ophør senere ændres.',

  'LifeAnnuity.quotedReserve':
    'Selskabets eget tal for, hvad ordningen står i, når den livsvarige ydelse begynder. Kun forholdet mellem det og beløbet ved siden af bruges, og begge tal skrives derfor præcis som de står på pensionsoverblikket.',

  'LifeAnnuity.quotedAnnualBenefit':
    'Selskabets eget tal for, hvad ordningen udbetaler hvert år fra det tidspunkt, den begynder. Sammen med depottallet ved siden af giver det den brøk, den faktisk opsparede saldo ganges med — og fordi kun brøken bruges, går prisniveauet i de to ud med sig selv.',

  'LifeAnnuity.conversionFactor':
    'Forholdet mellem selskabets to tal ovenfor: hvor stor en del af opsparingen der bliver til et beløb om året. Det ganges én gang på det, ordningen faktisk er vokset til, og derefter ligger det livsvarige beløb fast.',

  'LifeAnnuity.bonusRate':
    'Hvor meget den livsvarige ydelse ventes at stige om året, efter at den er begyndt. Det er det eneste, der løfter beløbet — hverken planens inflation eller folkepensionens regulering rører det.',

  'Holding.annualCostRate':
    'Den samlede årlige pris for at have pengene stående hos selskabet eller banken, opgjort i procent af saldoen. Den trækkes fra det forventede afkast, før pengene forrentes.',

  'Holding.netReturn':
    'Det, der er tilbage af det forventede afkast, når de årlige omkostninger er trukket fra. Det er den sats, pengene faktisk vokser med, og den følger af de to andre satser frem for at blive tastet.',

  // ---------- Posten ----------

  'Entry.name':
    'Det, posten kaldes i listen og i forklaringen af et år. Det indgår ikke i nogen beregning.',

  'Entry.amountInRealKroner':
    'Hvor stort beløbet er, målt i nutidskroner. For en løn er det tallet, lønsedlen kalder løn — arbejdsgiverens pensionsbidrag hører til i afsnittet Pension og lægges til derfra. Beløbet skrives én gang og vokser selv gennem forløbet.',

  'Entry.direction':
    'Om beløbet kommer ind i husstanden eller går ud af den. Tallet skrives positivt begge veje; det er valget her, der afgør fortegnet.',

  'Entry.owner':
    'Hvem af husstandens personer beløbet tilhører. For en indtægt afgør det, hvis skat den indgår i, og hvis aldre perioden kan måles fra.',

  'Entry.taxTreatment':
    'Hvordan indtægten beskattes. Arbejdsindkomst betaler AM-bidrag og giver til gengæld beskæftigelses- og jobfradrag; en pension er beskattet på vejen ind og gør ingen af delene, men tæller med i indkomsten på lige fod; skattefri beskattes slet ikke.',

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

  'Contribution.name':
    'Det, indbetalingen hedder i listen og i forklaringen af et år. Hedder den noget om, hvilken aftale den hører til, kan to bidrag til den samme ordning skelnes fra hinanden. Det indgår ikke i nogen beregning.',

  'Contribution.source':
    'Hvor pengene til indbetalingen kommer fra. Er det en lønpost, trækkes de af lønnen før skat; er det en beholdning, flyttes allerede beskattede penge. En løn kan kun betale til ordninger i lønmodtagerens eget navn, mens opsparede penge kan gå til begges.',

  'Contribution.to':
    'Hvilken ordning pengene lander i. Valget afgør resten: om indbetalingen nedsætter skatten, hvilket loft den måles mod, og hvordan pengene beskattes, mens de står der.',

  'Contribution.amountForm':
    'Om indbetalingen er en andel af lønnen eller et bestemt kronebeløb. En andel følger lønnen op af sig selv; et kronebeløb skal rettes i hånden, hvis det skal følge med.',

  'Contribution.percentageOfEntry':
    'Hvor stor en del af lønposten der går ind i ordningen. Stiger lønnen, stiger indbetalingen med den, uden at noget skal rettes.',

  'Contribution.amountInRealKroner':
    'Hvor meget der indbetales, målt i nutidskroner. Beløbet følger planens inflation gennem forløbet og ikke lønnens eget tempo.',

  // ---------- Pensionen på lønposten ----------

  'PensionAgreement.employerContributionForm':
    'Om arbejdsgiverens del er en andel af lønnen eller et aftalt kronebeløb. En andel følger lønnen op af sig selv; et kronebeløb står stille, indtil det rettes.',

  'PensionAgreement.employerPercentage':
    'Hvor stor en del af lønnen arbejdsgiveren lægger oven i den til pension. Tallet er det, der står på lønsedlen — det måles af lønnen selv og ikke af lønnen plus bidraget.',

  'PensionAgreement.employerAmount':
    'Hvor meget arbejdsgiveren lægger oven i lønnen til pension, målt i nutidskroner. Beløbet følger lønnens egen stigning gennem forløbet og ikke prisudviklingen.',

  'PensionAgreement.employeeContributionForm':
    'Om egen del er en andel af lønnen eller et aftalt kronebeløb. Valget er uafhængigt af, hvordan arbejdsgiverens del er skrevet — de to kan sagtens stå på hver sin form.',

  'PensionAgreement.employeePercentage':
    'Hvor stor en del af lønnen der selv betales til pension. Den måler samme løn som arbejdsgiverens del, ligesom de to gør på lønsedlen, og til forskel fra den løfter den ikke indtægten — de penge er der i forvejen.',

  'PensionAgreement.employeeAmount':
    'Hvor meget der selv betales til pension, målt i nutidskroner. Beløbet følger lønnens egen stigning gennem forløbet, ligesom arbejdsgiverens del gør.',

  'PensionAgreement.fee':
    'Det, selskabet tager til sin egen administration af hver indbetaling, målt i nutidskroner. Det trækkes fra, før pengene går ind i ordningen, og bliver aldrig til opsparing — men det nedsætter skatten som resten af indbetalingen. Handelsomkostningerne hører ikke her; de sidder i ordningens årlige omkostning.',

  'PensionAgreement.insurancePremium':
    'Det, der hvert år går til en forsikring — typisk ved tab af erhvervsevne eller ved død — målt i nutidskroner. Pengene forlader husstanden og bliver aldrig til opsparing, men de nedsætter skatten som resten af indbetalingen.',

  'AllocationLine.to':
    'Den ordning, denne del af indbetalingen lander i. Kun ordninger, en arbejdsgiver kan administrere og som står i lønmodtagerens eget navn, kan vælges — valget afgør, om pengene nedsætter skatten, og hvilket loft de måles mod. Hver ordning står på én linje.',

  'AllocationShare.form':
    'Om ordningen får en andel af indbetalingen, et aftalt kronebeløb, eller så meget som loven giver plads til. En andel følger indbetalingen op og ned af sig selv; et kronebeløb bliver det samme, uanset hvad lønnen gør, indtil det rettes. Det sidste valg findes kun på de ordninger, der har en øvre grænse.',

  'AllocationShare.percentage':
    'Hvor stor en del af indbetalingen der går til denne ordning. Den måler det, der er tilbage efter arbejdsmarkedsbidraget, gebyret og forsikringen — altså de penge, der rent faktisk skal fordeles, og ikke lønnen.',

  'AllocationShare.amountInRealKroner':
    'Hvor meget der går til denne ordning, målt i nutidskroner. Beløbet følger lønnens egen stigning gennem forløbet, og rækker indbetalingen ikke til alle de aftalte beløb i et år, tages de oppefra og ned, indtil pengene er brugt.',

  'AllocationShare.upToCap':
    'Ordningen får den plads, der er tilbage under dens øvre grænse det år — grænsen minus det, årets øvrige indbetalinger til samme slags ordning allerede har lagt ind, hvor de så end står i planen. Beløbet følger derfor grænsen af sig selv, også når aldersopsparingens springer op syv år før folkepensionsalderen.',

  'AllocationShare.remainder':
    'Denne ordning får det, de øvrige linjer ikke tog. Præcis én ordning gør det, og det er dét, der får fordelingen til at gå op krone for krone i hvert eneste år — også de år, hvor lønnen er en anden end forventet.',

  // ---------- Overførslen ----------

  'Transfer.name':
    'Det, flytningen hedder i listen og i forklaringen af et år. Hedder den noget om, hvad pengene skal bruges til, kan to hævninger fra den samme opsparing skelnes fra hinanden. Det indgår ikke i nogen beregning.',

  'Transfer.from':
    'Den beholdning, pengene tages fra. Det kan være enhver opsparing, ejeren selv kan hæve af, når hun vil — frie midler, en aldersopsparing, en aktiesparekonto eller en kapitalpension. En ratepension er bundet af en udbetalingsplan og kan ikke vælges her; en kapitalpension koster til gengæld en afgift på vejen ud.',

  'Transfer.to':
    'Den beholdning, pengene lander i. Det er altid frie midler — skal de ind i en pensionsordning, er det en indbetaling i stedet, med et loft og en skattevirkning.',

  'Transfer.amountInRealKroner':
    'Hvor meget der flyttes, målt i nutidskroner. Beløbet følger planens inflation gennem forløbet, og der flyttes aldrig mere, end afgiveren havde ved årets begyndelse.',

  // ---------- Forklar-årets overførselskolonner ----------

  'TransferYear.transfer':
    'Hvilken flytning linjen gælder, kaldt det samme som i listen til venstre. En plan kan have flere, og de opgøres hver for sig.',

  'TransferYear.requested':
    'Det beløb, planen bad om i året. Det er tallet fra flytningen selv, løftet med inflationen frem til året.',

  'TransferYear.moved':
    'Det beløb, der faktisk forlod afgiveren. Det er lavere end det ønskede, når der ikke var nok at give af — hverken fra årets begyndelse eller fra de flytninger, der står før denne i planen. Resten blev ikke hævet og står stadig, hvor den stod.',

  'TransferYear.charge':
    'Det, staten tog af beløbet på vejen ud. Den rammer kun en hævning fra en kapitalpension, hvor en fast andel går fra hver eneste gang, uanset hvad året ellers rummer af indkomst. Er cellen tom, kostede flytningen ingenting.',

  'TransferYear.landed':
    'Det, der nåede frem til den beholdning, pengene skulle over på. Det er mindre end det hævede, når der var en afgift undervejs, og ellers præcis det samme beløb.',

  // ---------- Årstabellens kolonner ----------

  'YearTable.year':
    'Kalenderåret, rækken gælder. En stjerne betyder, at årets satser ikke er officielt kendte endnu, men fremskrevet fra det sidste år, hvor de er.',

  'YearTable.personAge':
    'Personens alder ved udgangen af året. Den står her, fordi de fleste beslutninger i en plan hænger på en alder frem for på et årstal.',

  'YearResult.income':
    'Alt, hvad husstanden fik ind i året fra sine indtægtsposter. Afkastet er ikke med — det bliver stående på beholdningerne og har sin egen kolonne.',

  'YearTable.contributions':
    'Hvad der i alt landede i ordningerne i året. Det er penge, husstanden stadig har — de er blot flyttet — men de forlader bufferbeholdningen og trækker derfor overskuddet ned.',

  'YearTable.payouts':
    'Hvad ordningerne tilsammen tømte sig med i året. Pengene flytter sig blot over på bufferbeholdningen, så husstanden har dem stadig, og kun skatten af dem forsvinder. De er der, årets overskud kommer fra, når lønnen er hørt op.',

  'YearResult.return':
    'Hvad alle beholdninger tilsammen forrentede sig med i året, før den skat beholdningerne selv betaler. Pengene bliver stående og bliver først til noget, der kan bruges, når der hæves.',

  'YearResult.tax':
    'Al skat, året kostede: husstandens personskatter og den skat, ordningerne selv betaler af deres afkast.',

  'YearResult.expenses':
    'Alt, hvad husstanden brugte i året, lagt sammen fra planens udgiftsposter. Har en løn en firmaordning, tæller gebyret og forsikringen med her: de penge forlader husstanden uden at blive til opsparing, selv om de ikke står som en post nogen steder. Hvad de var, står i forklaringen af året.',

  Surplus:
    'Hvad der blev til overs af det, året lagde ind på bufferbeholdningen og tog fra den. Afkastet tæller ikke med — det bliver stående, hvor det er tjent — mens skatten af det gør, for den skal betales. Et minus er det beløb, der mangler at blive flyttet fra en anden beholdning, og ikke et tegn på, at pengene ikke findes.',

  'SurplusBand.IncomeEntries':
    'Det, husstanden fik ind udefra i året — løn, ATP og hvad planen ellers navngiver på den side, plus det arbejdsgiveren lagde oven i lønnen til pension. Penge hentet op fra en ordning er noget husstanden havde i forvejen og står for sig.',

  'SurplusBand.Benefits':
    'De faste beløb, der kommer ind uden en saldo bag sig: folkepensionens grundbeløb og pensionstillæg, og hvad en omsat livrente betaler hvert år. De er hverken tastet som en post eller hævet fra en beholdning, men de lander på bufferbeholdningen som alt andet.',

  'SurplusBand.Payouts':
    'Det, ordningerne tilsammen tømte sig med i året. Pengene flytter sig blot over på bufferbeholdningen — husstanden havde dem i forvejen — og kun skatten af dem forsvinder. De er dér, året henter sine penge, når lønnen er hørt op.',

  'SurplusBand.TransfersIn':
    'Penge, planen hentede hjem fra en anden beholdning og over på bufferbeholdningen. Beløbet er det, der landede — kom det fra en kapitalpension, er afgiften trukket fra undervejs. Ellers er formuen den samme bagefter, og pengene står nu dér, hvor årets regninger betales fra.',

  'SurplusBand.Tax':
    'Alt, året kostede i personlig skat til det offentlige — ikke det, ordningerne selv trækker af deres eget afkast. Beløbet er større, end de synlige indtægter kan forklare, fordi afkast uden for ordningerne også beskattes, mens afkastet selv ikke tæller med her.',

  'TaxAssessment.total':
    'Hvad personen selv betaler i indkomstskat i året, alle lag lagt sammen. Aktieindkomstens del står ikke med her: den regnes af husstandens samlede gevinst på aktier og kan ikke deles mellem to.',

  'HouseholdTaxAssessment.shareIncomeTax':
    'Hvad husstanden betaler af gevinst og udbytte på aktier og aktiebaserede fonde i året. Den regnes under ét for begge i husstanden, fordi den lave sats gælder op til en fælles grænse, der kan flyttes mellem ægtefæller.',

  ReturnTax:
    'Den del af årets regning, der kommer af, hvad formuen har tjent uden for ordningerne. Den er med i beløbet ovenfor, mens gevinsten selv ikke er: den bliver stående, hvor den er tjent, og bliver først til penge, der kan bruges, den dag der hæves.',

  'SurplusBand.ExpenseEntries':
    'Alt, husstanden brugte i året, lagt sammen fra de linjer i planen, der koster penge. De vokser med den antagne prisstigning hele forløbet igennem og er dét, årets indtægter først og fremmest måles mod.',

  'SurplusBand.Contributions':
    'Det, der i året gik fra bufferbeholdningen og ind i en ordning. Pengene er ikke væk, blot bundet et andet sted, men de forlader den beholdning, årets regninger betales fra. Beløbet er det, der landede i ordningen; arbejdsmarkedsbidraget af det ligger i årets skat.',

  'SurplusBand.TransfersOut':
    'Penge, planen satte til side på en anden beholdning i året. Formuen er den samme bagefter, men beløbet står ikke længere dér, hvor årets regninger betales fra.',

  'YearTable.buffer':
    'Hvad der stod tilbage på bufferbeholdningen ved årets udgang. Går den i minus, mangler planen penge netop dér — enten fordi de står bundet et andet sted, eller fordi de slet ikke er der.',

  'YearResult.closingWealth':
    'Alt, husstanden ejer ved årets udgang, lagt sammen på tværs af beholdningerne. Er en livrente skiftet til en livsvarig ydelse i året, forlader depotet formuen, og tallet falder uden at der er brugt noget.',

  // ---------- Forklar-årets kolonner ----------

  'TaxAssessment.earnedIncome':
    'Alt det, der er tjent i år og beskattes som almindelig indkomst, før noget er trukket fra. Det er beløbet, arbejdsmarkedsbidraget og de to fradrag for at være i arbejde måles af.',

  'TaxAssessment.labourMarketContribution':
    'De otte procent, der trækkes af lønnen, før alt andet. De rammer kun arbejde: hverken folkepension, ATP eller udbetalinger fra en ordning bærer dem, for de er betalt på vejen ind.',

  'TaxAssessment.contributionWithDeductibility':
    'Den del af årets indbetaling, der blev holdt uden for indkomsten. Den virker stærkere end et almindeligt fradrag, fordi den også nedsætter grundlaget for de høje satser i toppen.',

  'TaxAssessment.pensionIncome':
    'Årets udbetalinger fra ordninger, folkepension og ATP under ét. De lægges til efter arbejdsmarkedsbidraget og giver ingen af de fradrag, arbejde giver.',

  'TaxAssessment.personalIncome':
    'Indkomsten, de fleste satser regnes af, når løn og udbetalinger er lagt sammen og indbetalingen trukket fra. Det er den, progressionsgrænserne måles på.',

  'PersonYear.shareIncome':
    'Årets gevinst eller tab på aktier uden for pensionsordningerne. Den beskattes efter sine egne to satser og lægges ikke til den øvrige indkomst.',

  'PersonYear.capitalIncome':
    'Årets renter og tilsvarende afkast, positivt eller negativt. Er beløbet negativt, nedsætter det den indkomst, kommuneskatten regnes af, men det giver ingen penge tilbage.',

  'MarginalTaxRates.earnedIncome':
    'Hvad den næste tjente krone koster i alt. Den bærer arbejdsmarkedsbidrag og kan flytte et af arbejdsfradragene, og satsen er derfor sjældent den samme som for en pensionskrone.',

  'MarginalTaxRates.pensionIncome':
    'Hvad den næste krone ud af en ordning koster husstanden. Ligger indtægten i det spænd, hvor tillægget skæres ned, koster kronen både sin egen skat og det tillæg, den tager væk — og også ægtefællens.',

  'YearResult.openingWealth':
    'Hvad husstanden ejede ved årets begyndelse, alle beholdninger lagt sammen. I fremtidskroner er det nøjagtig det beløb, forrige år sluttede med; i nutidskroner kan de to se forskellige ud, fordi hvert år regnes tilbage til sit eget prisniveau.',

  'YearResult.conversion':
    'De penge, der forlod formuen, da den livsvarige ordning blev byttet til en fast årlig indtægt. De er hverken brugt eller betalt i skat — de findes bare ikke længere som en opsparing.',

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
    'Hvor stor en del af året pengene nåede at være med i. Falder de i januar, tæller de næsten et helt års afkast med; falder de i december, næsten intet. Er de fordelt jævnt over året, tæller de slet ikke med: de passerer blot kontoen og efterlader først noget ved årets slutning.',

  'ContributionYear.contribution':
    'Hvilken indbetaling linjen gælder, kaldt det samme som i listen til venstre. En plan kan have flere til den samme ordning, og de opgøres hver for sig.',

  'ContributionYear.fromSource':
    'Hvad der blev trukket ved kilden — af lønnen, før den blev udbetalt, eller af den beholdning pengene kom fra.',

  'ContributionYear.intoHolding':
    'Hvad der rent faktisk kom ind i ordningen. Er der forskel på de to tal, er forskellen AM-bidraget, som blev betalt på vejen ind.',

  // ---------- Forklar-årets pensionsaftale ----------

  'PensionAgreementYear.entry':
    'Hvilken løn firmaordningen hører til. Der er højst én ordning pr. løn, så lønnens navn er også aftalens — og perioden er lønnens, så ordningen ophører af sig selv, når arbejdet gør.',

  'PensionAgreementYear.employerContribution':
    'Det, arbejdsgiveren lagde oven i lønnen i året. Det står ikke i lønnens eget beløb, men det er husstandens indtægt på lige fod med resten — ellers ville pengene dukke op i ordningen uden at være kommet nogen steder fra.',

  'PensionAgreementYear.employeeContribution':
    'Det, der blev taget af lønnen selv i året. Til forskel fra arbejdsgiverens del løfter den ikke indtægten: de penge var der i forvejen, og de går blot et andet sted hen end ud på kontoen.',

  'PensionAgreementYear.labourMarketContribution':
    'De otte procent af hele indbetalingen, der gik fra på vejen ind i ordningen. De er ikke en ekstra regning: beløbet er en del af årets samlede arbejdsmarkedsbidrag, som står i skatten ovenfor, og det er pensionsselskabet der holder det tilbage.',

  'PensionAgreementYear.fee':
    'Det, selskabet tog til sin egen administration i året. Beløbet forlader husstanden og bliver aldrig til opsparing, og det står derfor blandt årets udgifter — men det nedsætter skatten sammen med resten af indbetalingen.',

  'PensionAgreementYear.insurancePremium':
    'Det, forsikringen kostede i året. Pengene er brugt og står ikke i nogen ordning bagefter, men de nedsætter skatten som resten af indbetalingen — det er den ene udgift i planen, der gør begge dele.',

  'PensionAgreementDestination.holding':
    'Den ordning, pengene landede i. Valget afgør resten: om indbetalingen nedsætter skatten, hvilket loft den måles mod, og hvordan pengene beskattes, mens de står der.',

  'PensionAgreementDestination.requested':
    'Det, denne ordnings andel af fordelingen kom til i året — en procent af det, der var at fordele, et aftalt kronebeløb, eller det de øvrige lod stå. Er tallet højere end det, der landede, rakte årets indbetaling ikke til alle de aftalte kronebeløb.',

  'PensionAgreementDestination.landed':
    'Det, der nåede frem til ordningen: de to bidrag lagt sammen, og arbejdsmarkedsbidraget, gebyret og forsikringen trukket fra, delt ud efter fordelingen. Det er dét beløb, loftet måles mod — de tre fradrag måles ikke mod noget loft, for de er trukket, før pengene nåede ordningen.',

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

  'StatePensionYear.basicAmount':
    'Den del af folkepensionen, alle får. Den er den samme uanset hvor stor en indkomst der er ved siden af, og den kan hverken skæres ned af arbejde eller af udbetalinger fra en ordning.',

  'StatePensionYear.pensionSupplement':
    'Det, der er tilbage, når indtægten har skåret i den indtægtsafhængige del af folkepensionen. Det er dette beløb — ikke det fulde — der udbetales og beskattes, og det er nul for den, hvis indtægt er stor nok.',

  'StatePensionYear.total':
    'Årets samlede beløb fra det offentlige: den faste del plus det, der blev tilbage af den indtægtsafhængige. Det er, hvad der faktisk kommer ind på kontoen i løbet af året.',

  'Taper.fullSupplement':
    'Den del af folkepensionen, der afhænger af indtægten, i sin fulde størrelse — altså før indtægten har skåret i den. Hvor stor den er, afhænger alene af, om man bor alene: en enlig får omtrent det dobbelte af en samlevende.',

  'Taper.allowance':
    'Hvor stor en indtægt der er fri, før tillægget begynder at blive skåret ned. Under den grænse udbetales tillægget ubeskåret, uanset hvordan indtægten er sammensat.',

  'Taper.reduction':
    'Hvor meget indtægten kostede i tillæg i år. Det er procenten ganget med den del af grundlaget, der ligger over det fri beløb — og aldrig mere, end der var tillæg at tage af.',

  'TaperBase.pensionIncome':
    'Det, husstandens egne ordninger har lagt ud i år, sammen med den livsvarige ydelse fra Arbejdsmarkedets Tillægspension. Det er den tungeste del af grundlaget — og den eneste, der kan flyttes til et andet år ved at ændre, hvornår ordningerne tømmes.',

  'TaperBase.capitalIncome':
    'Renter og lignende afkast af opsparing, når året samlet gav overskud. Et år med underskud tæller som nul: det lemper ikke, men det gør heller ingen skade.',

  'TaperBase.shareIncome':
    'Årets gevinst på aktier uden for en pensionsordning og uden for aktiesparekontoen. Den tæller fuldt med, selv om den beskattes efter sine egne satser og ikke som almindelig indkomst.',

  'TaperBase.spouse':
    'Den del af ægtefællens indtægt, der tæller med her. En fast andel holdes udenfor, så længe ægtefællen ikke selv får folkepension — og fra det år det sker, tæller hele beløbet med.',

  'TaperBase.total':
    'Den samlede indtægt, tillægget måles imod. Løn tæller ikke med, hverken egen eller ægtefællens, og det gør penge fra en aldersopsparing eller en aktiesparekonto heller ikke. Beløbet er rundet ned til nærmeste hundrede kroner, som loven foreskriver, og det er derfor sjældent præcis summen af linjerne ovenfor.',

  'LifeAnnuityBenefit.holding':
    'Hvilken af husstandens livrenter det årlige beløb kom af. Ordningen selv står med saldo nul fra det år, den blev omsat — pengene er byttet til en indtægt og findes ikke længere som en opsparing.',

  'LifeAnnuityBenefit.owner':
    'Hvem i husstanden der modtager beløbet. Det afgør, hvis skat det indgår i — pengene lander samme sted uanset hvem, men skatten af dem gør ikke.',

  'LifeAnnuityBenefit.amount':
    'Hvad ordningen udbetaler i netop dette år. Beløbet blev lagt fast, da opsparingen blev omsat, og stiger derefter kun med den bonus, der er regnet med — det kan hverken løbe tør eller falde.',

  'HoldingYear.holding':
    'Hvilken af husstandens beholdninger linjen gælder. Alle står her, også dem der hverken fik eller mistede noget i året.',

  'HoldingYear.openingBalance':
    'Hvad der stod på beholdningen ved årets begyndelse — altså det, forrige år sluttede med.',

  'HoldingYear.payout':
    'Hvad ordningen tømte sig med i året — for en ratepension årets rate, som regnes af saldoen ved årets begyndelse. Pengene er ikke væk: de er flyttet over på bufferen, og kun skatten af dem forsvinder. En tankestreg betyder, at ordningen ikke har en plan for at blive tømt.',

  'HoldingYear.weightedFlow':
    'De penge, der kom til eller forsvandt undervejs i året, talt med efter hvor længe de nåede at være der. Sammen med saldoen ved årets begyndelse er det grundlaget, afkastet regnes af. På bufferen tæller kun det, der faldt i en bestemt måned: de månedlige beløb passerer den blot og efterlader først noget ved årets slutning.',

  'HoldingYear.return':
    'Hvad netop denne beholdning gav i året, før dens egen skat. Grundlaget ganget med satsen til venstre giver dette tal, så linjen kan efterregnes for sig.',

  'HoldingYear.tax':
    'Den skat, beholdningen selv betaler af sit afkast, og som trækkes af dens saldo. Den passerer ingen persons indkomst — pensionsordninger betaler PAL-skat, aktiesparekontoen sin egen sats, og de frie beholdninger ingen.',
} as const satisfies Record<string, string>

/** Nøglerne i registret. Feltkomponenterne kræver en af dem, så et felt uden
    forklaring er en oversætterfejl og ikke noget, nogen skal opdage. */
export type FieldHelpKey = keyof typeof fieldHelp
