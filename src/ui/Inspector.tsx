import type { ReactNode } from 'react'
import { useId } from 'react'
import type {
  AgeBound,
  Anchor,
  Direction,
  Entry,
  HoldingVariant,
  Period,
  Plan,
  Recurrence,
  TaxTreatment,
  Timing,
} from '../engine/plan'
import { periodBounds } from '../engine/simulate'
import { procent } from './format'
import {
  findEntry,
  findHolding,
  findPerson,
  parseNumber,
  withDirection,
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
      <Section title="Skatten">
        <NumberField
          label="Kommuneskat"
          unit="%"
          value={asPercent(plan.municipalTaxRate)}
          onChange={(percent) =>
            onChange({ ...plan, municipalTaxRate: percent / 100 })
          }
        />
        <CheckboxField
          label="Betaler kirkeskat"
          checked={plan.churchTax}
          onChange={(churchTax) => onChange({ ...plan, churchTax })}
        />
        {plan.churchTax && (
          <NumberField
            label="Kirkeskat"
            unit="%"
            value={asPercent(plan.churchTaxRate)}
            onChange={(percent) =>
              onChange({ ...plan, churchTaxRate: percent / 100 })
            }
          />
        )}
        <Hint>
          Begge procenter afhænger af, hvor husstanden bor, og står derfor på
          planen frem for i satsåret.
        </Hint>
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
        <SelectField
          label="Variant"
          value={danish(variants, holding.variant)}
          options={Object.keys(variants)}
          onChange={(choice) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, variant: variants[choice]! })))
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
      <Section title="Afkast">
        <NumberField
          label="Bruttoafkast"
          unit="% p.a."
          value={asPercent(holding.grossReturn)}
          onChange={(percent) =>
            onChange(
              withHolding(plan, id, (h) => ({ ...h, grossReturn: percent / 100 })),
            )
          }
        />
        <NumberField
          label="ÅOP"
          unit="% p.a."
          value={asPercent(holding.annualCostRate)}
          onChange={(percent) =>
            onChange(
              withHolding(plan, id, (h) => ({ ...h, annualCostRate: percent / 100 })),
            )
          }
        />
        <LockedField
          label="Nettoafkast"
          value={procent(holding.grossReturn - holding.annualCostRate)}
          unit="udledt"
        />
      </Section>
    </>
  )
}

/** Retningen og skattebehandlingen står på skærmen med deres danske navne;
    kortene herunder er det ene sted, de to sprog møder hinanden. */
const directions: Record<string, Direction> = {
  Indtægt: 'Income',
  Udgift: 'Expense',
}

/** Etape 1 kender kun de to varianter for frie midler — de tre øvrige findes
    ikke i fladen, før de findes i motoren, jf. ADR-0010. */
const variants: Record<string, HoldingVariant> = {
  Aktieindkomst: 'ShareIncome',
  Kapitalindkomst: 'CapitalIncome',
}

const treatments: Record<string, TaxTreatment> = {
  Arbejdsindkomst: 'EarnedIncome',
  Skattefri: 'TaxFree',
}

/** De danske månedsnavne er koden helt uvedkommende — kun tallet 1–12
    forlader dette kort. */
const timings: Record<string, Timing> = {
  'Jævnt fordelt': 'Even',
  Januar: 1,
  Februar: 2,
  Marts: 3,
  April: 4,
  Maj: 5,
  Juni: 6,
  Juli: 7,
  August: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  December: 12,
}

function danish<T extends string>(map: Record<string, T>, value: T): string {
  return Object.keys(map).find((key) => map[key] === value)!
}

function danishTiming(timing: Timing): string {
  return Object.keys(timings).find((key) => timings[key] === timing)!
}

