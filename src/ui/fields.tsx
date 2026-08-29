import type { ChangeEvent, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'
import { workEndBoundAge } from '../engine/age'
import type { AgeBound, Person, PersonAgeBound } from '../engine/plan'
import { boundReason, boundValue } from '../engine/validatePlan'
import type { Bound, Bounds } from '../engine/validatePlan'
import { fieldHelp, type FieldHelpKey } from './fieldHelp'
import { formatNumber, parseNumber } from './planEdits'

/** Skuffens byggeklodser: hvordan ét felt tegnes, ikke hvilke felter hvert
    objekt har. Det sidste står i `Inspector.tsx`, som er filens eneste bruger
    — delingen går efter abstraktionsniveau og ikke efter genbrug.

    Hver komponent kræver en `help` — nøglen til feltets forklaring i
    `fieldHelp.ts`. Den er krævet og ikke valgfri, fordi dækningen er lovet
    total: et nyt felt uden forklaring skal fejle i oversætteren og ikke i
    et review. Teksten hænger på etiketten, som er det, man peger på. */

/** Et afsnit i skuffen. `action` er den ene knap, afsnittet selv kan bære —
    den, der lægger afsnittets figur til eller fjerner den igen. Den ligger på
    overskriftslinjen og ikke mellem felterne, så det er tydeligt, hvad den
    gælder: afsnittet, ikke det felt den tilfældigvis står nærmest. */
export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="afsnit">
      {/* Knappen står som overskriftens søskende og ikke inde i den:
          overskriftens tekst er afsnittets navn og bruges som sådan, og en
          knap inden i den ville lægge sin egen tekst til navnet. Den
          placeres oven på overskriftslinjen af `.afsnit-handling`. */}
      <h3>{title}</h3>
      {action && <span className="afsnit-handling">{action}</span>}
      {children}
    </section>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>
}

/** Beskeden om, at den redigering, der lige blev foretaget, blev rettet af en
    grænse — og hvilken.

    Den er hverken en feltforklaring eller en `Hint`, jf. ADR-0045. En
    forklaring er statisk og gælder feltet; en `Hint` er en ren funktion af
    den plan, der ligger på skærmen. Denne er ingen af delene: efter snappet
    er planen gyldig, og der findes ikke længere spor af, hvad brugeren
    prøvede. Den huskes derfor af `App` og dør, når valget skifter, eller når
    næste redigering går igennem uklemt — skrevet som en `Hint` ville den
    blive stående for evigt.

    `field` er feltets egen forklaringsnøgle. Skuffen viser hver nøgle højst
    én gang, og et *træk* på tidslinjen kan dermed pege på det felt, det ramte,
    uden at kende den komponent, der tegner det. */
export type Clamp = { field: FieldHelpKey; message: string }

/** Klemningen, en grænse melder, når den greb ind i et bestemt felt — eller
    intet, hvis grænsen ingen begrundelse bærer.

    Ét sted, fordi tre spørger: feltet, der klemte det tastede, håndtaget, der
    klemte et træk, og løftet, et skift af overførslens afgiver medfører. De
    møder den samme væg og skal sige det samme om den. */
export function clampBy(field: FieldHelpKey, bound: Bound | undefined): Clamp | null {
  const message = boundReason(bound)
  return message === undefined ? null : { field, message }
}

function ClampNote({ children }: { children: ReactNode }) {
  return (
    <p className="klemning" role="status">
      {children}
    </p>
  )
}

/** Rammen om ét felt i skuffen: etiketten til venstre, kontrollen og enheden
    til højre. Rammen ejer id'et og rækker det videre til kontrollen — etiket
    og værdikolonne er søskende i en flexrække og kan ikke bygges om til en
    omsluttende `<label>` uden at vælte opstillingen, se `.felt` i app.css.

    `LockedField` står udenfor: den har ingen kontrol at pege på og bruger
    `span.etiket`, hvor et `<label htmlFor>` ville pege på ingenting. */
