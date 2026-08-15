import type { ReactNode } from 'react'
import {
  bearsPayoutSchedule,
  isEmployerAdministered,
  isFreeAssets,
  isFreeAssetsVariant,
  isPensionScheme,
  isUniquePerPerson,
} from '../engine/holdingVariant'
import type {
  Anchor,
  Contribution,
  Entry,
  EntryId,
  Holding,
  HoldingId,
  PayoutScheduleHolding,
  PensionSchemeHolding,
  Period,
  Person,
  Plan,
  Recurrence,
  Timing,
} from '../engine/plan'
import { latestRateYear } from '../engine/rates/rates'
import { conversionFactor, isLifeAnnuity } from '../engine/lifeAnnuity'
import type { LifeAnnuityHolding } from '../engine/lifeAnnuity'
import { payoutAge, payoutRegime, payoutYear } from '../engine/payoutAge'
import { payoutDurationBounds } from '../engine/validatePlan'
import { deriveStatePensionAge } from '../engine/statePensionAge'
import type { YearResult } from '../engine/yearResult'
import {
  anchors,
  danish,
  danishTiming,
  directions,
  payoutPrinciples,
  payoutRegimes,
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
  addPayoutSchedule,
  addPayoutStart,
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
  removePayoutSchedule,
  removePayoutStart,
  removePerson,
  removeTransfer,
  transferEndOptions,
  withContribution,
  withDirection,
  withEntry,
  withHolding,
  withHoldingOwner,
  withLifeAnnuity,
  withPayoutSchedule,
  withPerson,
  withPensionScheme,
  withTransfer,
  withTransferEnd,
  withVariant,
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
          help="Plan.name"
          value={plan.name}
          onChange={(name) => onChange({ ...plan, name })}
        />
        <NumberField
          label="Startår"
          help="Plan.startYear"
          value={plan.startYear}
          onChange={(startYear) => onChange({ ...plan, startYear })}
        />
        <NumberField
          label="Inflation"
          help="Plan.inflationAssumption"
          unit="% p.a."
          value={asPercent(plan.inflationAssumption)}
          onChange={(percent) =>
            onChange({ ...plan, inflationAssumption: percent / 100 })
          }
        />
        <NumberField
          label="§ 20-fremskrivning"
          help="Plan.section20ProjectionAssumption"
          unit="% p.a."
          value={asPercent(plan.section20ProjectionAssumption)}
          onChange={(percent) =>
            onChange({ ...plan, section20ProjectionAssumption: percent / 100 })
          }
        />
        <NumberField
          label="Folkepensionsregulering"
          help="Plan.statePensionProjectionAssumption"
          unit="% p.a."
          value={asPercent(plan.statePensionProjectionAssumption)}
          onChange={(percent) =>
            onChange({ ...plan, statePensionProjectionAssumption: percent / 100 })
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
          help="Person.name"
          value={person.name}
          onChange={(name) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, name })))
          }
        />
        <NumberField
          label="Fødselsår"
          help="Person.birthYear"
          value={person.birthYear}
          onChange={(birthYear) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, birthYear })))
          }
        />
        <NumberField
          label="Fødselsmåned"
          help="Person.birthMonth"
          unit="1–12"
          value={person.birthMonth}
          onChange={(birthMonth) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, birthMonth })))
          }
        />
        <NumberField
          label="Horisont"
          help="Person.horizon"
          unit="år"
          value={person.horizon}
          onChange={(horizon) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, horizon })))
          }
        />
      </Section>
      <Section title="Skat">
        <SelectField
          label="Kommune"
          help="Person.municipality"
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
          help="Person.churchMember"
          checked={person.churchMember}
          onChange={(churchMember) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, churchMember })))
          }
        />
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
        help="Person.statePensionAge"
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
          help="Holding.name"
          value={holding.name}
          onChange={(name) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, name })))
          }
        />
        <SelectField
          label="Type"
          help="Holding.variant"
          value={danish(variants, holding.variant)}
          options={variantOptions(plan, owner, holding)}
          onChange={(choice) => onChange(withVariant(plan, id, variants[choice]!))}
        />
        <SelectField
          label="Ejer"
          help="Holding.owner"
          value={owner.name}
          options={persons.map((person) => person.name)}
          onChange={(name) =>
            onChange(withHoldingOwner(plan, id, ownerByName[name]!))
          }
        />
        <NumberField
          label="Saldo (dagens kroner)"
          help="Holding.balance"
          unit="kr."
          value={holding.balance}
          onChange={(balance) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, balance })))
          }
        />
        <RadioField
          label="Buffer"
          help="Plan.buffer"
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
          help="Holding.grossReturn"
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
          help="Holding.annualCostRate"
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
          help="Holding.netReturn"
          value={procent(holding.grossReturn - holding.annualCostRate)}
          unit="udledt"
        />
      </Section>
      {isPensionScheme(holding) && (
        <Section title="Udbetaling">
          <PayoutFields plan={plan} holding={holding} owner={owner} onChange={onChange} />
        </Section>
      )}
      {isLifeAnnuity(holding) && (
        <ConversionSection plan={plan} holding={holding} owner={owner} onChange={onChange} />
      )}
      {bearsPayoutSchedule(holding) && (
        <PayoutScheduleSection
          plan={plan}
          holding={holding}
          owner={owner}
          onChange={onChange}
        />
      )}
    </>
  )
}

