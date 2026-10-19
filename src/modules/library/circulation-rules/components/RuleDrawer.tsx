import { useEffect, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Select, TextInput, roleLabel, useConfirm, useToast } from "@/common/ui";
import { useSchoolCurrency } from "@/modules/users/shared";
import type { CirculationRule, LoanableItemType } from "../../shared/api/types";
import { useClassOptions, useMoney } from "../../shared/hooks/useLibraryLookups";
import { BORROWER_ROLES, ITEM_TYPE_LABELS, LOANABLE_ITEM_TYPES, isMoney, isWhole, plural } from "../../shared/utils/labels";
import { useCreateRule, useDeleteRule, useUpdateRule, type RuleInput } from "../api/rules";

type Values = {
  borrowerRole: string;
  classId: string;
  itemType: string;
  loanDays: string;
  maxLoans: string;
  maxRenewals: string;
  finePerDay: string;
  fineGraceDays: string;
  maxFine: string;
};

const EMPTY: Values = { borrowerRole: "", classId: "", itemType: "", loanDays: "14", maxLoans: "2", maxRenewals: "1", finePerDay: "0", fineGraceDays: "0", maxFine: "" };

const toValues = (r: CirculationRule): Values => ({
  borrowerRole: r.borrowerRole ?? "",
  classId: r.classId ?? "",
  itemType: r.itemType ?? "",
  loanDays: String(r.loanDays),
  maxLoans: String(r.maxLoans),
  maxRenewals: String(r.maxRenewals),
  finePerDay: String(r.finePerDay),
  fineGraceDays: String(r.fineGraceDays),
  maxFine: r.maxFine === null ? "" : String(r.maxFine)
});

const toInput = (v: Values): RuleInput => ({
  borrowerRole: v.borrowerRole || null,
  classId: v.borrowerRole === "STUDENT" && v.classId ? v.classId : null,
  itemType: (v.itemType || null) as LoanableItemType | null,
  loanDays: Number(v.loanDays),
  maxLoans: Number(v.maxLoans),
  maxRenewals: Number(v.maxRenewals),
  finePerDay: Number(v.finePerDay),
  fineGraceDays: Number(v.fineGraceDays),
  maxFine: v.maxFine.trim() === "" ? null : Number(v.maxFine)
});

const WHOLE: [keyof Values, number, number][] = [
  ["loanDays", 1, 365],
  ["maxLoans", 0, 100],
  ["maxRenewals", 0, 20],
  ["fineGraceDays", 0, 90]
];

function validate(v: Values) {
  const e: Record<string, string> = {};
  for (const [key, min, max] of WHOLE) if (!isWhole(v[key]) || Number(v[key]) < min || Number(v[key]) > max) e[key] = `must be ${min} to ${max}`;
  if (!isMoney(v.finePerDay) || Number(v.finePerDay) > 10_000) e.finePerDay = "must be an amount up to 10,000";
  if (v.maxFine.trim() !== "" && (!isMoney(v.maxFine) || Number(v.maxFine) > 100_000)) e.maxFine = "must be an amount up to 100,000, or blank";
  return e;
}

export const RULE_HELP =
  "The most specific rule applies. Its terms are copied onto each loan, so editing or deleting a rule does not change loans already issued. The rule with no item type also caps the total number of loans.";

