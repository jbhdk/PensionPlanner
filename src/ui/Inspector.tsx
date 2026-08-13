import { isFreeAssets } from '../engine/holdingVariant'
import type { Anchor, Period, Plan, Recurrence } from '../engine/plan'
import { latestRateYear } from '../engine/rates/rates'
import { deriveStatePensionAge } from '../engine/statePensionAge'
import type { YearResult } from '../engine/yearResult'
import {
  anchors,
  danish,
  danishTiming,
  directions,
  recurrences,
  timingForOnce,
  timingOptions,
  timings,
  treatments,
  variants,
} from './danish'
import { entryNote } from './entryNote'
import {
  AgeBoundField,
  CheckboxField,
  Hint,
  LockedField,
  NumberField,
  OptionalNumberField,
  RadioField,
  Section,
  SelectField,
  TextField,
} from './fields'
import { procent } from './format'
import {
  findEntry,
  findHolding,
  findHoldingOwner,
  findPerson,
  findTransfer,
  formatNumber,
  removeEntry,
  removeHolding,
  removePerson,
  removeTransfer,
  withDirection,
  withEntry,
  withHolding,
  withHoldingOwner,
  withPerson,
  withTransfer,
} from './planEdits'
import type { Selection } from './selection'

/** Skuffen. Alt, der kan redigeres på ét objekt, står her — navigatorlinjen
    viser kun navn og ét tal, så listen kan stå stille, mens skuffen skifter. */
export function Inspector({
  plan,
  years,
  selected,
  onChange,
  onClose,
}: {
  plan: Plan
  /** Motorens årsrække, som skuffen slår op i frem for at regne om — en note,
      der udleder selv, kan komme til at sige et år, motoren aldrig regnede,
      jf. ADR-0012. Tom, når planen ikke kunne simuleres. */
  years: YearResult[]
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
            years={years}
            id={selected.id}
            onChange={onChange}
            onClose={onClose}
          />
        )}
        {selected.kind === 'transfer' && (
          <TransferFields
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
        <NumberField
          label="§ 20-fremskrivning"
          unit="% p.a."
          value={asPercent(plan.section20ProjectionAssumption)}
          onChange={(percent) =>
            onChange({ ...plan, section20ProjectionAssumption: percent / 100 })
          }
        />
        <NumberField
          label="Satsregulering"
          unit="% p.a."
          value={asPercent(plan.benefitProjectionAssumption)}
          onChange={(percent) =>
            onChange({ ...plan, benefitProjectionAssumption: percent / 100 })
          }
        />
        <Hint>
          De to fremskrivningssatser løfter beløbsgrænser og ydelser for
          simuleringsår efter det sidst kendte satsår — hver efter sit eget
          indeks, uafhængigt af inflationsantagelsen.
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
        onDelete={
          plan.household.persons.length > 1
            ? () => {
                onChange(removePerson(plan, id))
                onClose()
              }
            : undefined
        }
        deleteLabel="Fjern person"
        deleteHint="personens beholdninger og poster fjernes med"
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
          label="Fødselsmåned"
          unit="1–12"
          value={person.birthMonth}
          onChange={(birthMonth) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, birthMonth })))
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
      <Section title="Skat">
        <SelectField
          label="Kommune"
          value={person.municipality}
          options={Object.keys(latestRateYear().municipalTax.rates).sort((a, b) =>
            a.localeCompare(b, 'da'),
          )}
          onChange={(municipality) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, municipality })))
          }
        />
        <CheckboxField
          label="Medlem af folkekirken"
          checked={person.churchMember}
          onChange={(churchMember) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, churchMember })))
          }
        />
        <Hint>
          Kommune- og kirkeskatteprocenten hører til satsåret og slås op efter
          bopælskommunen — ikke tastet ind her.
        </Hint>
      </Section>
      <Section title="Folkepension">
        <StatePensionAgeFields plan={plan} id={id} onChange={onChange} />
      </Section>
    </>
  )
}

/** Folkepensionsalderen udledt af fødselsdato, med mulighed for at
    overstyre — se `deriveStatePensionAge` og
    docs/satser/folkepensionsalder.md. Den udledte værdi står altid, også når
    overstyret, så overstyringen er synlig som netop en overstyring. */