/** Hvornår ordningen tidligst må udbetales — det, brugeren taster, og det,
    loven gør ved det. Afsnittet står kun på de tre pensionsvarianter: en
    aktiesparekonto og frie midler har ingen udbetalingsalder, og et felt om
    en, der ikke findes, ville påstå en lovregel, der heller ikke gør.

    Både regimet og alderen er udledte, jf. ADR-0012: fladen læser dem, hvor
    de regnes, frem for at gentage udledningen. Alderen retter sig derfor af
    sig selv, når ejerens fødselsdato flytter folkepensionsalderen — for de
    to relative regimer, og ikke for det faste. */
function PayoutFields({
  plan,
  holding,
  owner,
  onChange,
}: {
  plan: Plan
  holding: PensionSchemeHolding
  owner: Person
  onChange: (plan: Plan) => void
}) {
  const regime = payoutRegime(holding.openedOn)

  return (
    <>
      <NumberField
        label="Oprettet (år)"
        help="Holding.openedOn"
        value={holding.openedOn.year}
        onChange={(year) =>
          onChange(
            withPensionScheme(plan, holding.id, (h) => ({
              ...h,
              openedOn: { ...h.openedOn, year },
            })),
          )
        }
      />
      <NumberField
        label="Oprettet (måned)"
        help="Holding.openedOn"
        unit="1–12"
        value={holding.openedOn.month}
        onChange={(month) =>
          onChange(
            withPensionScheme(plan, holding.id, (h) => ({
              ...h,
              openedOn: { ...h.openedOn, month },
            })),
          )
        }
      />
      <LockedField
        label="Udbetalingsregime"
        help="Holding.payoutRegime"
        value={payoutRegimes[regime]}
        unit="udledt"
      />
      <LockedField
        label="Pensionsudbetalingsalder"
        help="Holding.payoutAge"
        value={`${formatNumber(payoutAge(holding, owner))} år`}
        unit="udledt"
      />
      <OptionalNumberField
        label="Bevaret udbetalingsalder"
        help="Holding.payoutAgeOverride"
        unit="år"
        value={holding.payoutAgeOverride}
        onChange={(payoutAgeOverride) =>
          onChange(
            withPensionScheme(plan, holding.id, (h) => {
              const { payoutAgeOverride: _forrige, ...rest } = h
              return payoutAgeOverride === undefined ? rest : { ...rest, payoutAgeOverride }
            }),
          )
        }
      />
      {holding.payoutAgeOverride !== undefined && (
        <Hint>
          Den bevarede alder gælder frem for den, oprettelsestidspunktet
          giver. Ryddes feltet, regnes alderen igen af regelsættet.
        </Hint>
      )}
    </>
  )
}

/** Omsætningen: hvornår livrentens depot bliver til en livsvarig ydelse, og
    de to tal, forholdet mellem dem regnes af.

    Starten slås til og fra som ratepensionens plan — er den der, gælder den;
    skal den væk, slettes den. De to oplyste tal står derimod altid: de hører
    til ordningen og ikke til beslutningen om, hvornår den skal omsættes.

    Faktoren er udledt og aldrig et gemt felt, jf. ADR-0012. Begge tal bag
    den står på pensionsoverblikket, og det er dét, der gør den
    efterprøvelig — hvor et enkelt gemt tal ikke kunne efterregnes. */