function EntryFields({ plan, id, onChange, onClose }: FieldsProps & { id: string }) {
  const entry = findEntry(plan, id)
  if (!entry) return null

  const income = entry.direction === 'Income'

  return (
    <>
      <Head
        title={entry.name}
        subtitle={`Post · ${income ? 'indtægt' : 'udgift'}`}
        onClose={onClose}
      />
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
        <SelectField
          label="Retning"
          value={danish(directions, entry.direction)}
          options={Object.keys(directions)}
          onChange={(choice) =>
            onChange(
              withEntry(plan, id, (e) => withDirection(e, directions[choice]!)),
            )
          }
        />
        {entry.direction === 'Income' && (
          <SelectField
            label="Skattebehandling"
            value={danish(treatments, entry.taxTreatment)}
            options={Object.keys(treatments)}
            onChange={(choice) =>
              onChange(
                withEntry(plan, id, (e) =>
                  e.direction === 'Income'
                    ? { ...e, taxTreatment: treatments[choice]! }
                    : e,
                ),
              )
            }
          />
        )}
        {entry.direction === 'Income' && entry.taxTreatment === 'EarnedIncome' && (
          <Hint>
            Beløbet er brutto inklusive arbejdsgiverbidrag — ikke det, der
            udbetales. Arbejdsgiverens pensionsbidrag flyttes til ordningen for
            sig.
          </Hint>
        )}
      </Section>
      <Section title="Perioden">
        <SelectField
          label="Forankring"
          value={danish(anchors, entry.period.anchor)}
          options={Object.keys(anchors)}
          onChange={(choice) =>
            onChange(
              withEntry(plan, id, (e) => ({ ...e, period: defaultPeriod(anchors[choice]!) })),
            )
          }
        />
        {entry.period.anchor === 'CalendarYear' ? (
          <>
            <OptionalNumberField
              label="Fra (år)"
              unit="år"
              value={entry.period.from}
              onChange={(from) =>
                onChange(
                  withEntry(plan, id, (e) =>
                    e.period.anchor === 'CalendarYear' ? { ...e, period: { ...e.period, from } } : e,
                  ),
                )
              }
            />
            <OptionalNumberField
              label="Til (år)"
              unit="år"
              value={entry.period.to}
              onChange={(to) =>
                onChange(
                  withEntry(plan, id, (e) =>
                    e.period.anchor === 'CalendarYear' ? { ...e, period: { ...e.period, to } } : e,
                  ),
                )
              }
            />
          </>
        ) : (
          <>
            <AgeBoundField
              label="Fra (alder)"
              value={entry.period.from}
              onChange={(from) =>
                onChange(
                  withEntry(plan, id, (e) =>
                    e.period.anchor === 'PersonAge' ? { ...e, period: { ...e.period, from } } : e,
                  ),
                )
              }
            />
            <AgeBoundField
              label="Til (alder)"
              value={entry.period.to}
              onChange={(to) =>
                onChange(
                  withEntry(plan, id, (e) =>
                    e.period.anchor === 'PersonAge' ? { ...e, period: { ...e.period, to } } : e,
                  ),
                )
              }
            />
            <LockedField label="Falder i" value={resolvedPeriodLabel(plan, entry)} unit="udledt" />
          </>
        )}
        <SelectField
          label="Gentagelse"
          value={danish(recurrences, entry.recurrence.kind)}
          options={Object.keys(recurrences)}
          onChange={(choice) =>
            onChange(
              withEntry(plan, id, (e) => ({
                ...e,
                recurrence: defaultRecurrence(recurrences[choice]!),
              })),
            )
          }
        />
        {entry.recurrence.kind === 'EveryNYears' && (
          <NumberField
            label="Hvert"
            unit="år"
            value={entry.recurrence.n}
            onChange={(n) =>
              onChange(
                withEntry(plan, id, (e) =>
                  e.recurrence.kind === 'EveryNYears'
                    ? { ...e, recurrence: { kind: 'EveryNYears', n } }
                    : e,
                ),
              )
            }
          />
        )}
        <SelectField
          label="Forfald"
          value={danishTiming(entry.timing)}
          options={Object.keys(timings)}
          onChange={(choice) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, timing: timings[choice]! })))
          }
        />
        <NumberField
          label="Reguleringssats"
          unit="% p.a."
          value={asPercent(entry.regulationRate)}
          onChange={(percent) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, regulationRate: percent / 100 })))
          }
        />
        <Hint>
          Reguleringssatsen er postens egen og adskilt fra planens
          inflationsantagelse.
        </Hint>
      </Section>
    </>
  )
}