function Field({
  label,
  help,
  unit,
  clamp,
  children,
}: {
  label: string
  help: FieldHelpKey
  /** Udeladt giver en tom enhedskolonne — bredden holdes alligevel, så alle
      felters kontroller flugter ned gennem sektionen. En `UnitToggle` er
      også en enhed: den vælger imellem dem og hører derfor til her. */
  unit?: ReactNode
  /** Fladens seneste klemning, hvor den end kom fra. Noten vises kun, når
      den peger på netop dette felt — rammen kender feltets nøgle og skal
      derfor ikke have besked to gange om, hvem den er. */
  clamp?: Clamp | null
  children: (id: string) => ReactNode
}) {
  const id = useId()
  // Noten står uden for `.felt`, som er en flexrække: inde i den ville
  // beskeden lægge sig ved siden af kontrollen i stedet for under den, som
  // `AgeBoundField`s tilvalg allerede har vist.
  return (
    <>
      <div className="felt">
        <label htmlFor={id} title={fieldHelp[help]}>
          {label}
        </label>
        <span className="vaerdi">
          {children(id)}
          <span className="enhed">{unit ?? ''}</span>
        </span>
      </div>
      {clamp?.field === help && <ClampNote>{clamp.message}</ClampNote>}
    </>
  )
}