/* LB-01 rule drawer: create (rule = null), edit, or (without manage) view */
export function RuleDrawer({ open, rule, canEdit, onClose }: { open: boolean; rule: CirculationRule | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const currency = useSchoolCurrency();
  const classes = useClassOptions();
  const form = useForm<Values>(EMPTY);
  const create = useCreateRule();
  const update = useUpdateRule();
  const remove = useDeleteRule();
  const { values } = form;

  useEffect(() => {
    if (open) form.reset(rule ? toValues(rule) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id]);

  const title = rule ? rule.appliesTo.charAt(0).toUpperCase() + rule.appliesTo.slice(1) : "New circulation rule";

  if (rule && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title}>
        <div className="stack">
          <DescriptionList
            columns={2}
            items={[
              { label: "Loan period", value: plural(rule.loanDays, "day") },
              { label: "Loans at a time", value: rule.maxLoans },
              { label: "Renewals", value: rule.maxRenewals },
              { label: "Fine per day", value: money(rule.finePerDay) },
              { label: "Grace days", value: rule.fineGraceDays },
              { label: "Most a fine can be", value: rule.maxFine === null ? "No cap" : money(rule.maxFine) }
            ]}
          />
          <p className="small muted">{RULE_HELP}</p>
        </div>
      </Drawer>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values);
    form.setErrors(errs);
    if (Object.keys(errs).length) return form.setFormError("Please correct the highlighted fields.");
    form.setFormError(null);
    const body = toInput(values);
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (!rule) create.mutate(body, { onSuccess: done, onError: err => form.setServerErrors(err) });
    else {
      const before = toInput(toValues(rule));
      const changes = Object.fromEntries(Object.entries(body).filter(([k, v]) => before[k as keyof RuleInput] !== v));
      if (!Object.keys(changes).length) return onClose();
      update.mutate({ id: rule.id, ...changes }, { onSuccess: done, onError: err => form.setServerErrors(err) });
    }
  };

  const askDelete = async () => {
    if (!rule) return;
    const ok = await confirm({
      title: `Delete the rule for ${rule.appliesTo}?`,
      message: "Loans already issued keep their terms. New loans fall back to the next most specific rule, if any.",
      confirmLabel: "Delete rule"
    });
    if (ok)
      remove.mutate(rule.id, {
        onSuccess: res => {
          toast.success(res.message || "Rule deleted");
          onClose();
        },
        onError: err => toast.error(err)
      });
  };

  const busy = create.isPending || update.isPending;
  const isStudent = values.borrowerRole === "STUDENT";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      footerStatus={form.formError}
      footer={
        <>
          {rule && (
            <Button variant="ghost" icon={<Trash2 />} onClick={() => void askDelete()} loading={remove.isPending} style={{ marginRight: "auto" }}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="rule-form" variant="primary" loading={busy}>
            {rule ? "Save changes" : "Add rule"}
          </Button>
        </>
      }
    >
      <form id="rule-form" className="stack" onSubmit={submit} noValidate>
        <p className="small muted">{RULE_HELP}</p>
        <div className="section-title">Applies to</div>
        <div className="form-grid">
          <Select
            label="Borrower"
            {...form.text("borrowerRole")}
            onChange={e => {
              form.set("borrowerRole", e.target.value);
              if (e.target.value !== "STUDENT") form.set("classId", "");
            }}
            placeholder="Any borrower"
            options={BORROWER_ROLES.map(r => ({ value: r, label: roleLabel(r) }))}
            hint="Blank: anyone without a more specific rule"
          />
          <Select
            label="Class"
            {...form.text("classId")}
            placeholder={isStudent ? "Every class" : "Students only"}
            options={classes}
            disabled={!isStudent}
            hint={isStudent ? "Only students of this class" : "Pick Student to narrow by class"}
          />
          <Select
            label="Item type"
            {...form.text("itemType")}
            placeholder="Any item"
            options={LOANABLE_ITEM_TYPES.map(t => ({ value: t, label: ITEM_TYPE_LABELS[t] }))}
            hint="Reference items are never lent"
          />
        </div>
        <div className="section-title">Terms</div>
        <div className="form-grid">
          <TextInput label="Loan period (days)" required inputMode="numeric" {...form.text("loanDays")} hint="1 to 365" />
          <TextInput label="Loans at a time" required inputMode="numeric" {...form.text("maxLoans")} hint="0 stops this kind of borrowing" />
          <TextInput label="Renewals" required inputMode="numeric" {...form.text("maxRenewals")} hint="How many times a loan can be renewed" />
          <TextInput label={`Fine per day (${currency})`} required inputMode="decimal" {...form.text("finePerDay")} hint="For each late day that counts" />
          <TextInput label="Grace days" inputMode="numeric" {...form.text("fineGraceDays")} hint="Late days without a fine" />
          <TextInput label={`Most a fine can be (${currency})`} inputMode="decimal" placeholder="No cap" {...form.text("maxFine")} hint="Blank: no cap" />
        </div>
      </form>
    </Drawer>
  );
}