const anchors: Record<string, Anchor> = {
  Kalenderår: 'CalendarYear',
  Alder: 'PersonAge',
}

const recurrences: Record<string, Recurrence['kind']> = {
  'Hvert år': 'Annual',
  'Én gang': 'Once',
  'Hvert N. år': 'EveryNYears',
}

/** En ny periode ved skift af forankring: begge endepunkter åbne, altså hele
    horisonten. Ternæren narrower kun `anchor` til den rette gren af unionen. */
function defaultPeriod(anchor: Anchor): Period {
  return anchor === 'CalendarYear' ? { anchor } : { anchor }
}

function defaultRecurrence(kind: Recurrence['kind']): Recurrence {
  return kind === 'EveryNYears' ? { kind, n: 2 } : { kind }
}

/** Den kalenderårsrække, en aldersforankret periode faktisk falder i — samme
    udledning som motoren selv bruger, jf. `periodBounds`. */
function resolvedPeriodLabel(plan: Plan, entry: Entry): string {
  const owner = findPerson(plan, entry.owner)
  if (!owner) return '–'

  const { from, to } = periodBounds(entry.period, owner)
  if (from === undefined && to === undefined) return 'Hele horisonten'
  if (from === undefined) return `til ${to}`
  if (to === undefined) return `fra ${from}`
  if (from === to) return String(from)
  return `${from}–${to}`
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

/** Et talfelt der kan stå tomt — tomt betyder "ikke sat", altså et åbent
    periodeendepunkt (fra planens start eller til horisontens slut). */
function OptionalNumberField({
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
          value={value === undefined ? '' : String(value)}
          onChange={(event) => {
            const text = event.target.value
            onChange(text === '' ? undefined : parseNumber(text))
          }}
        />
        <span className="enhed">{unit ?? ''}</span>
      </span>
    </div>
  )
}

/** Et periodeendepunkt for en aldersforankret post: en fast alder, eller
    afkrydset, en henvisning til personens erhvervsophør — feltet flytter sig
    selv, når erhvervsophørsalderen ændres, jf. `AgeBound`. */
function AgeBoundField({
  label,
  value,
  onChange,
}: {
  label: string
  value: AgeBound | undefined
  onChange: (value: AgeBound | undefined) => void
}) {
  const id = useId()
  const followsWorkEnd = value === 'WorkEndAge'
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      <span className="vaerdi">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="tal"
          disabled={followsWorkEnd}
          value={followsWorkEnd ? '' : value === undefined ? '' : String(value)}
          onChange={(event) => {
            const text = event.target.value
            onChange(text === '' ? undefined : parseNumber(text))
          }}
        />
        <span className="enhed">
          <label>
            <input
              type="checkbox"
              checked={followsWorkEnd}
              onChange={(event) =>
                onChange(event.target.checked ? 'WorkEndAge' : undefined)
              }
            />{' '}
            erhvervsophør
          </label>
        </span>
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

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      <span className="vaerdi">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="enhed" />
      </span>
    </div>
  )
}

/** Et valg mellem få faste muligheder. Værdierne er de danske navne — intet
    engelsk identifier når skærmen. */
function SelectField({
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
  const id = useId()
  return (
    <div className="felt">
      <label htmlFor={id}>{label}</label>
      <span className="vaerdi">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="enhed" />
      </span>
    </div>
  )
}

/** Et felt der ikke kan tastes i — enten fordi det først bliver redigerbart i
    en senere skive ("låst"), eller fordi det er udledt af andre felter. */
function LockedField({
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

/** 0,02 → 2, uden flydetallets hale. */
function asPercent(fraction: number): number {
  return Math.round(fraction * 1_000_000) / 10_000
}