export function TextField({
  label,
  help,
  value,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} help={help}>
      {(id) => (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}

/** Teksten i et talfelt, mens der tastes i det.

    Feltets tekst er sandheden, så længe feltet har fokus. Et halvskrevet tal
    som "7," eller "-" parser til noget andet end det, der står, og skrev
    feltet sig selv tilbage til den parsede værdi ved hvert tastetryk, ville
    decimaltegnet blive ædt, før decimalen nåede at blive tastet: "7,5" endte
    som 75.

    Ved blur er "halvskrevet" ikke længere en mulighed, og teksten skrives om
    fra værdien — ellers kunne feltet blive stående med "7," over en plan, der
    siger 7. Kommer værdien udefra — en anden beholdning valgt i navigatoren,
    en import, en fortrydelse — viger teksten på samme måde.

    Skellet mellem de to slags ændring er den værdi, feltet selv sidst sendte
    af sted, og ikke om teksten stadig parser til planens tal. De to er kun
    det samme, så længe `parse` er en oversættelse; klemmer den, oversætter
    den ikke længere entydigt, og mange forskellige tekster giver den samme
    værdi. Et felt, der blev løftet udefra fra 2028 til 2033, ville da blive
    stående med "2028", fordi netop dén tekst også klemmes til 2033 — og
    teksten ville lyve om planen.

    Krogen hviler på, at `parse(format(v))` er `v`; se `formatNumber`. Den
    modsatte vej gælder ikke og skal ikke gælde: `format(parse("7,"))` er
    netop den omskrivning, feltet ikke må lave, mens der tastes. */
function useNumberText<T>(
  value: T,
  format: (value: T) => string,
  parse: (text: string) => T,
  /** Teksten følger med værdien ud, så et felt med grænser kan se, hvad der
      blev tastet, og ikke kun hvad planen fik. Forskellen mellem de to *er*
      klemningen. */
  onChange: (value: T, text: string) => void,
): {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
} {
  const [text, setText] = useState(() => format(value))
  const [lastValue, setLastValue] = useState(value)
  // Det, feltet selv sidst sendte af sted. Et ref og ikke tilstand: det er
  // ikke noget, der skal tegnes, kun noget den næste tegning skal kunne
  // spørge om.
  const sent = useRef<{ value: T } | null>(null)

  if (!Object.is(value, lastValue)) {
    setLastValue(value)
    if (sent.current === null || !Object.is(sent.current.value, value)) setText(format(value))
  }

  return {
    value: text,
    onChange: (event) => {
      const parsed = parse(event.target.value)
      sent.current = { value: parsed }
      setText(event.target.value)
      onChange(parsed, event.target.value)
    },
    onBlur: () => setText(format(value)),
  }
}

/** Grænserne selv står i `validatePlan` ved siden af den regel, de er den
    venlige udgave af — se `Bounds` dér. Her klemmes værdien og ikke teksten:
    teksten bliver stående, mens der tastes, så et felt med en nedre grænse på
    ti stadig kan tastes ét ciffer ad gangen. Først når feltet forlades,
    retter teksten sig ind efter den værdi, planen faktisk fik. */
function clampTo(value: number, bounds: Bounds | undefined): number {
  if (bounds === undefined) return value
  const atLeast = bounds.min === undefined ? value : Math.max(value, boundValue(bounds.min))
  return bounds.max === undefined ? atLeast : Math.min(atLeast, boundValue(bounds.max))
}

/** Det, et tømt felt falder tilbage på: den nedre grænse, hvor der er en.
    Er endepunktet påkrævet — en udbetalingsplan skal begynde et sted — er
    tomt ikke et svar, og grænsen er det nærmeste gyldige.

    Siger grænsen selv, at tomt er et svar, står feltet tomt. Et
    periodeendepunkt beholder på den måde sin åbne betydning, selv om det
    andet endepunkt har lagt en grænse — se `mayBeEmpty` i `Bounds`. */
function emptyFallsBackTo(bounds: Bounds | undefined): number | undefined {
  if (bounds?.min === undefined || bounds.mayBeEmpty) return undefined
  return boundValue(bounds.min)
}

/** Klemningen, en redigering udløste — eller intet, hvis det tastede gik
    igennem, som det blev tastet.

    Grænsen uden en begrundelse melder intet. Den slags vægge kan ses i
    forvejen, og en besked om noget synligt er støj, jf. `Bound`. */
function clampedBy(
  typed: number | undefined,
  bounds: Bounds | undefined,
  field: FieldHelpKey,
): Clamp | null {
  if (typed === undefined) return null
  const clamped = clampTo(typed, bounds)
  if (clamped === typed) return null
  return clampBy(field, clamped > typed ? bounds?.min : bounds?.max)
}

/** Tomt betyder "ikke sat" — et åbent periodeendepunkt, altså fra planens
    start eller til horisontens slut. Modstykket til `formatNumber`, hvor tomt
    ville have parset til 0. */
function formatOptional(value: number | undefined): string {
  return value === undefined ? '' : formatNumber(value)
}

function parseOptional(text: string): number | undefined {
  return text === '' ? undefined : parseNumber(text)
}

export function NumberField({
  label,
  help,
  unit,
  value,
  bounds,
  clamp,
  onClamp,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  unit?: ReactNode
  value: number
  /** Udeladt betyder et frit tal. Se `Bounds`. */
  bounds?: Bounds
  clamp?: Clamp | null
  onClamp?: (clamp: Clamp | null) => void
  onChange: (value: number) => void
}) {
  const tal = useNumberText(
    value,
    formatNumber,
    (text) => clampTo(parseNumber(text), bounds),
    // En grænse uden begrundelse melder intet, jf. `clampedBy` — et felt med
    // to bare tal om sig klemmer derfor lige så tavst som før.
    (next, text) => {
      onClamp?.(clampedBy(parseNumber(text), bounds, help))
      onChange(next)
    },
  )

  return (
    <Field label={label} help={help} unit={unit} clamp={clamp}>
      {(id) => <input id={id} type="text" inputMode="decimal" className="tal" {...tal} />}
    </Field>
  )
}

/** Et talfelt der kan stå tomt — se `formatOptional`. */
export function OptionalNumberField({
  label,
  help,
  unit,
  value,
  bounds,
  clamp,
  onClamp,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  unit?: ReactNode
  value: number | undefined
  /** Udeladt betyder et frit tal, og feltet kan da stå tomt — sådan skrives
      et åbent periodeendepunkt. Er en nedre grænse sat, falder et tømt felt
      tilbage på den, med mindre grænsen selv siger, at tomt er et svar.
      Ganske som i `AgeBoundField`. Se `Bounds`. */
  bounds?: Bounds
  clamp?: Clamp | null
  onClamp?: (clamp: Clamp | null) => void
  onChange: (value: number | undefined) => void
}) {
  const tal = useNumberText(
    value,
    formatOptional,
    (text) => {
      const parsed = parseOptional(text)
      return parsed === undefined ? emptyFallsBackTo(bounds) : clampTo(parsed, bounds)
    },
    (next, text) => {
      onClamp?.(clampedBy(parseOptional(text), bounds, help))
      onChange(next)
    },
  )

  return (
    <Field label={label} help={help} unit={unit} clamp={clamp}>
      {(id) => <input id={id} type="text" inputMode="decimal" className="tal" {...tal} />}
    </Field>
  )
}

/** Et periodeendepunkt for en aldersforankret post: en fast alder, tomt, eller
    afkrydset, en henvisning til personens erhvervsophør — feltet flytter sig
    selv, når erhvervsophørsalderen ændres, jf. `AgeBound`. Den tredje slags
    værdi er grunden til, at `useNumberText` er generisk: henvisningen er ikke
    et tal, men den skal vises som ét. */
export function AgeBoundField({
  label,
  help,
  value,
  workEndAge,
  followsWorkEndAt,
  bounds,
  clamp,
  onClamp,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  value: AgeBound | undefined
  /** Ejerens erhvervsophørsalder — det tal feltet viser, når endepunktet
      følger den. Feltet er skrivebeskyttet imens frem for tomt: alderen er
      det, spørgsmålet handler om, og den skal kunne læses uden at klikke
      tilvalget fra igen. */
  workEndAge: number
  /** Den alder, tilvalget svarer til i feltets egen rolle — se
      `workEndBoundAge`. Den er ikke altid den, feltet viser: som slutår
      betyder erhvervsophør året før, jf. ADR-0031. Udeladt betyder
      erhvervsophørsalderen selv. */
  followsWorkEndAt?: number
  /** Udeladt betyder en fri alder, og feltet kan da også stå tomt — sådan
      skrives et åbent periodeendepunkt. Er en nedre grænse sat, er
      endepunktet påkrævet, og et tømt felt falder tilbage på grænsen: en
      udbetalingsplan skal begynde et sted. Siger grænsen selv, at tomt er et
      svar, står feltet tomt alligevel. Grænserne gælder også tilvalget
      herunder, som ikke kan klemmes og derfor afvises. Se `Bounds`. */
  bounds?: Bounds
  clamp?: Clamp | null
  onClamp?: (clamp: Clamp | null) => void
  onChange: (value: AgeBound | undefined) => void
}) {
  const followsWorkEnd = value === 'WorkEndAge'
  const tal = useNumberText<AgeBound | undefined>(
    value,
    (bound) => (bound === 'WorkEndAge' ? formatNumber(workEndAge) : formatOptional(bound)),
    (text) => {
      const parsed = parseOptional(text)
      return parsed === undefined ? emptyFallsBackTo(bounds) : clampTo(parsed, bounds)
    },
    // Målt på det tastede og ikke på det, feltet gav videre — forskellen
    // mellem de to *er* klemningen, ganske som i `OptionalNumberField`.
    // Tilvalget herunder melder på sin egen måde: det kan ikke klemmes og
    // afvises i stedet.
    (next, text) => {
      onClamp?.(clampedBy(parseOptional(text), bounds, help))
      onChange(next)
    },
  )

  // Tilvalget får sin egen linje under aldersfeltet. Proppet ind i
  // enhedskolonnen sprængte "erhvervsophør" de 40px, alle andre felter deler,
  // og skubbede inputtet ud af flugt med resten af sektionen.
  return (
    <>
      <Field label={label} help={help} unit="år" clamp={clamp}>
        {(id) => (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            className="tal"
            readOnly={followsWorkEnd}
            {...tal}
            // Følger endepunktet erhvervsophøret, er feltet en aflæsning og
            // ikke et talfelt: teksten kommer fra ejeren og skal følge med,
            // hvis alderen flytter sig, hvor krogens tekst først viger, når
            // endepunktet selv skifter.
            value={followsWorkEnd ? formatNumber(workEndAge) : tal.value}
          />
        )}
      </Field>
      <div className="felt felt--tilvalg">
        <span className="vaerdi">
          {/* Tilvalget er sit eget spørgsmål og har derfor sin egen
              forklaring — feltet ovenfor svarer på *hvornår*, tilvalget på
              *hvad det følger*. Nøglen er fast: der er kun ét tilvalg. */}
          <label title={fieldHelp['Period.followsWorkEnd']}>
            <input
              type="checkbox"
              checked={followsWorkEnd}
              // Tilvalget har kun to stillinger og kan ikke klemmes. Ligger
              // den alder, det svarer til, uden for grænserne, afvises
              // redigeringen i stedet, og fluebenet springer tilbage af sig
              // selv — det er planen, der tegner det, jf. ADR-0045. Går den
              // igennem, dør den forrige klemning som ved enhver anden
              // uklemt redigering.
              onChange={(event) => {
                if (!event.target.checked) {
                  onClamp?.(null)
                  onChange(undefined)
                  return
                }
                const refused = clampedBy(followsWorkEndAt ?? workEndAge, bounds, help)
                onClamp?.(refused)
                if (refused === null) onChange('WorkEndAge')
              }}
            />{' '}
            Følger erhvervsophør
          </label>
        </span>
      </div>
    </>
  )
}

/** Et periodeendepunkt for en aldersforankret post: en fast alder, tomt,
    eller afkrydset, en henvisning til en navngiven persons erhvervsophør, jf.
    `PersonAgeBound`. Samme opbygning som `AgeBoundField`, som bruger
    `AgeBound` til `PayoutSchedule.start` — de to felter deler visning, ikke
    type, ganske som ADR-0050 og ADR-0051 lader de to bundne typer dele form
    og ikke navn.

    Både fluebenet og et fast alderstal får hver sin personvælger, når
    husstanden har to personer: uden et valg ville "Til" på en Overførsel
    eller postens ejer stiltiende afgøre, hvem der måles på, netop den
    tvetydighed ADR-0050 og ADR-0051 fjerner. De to vælgere udelukker
    hinanden — kun den, der svarer til feltets nuværende form, vises. */
export function PersonAgeBoundField({
  label,
  help,
  value,
  owner,
  persons,
  role,
  bounds,
  boundsForCandidate,
  clamp,
  onClamp,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  value: PersonAgeBound | undefined
  /** Personen, et fast alderstal måles fra, når hverken fluebenet eller dets
      egen personvælger navngiver en anden, jf. ADR-0050 og ADR-0051. */
  owner: Person
  /** Husstandens personer, til de to vælgere. De vises kun, når der er mere
      end én — er der kun `owner`, er der intet valg at tilbyde. */
  persons: Person[]
  /** Endepunktets rolle, til at oversætte den valgte persons erhvervsophør
      til den rette alder — se `workEndBoundAge`. */
  role: 'from' | 'to'
  bounds?: Bounds
  /** Grænserne, som om et navnevalg der endnu ikke er truffet, allerede stod
      der — spurgt i motoren og ikke udledt her, jf. `periodEndpointBounds`.
      `bounds` er kun i den *nuværende* navngivnes enhed og kan ikke selv
      svare, når personvælgeren skifter til en anden: to personer med
      forskelligt fødselsår deler ikke én aldersskala. Udeladt falder tilbage
      på `bounds`, hvilket kun er rigtigt, når der ikke er noget valg at
      skifte til. */
  boundsForCandidate?: (candidate: PersonAgeBound) => Bounds
  clamp?: Clamp | null
  onClamp?: (clamp: Clamp | null) => void
  onChange: (value: PersonAgeBound | undefined) => void
}) {
  const follows = typeof value === 'object' && !('age' in value)
  const followedId = follows ? value.person : owner.id
  const followed = persons.find((person) => person.id === followedId) ?? owner

  // Et fast alderstal, der eksplicit navngiver en anden end `owner` — `age`
  // findes kun i den gren, jf. `PersonAgeBound`. `undefined` betyder her
  // "ingen navngivning", ikke "intet tal": det bare tal måles fortsat på
  // `owner`, som før ADR-0051.
  const fixedPersonId = typeof value === 'object' && 'age' in value ? value.person : undefined
  const fixedOwner = persons.find((person) => person.id === fixedPersonId) ?? owner
  const fixedAge = follows
    ? undefined
    : typeof value === 'number'
      ? value
      : typeof value === 'object'
        ? value.age
        : undefined

  const tal = useNumberText<PersonAgeBound | undefined>(
    value,
    (bound) => {
      if (typeof bound !== 'object') return formatOptional(bound)
      return formatNumber('age' in bound ? bound.age : followed.workEndAge)
    },
    (text) => {
      const parsed = parseOptional(text)
      const resolved = parsed === undefined ? emptyFallsBackTo(bounds) : clampTo(parsed, bounds)
      if (resolved === undefined) return undefined
      return fixedPersonId === undefined ? resolved : { person: fixedPersonId, age: resolved }
    },
    (next, text) => {
      onClamp?.(clampedBy(parseOptional(text), bounds, help))
      onChange(next)
    },
  )

  // Forsøger at følge personen — enten den forudfyldte ejer ved fluebenets
  // første krydsning, eller den nyvalgte ved et skift i vælgeren. Samme
  // klemning begge veje: alderen, valget svarer til i feltets egen rolle,
  // skal ligge inden for grænserne, ellers afvises redigeringen, og
  // fluebenet eller vælgeren springer tilbage af sig selv, jf. ADR-0045.
  function attemptFollow(personId: string) {
    const chosen = persons.find((person) => person.id === personId) ?? owner
    const candidateBounds = boundsForCandidate?.({ person: personId }) ?? bounds
    const refused = clampedBy(workEndBoundAge(chosen, role), candidateBounds, help)
    onClamp?.(refused)
    if (refused === null) onChange({ person: personId })
  }

  // Fluebenets egen forudfyldning: ejeren selv, som ADR-0050 lægger op til —
  // men falder til den første anden person i husstanden, ejerens eget svar
  // ikke holder. Det modsatte endepunkt følger ofte allerede ejerens eget
  // erhvervsophør, og med kun ét års rolleforskel mellem `from` og `to`, jf.
  // ADR-0031, kan de to aldrig begge stå på samme person — uden faldet ville
  // fluebenet være ubrugeligt netop dér, selv om en anden navngiven person i
  // husstanden er et fuldt gyldigt svar. Ingen af husstanden holder, meldes
  // ejerens egen afvisning, som hidtil.
  function attemptFollowAny() {
    const others = persons.filter((person) => person.id !== owner.id)
    for (const candidate of [owner, ...others]) {
      const candidateBounds = boundsForCandidate?.({ person: candidate.id }) ?? bounds
      const refused = clampedBy(workEndBoundAge(candidate, role), candidateBounds, help)
      if (refused === null) {
        onClamp?.(null)
        onChange({ person: candidate.id })
        return
      }
    }
    attemptFollow(owner.id)
  }

  // Forsøger at navngive, hvem et fast alderstal måles på — tallet selv
  // ændres ikke, kun hvis fødselsår det holdes op mod, og valget kan derfor
  // ende uden for grænserne, selv om det ikke rørte selve alderen. Vælges
  // `owner`, falder værdien tilbage til det bare tal, jf. ADR-0051. */
  function attemptFixedPerson(personId: string) {
    if (fixedAge === undefined) return
    const candidateBounds = boundsForCandidate?.({ person: personId, age: fixedAge }) ?? bounds
    const refused = clampedBy(fixedAge, candidateBounds, help)
    onClamp?.(refused)
    if (refused !== null) return
    onChange(personId === owner.id ? fixedAge : { person: personId, age: fixedAge })
  }

  return (
    <>
      <Field label={label} help={help} unit="år" clamp={clamp}>
        {(id) => (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            className="tal"
            readOnly={follows}
            {...tal}
            value={follows ? formatNumber(followed.workEndAge) : tal.value}
          />
        )}
      </Field>
      <div className="felt felt--tilvalg">
        <span className="vaerdi">
          <label title={fieldHelp['Period.followsWorkEnd']}>
            <input
              type="checkbox"
              checked={follows}
              onChange={(event) => {
                if (!event.target.checked) {
                  onClamp?.(null)
                  onChange(undefined)
                  return
                }
                attemptFollowAny()
              }}
            />{' '}
            Følger erhvervsophør
          </label>
        </span>
      </div>
      {/* Egen linje og ikke samme `.vaerdi`, som fluebenets: den er klemt fast
          på 186px for at flugte med tallet ovenfor, og de to labels sammen
          brød ud i flere linjer i den bredde, jf. issue #85. */}
      {follows && persons.length > 1 && (
        <div className="felt felt--tilvalg felt--personvaelger">
          <span className="vaerdi">
            <label title={fieldHelp['Period.followsWorkEndOf']}>
              for{' '}
              <select
                aria-label="Følger erhvervsophør for"
                value={followed.name}
                onChange={(event) => {
                  const chosen = persons.find((person) => person.name === event.target.value)
                  if (chosen) attemptFollow(chosen.id)
                }}
              >
                {persons.map((person) => (
                  <option key={person.id} value={person.name}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </span>
        </div>
      )}
      {!follows && fixedAge !== undefined && persons.length > 1 && (
        <div className="felt felt--tilvalg felt--personvaelger">
          <span className="vaerdi">
            <label title={fieldHelp['Period.fixedAgeOf']}>
              for{' '}
              <select
                aria-label={`${label} for`}
                value={fixedOwner.name}
                onChange={(event) => {
                  const chosen = persons.find((person) => person.name === event.target.value)
                  if (chosen) attemptFixedPerson(chosen.id)
                }}
              >
                {persons.map((person) => (
                  <option key={person.id} value={person.name}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </span>
        </div>
      )}
    </>
  )
}

export function RadioField({
  label,
  help,
  checked,
  onSelect,
  disabled = false,
}: {
  label: string
  help: FieldHelpKey
  checked: boolean
  onSelect: () => void
  /** Valget står, men kan ikke træffes — reglen bag skal stå i et `Hint` ved
      siden af, så et spærret felt ikke bare ser i stykker ud. */
  disabled?: boolean
}) {
  return (
    <Field label={label} help={help}>
      {(id) => (
        <input
          id={id}
          type="radio"
          name="buffer"
          checked={checked}
          disabled={disabled}
          onChange={onSelect}
        />
      )}
    </Field>
  )
}

/** En segmenteret kontakt: alle valg synlige på én gang, det valgte trykket
    ned. Bruges hvor en vælger ville skjule den ene mulighed bag et klik, og
    hvor der kun er to eller tre af dem — se indbetalingens beløbsform i
    fladekortet.

    Etiketten er en `span` og ikke et `<label htmlFor>`: kontakten er flere
    knapper og ikke én kontrol at pege på, ligesom i `LockedField`. */
export function ToggleField({
  label,
  help,
  value,
  options,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="felt">
      <span className="etiket" title={fieldHelp[help]}>
        {label}
      </span>
      <span className="vaerdi">
        <span className="kontakt">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === value}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          ))}
        </span>
        <span className="enhed"></span>
      </span>
    </div>
  )
}

/** Enhedskolonnen som et valg: den samme segmenterede kontakt som
    `ToggleField`s, men uden et felt om sig — den rækkes ind som et felts
    `unit`.

    Den findes, hvor de former, et beløb kan angives på, netop *er* enheder.
    "12 %" og "12.000 kr." er to former af det samme felt og ikke to felter,
    og et spørgsmål for sig ovenover ("Arbejdsgiverbidrag angives som") koster
    da både en linje i skuffen og en etiket, der er dobbelt så lang som den,
    der står lige under den. Er blot ét af valgene ikke en enhed, hører
    kontakten ikke hjemme her — se `allocationForms`.

    Forklaringen hænger på kontakten selv og ikke på en etiket: den er det,
    man peger på, når der ingen etiket er. `fieldHelp.test.tsx` prøver
    dækningen her på samme måde som på etiketterne. */
export function UnitToggle({
  help,
  value,
  options,
  onChange,
}: {
  help: FieldHelpKey
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <span className="kontakt" title={fieldHelp[help]}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </span>
  )
}

export function CheckboxField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field label={label} help={help}>
      {(id) => (
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      )}
    </Field>
  )
}

/** Et valg mellem få faste muligheder. Værdierne er de danske navne — intet
    engelsk identifier når skærmen. */
/** Valgene, eventuelt delt i navngivne grupper. Grupperne findes for
    indbetalingens kildevælger: kilden er ét spørgsmål og ikke to, men de to
    slags svar skal kunne kendes fra hinanden i listen. */
export type Options = string[] | { label: string; options: string[] }[]

export function SelectField({
  label,
  help,
  value,
  options,
  clamp,
  onChange,
}: {
  label: string
  help: FieldHelpKey
  value: string
  options: Options
  /** Fladens seneste klemning — ikke feltets egen: en `SelectField` klemmer
      aldrig sit eget valg, men et andet felts skift kan gøre det på dets
      vegne, som forankringen gør på sig selv, jf. `guardTransferOrContributionAnchor`. */
  clamp?: Clamp | null
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} help={help} clamp={clamp}>
      {(id) => (
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) =>
            typeof option === 'string' ? (
              <option key={option} value={option}>
                {option}
              </option>
            ) : (
              <optgroup key={option.label} label={option.label}>
                {option.options.map((inner) => (
                  <option key={inner} value={inner}>
                    {inner}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
      )}
    </Field>
  )
}

/** Et felt der ikke kan tastes i — enten fordi det først bliver redigerbart i
    en senere skive ("låst"), eller fordi det er udledt af andre felter. */
export function LockedField({
  label,
  help,
  value,
  unit = 'låst',
}: {
  label: string
  help: FieldHelpKey
  value: string
  unit?: ReactNode
}) {
  return (
    <div className="felt">
      <span className="etiket" title={fieldHelp[help]}>
        {label}
      </span>
      <span className="vaerdi">
        <span className="laast">{value}</span>
        <span className="enhed">{unit}</span>
      </span>
    </div>
  )
}

