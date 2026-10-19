/* LB-01 · Policy and circulation rules: the Policy tab (settings form) */
import { useEffect, useMemo, useRef, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/common/auth";
import { useForm } from "@/common/hooks";
import { Badge, Button, Card, ErrorState, Field, FormActions, RadioGroup, Switch, TextInput, useToast } from "@/common/ui";
import { relativeTime } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import type { FineDayBasis, LibraryPolicy } from "../../shared/api/types";
import { LibraryIntro } from "../../shared/components/LibraryBits";
import { isMoney, isWhole } from "../../shared/utils/labels";
import { usePolicy, useUpdatePolicy, type PolicyChanges } from "../api/policy";

type Values = {
  blockOnFines: boolean;
  fineBlockThreshold: string;
  blockOnOverdue: boolean;
  fineDayBasis: FineDayBasis;
  capFineAtPrice: boolean;
  lostProcessingFee: string;
  lostMinimumCharge: string;
  lostIncludesLateFine: boolean;
  lostFoundRefundDays: string;
  holdPickupDays: string;
  maxHoldsPerBorrower: string;
  dueSoonDays: string;
  overdueReminderEveryDays: string;
  notifyParents: boolean;
};

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

const toValues = (p: LibraryPolicy): Values => ({
  blockOnFines: p.blockOnFines,
  fineBlockThreshold: str(p.fineBlockThreshold),
  blockOnOverdue: p.blockOnOverdue,
  fineDayBasis: p.fineDayBasis,
  capFineAtPrice: p.capFineAtPrice,
  lostProcessingFee: str(p.lostProcessingFee),
  lostMinimumCharge: str(p.lostMinimumCharge),
  lostIncludesLateFine: p.lostIncludesLateFine,
  lostFoundRefundDays: str(p.lostFoundRefundDays),
  holdPickupDays: str(p.holdPickupDays),
  maxHoldsPerBorrower: str(p.maxHoldsPerBorrower),
  dueSoonDays: str(p.dueSoonDays),
  overdueReminderEveryDays: str(p.overdueReminderEveryDays),
  notifyParents: p.notifyParents
});

/* Whole-day fields and their limits (the API's) */
const DAY_FIELDS = {
  lostFoundRefundDays: [0, 365],
  holdPickupDays: [1, 30],
  maxHoldsPerBorrower: [0, 50],
  dueSoonDays: [0, 30],
  overdueReminderEveryDays: [1, 90]
} as const;
const MONEY_FIELDS = ["lostProcessingFee", "lostMinimumCharge"] as const;
const MAX_MONEY = 100_000;

/* Shown (disabled) until the policy arrives: the same form, so nothing moves */
const LOADING: Values = {
  blockOnFines: true,
  fineBlockThreshold: "",
  blockOnOverdue: true,
  fineDayBasis: "ACADEMIC_DAYS",
  capFineAtPrice: true,
  lostProcessingFee: "",
  lostMinimumCharge: "",
  lostIncludesLateFine: true,
  lostFoundRefundDays: "",
  holdPickupDays: "",
  maxHoldsPerBorrower: "",
  dueSoonDays: "",
  overdueReminderEveryDays: "",
  notifyParents: true
};

/* The changed fields, typed for the API ("" threshold: no limit) */
function patchOf(before: Values, now: Values): PolicyChanges {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(now) as (keyof Values)[]) {
    if (now[key] === before[key]) continue;
    const v = now[key];
    if (typeof v === "boolean" || key === "fineDayBasis") out[key] = v;
    else if (key === "fineBlockThreshold") out[key] = (v as string).trim() === "" ? null : Number(v);
    else out[key] = Number(v);
  }
  return out as PolicyChanges;
}

function validate(v: Values) {
  const e: Record<string, string> = {};
  for (const [key, [min, max]] of Object.entries(DAY_FIELDS) as [keyof typeof DAY_FIELDS, readonly [number, number]][]) {
    const raw = v[key];
    if (!isWhole(raw) || Number(raw) < min || Number(raw) > max) e[key] = `must be a whole number from ${min} to ${max}`;
  }
  for (const key of MONEY_FIELDS)
    if (!isMoney(v[key]) || Number(v[key]) > MAX_MONEY) e[key] = `must be an amount up to ${MAX_MONEY.toLocaleString()} (2 decimals at most)`;
  if (v.fineBlockThreshold.trim() !== "" && (!isMoney(v.fineBlockThreshold) || Number(v.fineBlockThreshold) > MAX_MONEY))
    e.fineBlockThreshold = `must be an amount up to ${MAX_MONEY.toLocaleString()}, or blank for no limit`;
  return e;
}

/* A switch with a line of explanation under it, in the form's grid */
function SwitchField({ label, hint, checked, onChange, disabled }: { label: string; hint: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <Field hint={hint}>
      <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </Field>
  );
}

export default function PolicyPage() {
  const { can } = useAuth();
  const canEdit = can("library.policy.manage");
  const policy = usePolicy();
  const p = policy.data;

  return (
    <div className="stack">
      <LibraryIntro>
        {canEdit
          ? `How borrowing, fines, lost books, holds and reminders work${p ? ` · last updated ${relativeTime(p.updatedAt)}` : ""}`
          : "How borrowing, fines, lost books, holds and reminders work. Only the library's owner can change it."}
      </LibraryIntro>
      {policy.error ? <ErrorState error={policy.error} onRetry={() => void policy.refetch()} /> : <PolicyForm policy={p} canEdit={canEdit} />}
    </div>
  );
}