function ConversionSection({
  plan,
  holding,
  owner,
  onChange,
}: {
  plan: Plan
  holding: LifeAnnuityHolding
  owner: Person
  onChange: (plan: Plan) => void
}) {
  const earliest = payoutAge(holding, owner)
  const start = holding.payout?.start
  const factor = conversionFactor(holding)

  return (
    <Section
      title="Omsætning"
      action={
        start === undefined ? (
          <button
            type="button"
            className="afsnit-tilfoej"
            title="Læg en udbetalingsstart på livrenten"
            onClick={() => onChange(addPayoutStart(plan, holding.id, earliest))}
          >
            + Tilføj
          </button>
        ) : (
          <button
            type="button"
            className="slet"
            aria-label="Fjern udbetalingsstart"
            title="Fjern udbetalingsstart — livrenten bliver stående og vokser"
            onClick={() => onChange(removePayoutStart(plan, holding.id))}
          >
            <TrashIcon />
          </button>
        )
      }
    >
      {start === undefined ? (
        <Hint>
          Uden en udbetalingsstart bliver livrenten stående og vokser hele
          forløbet igennem, ganske som en ordning uden en plan for at blive
          tømt.
        </Hint>
      ) : (
        <AgeBoundField
          label="Udbetalingsstart"
          help="LifeAnnuity.payoutStart"
          value={start}
          workEndAge={owner.workEndAge}
          bounds={{ min: earliest }}
          onChange={(next) =>
            onChange(
              withLifeAnnuity(plan, holding.id, (h) => ({
                ...h,
                payout: { start: next ?? earliest },
              })),
            )
          }
        />
      )}
      <NumberField
        label="Oplyst depot"
        help="LifeAnnuity.quotedReserve"
        unit="kr."
        value={holding.quotedReserve}
        onChange={(quotedReserve) =>
          onChange(withLifeAnnuity(plan, holding.id, (h) => ({ ...h, quotedReserve })))
        }
      />
      <NumberField
        label="Oplyst årlig ydelse"
        help="LifeAnnuity.quotedAnnualBenefit"
        unit="kr."
        value={holding.quotedAnnualBenefit}
        onChange={(quotedAnnualBenefit) =>
          onChange(withLifeAnnuity(plan, holding.id, (h) => ({ ...h, quotedAnnualBenefit })))
        }
      />
      <LockedField
        label="Omsætningsfaktor"
        help="LifeAnnuity.conversionFactor"
        value={procent(factor)}
        unit="udledt"
      />
      <NumberField
        label="Bonus"
        help="LifeAnnuity.bonusRate"
        unit="% p.a."
        value={asPercent(holding.bonusRate)}
        onChange={(percent) =>
          onChange(
            withLifeAnnuity(plan, holding.id, (h) => ({ ...h, bonusRate: percent / 100 })),
          )
        }
      />
      {factor === 0 && (
        <Hint>
          Uden selskabets to tal er der intet forhold at gange depotet med, og
          ydelsen bliver nul. Begge står på pensionsoverblikket.
        </Hint>
      )}
    </Section>
  )
}

/** Udbetalingsplanen: hvornår ordningen begynder at blive tømt, over hvor
    mange år, og efter hvilket princip. Afsnittet står kun på de varianter,
    varianttabellen giver en plan — ratepensionen i denne skive.

    Planen slås ikke til og fra. Er den der, gælder den; skal den væk, slettes
    den, ganske som en overførsel eller en indbetaling. En ratepension uden
    plan er ikke en fejl: den bliver stående og vokser, og det ses i
    formuegrafen. */