function StatePensionAgeFields({
  plan,
  id,
  onChange,
}: {
  plan: Plan
  id: string
  onChange: (plan: Plan) => void
}) {
  const person = findPerson(plan, id)
  if (!person) return null

  const derived = deriveStatePensionAge(person.birthYear, person.birthMonth)
  const overridden = person.statePensionAgeOverride !== undefined

  return (
    <>
      <LockedField
        label="Folkepensionsalder"
        value={`${formatNumber(derived.age)} år`}
        unit="udledt"
      />
      {!derived.enacted && (
        <Hint>
          Endnu ikke vedtaget af Folketinget for dette fødselsår — et
          fremskrevet skøn.
        </Hint>
      )}
      <CheckboxField
        label="Overstyr folkepensionsalderen"
        checked={overridden}
        onChange={(checked) =>
          onChange(
            withPerson(plan, id, (p) => ({
              ...p,
              statePensionAgeOverride: checked ? derived.age : undefined,
            })),
          )
        }
      />
      {overridden && (
        <NumberField
          label="Overstyret folkepensionsalder"
          unit="år"
          value={person.statePensionAgeOverride!}
          onChange={(value) =>
            onChange(
              withPerson(plan, id, (p) => ({ ...p, statePensionAgeOverride: value })),
            )
          }
        />
      )}
    </>
  )
}

function HoldingFields({ plan, id, onChange, onClose }: FieldsProps & { id: string }) {
  const holding = findHolding(plan, id)
  const owner = findHoldingOwner(plan, id)
  if (!holding || !owner) return null

  const persons = plan.household.persons
  const ownerByName: Record<string, string> = Object.fromEntries(
    persons.map((person) => [person.name, person.id]),
  )

  return (
    <>
      <Head
        title={holding.name}
        subtitle="Beholdning"
        onClose={onClose}
        onDelete={() => {
          onChange(removeHolding(plan, id))
          onClose()
        }}
        deleteLabel="Fjern beholdning"
        deleteHint="overførsler til eller fra beholdningen fjernes med"
      />
      <Section title="Beholdningen">
        <TextField
          label="Navn"
          value={holding.name}
          onChange={(name) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, name })))
          }
        />
        <SelectField
          label="Ejer"
          value={owner.name}
          options={persons.map((person) => person.name)}
          onChange={(name) =>
            onChange(withHoldingOwner(plan, id, ownerByName[name]!))
          }
        />
        <NumberField
          label="Saldo (dagens kroner)"
          unit="kr."
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
          disabled={!isFreeAssets(holding)}
          onSelect={() => onChange({ ...plan, buffer: id })}
        />
        <Hint>
          Årets samlede over- eller underskud lander på bufferen. Præcis én
          beholdning kan være det, og bufferen skal være frie midler — penge
          ind i en ordning er en indbetaling.
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

