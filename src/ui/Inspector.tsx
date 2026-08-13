import type { ReactNode } from 'react'
import { isFreeAssets } from '../engine/holdingVariant'
import type {
  Anchor,
  Contribution,
  Entry,
  EntryId,
  HoldingId,
  Period,
  Person,
  Plan,
  Recurrence,
  Timing,
} from '../engine/plan'
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
  contributionAmounts,
  timingOptions,
  timings,
  treatments,
  variants,
} from './danish'
import { entryNote, entryPeriodLabel } from './entryNote'
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
  ToggleField,
} from './fields'
import { procent } from './format'
import {
  findContribution,
  findEntry,
  findHolding,
  findHoldingOwner,
  findPerson,
  findTransfer,
  formatNumber,
  removeContribution,
  removeEntry,
  removeHolding,
  removePerson,
  removeTransfer,
  withContribution,
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
        {selected.kind === 'contribution' && (
          <ContributionFields
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
        <StatePensionAgeFields plan={plan} id={id} />
      </Section>
    </>
  )
}

/** Folkepensionsalderen udledt af fødselsdato — se `deriveStatePensionAge`
    og docs/satser/folkepensionsalder.md. Tabellen er eneste kilde: et trin,
    Folketinget endnu ikke har vedtaget, står som det fremskrevne skøn det
    er, og rettes i datagrundlaget frem for på den enkelte person. */
function StatePensionAgeFields({ plan, id }: { plan: Plan; id: string }) {
  const person = findPerson(plan, id)
  if (!person) return null

  const derived = deriveStatePensionAge(person.birthYear, person.birthMonth)

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
          label="Type"
          value={danish(variants, holding.variant)}
          options={Object.keys(variants)}
          onChange={(choice) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, variant: variants[choice]! })))
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
          /* Ordet står på etiketten og ikke kun i noten nedenfor: taster
             brugeren nettolønnen og lægger et bidrag oveni, går alle tal op
             og er alligevel over 100.000 kr. forkerte om året, og ingen
             invariant fanger det, jf. ADR-0007. */
          label={
            income && entry.taxTreatment === 'EarnedIncome'
              ? 'Beløb, brutto (dagens kroner)'
              : 'Beløb (dagens kroner)'
          }
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
      <PeriodSection
        value={entry}
        owner={owner}
        startYear={plan.startYear}
        onChange={(next) => onChange(withEntry(plan, id, (e) => ({ ...e, ...next })))}
      >
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
      </PeriodSection>
    </>
  )
}

/** Trioen enhver periodisk pengestrøm bærer: periode, gentagelse og forfald.
    Posten og det beholdningskildede bidrag har den med den samme betydning,
    og reglerne imellem dem er små nok til at drive fra hinanden, hvis de
    skrives to gange — `Én gang` bytter både endepunktsfeltet og forfaldets
    muligheder ud, og et aldersendepunkt har sit eget felt med sin egen
    henvisning til erhvervsophøret.

    Overførslen står udenfor. Dens periode er kalenderår alene og bærer ingen
    `anchor` at skifte på — den har ingen ejer at binde en alder til, jf.
    `Transfer` — og den kunne kun komme med her ved at ændre det gemte skema.

    `children` er de felter, der hører til netop denne figurs periode og
    ingen andens: postens reguleringssats og dens note. */
type Periodic = { period: Period; recurrence: Recurrence; timing: Timing }