function PayoutScheduleSection({
  plan,
  holding,
  owner,
  onChange,
}: {
  plan: Plan
  holding: PayoutScheduleHolding
  owner: Person
  onChange: (plan: Plan) => void
}) {
  const payout = holding.payout
  const earliest = payoutAge(holding, owner)

  if (payout === undefined) {
    return (
      <Section
        title="Udbetalingsplan"
        action={
          <button
            type="button"
            className="afsnit-tilfoej"
            title="Læg en udbetalingsplan på ordningen"
            onClick={() => onChange(addPayoutSchedule(plan, holding.id, earliest))}
          >
            + Tilføj
          </button>
        }
      >
        <Hint>
          Uden en plan bliver ordningen stående og vokser hele forløbet
          igennem. Den vises i formuegrafen som den formue, den er.
        </Hint>
      </Section>
    )
  }

  return (
    <Section
      title="Udbetalingsplan"
      action={
        <button
          type="button"
          className="slet"
          aria-label="Fjern udbetalingsplan"
          title="Fjern udbetalingsplan — ordningen bliver stående og vokser"
          onClick={() => onChange(removePayoutSchedule(plan, holding.id))}
        >
          <TrashIcon />
        </button>
      }
    >
      <AgeBoundField
        label="Start"
        help="PayoutSchedule.start"
        value={payout.start}
        workEndAge={owner.workEndAge}
        bounds={{ min: earliest }}
        onChange={(start) =>
          onChange(
            withPayoutSchedule(plan, holding.id, (p) => ({ ...p, start: start ?? earliest })),
          )
        }
      />
      <NumberField
        label="Varighed"
        help="PayoutSchedule.duration"
        unit="år"
        value={payout.duration}
        bounds={payoutDurationBounds(holding, owner, payout.start)}
        onChange={(duration) =>
          onChange(withPayoutSchedule(plan, holding.id, (p) => ({ ...p, duration })))
        }
      />
      <SelectField
        label="Princip"
        help="PayoutSchedule.principle"
        value={danish(payoutPrinciples, payout.principle)}
        options={Object.keys(payoutPrinciples)}
        onChange={(choice) =>
          onChange(
            withPayoutSchedule(plan, holding.id, (p) => ({
              ...p,
              principle: payoutPrinciples[choice]!,
            })),
          )
        }
      />
    </Section>
  )
}

/** Typerne, beholdningen kan sættes til. To regler udelader hver sin slags,
    og begge er `validatePlan`s: ét klik skal ikke kunne skrive en plan, den
    afviser, jf. ADR-0020.

    En variant, personen kun kan have én af, udelades, når en anden af
    personens beholdninger allerede er den. Og er beholdningen planens
    buffer, udelades ordningerne helt: årets restpost lander på bufferen, og
    en ordning kan ikke tage imod frit forbrug, jf. ADR-0004. Reglen er den
    samme, bufferradioen bærer fra sin ende — den lader sig ikke sætte på en
    ordning, og her kan bufferen ikke blive til en. Vil man omdanne den, skal
    en anden beholdning først være buffer; planen rettes ikke tavst under
    brugeren, jf. ADR-0002.

    Beholdningens egen variant står der altid. Faldt den ud af sin egen
    liste, ville feltet stå tomt, og beholdningen kunne ikke redigeres —
    listen skal udelukke det, brugeren ikke kan vælge, og aldrig det, der
    allerede er valgt. En buffer, der allerede er en ordning, beholder derfor
    sin egen linje og kan vælge sig tilbage til frie midler. */