function PolicyForm({ policy, canEdit }: { policy: LibraryPolicy | undefined; canEdit: boolean }) {
  const toast = useToast();
  const currency = useSchoolCurrency();
  const update = useUpdatePolicy();
  const original = useMemo(() => (policy ? toValues(policy) : LOADING), [policy]);
  const form = useForm<Values>(original);
  const { values, errors } = form;

  /* A newer policy (a save, a refetch): adopt it unless there are unsaved edits */
  const previous = useRef(original);
  useEffect(() => {
    if (Object.keys(patchOf(previous.current, form.values)).length === 0) form.reset(original);
    previous.current = original;
  }, [original]); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = patchOf(original, values);
  const dirty = Object.keys(changes).length > 0;
  const disabled = !canEdit || !policy || update.isPending;
  const thresholdMissing = !!policy?.setupNeeded.includes("fineBlockThreshold");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    const errs = validate(values);
    form.setErrors(errs);
    if (Object.keys(errs).length) {
      form.setFormError("Please correct the highlighted fields.");
      return;
    }
    form.setFormError(null);
    update.mutate(changes, {
      onSuccess: res => toast.success(res.message),
      onError: err => form.setServerErrors(err)
    });
  };

  const num = (key: keyof Values) => ({ ...form.text(key), disabled, inputMode: "numeric" as const });
  const flag = (key: "blockOnFines" | "blockOnOverdue" | "capFineAtPrice" | "lostIncludesLateFine" | "notifyParents") => ({
    checked: values[key],
    onChange: (v: boolean) => form.set(key, v),
    disabled
  });

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Card
        title="Borrowing blocks"
        subtitle="When a borrower can't take more books until they settle up"
        actions={thresholdMissing && <Badge tone="warning">Fine limit not set</Badge>}
      >
        <div className="form-grid">
          <SwitchField label="Block for unpaid fines" hint="Fines above the limit stop new loans" {...flag("blockOnFines")} />
          <TextInput
            label={`Fine limit (${currency})`}
            inputMode="decimal"
            placeholder="No limit"
            {...form.text("fineBlockThreshold")}
            disabled={disabled || !values.blockOnFines}
            hint={
              !values.blockOnFines ? (
                "Fines don't block borrowing"
              ) : values.fineBlockThreshold.trim() === "" ? (
                <span className="text-warning">Fines do not block borrowing until you set a fine limit</span>
              ) : (
                "Borrowing stops when unpaid fines go above this"
              )
            }
          />
          <SwitchField label="Block for overdue books" hint="A borrower with an overdue book returns it first" {...flag("blockOnOverdue")} />
        </div>
      </Card>

      <Card title="Late fines" subtitle="The amount per day is set in each circulation rule">
        <div className="stack">
          <Field label="Days that count" hint="Changes only the fine days counted from now on">
            <RadioGroup<FineDayBasis>
              aria-label="Days that count"
              value={values.fineDayBasis}
              onChange={v => form.set("fineDayBasis", v)}
              disabled={disabled}
              options={[
                {
                  value: "ACADEMIC_DAYS",
                  label: "School days",
                  description: "Only working days: no weekly off days, holidays, vacations or library closures"
                },
                { value: "CALENDAR_DAYS", label: "Every day", description: "Every calendar day, except library closures" }
              ]}
            />
          </Field>
          <SwitchField label="Never more than the book's price" hint="A late fine stops growing at the copy's price" {...flag("capFineAtPrice")} />
        </div>
      </Card>

      <Card title="Lost books" subtitle="Charge: the copy's price plus the processing fee, and at least the minimum">
        <div className="form-grid">
          <TextInput label={`Processing fee (${currency})`} {...num("lostProcessingFee")} inputMode="decimal" error={errors.lostProcessingFee} />
          <TextInput label={`Minimum charge (${currency})`} {...num("lostMinimumCharge")} inputMode="decimal" error={errors.lostMinimumCharge} />
          <SwitchField label="Add the late fine too" hint="The late fine so far is added to the lost-book charge" {...flag("lostIncludesLateFine")} />
          <TextInput
            label="Refund if found within (days)"
            {...num("lostFoundRefundDays")}
            hint="A lost book brought back in time has its charge reversed. 0: never"
            error={errors.lostFoundRefundDays}
          />
        </div>
      </Card>

      <Card title="Holds" subtitle="Reserving a book that is out">
        <div className="form-grid">
          <TextInput label="Days to collect" {...num("holdPickupDays")} hint="A ready hold waits this long at the desk (1 to 30)" error={errors.holdPickupDays} />
          <TextInput
            label="Holds per borrower"
            {...num("maxHoldsPerBorrower")}
            hint="How many titles one reader may reserve at once. 0: no holds"
            error={errors.maxHoldsPerBorrower}
          />
        </div>
      </Card>

      <Card title="Reminders" subtitle="Sent by the school each morning">
        <div className="form-grid">
          <TextInput label="Due-soon reminder (days before)" {...num("dueSoonDays")} hint="0: no due-soon reminder" error={errors.dueSoonDays} />
          <TextInput
            label="Overdue reminder every (days)"
            {...num("overdueReminderEveryDays")}
            hint="On the first late day, then every this many days"
            error={errors.overdueReminderEveryDays}
          />
          <SwitchField label="Tell parents too" hint="Parents of student borrowers hear about overdue books and fines" {...flag("notifyParents")} />
        </div>
      </Card>

      {canEdit && (
        <FormActions error={form.formError}>
          <Button onClick={() => form.reset(original)} disabled={!dirty || update.isPending}>
            Discard changes
          </Button>
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
            Save changes
          </Button>
        </FormActions>
      )}
    </form>
  );
}
