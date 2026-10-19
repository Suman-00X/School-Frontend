import { useEffect, useMemo, type FormEvent } from "react";
import { X } from "lucide-react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { EmployeeSelect, UUID } from "../../shared/components/EmployeeSelect";
import { useMoney } from "../../shared/hooks/useMoney";
import { addMonths, monthLabel, monthOf, monthRange } from "../../shared/utils/format";
import { createSalary, lineAmount, revisionTotals, SALARIES_PATH, useAllComponents, type SalaryInput, type SalaryRevision } from "../api/payroll";
import { KindBadge } from "./SalaryBits";
import "../../shared/hr.css";

type Line = { componentId: string; value: string };
type Values = {
  userId: string;
  month: string;
  monthlyBasic: string;
  lines: Line[];
  bankAccountNumber: string;
  bankIfsc: string;
  panNumber: string;
  notes: string;
};

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ACCOUNT = /^[0-9]{6,20}$/;

const twoDecimals = (v: number) => Math.round(v * 100) === v * 100;

/* HR-02 revision form. A revision is never edited: this always adds a new one, prefilled from
   `from` (the revision being revised) when given. Bank details left blank carry over. */
export function RevisionFormDrawer({
  open,
  onClose,
  userId,
  employeeName,
  from,
  history = [],
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  /* Fixed employee (revise, or add a salary for someone listed) */
  userId?: string;
  employeeName?: string;
  /* Prefill from this revision */
  from?: SalaryRevision | null;
  /* The employee's revisions (to grey out months already taken) */
  history?: SalaryRevision[];
  onSaved?: (r: SalaryRevision) => void;
}) {
  const toast = useToast();
  const money = useMoney();
  const components = useAllComponents();
  const save = useApiMutation(createSalary, { invalidate: [SALARIES_PATH, "/hr/payroll-runs"] });
  const thisMonth = monthOf(todayIso());

  const initial = (): Values => ({
    userId: userId ?? "",
    month: from ? addMonths(thisMonth, 1) : thisMonth,
    monthlyBasic: from ? String(from.monthlyBasic) : "",
    lines: from ? from.lines.map(l => ({ componentId: l.componentId, value: String(l.value) })) : [],
    bankAccountNumber: "",
    bankIfsc: "",
    panNumber: "",
    notes: ""
  });
  const form = useForm<Values>(initial());
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, from?.id]);

  const byId = useMemo(() => new Map((components.data ?? []).map(c => [c.id, c])), [components.data]);
  const taken = new Set(history.filter(h => h.userId === values.userId).map(h => monthOf(h.effectiveFrom)));
  const months = monthRange(addMonths(thisMonth, -24), addMonths(thisMonth, 12)).map(m => ({
    value: m,
    label: monthLabel(m),
    disabled: taken.has(m),
    description: taken.has(m) ? "Already has a revision" : m === thisMonth ? "This month" : m > thisMonth ? "Upcoming" : undefined
  }));

  const basic = Number(values.monthlyBasic) || 0;
  const resolved = values.lines
    .map(l => ({ line: l, c: byId.get(l.componentId) }))
    .filter((x): x is { line: Line; c: NonNullable<typeof x.c> } => !!x.c);
  const totals = revisionTotals(
    basic,
    resolved.map(({ line, c }) => ({ kind: c.kind, calculation: c.calculation, value: Number(line.value) || 0 }))
  );
  const unused = (components.data ?? []).filter(c => !values.lines.some(l => l.componentId === c.id));

  const setLine = (i: number, patch: Partial<Line>) => {
    form.set(
      "lines",
      values.lines.map((l, j) => (j === i ? { ...l, ...patch } : l))
    );
    form.setErrors(e => {
      const next = { ...e };
      delete next[`lines.${i}.value`];
      delete next[`lines.${i}`];
      return next;
    });
  };
  const addLine = (componentId: string) => {
    const c = byId.get(componentId);
    if (c) form.set("lines", [...values.lines, { componentId, value: String(c.defaultValue) }]);
  };
  const removeLine = (i: number) => {
    form.set(
      "lines",
      values.lines.filter((_, j) => j !== i)
    );
    form.setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.userId) e.userId = "Pick the employee";
    else if (!UUID.test(values.userId)) e.userId = "Not a user id";
    if (!values.month) e.month = "Pick the month";
    if (values.monthlyBasic.trim() === "" || !(basic >= 0)) e.monthlyBasic = "Enter the monthly basic";
    else if (!twoDecimals(basic)) e.monthlyBasic = "At most 2 decimals";
    values.lines.forEach((l, i) => {
      const c = byId.get(l.componentId);
      const v = Number(l.value);
      if (l.value.trim() === "" || !Number.isFinite(v) || v < 0) e[`lines.${i}.value`] = "Enter 0 or more";
      else if (c?.calculation === "PERCENT_OF_BASIC" && v > 100) e[`lines.${i}.value`] = "At most 100%";
      else if (!twoDecimals(v)) e[`lines.${i}.value`] = "At most 2 decimals";
    });
    if (values.bankAccountNumber && !ACCOUNT.test(values.bankAccountNumber.trim())) e.bankAccountNumber = "6–20 digits";
    if (values.bankIfsc && !IFSC.test(values.bankIfsc.trim().toUpperCase())) e.bankIfsc = "e.g. HDFC0001234";
    if (values.panNumber && !PAN.test(values.panNumber.trim().toUpperCase())) e.panNumber = "e.g. ABCDE1234F";
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const body: SalaryInput = {
      userId: values.userId,
      effectiveFrom: `${values.month}-01`,
      monthlyBasic: basic,
      lines: values.lines.map(l => ({ componentId: l.componentId, value: Number(l.value) }))
    };
    if (values.bankAccountNumber.trim()) body.bankAccountNumber = values.bankAccountNumber.trim();
    if (values.bankIfsc.trim()) body.bankIfsc = values.bankIfsc.trim().toUpperCase();
    if (values.panNumber.trim()) body.panNumber = values.panNumber.trim().toUpperCase();
    if (values.notes.trim()) body.notes = values.notes.trim();
    save.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onSaved?.(res.data);
        onClose();
      },
      onError: err => {
        if (isApiError(err) && err.status === 409) {
          form.setErrors({ month: err.message });
          form.setFormError(null);
        } else if (isApiError(err) && err.status === 422 && /userId|employee/i.test(err.message)) {
          form.setErrors({ userId: err.message });
          form.setFormError(null);
        } else form.setServerErrors(err, { effectiveFrom: "month" });
      }
    });
  };

  /* Bank details not sent carry over from the employee's latest revision */
  const previous = from ?? [...history].filter(h => h.userId === values.userId).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const keepHint = (masked: string | null | undefined) => (previous ? `Leave blank to keep ${masked ?? "the current value"}` : "Optional");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={from ? `Revise salary` : "New salary"}
      subtitle={employeeName ?? (from?.user ? `${from.user.firstName} ${from.user.lastName}` : undefined)}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="revision-form" variant="primary" loading={save.isPending}>
            Save revision
          </Button>
        </>
      }
    >
      <form id="revision-form" className="stack" onSubmit={submit} noValidate>
        {!userId && (
          <EmployeeSelect
            label="Employee"
            required
            placeholder="Pick an employee"
            value={values.userId}
            error={errors.userId}
            onChange={id => form.set("userId", id)}
          />
        )}
        <div className="form-grid">
          <Select label="Effective from" required value={values.month} error={errors.month} hint="Pay changes from the 1st of this month" options={months} onChange={e => form.set("month", e.target.value)} />
          <TextInput label="Monthly basic" required type="number" inputMode="decimal" min={0} step={0.01} hint="Before allowances and deductions" {...form.text("monthlyBasic")} />
        </div>

        <Field label="Components" hint="Values start from each component's default. Percentages are of the monthly basic." error={errors.lines}>
          <div className="stack-sm">
            {values.lines.length > 0 && (
              <table className="hr-lines-editor">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th style={{ width: 140 }}>Value</th>
                    <th style={{ width: 120, textAlign: "right" }}>Amount</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {values.lines.map((l, i) => {
                    const c = byId.get(l.componentId);
                    const amount = c ? lineAmount(basic, c.calculation, Number(l.value) || 0) : 0;
                    return (
                      <tr key={l.componentId}>
                        <td style={{ paddingTop: 7 }}>
                          <span className="row" style={{ gap: 6 }}>
                            <strong>{c?.name ?? "Unknown component"}</strong>
                            {c && <KindBadge kind={c.kind} />}
                          </span>
                        </td>
                        <td>
                          <TextInput
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={c?.calculation === "PERCENT_OF_BASIC" ? 100 : undefined}
                            step={0.01}
                            className="input-sm"
                            aria-label={`${c?.name ?? "Component"} value`}
                            value={l.value}
                            error={errors[`lines.${i}.value`]}
                            hint={c?.calculation === "PERCENT_OF_BASIC" ? "% of basic" : "Amount"}
                            onChange={e => setLine(i, { value: e.target.value })}
                          />
                        </td>
                        <td className="amount" style={{ color: c?.kind === "DEDUCTION" ? "var(--danger-text)" : undefined }}>
                          {c?.kind === "DEDUCTION" ? "−" : ""}
                          {money(amount)}
                        </td>
                        <td>
                          <Button size="sm" variant="ghost" icon={<X />} aria-label={`Remove ${c?.name ?? "component"}`} onClick={() => removeLine(i)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <Select
              aria-label="Add a component"
              className="select-sm"
              value=""
              placeholder={components.isLoading ? "Loading components…" : unused.length ? "Add a component…" : "Every component is added"}
              disabled={!unused.length}
              required
              options={unused.map(c => ({
                value: c.id,
                label: c.name,
                description: `${c.kind === "EARNING" ? "Earning" : "Deduction"} · ${c.calculation === "PERCENT_OF_BASIC" ? `${c.defaultValue}% of basic` : money(c.defaultValue)}`
              }))}
              onChange={e => addLine(e.target.value)}
            />
          </div>
        </Field>

        <div className="hr-totals" aria-live="polite">
          <div>
            <div className="kpi-label">Gross</div>
            <strong>{money(totals.gross)}</strong>
          </div>
          <div>
            <div className="kpi-label">Deductions</div>
            <strong>{money(totals.deductions)}</strong>
          </div>
          <div>
            <div className="kpi-label">Net (before loss of pay)</div>
            <strong>{money(totals.net)}</strong>
          </div>
        </div>

        <div className="form-grid">
          <TextInput label="Bank account number" inputMode="numeric" maxLength={20} hint={keepHint(previous?.bankAccountNumber)} {...form.text("bankAccountNumber")} />
          <TextInput
            label="IFSC"
            maxLength={11}
            hint={keepHint(previous?.bankIfsc)}
            {...form.text("bankIfsc")}
            onChange={e => form.set("bankIfsc", e.target.value.toUpperCase())}
          />
          <TextInput
            label="PAN"
            maxLength={10}
            hint={keepHint(previous?.panNumber)}
            {...form.text("panNumber")}
            onChange={e => form.set("panNumber", e.target.value.toUpperCase())}
          />
        </div>
        <Textarea label="Notes" rows={2} maxLength={500} placeholder="Annual increment" {...form.text("notes")} />
      </form>
    </Drawer>
  );
}
