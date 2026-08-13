import type { ChangeEvent, ReactNode } from 'react'
import { useId, useState } from 'react'
import type { AgeBound } from '../engine/plan'
import { formatNumber, parseNumber } from './planEdits'

/** Skuffens byggeklodser: hvordan ét felt tegnes, ikke hvilke felter hvert
    objekt har. Det sidste står i `Inspector.tsx`, som er filens eneste bruger
    — delingen går efter abstraktionsniveau og ikke efter genbrug. */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="afsnit">
      <h3>{title}</h3>
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
  unit,
  children,
}: {
  label: string
  /** Udeladt giver en tom enhedskolonne — bredden holdes alligevel, så alle
      felters kontroller flugter ned gennem sektionen. */
  unit?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      <span className="vaerdi">
        {children(id)}
        <span className="enhed">{unit ?? ''}</span>
      </span>
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
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
  unit,
  value,
  onChange,
}: {
  label: string
  unit?: string
  value: number
  onChange: (value: number) => void
}) {
  const tal = useNumberText(value, formatNumber, parseNumber, onChange)

  return (
    <Field label={label} unit={unit}>
      {(id) => <input id={id} type="text" inputMode="decimal" className="tal" {...tal} />}
    </Field>
  )
}

/** Et talfelt der kan stå tomt — se `formatOptional`. */
export function OptionalNumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit?: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  const tal = useNumberText(value, formatOptional, parseOptional, onChange)

  return (
    <Field label={label} unit={unit}>
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
  value,
  workEndAge,
  onChange,
}: {
  label: string
  value: AgeBound | undefined
  /** Ejerens erhvervsophørsalder — det tal feltet viser, når endepunktet
      følger den. Feltet er skrivebeskyttet imens frem for tomt: alderen er
      det, spørgsmålet handler om, og den skal kunne læses uden at klikke
      tilvalget fra igen. */
  workEndAge: number
  onChange: (value: AgeBound | undefined) => void
}) {
  const followsWorkEnd = value === 'WorkEndAge'
  const tal = useNumberText<AgeBound | undefined>(
    value,
    (bound) => (bound === 'WorkEndAge' ? formatNumber(workEndAge) : formatOptional(bound)),
    parseOptional,
    onChange,
  )

  // Tilvalget får sin egen linje under aldersfeltet. Proppet ind i
  // enhedskolonnen sprængte "erhvervsophør" de 56px, alle andre felter deler,
  // og skubbede inputtet ud af flugt med resten af sektionen.
  return (
    <>
      <Field label={label} unit="år">
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
          <label>
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
  checked,
  onSelect,
  disabled = false,
}: {
  label: string
  checked: boolean
  onSelect: () => void
  /** Valget står, men kan ikke træffes — reglen bag skal stå i et `Hint` ved
      siden af, så et spærret felt ikke bare ser i stykker ud. */
  disabled?: boolean
}) {
  return (
    <Field label={label}>
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

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field label={label}>
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
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

/** Et felt der ikke kan tastes i — enten fordi det først bliver redigerbart i
    en senere skive ("låst"), eller fordi det er udledt af andre felter. */
export function LockedField({
  label,
  value,
  unit = 'låst',
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="felt">
      <span className="etiket">{label}</span>
      <span className="vaerdi">
        <span className="laast">{value}</span>
        <span className="enhed">{unit}</span>
      </span>
    </div>
  )
}

