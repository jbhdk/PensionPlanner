import type { ReactNode } from 'react'
import {
  bearsPayoutSchedule,
  cappedVariant,
  isEmployerAdministered,
  isFreeAssets,
  isFreeAssetsVariant,
  isOpenToContributions,
  isPensionScheme,
  isUniquePerPerson,
  payoutTaxation,
  transferCharge,
} from '../engine/holdingVariant'
import type {
  AllocationLine,
  Anchor,
  Contribution,
  ContributionAmount,
  Entry,
  ExpenseEntry,
  Holding,
  HoldingId,
  IncomeEntry,
  PayoutScheduleHolding,
  PensionSchemeHolding,
  Period,
  PersonAgeBound,
  Person,
  Plan,
  Recurrence,
  Timing,
} from '../engine/plan'
import { latestRateYear } from '../engine/rates/rates'
import { conversionFactor, isLifeAnnuity } from '../engine/lifeAnnuity'
import type { LifeAnnuityHolding } from '../engine/lifeAnnuity'
import { payoutYear } from '../engine/payoutAge'
import {
  boundValue,
  payoutDurationBounds,
  payoutStartBounds,
  periodEndpointBounds,
} from '../engine/validatePlan'
import type { Bounds, PeriodicFigure } from '../engine/validatePlan'
import { deriveStatePensionAge } from '../engine/statePensionAge'
import type { YearResult } from '../engine/yearResult'
import {
  allocationForms,
  allocationFormsFor,
  anchors,
  danish,
  danishTiming,
  payoutPrinciples,
  recurrences,
  timingForOnce,
  contributionAmounts,
  timingOptions,
  timings,
  treatments,
  variants,
} from './danish'
import { entryNote, entryPeriodLabel } from './entryNote'
import type { Clamp } from './fields'
import {
  AgeBoundField,
  PersonAgeBoundField,
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
  UnitToggle,
} from './fields'
import type { FieldHelpKey } from './fieldHelp'
import { kroner, procent } from './format'
import {
  addAllocationLine,
  addPayoutSchedule,
  addPayoutStart,
  addPensionAgreement,
  agreementDestination,
  findContribution,
  findEntry,
  findHolding,
  findHoldingOwner,
  findPerson,
  findTransfer,
  formatNumber,
  guardTransferOrContributionAnchor,
  removeAllocationLine,
  removeContribution,
  removeEntry,
  removeHolding,
  removePayoutSchedule,
  removePayoutStart,
  removePensionAgreement,
  removePerson,
  removeTransfer,
  transferEndOptions,
  withAllocationLine,
  withContribution,
  withEntry,
  withHolding,
  withHoldingOwner,
  withIncomeEntry,
  withLifeAnnuity,
  withPayoutSchedule,
  withPensionAgreement,
  withPerson,
  withPensionScheme,
  withTransfer,
  withTransferOrContributionEnd,
  withVariant,
} from './planEdits'
import type { Selection } from './selection'

/** Skuffen. Alt, der kan redigeres på ét objekt, står her — navigatorlinjen
    viser kun navn og ét tal, så listen kan stå stille, mens skuffen skifter. */
