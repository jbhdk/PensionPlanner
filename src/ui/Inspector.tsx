import type { ReactNode } from 'react'
import { useId } from 'react'
import type { Plan } from '../engine/plan'
import {
  findEntry,
  findHolding,
  findPerson,
  parseNumber,
  withEntry,
  withHolding,
  withPerson,
} from './planEdits'
import type { Selection } from './selection'

/** Skuffen. Alt, der kan redigeres på ét objekt, står her — navigatorlinjen
    viser kun navn og ét tal, så listen kan stå stille, mens skuffen skifter. */
export function Inspector({
  plan,
  selected,
  onChange,
  onClose,
}: {
  plan: Plan
  selected: Selection
  onChange: (plan: Plan) => void
  onClose: () => void
}) {
  if (selected === null) return null

  return (
    <>
      <div className="spaltehoved">Inspektør</div>
      <div className="inspektor">
        {selected.kind === 'plan' && (
          <PlanFields plan={plan} onChange={onChange} onClose={onClose} />
        )}
        {selected.kind === 'person' && (
          <PersonFields
            plan={plan}
            id={selected.id}
            onChange={onChange}
            onClose={onClose}
          />
        )}
        {selected.kind === 'holding' && (
          <HoldingFields
            plan={plan}
            id={selected.id}
            onChange={onChange}
            onClose={onClose}
          />
        )}
        {selected.kind === 'entry' && (
          <EntryFields
            plan={plan}
            id={selected.id}
            onChange={onChange}
            onClose={onClose}
          />
        )}
      </div>
    </>
  )
}

type FieldsProps = {
  plan: Plan
  onChange: (plan: Plan) => void
  onClose: () => void
}

function PlanFields({ plan, onChange, onClose }: FieldsProps) {
  return (
    <>
      <Head title={plan.name} subtitle="Det, der gælder hele forløbet" onClose={onClose} />
      <Section title="Grundlag">
        <TextField
          label="Navn"
          value={plan.name}
          onChange={(name) => onChange({ ...plan, name })}
        />
        <NumberField
          label="Startår"
          value={plan.startYear}
          onChange={(startYear) => onChange({ ...plan, startYear })}
        />
        <NumberField
          label="Inflation"
          unit="% p.a."
          value={asPercent(plan.inflationAssumption)}
          onChange={(percent) =>
            onChange({ ...plan, inflationAssumption: percent / 100 })
          }
        />
      </Section>
    </>
  )
}

function PersonFields({ plan, id, onChange, onClose }: FieldsProps & { id: string }) {
  const person = findPerson(plan, id)
  if (!person) return null

  return (
    <>
      <Head
        title={person.name}
        subtitle={`Født ${person.birthYear} · horisont ${person.birthYear + person.horizon}`}
        onClose={onClose}
      />
      <Section title="Personen">
        <TextField
          label="Navn"
          value={person.name}
          onChange={(name) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, name })))
          }
        />
        <NumberField
          label="Fødselsår"
          value={person.birthYear}
          onChange={(birthYear) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, birthYear })))
          }
        />
        <NumberField
          label="Horisont"
          unit="år"
          value={person.horizon}
          onChange={(horizon) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, horizon })))
          }
        />
        <Hint>Simuleringen løber til og med det år, personen fylder så mange år.</Hint>
      </Section>
    </>
  )
}

function HoldingFields({ plan, id, onChange, onClose }: FieldsProps & { id: string }) {
  const holding = findHolding(plan, id)
  if (!holding) return null

  return (
    <>
      <Head title={holding.name} subtitle="Beholdning" onClose={onClose} />
      <Section title="Beholdningen">
        <TextField
          label="Navn"
          value={holding.name}
          onChange={(name) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, name })))
          }
        />
        <NumberField
          label="Saldo"
          unit="kr. (dagens kroner)"
          value={holding.balance}
          onChange={(balance) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, balance })))
          }
        />
        <RadioField
          label="Buffer"
          checked={plan.buffer === id}
          onSelect={() => onChange({ ...plan, buffer: id })}
        />
        <Hint>
          Årets samlede over- eller underskud lander på bufferen. Præcis én
          beholdning kan være det.
        </Hint>
      </Section>
    </>
  )
}

function EntryFields({ plan, id, onChange, onClose }: FieldsProps & { id: string }) {
  const entry = findEntry(plan, id)
  if (!entry) return null

  return (
    <>
      <Head title={entry.name} subtitle="Post · udgift" onClose={onClose} />
      <Section title="Posten">
        <TextField
          label="Navn"
          value={entry.name}
          onChange={(name) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, name })))
          }
        />
        <NumberField
          label="Beløb"
          unit="kr. (dagens kroner)"
          value={entry.amountInRealKroner}
          onChange={(amountInRealKroner) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, amountInRealKroner })))
          }
        />
        <LockedField label="Retning" value="Udgift" />
      </Section>
      <Section title="Perioden">
        <LockedField label="Forankring" value="Kalenderår" />
        <LockedField label="Gentagelse" value="Hvert år" />
        <LockedField label="Forfald" value="Jævnt fordelt" />
        <Hint>Låst i denne udgave. Posten løber hele horisonten.</Hint>
      </Section>
    </>
  )
}

function Head({
  title,
  subtitle,
  onClose,
}: {
  title: string
  subtitle: string
  onClose: () => void
}) {
  return (
    <>
      <div className="titel">
        {title}
        <button
          type="button"
          className="luk"
          aria-label="Luk inspektøren"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="undertitel">{subtitle}</div>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="afsnit">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      <span className="vaerdi">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="enhed" />
      </span>
    </div>
  )
}

function NumberField({
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
  const id = useId()
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      <span className="vaerdi">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="tal"
          value={String(value)}
          onChange={(event) => onChange(parseNumber(event.target.value))}
        />
        <span className="enhed">{unit ?? ''}</span>
      </span>
    </div>
  )
}

function RadioField({
  label,
  checked,
  onSelect,
}: {
  label: string
  checked: boolean
  onSelect: () => void
}) {
  const id = useId()
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      <span className="vaerdi">
        <input
          id={id}
          type="radio"
          name="buffer"
          checked={checked}
          onChange={onSelect}
        />
        <span className="enhed" />
      </span>
    </div>
  )
}

/** Et felt, der findes, men som først bliver redigerbart i en senere skive. */
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="felt">
      <span className="etiket">{label}</span>
      <span className="vaerdi">
        <span className="laast">{value}</span>
        <span className="enhed">låst</span>
      </span>
    </div>
  )
}

/** 0,02 → 2, uden flydetallets hale. */
function asPercent(fraction: number): number {
  return Math.round(fraction * 1_000_000) / 10_000
}