function EntryFields({
  plan,
  years,
  id,
  onChange,
  onClose,
}: FieldsProps & { id: string; years: YearResult[] }) {
  const entry = findEntry(plan, id)
  const owner = findPerson(plan, entry?.owner ?? '')
  if (!entry || !owner) return null

  const persons = plan.household.persons
  const ownerByName: Record<string, string> = Object.fromEntries(
    persons.map((person) => [person.name, person.id]),
  )

  const income = entry.direction === 'Income'

  return (
    <>
      <Head
        title={entry.name}
        subtitle={`Post · ${income ? 'indtægt' : 'udgift'}`}
        onClose={onClose}
        onDelete={() => {
          onChange(removeEntry(plan, id))
          onClose()
        }}
        deleteLabel={`Fjern ${income ? 'indtægt' : 'udgift'}`}
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
          label="Beløb (dagens kroner)"
          unit="kr."
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
        <SelectField
          label="Ejer"
          value={owner.name}
          options={persons.map((person) => person.name)}
          onChange={(name) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, owner: ownerByName[name]! })))
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
          label="Gentagelse"
          value={danish(recurrences, entry.recurrence.kind)}
          options={Object.keys(recurrences)}
          onChange={(choice) => {
            const kind = recurrences[choice]!
            onChange(
              withEntry(plan, id, (e) =>
                kind === 'Once'
                  ? {
                      ...e,
                      recurrence: defaultRecurrence(kind),
                      timing: timingForOnce(e.timing),
                    }
                  : { ...e, recurrence: defaultRecurrence(kind) },
              ),
            )
          }}
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
          label="Forankring"
          value={danish(anchors, entry.period.anchor)}
          options={Object.keys(anchors)}
          onChange={(choice) =>
            onChange(
              withEntry(plan, id, (e) => ({ ...e, period: defaultPeriod(anchors[choice]!) })),
            )
          }
        />
        {entry.recurrence.kind === 'Once' ? (
          entry.period.anchor === 'CalendarYear' ? (
            <NumberField
              label="År"
              unit="år"
              value={entry.period.from ?? entry.period.to ?? plan.startYear}
              onChange={(from) =>
                onChange(
                  withEntry(plan, id, (e) =>
                    e.period.anchor === 'CalendarYear'
                      ? { ...e, period: { anchor: 'CalendarYear', from } }
                      : e,
                  ),
                )
              }
            />
          ) : (
            <>
              <AgeBoundField
                label="Alder"
                workEndAge={owner.workEndAge}
                value={entry.period.from ?? entry.period.to}
                onChange={(from) =>
                  onChange(
                    withEntry(plan, id, (e) =>
                      e.period.anchor === 'PersonAge'
                        ? { ...e, period: { anchor: 'PersonAge', from } }
                        : e,
                    ),
                  )
                }
              />
            </>
          )
        ) : entry.period.anchor === 'CalendarYear' ? (
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
              workEndAge={owner.workEndAge}
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
              workEndAge={owner.workEndAge}
              value={entry.period.to}
              onChange={(to) =>
                onChange(
                  withEntry(plan, id, (e) =>
                    e.period.anchor === 'PersonAge' ? { ...e, period: { ...e.period, to } } : e,
                  ),
                )
              }
            />
          </>
        )}
        <SelectField
          label="Forfald"
          value={danishTiming(entry.timing)}
          options={timingOptions(entry.recurrence)}
          onChange={(choice) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, timing: timings[choice]! })))
          }
        />
        {entry.direction === 'Income' && (
          <NumberField
            label="Reguleringssats"
            unit="% p.a."
            value={asPercent(entry.regulationRate)}
            onChange={(percent) =>
              onChange(
                withEntry(plan, id, (e) =>
                  e.direction === 'Income' ? { ...e, regulationRate: percent / 100 } : e,
                ),
              )
            }
          />
        )}
        <Hint>{entryNote(years, entry)}</Hint>
      </Section>
    </>
  )
}

/** En ny periode ved skift af forankring: begge endepunkter åbne, altså hele
    horisonten. Ternæren narrower kun `anchor` til den rette gren af unionen. */
function defaultPeriod(anchor: Anchor): Period {
  return anchor === 'CalendarYear' ? { anchor } : { anchor }
}

function defaultRecurrence(kind: Recurrence['kind']): Recurrence {
  return kind === 'EveryNYears' ? { kind, n: 2 } : { kind }
}