export function Inspector({
  plan,
  years,
  selected,
  clamp,
  onClamp,
  onChange,
  onClose,
}: {
  plan: Plan
  /** Motorens årsrække, som skuffen slår op i frem for at regne om — en note,
      der udleder selv, kan komme til at sige et år, motoren aldrig regnede,
      jf. ADR-0012. Tom, når planen ikke kunne simuleres. */
  years: YearResult[]
  selected: Selection
  /** Fladens seneste klemning — også en, der kom fra et træk på tidslinjen.
      Skuffen ejer den ikke; den viser den ved det felt, den peger på. */
  clamp: Clamp | null
  /** Meldes ved hver redigering af et felt med grænser: klemningen, hvis
      grænsen greb ind, ellers intet — og så dør den forrige. */
  onClamp: (clamp: Clamp | null) => void
  onChange: (plan: Plan) => void
  /** Rydder markeringen. Ingen knap kalder den længere — skuffen er en fast
      spalte og har intet at lukke, jf. ADR-0035 — men en slettet linje må
      ikke lade markeringen pege på noget, der er væk. */
  onClose: () => void
}) {
  // Skuffen er en fast spalte og altid synlig, jf. ADR-0035 — intet valgt
  // falder derfor tilbage på planens egne felter i stedet for at stå tom.
  const target = selected ?? { kind: 'plan' as const }

  return (
    <>
      <div className="spaltehoved">Inspektør</div>
      <div className="inspektor">
        {target.kind === 'plan' && (
          <PlanFields plan={plan} onChange={onChange} onClose={onClose} />
        )}
        {target.kind === 'person' && (
          <PersonFields
            plan={plan}
            id={target.id}
            onChange={onChange}
            onClose={onClose}
          />
        )}
        {target.kind === 'holding' && (
          <HoldingFields
            plan={plan}
            id={target.id}
            clamp={clamp}
            onClamp={onClamp}
            onChange={onChange}
            onClose={onClose}
          />
        )}
        {target.kind === 'entry' && (
          <EntryFields
            plan={plan}
            years={years}
            id={target.id}
            clamp={clamp}
            onClamp={onClamp}
            onChange={onChange}
            onClose={onClose}
          />
        )}
        {/* Målet siger kun, i hvilket array figuren står — ikke om den
            lønkildede eller den beholdningskildede rude skal tegnes.
            Reklassificeringen i `withTransferOrContributionEnd` kan flytte
            figuren mellem `plan.transfers` og `plan.contributions` uden at
            `target` følger med, jf. ADR-0047 — de to ruder afgør derfor selv,
            ud fra figurens egen `kind`, om de har noget at tegne, og lader
            hinanden stå tomme, når de ikke har. */}
        {target.kind === 'contribution' && (
          <>
            <ContributionFields
              plan={plan}
              years={years}
              id={target.id}
              clamp={clamp}
              onClamp={onClamp}
              onChange={onChange}
              onClose={onClose}
            />
            <TransferFields
              plan={plan}
              id={target.id}
              clamp={clamp}
              onClamp={onClamp}
              onChange={onChange}
              onClose={onClose}
            />
          </>
        )}
        {target.kind === 'transfer' && (
          <TransferFields
            plan={plan}
            id={target.id}
            clamp={clamp}
            onClamp={onClamp}
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

function PlanFields({ plan, onChange }: FieldsProps) {
  return (
    <>
      <Head title={plan.name} subtitle="Det, der gælder hele forløbet" />
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
        <NumberField
          label="Erhvervsophør"
          help="Person.workEndAge"
          unit="år"
          value={person.workEndAge}
          bounds={{ min: 0, max: person.horizon }}
          onChange={(workEndAge) =>
            onChange(withPerson(plan, id, (p) => ({ ...p, workEndAge })))
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

function HoldingFields({
  plan,
  id,
  clamp,
  onClamp,
  onChange,
  onClose,
}: FieldsProps & { id: string; clamp: Clamp | null; onClamp: (clamp: Clamp | null) => void }) {
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
          label="Saldo"
          help="Holding.balance"
          unit="kr."
          value={holding.balance}
          onChange={(balance) =>
            onChange(withHolding(plan, id, (h) => ({ ...h, balance })))
          }
        />
        {isPensionScheme(holding) && (
          <PayoutFields plan={plan} holding={holding} onChange={onChange} />
        )}
        {isFreeAssets(holding) && (
          <>
            <RadioField
              label="Buffer"
              help="Plan.buffer"
              checked={plan.buffer === id}
              onSelect={() => onChange({ ...plan, buffer: id })}
            />
            <Hint>
              Årets samlede over- eller underskud lander på bufferen. Præcis én
              beholdning kan være det, og bufferen skal være frie midler —
              penge ind i en ordning er en indbetaling.
            </Hint>
          </>
        )}
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
      {isLifeAnnuity(holding) && (
        <ConversionSection
          plan={plan}
          holding={holding}
          owner={owner}
          clamp={clamp}
          onClamp={onClamp}
          onChange={onChange}
        />
      )}
      {bearsPayoutSchedule(holding) && (
        <PayoutScheduleSection
          plan={plan}
          holding={holding}
          owner={owner}
          clamp={clamp}
          onClamp={onClamp}
          onChange={onChange}
        />
      )}
    </>
  )
}

/** Hvornår ordningen tidligst må udbetales. Tastet direkte, som
    pensionsselskabet oplyser den, jf. ADR-0032 — feltet står kun på de fire
    pensionsvarianter: en aktiesparekonto og frie midler har ingen
    udbetalingsalder, og et felt om en, der ikke findes, ville påstå en
    lovregel, der ikke gør. */
function PayoutFields({
  plan,
  holding,
  onChange,
}: {
  plan: Plan
  holding: PensionSchemeHolding
  onChange: (plan: Plan) => void
}) {
  return (
    <NumberField
      label="Udbetalingsalder"
      help="Holding.payoutAge"
      unit="år"
      value={holding.payoutAge}
      onChange={(payoutAge) =>
        onChange(withPensionScheme(plan, holding.id, (h) => ({ ...h, payoutAge })))
      }
    />
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
  clamp,
  onClamp,
  onChange,
}: {
  plan: Plan
  holding: LifeAnnuityHolding
  owner: Person
  clamp: Clamp | null
  onClamp: (clamp: Clamp | null) => void
  onChange: (plan: Plan) => void
}) {
  const start = holding.payout?.start
  const bounds = payoutStartBounds(holding, owner, start)
  const earliest = boundValue(bounds.min)
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
          bounds={bounds}
          clamp={clamp}
          onClamp={onClamp}
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
  clamp,
  onClamp,
  onChange,
}: {
  plan: Plan
  holding: PayoutScheduleHolding
  owner: Person
  clamp: Clamp | null
  onClamp: (clamp: Clamp | null) => void
  onChange: (plan: Plan) => void
}) {
  const payout = holding.payout
  const bounds = payoutStartBounds(holding, owner, payout?.start)
  const earliest = boundValue(bounds.min)

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
        bounds={bounds}
        clamp={clamp}
        onClamp={onClamp}
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
        clamp={clamp}
        onClamp={onClamp}
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

/** Postens rude, som deler sig i to. Retningen er ikke et felt: en indtægt
    og en udgift oprettes hver sit sted i navigatoren, og de er to slags
    poster og ikke to tilstande af én. Delingen sker derfor én gang her, og
    ingen af de to ruder spørger om retningen igen længere nede.

    Opslaget og vagten mod et id, der ikke rammer noget, står også kun her —
    de er ens for de to. */
function EntryFields({
  plan,
  years,
  id,
  clamp,
  onClamp,
  onChange,
  onClose,
}: FieldsProps & { id: string; years: YearResult[] } & ClampProps) {
  const entry = findEntry(plan, id)
  const owner = findPerson(plan, entry?.owner ?? '')
  if (!entry || !owner) return null

  return entry.direction === 'Income' ? (
    <IncomeFields
      plan={plan}
      years={years}
      entry={entry}
      owner={owner}
      clamp={clamp}
      onClamp={onClamp}
      onChange={onChange}
      onClose={onClose}
    />
  ) : (
    <ExpenseFields
      plan={plan}
      years={years}
      entry={entry}
      owner={owner}
      clamp={clamp}
      onClamp={onClamp}
      onChange={onChange}
      onClose={onClose}
    />
  )
}

/** Fladens seneste klemning og den kanal, en ny meldes gennem. Rækkes ned
    gennem ruderne til det felt, grænsen står ved — skuffen ejer den ikke,
    jf. ADR-0045. */
type ClampProps = { clamp: Clamp | null; onClamp: (clamp: Clamp | null) => void }

type EntryFieldsProps<T extends Entry> = {
  plan: Plan
  years: YearResult[]
  entry: T
  /** Personen, posten tilhører, og den et aldersendepunkt måles fra. Slået
      op af `EntryFields`, så de to ruder ikke gør det hver for sig. */
  owner: Person
  onChange: (plan: Plan) => void
  onClose: () => void
} & ClampProps

/** Afsnittet **Posten**: navnet, beløbet og ejeren, som de to slags har med
    den samme betydning. `children` er de felter, kun den ene har — samme
    greb og samme grund som `PeriodSection`s.

    Redigeringerne går gennem `withEntry` og ikke `withIncomeEntry`: de tre
    felter står på grundformen, og afsnittet har derfor ingen grund til at
    vide, hvilken slags post det tegner. */
function EntrySection({
  plan,
  entry,
  owner,
  onChange,
  children,
}: {
  plan: Plan
  entry: Entry
  owner: Person
  onChange: (plan: Plan) => void
  children?: ReactNode
}) {
  const persons = plan.household.persons
  const ownerByName: Record<string, string> = Object.fromEntries(
    persons.map((person) => [person.name, person.id]),
  )

  return (
    <Section title="Posten">
      <TextField
        label="Navn"
        help="Entry.name"
        value={entry.name}
        onChange={(name) => onChange(withEntry(plan, entry.id, (e) => ({ ...e, name })))}
      />
      <NumberField
        /* Ét navn på feltet uanset skattebehandling: beløbet er postens
           eget, og en lønpost er ikke længere en undtagelse, jf.
           ADR-0040. Hvad det betyder for en løn, står i noten nedenfor. */
        label="Beløb"
        help="Entry.amountInRealKroner"
        unit="kr."
        value={entry.amountInRealKroner}
        onChange={(amountInRealKroner) =>
          onChange(withEntry(plan, entry.id, (e) => ({ ...e, amountInRealKroner })))
        }
      />
      <SelectField
        label="Ejer"
        help="Entry.owner"
        value={owner.name}
        options={persons.map((person) => person.name)}
        onChange={(name) =>
          onChange(withEntry(plan, entry.id, (e) => ({ ...e, owner: ownerByName[name]! })))
        }
      />
      {children}
    </Section>
  )
}

/** Indtægtsposten. Den bærer en skattebehandling, en reguleringssats og
    firmaordningen på lønnen — de tre, udgiftsposten ikke har. */
function IncomeFields({
  plan,
  years,
  entry,
  owner,
  clamp,
  onClamp,
  onChange,
  onClose,
}: EntryFieldsProps<IncomeEntry>) {
  return (
    <>
      <Head
        title={entry.name}
        subtitle="Indtægtspost"
        onDelete={() => {
          onChange(removeEntry(plan, entry.id))
          onClose()
        }}
        deleteLabel="Fjern indtægt"
      />
      <EntrySection plan={plan} entry={entry} owner={owner} onChange={onChange}>
        <SelectField
          label="Skattebehandling"
          help="Entry.taxTreatment"
          value={danish(treatments, entry.taxTreatment)}
          options={Object.keys(treatments)}
          onChange={(choice) =>
            onChange(
              withIncomeEntry(plan, entry.id, (e) => ({
                ...e,
                taxTreatment: treatments[choice]!,
              })),
            )
          }
        />
        {entry.taxTreatment === 'EarnedIncome' && (
          <Hint>
            Beløbet er det, lønsedlen kalder løn. Arbejdsgiverens
            pensionsbidrag hører til i afsnittet Pension og lægges til
            derfra — det skal ikke tastes med her.
          </Hint>
        )}
      </EntrySection>
      <PensionAgreementSection plan={plan} entry={entry} onChange={onChange} />
      <PeriodSection
        value={entry}
        owner={owner}
        persons={plan.household.persons}
        startYear={plan.startYear}
        bounds={endpointBounds(plan, entry)}
        boundsForCandidate={endpointBoundsForCandidate(plan, entry)}
        clamp={clamp}
        onClamp={onClamp}
        onChange={(next) => onChange(withEntry(plan, entry.id, (e) => ({ ...e, ...next })))}
      >
        <NumberField
          label="Reguleringssats"
          help="Entry.regulationRate"
          unit="% p.a."
          value={asPercent(entry.regulationRate)}
          onChange={(percent) =>
            onChange(
              withIncomeEntry(plan, entry.id, (e) => ({ ...e, regulationRate: percent / 100 })),
            )
          }
        />
        <Hint>{entryNote(years, entry)}</Hint>
      </PeriodSection>
    </>
  )
}

/** Udgiftsposten. Grundformen og perioden og intet andet: der er hverken en
    skattebehandling at vælge — udgiften har ingen — eller et eget tempo at
    sætte, for den følger planens inflationsantagelse. */
function ExpenseFields({
  plan,
  years,
  entry,
  owner,
  clamp,
  onClamp,
  onChange,
  onClose,
}: EntryFieldsProps<ExpenseEntry>) {
  return (
    <>
      <Head
        title={entry.name}
        subtitle="Udgiftspost"
        onDelete={() => {
          onChange(removeEntry(plan, entry.id))
          onClose()
        }}
        deleteLabel="Fjern udgift"
      />
      <EntrySection plan={plan} entry={entry} owner={owner} onChange={onChange} />
      <PeriodSection
        value={entry}
        owner={owner}
        persons={plan.household.persons}
        startYear={plan.startYear}
        bounds={endpointBounds(plan, entry)}
        boundsForCandidate={endpointBoundsForCandidate(plan, entry)}
        clamp={clamp}
        onClamp={onClamp}
        onChange={(next) => onChange(withEntry(plan, entry.id, (e) => ({ ...e, ...next })))}
      >
        <Hint>{entryNote(years, entry)}</Hint>
      </PeriodSection>
    </>
  )
}

/** Firmaordningen på lønposten. Afsnittet hedder **Pension** på skærmen —
    det er en etiket og ikke et begreb.

    Aftalen findes kun, hvor den er skrevet: slås afsnittet fra, er den væk
    med sine tal. Der er ingen afbryder, der lader dem stå, mens året regner
    uden dem — det ville være to scenarier i én plan, og scenarier er
    uafhængige planer.

    Afsnittet bærer hverken periode, gentagelse eller forfald. Aftalen arver
    lønpostens og ophører derfor af sig selv ved erhvervsophør, som det
    lønkildede bidrag allerede gør, jf. ADR-0016.

    Har ejeren ingen ordning, en arbejdsgiver kan administrere, er der ingen
    destination at pege på. Afsnittet står da med sin begrundelse frem for med
    en knap, der ville skrive en plan, motoren afviser, jf. ADR-0020. */
function PensionAgreementSection({
  plan,
  entry,
  onChange,
}: {
  plan: Plan
  entry: IncomeEntry
  onChange: (plan: Plan) => void
}) {
  const agreement = entry.pensionAgreement
  const destinations = (findPerson(plan, entry.owner)?.holdings ?? []).filter(
    (holding) => !isFreeAssets(holding) && isEmployerAdministered(holding),
  )

  if (agreement === undefined) {
    return (
      <Section
        title="Pension"
        action={
          destinations.length > 0 ? (
            <button
              type="button"
              className="afsnit-tilfoej"
              title="Beskriv firmaordningen, lønnen hører til"
              onClick={() => onChange(addPensionAgreement(plan, entry.id))}
            >
              + Tilføj
            </button>
          ) : undefined
        }
      >
        <Hint>
          {destinations.length > 0
            ? 'Uden en firmaordning er lønnen bare en løn. Med den lægges arbejdsgiverens bidrag oven i, og det, der er tilbage efter arbejdsmarkedsbidraget, går ind i ordningen.'
            : 'En firmaordning kræver en ordning, en arbejdsgiver kan administrere — en ratepension, en livrente eller en aldersopsparing i lønmodtagerens eget navn. Der er ingen af dem hos ejeren af denne løn endnu.'}
        </Hint>
      </Section>
    )
  }

  return (
    <Section
      title="Pension"
      action={
        <button
          type="button"
          className="slet"
          aria-label="Fjern pension"
          title="Fjern pension — lønnen bliver stående, og aftalens tal forsvinder"
          onClick={() => onChange(removePensionAgreement(plan, entry.id))}
        >
          <TrashIcon />
        </button>
      }
    >
      <ContributionAmountField
        label="Arbejdsgiverbidrag"
        formHelp="PensionAgreement.employerContributionForm"
        percentageHelp="PensionAgreement.employerPercentage"
        amountHelp="PensionAgreement.employerAmount"
        value={agreement.employerContribution}
        onChange={(employerContribution) =>
          onChange(
            withPensionAgreement(plan, entry.id, (a) => ({ ...a, employerContribution })),
          )
        }
      />
      <ContributionAmountField
        label="Arbejdstagerbidrag"
        formHelp="PensionAgreement.employeeContributionForm"
        percentageHelp="PensionAgreement.employeePercentage"
        amountHelp="PensionAgreement.employeeAmount"
        value={agreement.employeeContribution}
        onChange={(employeeContribution) =>
          onChange(
            withPensionAgreement(plan, entry.id, (a) => ({ ...a, employeeContribution })),
          )
        }
      />
      {/* De to trækkes efter arbejdsmarkedsbidraget og før fordelingen, og
          de står derfor mellem bidragene og ordningen — rækkefølgen på
          skærmen er årets gennemløb. Der er intet felt for kurtage:
          handelsomkostningerne er depotets og ligger i beholdningens
          omkostningssats, hvor de sænker afkastet. */}
      <NumberField
        label="Gebyr"
        help="PensionAgreement.fee"
        unit="kr."
        value={agreement.fee}
        onChange={(fee) =>
          onChange(withPensionAgreement(plan, entry.id, (a) => ({ ...a, fee })))
        }
      />
      <NumberField
        label="Forsikringspræmie"
        help="PensionAgreement.insurancePremium"
        unit="kr."
        value={agreement.insurancePremium}
        onChange={(insurancePremium) =>
          onChange(
            withPensionAgreement(plan, entry.id, (a) => ({ ...a, insurancePremium })),
          )
        }
      />
      {agreement.allocation.map((line, index) => (
        <AllocationLineFields
          key={index}
          line={line}
          destinations={destinations}
          onChange={(next) =>
            onChange(withAllocationLine(plan, entry.id, index, () => next))
          }
          onRemove={
            line.form === 'Remainder'
              ? undefined
              : () => onChange(removeAllocationLine(plan, entry.id, index))
          }
        />
      ))}
      {/* Knappen står blandt felterne og ikke på overskriftslinjen: den
          lægger en linje til fordelingen og ikke et afsnit til skuffen, og
          afsnittets egen knap er den, der fjerner hele aftalen. Den udebliver,
          når ejeren ingen ordning har tilbage at pege på — samme ordning to
          gange er en plan, indgangskontrollen afviser. */}
      {agreementDestination(plan, entry.id) !== undefined && (
        <button
          type="button"
          className="afsnit-tilfoej"
          title="Del indbetalingen ud på en ordning mere"
          onClick={() => onChange(addAllocationLine(plan, entry.id))}
        >
          + Tilføj ordning
        </button>
      )}
      <Hint>
        Begge procenter måles af {entry.name} selv, ligesom de gør på
        lønsedlen. Arbejdsmarkedsbidraget trækkes af de to under ét på vejen
        ind — det opkræves ikke igen, det står allerede i årets skat.
        Fordelingens procenter måler derimod det, der er tilbage bagefter.
      </Hint>
    </Section>
  )
}

/** Én linje i fordelingen: destinationen, formen og det ene tal, formen har.

    Restlinjen har hverken en form at vælge eller en knap at fjerne den med.
    Præcis én linje er resten, og det er dét, der får fordelingen til at gå
    op i hvert eneste simuleringsår — kunne den slås fra, ville ét klik skrive
    en plan, motoren nægter at regne. Dens andel står som et udledt felt, for
    det er præcis, hvad den er: det, de øvrige linjer ikke tog. */
function AllocationLineFields({
  line,
  destinations,
  onChange,
  onRemove,
}: {
  line: AllocationLine
  destinations: Holding[]
  onChange: (line: AllocationLine) => void
  onRemove?: () => void
}) {
  const destination = destinations.find((holding) => holding.id === line.to)

  return (
    <div className="fordelingslinje">
      <SelectField
        label="Ordning"
        help="AllocationLine.to"
        value={destination?.name ?? ''}
        options={destinations.map((holding) => holding.name)}
        onChange={(name) => {
          const to = destinations.find((holding) => holding.name === name)!
          onChange(retainedOn({ ...line, to: to.id }, to))
        }}
      />
      {line.form === 'Remainder' ? (
        <LockedField label="Andel" help="AllocationShare.remainder" value="Resten" unit="" />
      ) : (
        <>
          {/* Kontakten bliver stående som sit eget felt, hvor bidragets er
              flyttet ind i enhedskolonnen: "Op til loftet" er en form og ikke
              en enhed, jf. `allocationForms`. Etiketten er skåret ind til det,
              der er plads til ved siden af tre knapper. */}
          <ToggleField
            label="Andelen er"
            help="AllocationShare.form"
            value={danish(allocationForms, line.form)}
            options={allocationFormsFor(destination)}
            onChange={(choice) => onChange(withForm(line.to, allocationForms[choice]!))}
          />
          {line.form === 'UpToCap' ? (
            <LockedField
              label="Andel"
              help="AllocationShare.upToCap"
              value="Det, der er plads til"
              unit=""
            />
          ) : line.form === 'Percentage' ? (
            <NumberField
              label="Andel"
              help="AllocationShare.percentage"
              unit="%"
              value={asPercent(line.percentage)}
              onChange={(percent) =>
                onChange({ to: line.to, form: 'Percentage', percentage: percent / 100 })
              }
            />
          ) : (
            <NumberField
              label="Andel"
              help="AllocationShare.amountInRealKroner"
              unit="kr."
              value={line.amountInRealKroner}
              onChange={(amountInRealKroner) =>
                onChange({ to: line.to, form: 'Amount', amountInRealKroner })
              }
            />
          )}
        </>
      )}
      {/* Knappen står også, når destinationen ikke findes — en linje, hvis
          beholdning er slettet under den, er netop den, planlæggeren skal
          kunne komme af med. Den kendes da ikke ved navn, for der er intet
          navn tilbage at kende den på. */}
      {onRemove && (
        <span className="fordelingslinje-handling">
          <button
            type="button"
            className="slet"
            aria-label={destination ? `Fjern ${destination.name}` : 'Fjern fordelingslinjen'}
            title={
              destination
                ? `Tag ${destination.name} ud af fordelingen`
                : 'Tag linjen ud af fordelingen'
            }
            onClick={onRemove}
          >
            <TrashIcon />
          </button>
        </span>
      )}
    </div>
  )
}

/** En fordelingslinje på den valgte form, med det tal formen har — og uden et,
    når den ingen har. Skiftet nulstiller tallet med vilje: de to former måler
    hver sit grundlag, og et tal, der fulgte med over, ville sige noget helt
    andet, end det gjorde før. */
function withForm(
  to: HoldingId,
  form: 'Percentage' | 'Amount' | 'UpToCap',
): AllocationLine {
  switch (form) {
    case 'Percentage':
      return { to, form: 'Percentage', percentage: 0 }
    case 'Amount':
      return { to, form: 'Amount', amountInRealKroner: 0 }
    case 'UpToCap':
      return { to, form: 'UpToCap' }
  }
}

/** Linjen, som den kan stå på sin nye destination. En linje op til loftet
    falder tilbage til en procent på nul, når destinationen skiftes til en
    ordning uden loft: formen kræver et loft at måle sig mod, og ét klik må
    ikke skrive en plan, indgangskontrollen afviser, jf. ADR-0020. Procenten
    er den ene form, der ikke kan komme til at bede om et beløb, aftalen ikke
    har — samme valg som en ny linjes. */
function retainedOn(line: AllocationLine, destination: Holding): AllocationLine {
  return line.form === 'UpToCap' && cappedVariant(destination) === undefined
    ? withForm(line.to, 'Percentage')
    : line
}

/** Et bidrag på pensionsaftalen: ét felt med sit tal, hvor enheden er valget
    mellem de to former. Begge former står synlige — en vælger ville skjule
    den ene bag et klik, og der er kun to — men de er ikke et spørgsmål for
    sig: formen *er* enheden, og kontakten står derfor, hvor "%" ellers stod,
    jf. `UnitToggle`. Samme kontakt som indbetalingens.

    De to bidrag stiller det samme spørgsmål og ville drive fra hinanden,
    hvis de blev skrevet to gange — men de er hver sit felt på skærmen og
    bærer derfor hver sine forklaringer, som kalderen rækker ind. */
function ContributionAmountField({
  label,
  formHelp,
  percentageHelp,
  amountHelp,
  value,
  onChange,
}: {
  label: string
  formHelp: FieldHelpKey
  percentageHelp: FieldHelpKey
  amountHelp: FieldHelpKey
  value: ContributionAmount
  onChange: (value: ContributionAmount) => void
}) {
  const isPercentage = 'percentageOfEntry' in value
  const unit = (
    <UnitToggle
      help={formHelp}
      value={danish(contributionAmounts, isPercentage ? 'percentageOfEntry' : 'amountInRealKroner')}
      options={Object.keys(contributionAmounts)}
      onChange={(choice) =>
        onChange(
          contributionAmounts[choice] === 'percentageOfEntry'
            ? { percentageOfEntry: 0 }
            : { amountInRealKroner: 0 },
        )
      }
    />
  )

  return isPercentage ? (
    <NumberField
      label={label}
      help={percentageHelp}
      unit={unit}
      value={asPercent(value.percentageOfEntry)}
      onChange={(percent) => onChange({ percentageOfEntry: percent / 100 })}
    />
  ) : (
    <NumberField
      label={label}
      help={amountHelp}
      unit={unit}
      value={value.amountInRealKroner}
      onChange={(amountInRealKroner) => onChange({ amountInRealKroner })}
    />
  )
}

/** Trioen enhver periodisk pengestrøm bærer: periode, gentagelse og forfald.
    Posten og det beholdningskildede bidrag har den med den samme betydning,
    og reglerne imellem dem er små nok til at drive fra hinanden, hvis de
    skrives to gange — `Én gang` bytter både endepunktsfeltet og forfaldets
    muligheder ud, og et aldersendepunkt har sit eget felt med sin egen
    henvisning til erhvervsophøret.

    `children` er de felter, der hører til netop denne figurs periode og
    ingen andens: postens reguleringssats og dens note. */
type Periodic = { period: Period; recurrence: Recurrence; timing: Timing }

/** Begge endepunkters grænser for én figur. Slået op ét sted, så de tre
    ruder ikke gør det hver for sig — og regnet i motoren, så feltet, håndtaget
    og afvisningen ikke kan komme til at sige hver sit, jf. ADR-0045. */
function endpointBounds(plan: Plan, figure: PeriodicFigure): { from: Bounds; to: Bounds } {
  return {
    from: periodEndpointBounds(plan, figure, 'from'),
    to: periodEndpointBounds(plan, figure, 'to'),
  }
}

/** Et endepunkts grænser, som om et navnevalg der endnu ikke er truffet,
    allerede stod der — til `PersonAgeBoundField`s personvælger, jf.
    `periodEndpointBounds`s `candidate`. `endpointBounds` ovenfor svarer kun
    for figurens *nuværende* endepunkt og kan derfor ikke bruges til at
    afgøre, om et skift til en anden navngiven person holder — to personer
    med forskelligt fødselsår deler ikke én aldersskala. */
function endpointBoundsForCandidate(
  plan: Plan,
  figure: PeriodicFigure,
): (endpoint: 'from' | 'to', candidate: PersonAgeBound) => Bounds {
  return (endpoint, candidate) => periodEndpointBounds(plan, figure, endpoint, candidate)
}

function PeriodSection({
  value,
  owner,
  persons,
  startYear,
  bounds,
  boundsForCandidate,
  clamp,
  onClamp,
  onChange,
  children,
}: {
  value: Periodic
  /** Personen, et fast aldersendepunkt måles fra. */
  owner: Person
  /** Husstandens personer, til "Følger erhvervsophør"s personvælger — se
      `PersonAgeBoundField`. */
  persons: Person[]
  /** Året et `Én gang`-felt falder tilbage på, når intet endepunkt er sat. */
  startYear: number
  /** De to endepunkters grænser, slået op af den figur, perioden hænger på —
      afsnittet regner dem ikke selv, for reglerne er figurens og ikke
      periodens. Udeladt betyder frie endepunkter. Se `Bounds`. */
  bounds?: { from?: Bounds; to?: Bounds }
  /** Samme grænser, men for et navnevalg der endnu ikke er truffet — til
      `PersonAgeBoundField`s personvælger. Se `endpointBoundsForCandidate`. */
  boundsForCandidate?: (endpoint: 'from' | 'to', candidate: PersonAgeBound) => Bounds
  clamp?: Clamp | null
  onClamp?: (clamp: Clamp | null) => void
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
              ? {
                  recurrence: defaultRecurrence(kind),
                  timing: timingForOnce(timing),
                  period:
                    period.anchor === 'CalendarYear'
                      ? { anchor: 'CalendarYear', from: period.from ?? period.to ?? startYear }
                      : period,
                }
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
        clamp={clamp}
        onChange={(choice) => change({ period: defaultPeriod(anchors[choice]!, recurrence, startYear) })}
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
          <PersonAgeBoundField
            label="Alder"
            help="Period.once"
            owner={owner}
            persons={persons}
            role="from"
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
            bounds={bounds?.from}
            clamp={clamp}
            onClamp={onClamp}
            onChange={(from) => change({ period: { ...period, from } })}
          />
          <OptionalNumberField
            label="Til (år)"
            help="Period.to"
            unit="år"
            value={period.to}
            bounds={bounds?.to}
            clamp={clamp}
            onClamp={onClamp}
            onChange={(to) => change({ period: { ...period, to } })}
          />
        </>
      ) : (
        <>
          <PersonAgeBoundField
            label="Fra (alder)"
            help="Period.from"
            owner={owner}
            persons={persons}
            role="from"
            value={period.from}
            bounds={bounds?.from}
            boundsForCandidate={
              boundsForCandidate && ((candidate) => boundsForCandidate('from', candidate))
            }
            clamp={clamp}
            onClamp={onClamp}
            onChange={(from) => change({ period: { ...period, from } })}
          />
          <PersonAgeBoundField
            label="Til (alder)"
            help="Period.to"
            owner={owner}
            persons={persons}
            role="to"
            value={period.to}
            bounds={bounds?.to}
            boundsForCandidate={
              boundsForCandidate && ((candidate) => boundsForCandidate('to', candidate))
            }
            clamp={clamp}
            onClamp={onClamp}
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
    horisonten — undtagen for `Én gang` med kalenderårsforankring, hvor et åbent
    år aldrig falder, jf. `matchesRecurrence`. Dér skal et konkret år stå i
    periodens data med det samme, ikke kun vises som et faldback i feltet. */
function defaultPeriod(anchor: Anchor, recurrence: Recurrence, startYear: number): Period {
  if (recurrence.kind === 'Once' && anchor === 'CalendarYear') return { anchor, from: startYear }
  return { anchor }
}

function defaultRecurrence(kind: Recurrence['kind']): Recurrence {
  return kind === 'EveryNYears' ? { kind, n: 2 } : { kind }
}

/** Indbetalingens rude — den lønkildede udgave alene. Den beholdningskildede
    hører til den sammenlagte Overførsel-sektion og tegnes af `TransferFields`
    i stedet, jf. ADR-0047: kilden er her altid en lønpost, og periode,
    forankring, gentagelse og forfald står derfor slet ikke her — hverken som
    felter eller som grå felter — men som én linje, der siger, hvad bidraget
    følger.

    Fradragsretten og loftet står ikke her, men af en anden grund: de følger
    destinationens variant og er ikke noget, brugeren svarer på, jf.
    ADR-0016. */
function ContributionFields({
  plan,
  years,
  id,
  onChange,
  onClose,
}: FieldsProps & { id: string; years: YearResult[] } & ClampProps) {
  const contribution = findContribution(plan, id)
  if (!contribution || contribution.kind !== 'EntrySourced') return null

  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const holdingName = (holdingId: string) =>
    holdings.find((holding) => holding.id === holdingId)?.name ?? holdingId

  const sourceEntry = findEntry(plan, contribution.source)
  // En firmaordning står i lønmodtagerens eget navn, jf. ADR-0028 — ejeren,
  // "Til"s liste og aldersforankringen hænger derfor alle på kildens ejer.
  const owner = plan.household.persons.find((person) => person.id === sourceEntry?.owner)
  if (!owner) return null

  const named = (name: string, person: string) => `${name} · ${person}`
  const personById = (personId: string) =>
    plan.household.persons.find((person) => person.id === personId)
  // Destinationen skal kunne administreres af en arbejdsgiver — ellers ville
  // ét klik skrive en plan, `validatePlan` afviser, jf. ADR-0020. Ligger den
  // nuværende destination allerede hos den nye ejer, bliver den stående;
  // ellers findes ejerens første arbejdsgiveradministrerede ordning. Er der
  // ingen, er der intet at flytte til — og lønposten tilbydes ikke.
  const employerDestinationUnder = (person: Person | undefined) => {
    if (person?.holdings.some((holding) => holding.id === contribution.to)) return contribution.to
    return person?.holdings.find(
      (holding) => !isFreeAssets(holding) && isEmployerAdministered(holding),
    )?.id
  }
  const entrySources = plan.entries.filter(
    (entry) =>
      entry.direction === 'Income' &&
      employerDestinationUnder(personById(entry.owner)) !== undefined,
  )
  const entryLabel = (entry: Entry) =>
    named(
      entry.name,
      plan.household.persons.find((person) => person.id === entry.owner)?.name ?? entry.owner,
    )

  // Destinationen er ejerens egne ordninger, en arbejdsgiver kan
  // administrere — aktiesparekontoen og en anden persons ordning står
  // derfor aldrig her, jf. ADR-0028. Feltet skal vise planens egen
  // destination, også når den ligger uden for listen, så en ulovlig
  // destination i en importeret plan vises med sit navn og ikke forsvinder.
  const destination = holdings.find((holding) => holding.id === contribution.to)
  const destinations = owner.holdings.filter(
    (holding) => !isFreeAssets(holding) && isEmployerAdministered(holding),
  )
  const destinationOptions =
    destination && !destinations.some((holding) => holding.name === destination.name)
      ? [destination, ...destinations]
      : destinations
  // Beløbsformen er feltets enhed og ikke et spørgsmål ved siden af det, jf.
  // `UnitToggle`. Den bygges her, fordi begge grene af beløbsfeltet rækker
  // den samme kontakt ind — kun tallet og dets forklaring skifter med formen.
  const amountForm = (
    <UnitToggle
      help="Contribution.amountForm"
      value={danish(
        contributionAmounts,
        'percentageOfEntry' in contribution ? 'percentageOfEntry' : 'amountInRealKroner',
      )}
      options={Object.keys(contributionAmounts)}
      onChange={(choice) =>
        onChange(withContribution(plan, id, (c) => withAmountForm(c, contributionAmounts[choice]!)))
      }
    />
  )
  return (
    <>
      <Head
        title={contribution.name}
        subtitle="Indbetaling"
        onDelete={() => {
          onChange(removeContribution(plan, id))
          onClose()
        }}
        deleteLabel="Fjern indbetaling"
      />
      <Section title="Indbetalingen">
        <TextField
          label="Navn"
          help="Contribution.name"
          value={contribution.name}
          onChange={(name) => onChange(withContribution(plan, id, (c) => ({ ...c, name })))}
        />
        <SelectField
          label="Fra"
          help="Contribution.source"
          value={sourceEntry ? entryLabel(sourceEntry) : contribution.source}
          options={entrySources.map(entryLabel)}
          onChange={(choice) => {
            const entry = entrySources.find((source) => entryLabel(source) === choice)!
            onChange(
              withContribution(plan, id, (c) =>
                c.kind === 'EntrySourced'
                  ? { ...c, source: entry.id, to: employerDestinationUnder(personById(entry.owner))! }
                  : c,
              ),
            )
          }}
        />
        <SelectField
          label="Til"
          help="Contribution.to"
          value={holdingName(contribution.to)}
          options={destinationOptions.map((holding) => holding.name)}
          onChange={(name) => {
            const to = destinationOptions.find((holding) => holding.name === name)!
            onChange(withContribution(plan, id, (c) => ({ ...c, to: to.id })))
          }}
        />
        <Hint>
          {sourceEntry?.direction === 'Income' && sourceEntry.taxTreatment === 'EarnedIncome'
            ? 'Kilden er en AM-pligtig post, så AM-bidraget trækkes på vejen ind — der lander 92 % i beholdningen.'
            : 'Kilden har aldrig båret AM-bidrag, så hele beløbet går ind.'}{' '}
          Det følger kilden og tastes ikke.
        </Hint>
      </Section>
      <Section title="Beløb">
        {/* Begge former står synlige: en vælger ville skjule den ene bag et
            klik, og der er kun to. De er ikke et spørgsmål for sig — formen
            *er* feltets enhed, jf. `UnitToggle`. */}
        {'percentageOfEntry' in contribution ? (
          <NumberField
            label="Beløb"
            help="Contribution.percentageOfEntry"
            unit={amountForm}
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
            label="Beløb"
            help="Contribution.amountInRealKroner"
            unit={amountForm}
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
            Måles af {sourceEntry.name}, så bidraget følger lønnen op uden at blive rettet.
          </Hint>
        )}
      </Section>
      {sourceEntry && (
        <section className="afsnit arvet">
          <h3>Følger {sourceEntry.name}</h3>
          <div className="arvelinje">{inheritedLine(years, sourceEntry)}</div>
          <Hint>
            Periode, forankring, gentagelse og forfald hører til posten. Bidraget har
            dem ikke selv og ophører derfor af sig selv ved erhvervsophøret.
          </Hint>
        </section>
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

/** Skifter beløbsangivelsens form på et lønkildet bidrag. De to former er
    hvert sit felt og ikke to værdier i ét, så skiftet bygger et nyt bidrag
    frem for at sætte et felt — som `withForm` gør for en fordelingslinje.
    Det gamle tal huskes ikke: det findes ikke at huske på, og en procent og
    et kronebeløb er alligevel ikke hinandens omregning. */
function withAmountForm(
  contribution: Contribution,
  field: 'percentageOfEntry' | 'amountInRealKroner',
): Contribution {
  if (contribution.kind !== 'EntrySourced') return contribution
  const { id, name, kind, source, to } = contribution
  return field === 'percentageOfEntry'
    ? { id, name, kind, source, to, percentageOfEntry: 0 }
    : { id, name, kind, source, to, amountInRealKroner: 0 }
}

/** Den sammenlagte Overførsel-rude. Skuffen kender kun kilden, jf. ADR-0047:
    figuren, brugeren redigerer, er enten en `Transfer` eller et
    beholdningskildet bidrag, og hvilken af de to det bliver, afgør sig alene
    af "Til" — vælges en ordning, bliver figuren et bidrag; vælges frie
    midler, bliver den en overførsel. Skiftet er `withTransferOrContributionEnd`s
    arbejde og usynligt for brugeren; ordet på skærmen ("Overførsel"/
    "Udbetaling") følger som hidtil alene "Fra"-beholdningen og ikke denne
    klassificering — det ord bliver aldrig "Indbetaling" her.

    Den lønkildede indbetaling er ikke en del af sammenlægningen og tegnes
    fortsat af `ContributionFields`. */
function TransferFields({
  plan,
  id,
  clamp,
  onClamp,
  onChange,
  onClose,
}: FieldsProps & { id: string; clamp: Clamp | null; onClamp: (clamp: Clamp | null) => void }) {
  const transfer = findTransfer(plan, id)
  const holdingContribution = transfer ? undefined : findContribution(plan, id)
  const contribution =
    holdingContribution?.kind === 'HoldingSourced' ? holdingContribution : undefined
  const figure = transfer ?? contribution
  if (!figure) return null
  const isContribution = contribution !== undefined

  const fromId = isContribution ? contribution.source : transfer!.from
  const toId = figure.to
  const fromOwner = findHoldingOwner(plan, fromId)
  const toOwner = findHoldingOwner(plan, toId)
  // Ejeren, perioden forankrer sig på, er afgiverens for en overførsel og
  // destinationens for et beholdningskildet bidrag, jf. ADR-0028 — det er
  // derfor kun den sidste, der kan krydse ejerskellet mellem "Fra" og "Til".
  const anchorOwner = isContribution ? toOwner : fromOwner
  if (!anchorOwner) return null

  const holdings = plan.household.persons.flatMap((person) => person.holdings)
  const holdingName = (holdingId: string) =>
    holdings.find((holding) => holding.id === holdingId)?.name ?? holdingId
  const from = holdings.find((holding) => holding.id === fromId)
  const fromIsFreeAssets = from ? isFreeAssets(from) : false

  // "Fra" er den brede liste, en overførsel altid har haft — også de låste
  // ordninger, der netop tømmes ad denne vej, jf. ADR-0022 — men kun så
  // længe figuren står som en overførsel. Er den et beholdningskildet
  // bidrag, skal kilden altid være frie midler, og listen indskrænkes
  // dertil, så et valg her aldrig kan bede om et bidrag, motoren afviser.
  const fromOptions = isContribution ? holdings.filter(isFreeAssets) : transferEndOptions(plan, 'from')
  // "Til" har to grupper: frie midler, som gør figuren til en overførsel
  // (eller en udbetaling), og ordninger, som gør den til et bidrag. Sidste
  // gruppe udelades helt, når "Fra" er en låst ordning — dér er destinationen
  // altid frie midler, og der er intet at vælge fra, jf. ADR-0047.
  const freeDestinations = transferEndOptions(plan, 'to')
  const schemeDestinations = fromIsFreeAssets
    ? holdings.filter((holding) => !isFreeAssets(holding) && isOpenToContributions(holding))
    : []
  const holdingByName: Record<string, string> = Object.fromEntries(
    [...fromOptions, ...freeDestinations, ...schemeDestinations].map((holding) => [
      holding.name,
      holding.id,
    ]),
  )

  /** Vælger den ene ende og lader figuren skifte klassificering usynligt.
      Løftet af starten, valget kan medføre, taler gennem den samme kanal som
      feltet og håndtaget — det var tavst indtil ADR-0045. */
  function chooseEnd(end: 'from' | 'to', holding: string) {
    const chosen = withTransferOrContributionEnd(plan, id, end, holding)
    onChange(chosen.plan)
    onClamp(chosen.clamp)
  }

  // Fladen låner ordet "udbetaling", når pengene forlader en ordning — det
  // er det, den er i virkeligheden, jf. ADR-0022 — men ordet er alene
  // "Fra"-beholdningens: klassificeringen mellem overførsel og bidrag har
  // intet at sige om det, og ordet bliver aldrig "Indbetaling" her, jf.
  // ADR-0047.
  const label =
    from && !isFreeAssets(from)
      ? { slags: 'Udbetaling', bestemt: 'Udbetalingen', fjern: 'Fjern udbetaling' }
      : { slags: 'Overførsel', bestemt: 'Overførslen', fjern: 'Fjern overførsel' }

  return (
    <>
      <Head
        title={figure.name}
        subtitle={label.slags}
        onDelete={() => {
          onChange(isContribution ? removeContribution(plan, id) : removeTransfer(plan, id))
          onClose()
        }}
        deleteLabel={label.fjern}
      />
      <Section title={label.bestemt}>
        <TextField
          label="Navn"
          help={isContribution ? 'Contribution.name' : 'Transfer.name'}
          value={figure.name}
          onChange={(name) =>
            onChange(
              isContribution
                ? withContribution(plan, id, (c) => ({ ...c, name }))
                : withTransfer(plan, id, (t) => ({ ...t, name })),
            )
          }
        />
        {/* Står den beholdning, der allerede er den anden ende, i listen, og
            kan de to bytte plads lovligt, gør de det — se `withTransferEnd`,
            som `withTransferOrContributionEnd` viderefører uændret, når
            figuren bliver ved med at være en overførsel. */}
        <SelectField
          label="Fra"
          help="Transfer.from"
          value={holdingName(fromId)}
          options={fromOptions.map((holding) => holding.name)}
          onChange={(name) => chooseEnd('from', holdingByName[name]!)}
        />
        <SelectField
          label="Til"
          help={isContribution ? 'Contribution.to' : 'Transfer.to'}
          value={holdingName(toId)}
          options={[
            { label: 'Frie midler', options: freeDestinations.map((holding) => holding.name) },
            { label: 'Ordninger', options: schemeDestinations.map((holding) => holding.name) },
            // En tom gruppe udelades: en overskrift uden noget under sig
            // ligner en liste, der mangler at blive fyldt.
          ].filter((group) => group.options.length > 0)}
          onChange={(name) => chooseEnd('to', holdingByName[name]!)}
        />
        <NumberField
          label="Beløb"
          help={isContribution ? 'Contribution.amountInRealKroner' : 'Transfer.amountInRealKroner'}
          unit="kr."
          value={figure.amountInRealKroner}
          onChange={(amountInRealKroner) =>
            onChange(
              isContribution
                ? withContribution(plan, id, (c) => ({ ...c, amountInRealKroner }))
                : withTransfer(plan, id, (t) => ({ ...t, amountInRealKroner })),
            )
          }
        />
        {/* Denne plans tal og ikke feltets — en Hint og ikke en forklaring,
            jf. ADR-0021. Afgiften rammer kun en kapitalpension, og den kan
            aldrig være destination for et bidrag — figuren er derfor altid
            en overførsel her. Beløbet er det ubeskårne: rækker ordningens
            saldo ikke til det ønskede, afkortes det først, og forklar-året
            viser det faktiske. */}
        {!isContribution && from && payoutTaxation(from) === 'Chargeable' && (
          <Hint>
            Kapitalpensionens afgift trækkes fra på vejen ud. Af{' '}
            {kroner(figure.amountInRealKroner)} kr. lander{' '}
            {kroner(
              figure.amountInRealKroner -
                transferCharge(from, figure.amountInRealKroner, latestRateYear()),
            )}{' '}
            kr. i de frie midler.
          </Hint>
        )}
      </Section>
      <PeriodSection
        value={figure}
        owner={anchorOwner}
        persons={plan.household.persons}
        startYear={plan.startYear}
        bounds={endpointBounds(plan, figure)}
        boundsForCandidate={endpointBoundsForCandidate(plan, figure)}
        clamp={clamp}
        onClamp={onClamp}
        onChange={(next) => {
          const updated = isContribution
            ? withContribution(plan, id, (c) => ({ ...c, ...next }))
            : withTransfer(plan, id, (t) => ({ ...t, ...next }))
          // Fanger kun det tilfælde, hvor forankringen selv lige blev valgt
          // til `PersonAge` med forskellig ejer på "Fra" og "Til" — "Fra" og
          // "Til" ændres ikke her, kun perioden, så guarden rammer aldrig et
          // klemt talfelts egen besked, jf. `guardTransferOrContributionAnchor`.
          const guarded = guardTransferOrContributionAnchor(updated, id)
          onChange(guarded.plan)
          if (guarded.clamp) onClamp(guarded.clamp)
        }}
      >
        <Hint>
          {isContribution ? (
            <>
              Et aldersforankret bidrag måles på {anchorOwner.name}, som ejer den ordning,
              pengene lander i.
            </>
          ) : (
            <>
              En aldersforankret overførsel måles på {anchorOwner.name}, som ejer
              den beholdning, pengene tages fra — så en tømning flytter sig med
              erhvervsophøret.
              {from && isPensionScheme(from) && (
                <> Ordningen må tidligst udbetales i {payoutYear(from, anchorOwner)}.</>
              )}
            </>
          )}
        </Hint>
      </PeriodSection>
    </>
  )
}

function Head({
  title,
  subtitle,
  onDelete,
  deleteLabel,
  deleteHint,
}: {
  title: string
  subtitle: string
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
        {onDelete && (
          <span className="handlinger">
            <button
              type="button"
              className="slet"
              aria-label={deleteLabel}
              title={deleteHint ? `${deleteLabel} — ${deleteHint}` : deleteLabel}
              onClick={onDelete}
            >
              <TrashIcon />
            </button>
          </span>
        )}
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
