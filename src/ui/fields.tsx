import type { ChangeEvent, ReactNode } from 'react'
import { useId, useState } from 'react'
import type { AgeBound } from '../engine/plan'
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
  children,
}: {
  label: string
  help: FieldHelpKey
  /** Udeladt giver en tom enhedskolonne — bredden holdes alligevel, så alle
      felters kontroller flugter ned gennem sektionen. En `UnitToggle` er
      også en enhed: den vælger imellem dem og hører derfor til her. */
  unit?: ReactNode
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="felt">
      <label htmlFor={id} title={fieldHelp[help]}>
        {label}
      </label>
      <span className="vaerdi">
        {children(id)}
        <span className="enhed">{unit ?? ''}</span>
      </span>
    </div>
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

    Krogen hviler på, at `parse(format(v))` er `v`; se `formatNumber`. Den
    modsatte vej gælder ikke og skal ikke gælde: `format(parse("7,"))` er
    netop den omskrivning, feltet ikke må lave, mens der tastes. */
function useNumberText<T>(
  value: T,
  format: (value: T) => string,
  parse: (text: string) => T,
  onChange: (value: T) => void,
): {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
} {
  const [text, setText] = useState(() => format(value))
  const [lastValue, setLastValue] = useState(value)

  if (!Object.is(value, lastValue)) {
    setLastValue(value)
    if (parse(text) !== value) setText(format(value))
  }

  return {
    value: text,
    onChange: (event) => {
      setText(event.target.value)
      onChange(parse(event.target.value))
    },
    onBlur: () => setText(format(value)),
  }
}

/** Et talfelts nedre og øvre grænse. Værdien, feltet giver videre, klemmes
    ind i dem, så almindelig indtastning ikke kan skrive en plan, motoren
    afviser — reglen selv står i `validatePlan`, fordi en importeret fil ikke
    er gået gennem et felt, og grænsen her er dens venlige udgave.

    Det er værdien, der klemmes, og ikke teksten: den bliver stående, mens der
    tastes, så et felt med en nedre grænse på ti stadig kan tastes ét ciffer
    ad gangen. Først når feltet forlades, retter teksten sig ind efter den
    værdi, planen faktisk fik. */
export type Bounds = { min?: number; max?: number }

function clampTo(value: number, bounds: Bounds | undefined): number {
  if (bounds === undefined) return value
  const atLeast = bounds.min === undefined ? value : Math.max(value, bounds.min)
  return bounds.max === undefined ? atLeast : Math.min(atLeast, bounds.max)
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
  onChange,
}: {
  label: string
  help: FieldHelpKey
  unit?: ReactNode
  value: number
  /** Udeladt betyder et frit tal. Se `Bounds`. */
  bounds?: Bounds
  onChange: (value: number) => void
}) {
  const tal = useNumberText(
    value,
    formatNumber,
    (text) => clampTo(parseNumber(text), bounds),
    onChange,
  )

  return (
    <Field label={label} help={help} unit={unit}>
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
  onChange,
}: {
  label: string
  help: FieldHelpKey
  unit?: ReactNode
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  const tal = useNumberText(value, formatOptional, parseOptional, onChange)

  return (
    <Field label={label} help={help} unit={unit}>
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
  bounds,
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
  /** Udeladt betyder en fri alder, og feltet kan da også stå tomt — sådan
      skrives et åbent periodeendepunkt. Er en nedre grænse sat, er
      endepunktet påkrævet, og et tømt felt falder tilbage på grænsen: en
      udbetalingsplan skal begynde et sted. Se `Bounds`. */
  bounds?: Bounds
  onChange: (value: AgeBound | undefined) => void
}) {
  const followsWorkEnd = value === 'WorkEndAge'
  const tal = useNumberText<AgeBound | undefined>(
    value,
    (bound) => (bound === 'WorkEndAge' ? formatNumber(workEndAge) : formatOptional(bound)),
    (text) => {
      const parsed = parseOptional(text)
      return parsed === undefined ? bounds?.min : clampTo(parsed, bounds)
    },
    onChange,
  )

  // Tilvalget får sin egen linje under aldersfeltet. Proppet ind i
  // enhedskolonnen sprængte "erhvervsophør" de 40px, alle andre felter deler,
  // og skubbede inputtet ud af flugt med resten af sektionen.
  return (
    <>
      <Field label={label} help={help} unit="år">
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
              onChange={(event) => onChange(event.target.checked ? 'WorkEndAge' : undefined)}
            />{' '}
            Følger erhvervsophør
          </label>
        </span>
      </div>
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
  onChange,
}: {
  label: string
  help: FieldHelpKey
  value: string
  options: Options
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} help={help}>
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