function variantOptions(plan: Plan, owner: Person, holding: Holding): string[] {
  return Object.keys(variants).filter((label) => {
    const variant = variants[label]!
    if (variant === holding.variant) return true
    if (plan.buffer === holding.id && !isFreeAssetsVariant(variant)) return false
    return !(
      isUniquePerPerson(variant) && owner.holdings.some((other) => other.variant === variant)
    )
  })
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
          help="Entry.name"
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
          help="Entry.amountInRealKroner"
          unit="kr."
          value={entry.amountInRealKroner}
          onChange={(amountInRealKroner) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, amountInRealKroner })))
          }
        />
        <SelectField
          label="Retning"
          help="Entry.direction"
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
          help="Entry.owner"
          value={owner.name}
          options={persons.map((person) => person.name)}
          onChange={(name) =>
            onChange(withEntry(plan, id, (e) => ({ ...e, owner: ownerByName[name]! })))
          }
        />
        {entry.direction === 'Income' && (
          <SelectField
            label="Skattebehandling"
            help="Entry.taxTreatment"
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
            help="Entry.regulationRate"
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
        help="Recurrence.kind"
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
          help="Recurrence.n"
          unit="år"
          value={recurrence.n}
          onChange={(n) => change({ recurrence: { kind: 'EveryNYears', n } })}
        />
      )}
      <SelectField
        label="Forankring"
        help="Period.anchor"
        value={danish(anchors, period.anchor)}
        options={Object.keys(anchors)}
        onChange={(choice) => change({ period: defaultPeriod(anchors[choice]!) })}
      />
      {recurrence.kind === 'Once' ? (
        period.anchor === 'CalendarYear' ? (
          <NumberField
            label="År"
            help="Period.once"
            unit="år"
            value={period.from ?? period.to ?? startYear}
            onChange={(from) => change({ period: { anchor: 'CalendarYear', from } })}
          />
        ) : (
          <AgeBoundField
            label="Alder"
            help="Period.once"
            workEndAge={owner.workEndAge}
            value={period.from ?? period.to}
            onChange={(from) => change({ period: { anchor: 'PersonAge', from } })}
          />
        )
      ) : period.anchor === 'CalendarYear' ? (
        <>
          <OptionalNumberField
            label="Fra (år)"
            help="Period.from"
            unit="år"
            value={period.from}
            onChange={(from) => change({ period: { ...period, from } })}
          />
          <OptionalNumberField
            label="Til (år)"
            help="Period.to"
            unit="år"
            value={period.to}
            onChange={(to) => change({ period: { ...period, to } })}
          />
        </>
      ) : (
        <>
          <AgeBoundField
            label="Fra (alder)"
            help="Period.from"
            workEndAge={owner.workEndAge}
            value={period.from}
            onChange={(from) => change({ period: { ...period, from } })}
          />
          <AgeBoundField
            label="Til (alder)"
            help="Period.to"
            workEndAge={owner.workEndAge}
            value={period.to}
            onChange={(to) => change({ period: { ...period, to } })}
          />
        </>
      )}
      <SelectField
        label="Forfald"
        help="Timing"
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
  // Går indbetalingen til en ordning, ingen arbejdsgiver kan administrere,
  // tilbydes lønposterne slet ikke: den plan ville `validatePlan` afvise, og
  // så forsvandt resultatspalten efter ét klik, jf. ADR-0020.
  const destination = holdings.find((holding) => holding.id === contribution.to)
  const entrySources =
    destination && !isEmployerAdministered(destination)
      ? []
      : plan.entries.filter((entry) => entry.direction === 'Income')
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
  //
  // Destinationen kan skifte bidragets udgave med sig: vælges en ordning,
  // ingen arbejdsgiver kan administrere, mens kilden er en lønpost, flytter
  // kilden med over på personens frie midler. Har personen ingen at flytte
  // den til, er der intet at skifte til, og ordningen tilbydes ikke.
  const ownFreeAssets = owner.holdings.find(isFreeAssets)
  const destinations = owner.holdings.filter(
    (holding) =>
      !isFreeAssets(holding) &&
      (contribution.kind !== 'EntrySourced' ||
        isEmployerAdministered(holding) ||
        ownFreeAssets !== undefined),
  )
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
          help="Contribution.source"
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
            // En tom gruppe udelades: en overskrift uden noget under sig
            // ligner en liste, der mangler at blive fyldt.
          ].filter((group) => group.options.length > 0)}
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
          help="Contribution.to"
          value={holdingName(contribution.to)}
          options={destinations.map((holding) => holding.name)}
          onChange={(name) => {
            const to = destinations.find((holding) => holding.name === name)!
            onChange(
              withContribution(plan, id, (c) => {
                const moved = { ...c, to: to.id }
                return c.kind === 'EntrySourced' && !isEmployerAdministered(to)
                  ? withSource(moved, { kind: 'HoldingSourced', source: ownFreeAssets!.id })
                  : moved
              }),
            )
          }}
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
              help="Contribution.amountForm"
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
                help="Contribution.percentageOfEntry"
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
                help="Contribution.amountInRealKroner"
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
              help="Contribution.amountInRealKroner"
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
  const fromOwner = findHoldingOwner(plan, transfer?.from ?? '')
  if (!transfer || !fromOwner) return null

  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const holdingName = (holdingId: string) =>
    holdings.find((holding) => holding.id === holdingId)?.name ?? holdingId

  // De to ender har hver sin regel og dermed hver sin liste. Afgiveren skal
  // være en variant, hvis udbetaling er skattefri — også aldersopsparingen og
  // aktiesparekontoen, som netop tømmes sådan, jf. ADR-0022. Destinationen er
  // altid frie midler: ind i en ordning er det en indbetaling, jf. ADR-0016.
  //
  // Listerne tilbyder kun det, der kan vælges, frem for at lade motoren
  // afvise planen bagefter — navneopslaget ovenfor står stadig på alle
  // beholdninger, så en importeret plans ulovlige ende vises med sit navn og
  // ikke med sit id.
  const sources = transferEndOptions(plan, 'from')
  const destinations = transferEndOptions(plan, 'to')
  // Opslaget dækker afgiverlisten, og destinationerne er en delmængde af
  // den: et navn, en af de to lister kan sende hertil, står altid i kortet.
  // En beholdning, ingen af listerne tilbyder, hører ikke i det — den kunne
  // stjæle et navn fra en, der gør.
  const holdingByName: Record<string, string> = Object.fromEntries(
    sources.map((holding) => [holding.name, holding.id]),
  )

  // Fladen låner ordet "udbetaling", når pengene forlader en ordning. Det er
  // det, den er i virkeligheden — man beder selskabet udbetale sin
  // aldersopsparing — men figuren hedder stadig en overførsel i glossaret og
  // i koden, jf. ADR-0022. En etiket og ikke et begreb, og derfor står de
  // bøjede former som tekst her og ikke som en regel, der bøjer dem.
  const from = holdings.find((holding) => holding.id === transfer.from)
  const label =
    from && !isFreeAssets(from)
      ? { slags: 'Udbetaling', bestemt: 'Udbetalingen', fjern: 'Fjern udbetaling' }
      : { slags: 'Overførsel', bestemt: 'Overførslen', fjern: 'Fjern overførsel' }

  return (
    <>
      <Head
        title={`${holdingName(transfer.from)} → ${holdingName(transfer.to)}`}
        subtitle={label.slags}
        onClose={onClose}
        onDelete={() => {
          onChange(removeTransfer(plan, id))
          onClose()
        }}
        deleteLabel={label.fjern}
      />
      <Section title={label.bestemt}>
        {/* Står den beholdning, der allerede er den anden ende, i listen, og
            kan de to bytte plads lovligt, gør de det — se `withTransferEnd`.
            Udelod listen den anden ende, ville retningen være låst mellem to
            frie midler, og der ville ikke være et valg tilbage overhovedet. */}
        <SelectField
          label="Fra"
          help="Transfer.from"
          value={holdingName(transfer.from)}
          options={sources.map((holding) => holding.name)}
          onChange={(name) => onChange(withTransferEnd(plan, id, 'from', holdingByName[name]!))}
        />
        <SelectField
          label="Til"
          help="Transfer.to"
          value={holdingName(transfer.to)}
          options={destinations.map((holding) => holding.name)}
          onChange={(name) => onChange(withTransferEnd(plan, id, 'to', holdingByName[name]!))}
        />
        <NumberField
          label="Beløb (dagens kroner)"
          help="Transfer.amountInRealKroner"
          unit="kr."
          value={transfer.amountInRealKroner}
          onChange={(amountInRealKroner) =>
            onChange(withTransfer(plan, id, (t) => ({ ...t, amountInRealKroner })))
          }
        />
      </Section>
      <PeriodSection
        value={transfer}
        owner={fromOwner}
        startYear={plan.startYear}
        onChange={(next) => onChange(withTransfer(plan, id, (t) => ({ ...t, ...next })))}
      >
        <Hint>
          En aldersforankret overførsel måles på {fromOwner.name}, som ejer
          den beholdning, pengene tages fra — så en tømning flytter sig med
          erhvervsophøret.
          {from && isPensionScheme(from) && (
            <> Ordningen må tidligst udbetales i {payoutYear(from, fromOwner)}.</>
          )}
        </Hint>
      </PeriodSection>
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