function PeriodSection({
  value,
  owner,
  startYear,
  onChange,
  children,
}: {
  value: Periodic
  /** Personen, et aldersendepunkt måles fra. */
  owner: Person
  /** Året et `Én gang`-felt falder tilbage på, når intet endepunkt er sat. */
  startYear: number
  onChange: (next: Periodic) => void
  children?: ReactNode
}) {
  // Hentet ud som konstanter, så narrowingen på `anchor` og `kind` holder
  // hele vejen ind i felternes onChange.
  const { period, recurrence, timing } = value
  const change = (part: Partial<Periodic>) => onChange({ ...value, ...part })

  return (
    <Section title="Perioden">
      <SelectField
        label="Gentagelse"
        value={danish(recurrences, recurrence.kind)}
        options={Object.keys(recurrences)}
        onChange={(choice) => {
          const kind = recurrences[choice]!
          change(
            kind === 'Once'
              ? { recurrence: defaultRecurrence(kind), timing: timingForOnce(timing) }
              : { recurrence: defaultRecurrence(kind) },
          )
        }}
      />
      {recurrence.kind === 'EveryNYears' && (
        <NumberField
          label="Hvert"
          unit="år"
          value={recurrence.n}
          onChange={(n) => change({ recurrence: { kind: 'EveryNYears', n } })}
        />
      )}
      <SelectField
        label="Forankring"
        value={danish(anchors, period.anchor)}
        options={Object.keys(anchors)}
        onChange={(choice) => change({ period: defaultPeriod(anchors[choice]!) })}
      />
      {recurrence.kind === 'Once' ? (
        period.anchor === 'CalendarYear' ? (
          <NumberField
            label="År"
            unit="år"
            value={period.from ?? period.to ?? startYear}
            onChange={(from) => change({ period: { anchor: 'CalendarYear', from } })}
          />
        ) : (
          <AgeBoundField
            label="Alder"
            workEndAge={owner.workEndAge}
            value={period.from ?? period.to}
            onChange={(from) => change({ period: { anchor: 'PersonAge', from } })}
          />
        )
      ) : period.anchor === 'CalendarYear' ? (
        <>
          <OptionalNumberField
            label="Fra (år)"
            unit="år"
            value={period.from}
            onChange={(from) => change({ period: { ...period, from } })}
          />
          <OptionalNumberField
            label="Til (år)"
            unit="år"
            value={period.to}
            onChange={(to) => change({ period: { ...period, to } })}
          />
        </>
      ) : (
        <>
          <AgeBoundField
            label="Fra (alder)"
            workEndAge={owner.workEndAge}
            value={period.from}
            onChange={(from) => change({ period: { ...period, from } })}
          />
          <AgeBoundField
            label="Til (alder)"
            workEndAge={owner.workEndAge}
            value={period.to}
            onChange={(to) => change({ period: { ...period, to } })}
          />
        </>
      )}
      <SelectField
        label="Forfald"
        value={danishTiming(timing)}
        options={timingOptions(recurrence)}
        onChange={(choice) => change({ timing: timings[choice]! })}
      />
      {children}
    </Section>
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

/** Indbetalingens rude — ét objekt i to udgaver, ikke to slags. Kilden er ét
    spørgsmål og ikke to, og ruden skifter form efter svaret: er kilden en
    lønpost, står periode, forankring, gentagelse og forfald slet ikke her —
    hverken som felter eller som grå felter — men som én linje, der siger,
    hvad bidraget følger. Er kilden en beholdning, er der ingen post at arve
    fra, og bidraget bærer dem selv.

    Fradragsretten og loftet står ikke her i nogen af udgaverne, men af en
    anden grund: de følger destinationens variant og er ikke noget, brugeren
    svarer på, jf. ADR-0016. */
function ContributionFields({
  plan,
  years,
  id,
  onChange,
  onClose,
}: FieldsProps & { id: string; years: YearResult[] }) {
  const contribution = findContribution(plan, id)
  if (!contribution) return null

  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const holdingName = (holdingId: string) =>
    holdings.find((holding) => holding.id === holdingId)?.name ?? holdingId
  const ownerOfHolding = new Map(
    plan.household.persons.flatMap((person) =>
      person.holdings.map((holding) => [holding.id, person] as const),
    ),
  )

  const sourceEntry =
    contribution.kind === 'EntrySourced' ? findEntry(plan, contribution.source) : undefined
  // Kilde og destination tilhører samme person, jf. ADR-0016, så der er kun
  // én ejer at måle et aldersendepunkt fra — og den findes i begge udgaver.
  const owner =
    contribution.kind === 'EntrySourced'
      ? plan.household.persons.find((person) => person.id === sourceEntry?.owner)
      : ownerOfHolding.get(contribution.source)
  if (!owner) return null

  // Kilden er ét felt med to grupper. Navnet bærer personen med, så to ens
  // navne i husstanden kan skelnes fra hinanden i listen.
  const named = (name: string, person: string) => `${name} · ${person}`
  const entrySources = plan.entries.filter((entry) => entry.direction === 'Income')
  const holdingSources = holdings.filter(isFreeAssets)
  const entryLabel = (entry: Entry) =>
    named(
      entry.name,
      plan.household.persons.find((person) => person.id === entry.owner)?.name ?? entry.owner,
    )
  const holdingLabel = (holdingId: string) =>
    named(holdingName(holdingId), ownerOfHolding.get(holdingId)?.name ?? '')

  // En indbetaling går aldrig til frie midler — så er det en overførsel — og
  // kilde og destination skal tilhøre samme person, jf. ADR-0016. Vælgerne
  // tilbyder kun det, der kan vælges, frem for at lade motoren afvise planen
  // bagefter.
  const destinations = owner.holdings.filter((holding) => !isFreeAssets(holding))
  const sourceName =
    contribution.kind === 'EntrySourced'
      ? (sourceEntry?.name ?? contribution.source)
      : holdingName(contribution.source)

  return (
    <>
      <Head
        title={`${sourceName} → ${holdingName(contribution.to)}`}
        subtitle="Indbetaling"
        onClose={onClose}
        onDelete={() => {
          onChange(removeContribution(plan, id))
          onClose()
        }}
        deleteLabel="Fjern indbetaling"
      />
      <Section title="Indbetalingen">
        <SelectField
          label="Kilde"
          value={
            contribution.kind === 'EntrySourced' && sourceEntry
              ? entryLabel(sourceEntry)
              : holdingLabel(contribution.source)
          }
          options={[
            { label: 'Lønposter', options: entrySources.map(entryLabel) },
            {
              label: 'Beholdninger',
              options: holdingSources.map((holding) => holdingLabel(holding.id)),
            },
          ]}
          onChange={(choice) => {
            const entry = entrySources.find((source) => entryLabel(source) === choice)
            const holding = holdingSources.find((source) => holdingLabel(source.id) === choice)
            onChange(
              withContribution(plan, id, (c) =>
                entry
                  ? withSource(c, { kind: 'EntrySourced', source: entry.id })
                  : withSource(c, { kind: 'HoldingSourced', source: holding!.id }),
              ),
            )
          }}
        />
        <SelectField
          label="Destination"
          value={holdingName(contribution.to)}
          options={destinations.map((holding) => holding.name)}
          onChange={(name) =>
            onChange(
              withContribution(plan, id, (c) => ({
                ...c,
                to: destinations.find((holding) => holding.name === name)!.id,
              })),
            )
          }
        />
        <Hint>
          {contribution.kind === 'HoldingSourced'
            ? 'Kilden er en beholdning, så der trækkes intet AM-bidrag — pengene er beskattet, og der lander 100 % i ordningen.'
            : sourceEntry?.direction === 'Income' && sourceEntry.taxTreatment === 'EarnedIncome'
              ? 'Kilden er en AM-pligtig post, så AM-bidraget trækkes på vejen ind — der lander 92 % i beholdningen.'
              : 'Kilden har aldrig båret AM-bidrag, så hele beløbet går ind.'}{' '}
          Begge dele følger kilden og tastes ikke.
        </Hint>
      </Section>
      <Section title="Beløb">
        {contribution.kind === 'EntrySourced' ? (
          <>
            {/* Begge former står synlige: en vælger ville skjule den ene bag
                et klik, og der er kun to. */}
            <ToggleField
              label="Angives som"
              value={danish(
                contributionAmounts,
                'percentageOfEntry' in contribution ? 'percentageOfEntry' : 'amountInRealKroner',
              )}
              options={Object.keys(contributionAmounts)}
              onChange={(choice) =>
                onChange(
                  withContribution(plan, id, (c) => withAmountForm(c, contributionAmounts[choice]!)),
                )
              }
            />
            {'percentageOfEntry' in contribution ? (
              <NumberField
                label="Procent"
                unit="%"
                value={asPercent(contribution.percentageOfEntry)}
                onChange={(percent) =>
                  onChange(
                    withContribution(plan, id, (c) =>
                      'percentageOfEntry' in c ? { ...c, percentageOfEntry: percent / 100 } : c,
                    ),
                  )
                }
              />
            ) : (
              <NumberField
                label="Fast beløb (dagens kroner)"
                unit="kr."
                value={contribution.amountInRealKroner}
                onChange={(amountInRealKroner) =>
                  onChange(
                    withContribution(plan, id, (c) =>
                      c.kind === 'EntrySourced' && 'amountInRealKroner' in c
                        ? { ...c, amountInRealKroner }
                        : c,
                    ),
                  )
                }
              />
            )}
            {'percentageOfEntry' in contribution && sourceEntry && (
              <Hint>
                Måles af {sourceEntry.name}, så bidraget følger lønnen op uden at blive
                rettet.
              </Hint>
            )}
          </>
        ) : (
          <>
            <NumberField
              label="Fast beløb (dagens kroner)"
              unit="kr."
              value={contribution.amountInRealKroner}
              onChange={(amountInRealKroner) =>
                onChange(
                  withContribution(plan, id, (c) =>
                    c.kind === 'HoldingSourced' ? { ...c, amountInRealKroner } : c,
                  ),
                )
              }
            />
            {/* Kontakten "Angives som" står slet ikke: en procent skal have en
                post at måle af, og et valg, der aldrig kan træffes, er værre
                end intet valg. */}
            <Hint>
              En procent skal have en post at måle af, og kilden er en beholdning — derfor
              kun kronebeløbet. Det er tastet i dagens kroner og følger planens
              inflationsantagelse, som en overførsel gør.
            </Hint>
          </>
        )}
      </Section>
      {contribution.kind === 'EntrySourced' ? (
        sourceEntry && (
          <section className="afsnit arvet">
            <h3>Følger {sourceEntry.name}</h3>
            <div className="arvelinje">{inheritedLine(years, sourceEntry)}</div>
            <Hint>
              Periode, forankring, gentagelse og forfald hører til posten. Bidraget har
              dem ikke selv og ophører derfor af sig selv ved erhvervsophøret.
            </Hint>
          </section>
        )
      ) : (
        <PeriodSection
          value={contribution}
          owner={owner}
          startYear={plan.startYear}
          onChange={(next) =>
            onChange(
              withContribution(plan, id, (c) =>
                c.kind === 'HoldingSourced' ? { ...c, ...next } : c,
              ),
            )
          }
        >
          <Hint>
            Kilden er en beholdning og har ingen periode at låne ud. Til gengæld kan
            bidraget aldersforankres: destinationen har en ejer og dermed en alder at
            måle fra.
          </Hint>
        </PeriodSection>
      )}
    </>
  )
}

/** Det, bidraget arver af sin post, som én linje. Årene er motorens eget svar
    og ikke en udledning ved siden af den, jf. ADR-0012 — de er derfor også
    klippet mod horisonten, som postens egen periode ikke er. */
function inheritedLine(years: YearResult[], source: Entry): string {
  return [
    entryPeriodLabel(years, source),
    danish(recurrences, source.recurrence.kind).toLowerCase(),
    danishTiming(source.timing).toLowerCase(),
  ]
    .filter((part) => part !== undefined)
    .join(' · ')
}

/** Skifter bidragets kilde — og dermed dets udgave. De to bærer hvert sit sæt
    felter, så skiftet bygger et nyt bidrag frem for at sætte et felt, som
    `withAmountForm` gør for beløbet.

    Kronebeløbet overlever skiftet: det er det samme tal i begge udgaver.
    Procenten gør ikke — den findes kun, hvor der er en post at måle af — og
    perioden heller ikke, for den findes kun, hvor der ingen post er at arve
    den fra. */
function withSource(
  contribution: Contribution,
  source:
    | { kind: 'EntrySourced'; source: EntryId }
    | { kind: 'HoldingSourced'; source: HoldingId },
): Contribution {
  const { id, to } = contribution
  const amountInRealKroner =
    'amountInRealKroner' in contribution ? contribution.amountInRealKroner : undefined

  if (source.kind === 'EntrySourced') {
    return amountInRealKroner === undefined
      ? { id, to, ...source, percentageOfEntry: 0 }
      : { id, to, ...source, amountInRealKroner }
  }
  return {
    id,
    to,
    ...source,
    amountInRealKroner: amountInRealKroner ?? 0,
    timing: 'Even',
    period: { anchor: 'CalendarYear' },
    recurrence: { kind: 'Annual' },
  }
}

/** Skifter beløbsangivelsens form på et lønkildet bidrag. De to former er
    hvert sit felt og ikke to værdier i ét, så skiftet bygger et nyt bidrag
    frem for at sætte et felt — som `withDirection` gør for posten. Det gamle
    tal huskes ikke: det findes ikke at huske på, og en procent og et
    kronebeløb er alligevel ikke hinandens omregning. */
function withAmountForm(
  contribution: Contribution,
  field: 'percentageOfEntry' | 'amountInRealKroner',
): Contribution {
  if (contribution.kind !== 'EntrySourced') return contribution
  const { id, kind, source, to } = contribution
  return field === 'percentageOfEntry'
    ? { id, kind, source, to, percentageOfEntry: 0 }
    : { id, kind, source, to, amountInRealKroner: 0 }
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