function TransferFields({ plan, id, onChange, onClose }: FieldsProps & { id: string }) {
  const transfer = findTransfer(plan, id)
  if (!transfer) return null

  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const holdingByName: Record<string, string> = Object.fromEntries(
    holdings.map((holding) => [holding.name, holding.id]),
  )
  const holdingName = (holdingId: string) =>
    holdings.find((holding) => holding.id === holdingId)?.name ?? holdingId

  return (
    <>
      <Head
        title={`${holdingName(transfer.from)} → ${holdingName(transfer.to)}`}
        subtitle="Overførsel"
        onClose={onClose}
        onDelete={() => {
          onChange(removeTransfer(plan, id))
          onClose()
        }}
        deleteLabel="Fjern overførsel"
      />
      <Section title="Overførslen">
        <SelectField
          label="Fra"
          value={holdingName(transfer.from)}
          options={holdings.filter((holding) => holding.id !== transfer.to).map((h) => h.name)}
          onChange={(name) =>
            onChange(withTransfer(plan, id, (t) => ({ ...t, from: holdingByName[name]! })))
          }
        />
        <SelectField
          label="Til"
          value={holdingName(transfer.to)}
          options={holdings.filter((holding) => holding.id !== transfer.from).map((h) => h.name)}
          onChange={(name) =>
            onChange(withTransfer(plan, id, (t) => ({ ...t, to: holdingByName[name]! })))
          }
        />
        <NumberField
          label="Beløb (dagens kroner)"
          unit="kr."
          value={transfer.amountInRealKroner}
          onChange={(amountInRealKroner) =>
            onChange(withTransfer(plan, id, (t) => ({ ...t, amountInRealKroner })))
          }
        />
      </Section>
      <Section title="Perioden">
        <SelectField
          label="Gentagelse"
          value={danish(recurrences, transfer.recurrence.kind)}
          options={Object.keys(recurrences)}
          onChange={(choice) => {
            const kind = recurrences[choice]!
            onChange(
              withTransfer(plan, id, (t) =>
                kind === 'Once'
                  ? { ...t, recurrence: defaultRecurrence(kind), timing: timingForOnce(t.timing) }
                  : { ...t, recurrence: defaultRecurrence(kind) },
              ),
            )
          }}
        />
        {transfer.recurrence.kind === 'EveryNYears' && (
          <NumberField
            label="Hvert"
            unit="år"
            value={transfer.recurrence.n}
            onChange={(n) =>
              onChange(
                withTransfer(plan, id, (t) =>
                  t.recurrence.kind === 'EveryNYears'
                    ? { ...t, recurrence: { kind: 'EveryNYears', n } }
                    : t,
                ),
              )
            }
          />
        )}
        {transfer.recurrence.kind === 'Once' ? (
          <NumberField
            label="År"
            unit="år"
            value={transfer.period.from ?? transfer.period.to ?? plan.startYear}
            onChange={(from) =>
              onChange(withTransfer(plan, id, (t) => ({ ...t, period: { from } })))
            }
          />
        ) : (
          <>
            <OptionalNumberField
              label="Fra (år)"
              unit="år"
              value={transfer.period.from}
              onChange={(from) =>
                onChange(withTransfer(plan, id, (t) => ({ ...t, period: { ...t.period, from } })))
              }
            />
            <OptionalNumberField
              label="Til (år)"
              unit="år"
              value={transfer.period.to}
              onChange={(to) =>
                onChange(withTransfer(plan, id, (t) => ({ ...t, period: { ...t.period, to } })))
              }
            />
          </>
        )}
        <SelectField
          label="Forfald"
          value={danishTiming(transfer.timing)}
          options={timingOptions(transfer.recurrence)}
          onChange={(choice) =>
            onChange(withTransfer(plan, id, (t) => ({ ...t, timing: timings[choice]! })))
          }
        />
        <Hint>
          Overførslen er altid kalenderårsforankret — den har ingen ejer at
          binde en alder til.
        </Hint>
      </Section>
    </>
  )
}

function Head({
  title,
  subtitle,
  onClose,
  onDelete,
  deleteLabel,
  deleteHint,
}: {
  title: string
  subtitle: string
  onClose: () => void
  /** Udeladt betyder, at objektet ikke kan slettes herfra — Person udelader
      den, når husstanden kun har én tilbage. */
  onDelete?: () => void
  deleteLabel?: string
  /** Uddyber, hvad der følger med i slettet, hvis andet end selve objektet —
      vises kun i tooltippet, så den korte handling ikke drukner i tekst. */
  deleteHint?: string
}) {
  return (
    <>
      <div className="titel">
        {title}
        <span className="handlinger">
          {onDelete && (
            <>
              <button
                type="button"
                className="slet"
                aria-label={deleteLabel}
                title={deleteHint ? `${deleteLabel} — ${deleteHint}` : deleteLabel}
                onClick={onDelete}
              >
                <TrashIcon />
              </button>
              <span className="skl" aria-hidden="true" />
            </>
          )}
          <button
            type="button"
            className="luk"
            aria-label="Luk inspektøren"
            onClick={onClose}
          >
            ×
          </button>
        </span>
      </div>
      <div className="undertitel">{subtitle}</div>
    </>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5h10" />
      <path d="M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5" />
      <path d="M4.2 4.5l.5 8.3a1 1 0 0 0 1 .95h4.6a1 1 0 0 0 1-.95l.5-8.3" />
      <path d="M6.5 7v4" />
      <path d="M9.5 7v4" />
    </svg>
  )
}

/** 0,02 → 2, uden flydetallets hale. */
function asPercent(fraction: number): number {
  return Math.round(fraction * 1_000_000) / 10_000
}
