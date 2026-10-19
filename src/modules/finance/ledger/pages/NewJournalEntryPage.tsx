/* FI-13 · New manual journal entry: a balanced adjustment, 2 to 50 lines, each a debit or a credit */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Button, Card, FormActions, PageHeader, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { MoneyInput, hasTooManyDecimals, parseAmount, sumAmounts, useMoney } from "../../shared";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { postEntry, useAccountOptions, useLedgerMutation, type ManualEntryInput } from "../api/ledger";

type Line = { key: string; accountId: string; debit: string; credit: string; memo: string };

let seq = 0;
const newLine = (): Line => ({ key: `l${++seq}`, accountId: "", debit: "", credit: "", memo: "" });

const COLS = "28px minmax(0, 1.6fr) 140px 140px minmax(0, 1fr) 34px";
const MAX_LINES = 50;

export default function NewJournalEntryPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const money = useMoney();
  const accounts = useAccountOptions({ manualOnly: true });
  const form = useForm({ date: todayIso(), narration: "" });
  const [lines, setLines] = useState<Line[]>([newLine(), newLine()]);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [gridMessage, setGridMessage] = useState<string | null>(null);
  const post = useLedgerMutation(postEntry);

  const debits = sumAmounts(lines.map(l => parseAmount(l.debit)));
  const credits = sumAmounts(lines.map(l => parseAmount(l.credit)));
  const balanced = debits > 0 && debits === credits;
  const difference = Math.round((debits - credits) * 100) / 100;

  const set = (key: string, patch: Partial<Line>) => {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
    const i = lines.findIndex(l => l.key === key);
    setLineErrors(errs => {
      const next = { ...errs };
      for (const f of Object.keys(patch)) delete next[`lines.${i}.${f}`];
      delete next[`lines.${i}`];
      return next;
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    lines.forEach((l, i) => {
      const d = parseAmount(l.debit) ?? 0;
      const c = parseAmount(l.credit) ?? 0;
      if (!l.accountId) errs[`lines.${i}.accountId`] = "Pick an account";
      if (hasTooManyDecimals(l.debit)) errs[`lines.${i}.debit`] = "At most 2 decimals";
      if (hasTooManyDecimals(l.credit)) errs[`lines.${i}.credit`] = "At most 2 decimals";
      if ((d > 0) === (c > 0)) errs[`lines.${i}.debit`] ??= "A debit or a credit";
    });
    const fieldErrs: Record<string, string> = {};
    if (!form.values.narration.trim()) fieldErrs.narration = "Say what the entry is for";
    setLineErrors(errs);
    form.setErrors(fieldErrs);
    return !Object.keys(errs).length && !Object.keys(fieldErrs).length;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    setGridMessage(null);
    if (!validate() || !balanced) return;
    const body: ManualEntryInput = {
      date: form.values.date || undefined,
      narration: form.values.narration.trim(),
      lines: lines.map(l => {
        const d = parseAmount(l.debit) ?? 0;
        const c = parseAmount(l.credit) ?? 0;
        return { accountId: l.accountId, ...(d > 0 ? { debit: d } : { credit: c }), ...(l.memo.trim() ? { memo: l.memo.trim() } : {}) };
      })
    };
    post.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        navigate(OPS_PATHS.journalEntry(res.data.id));
      },
      onError: err => {
        if (isApiError(err) && err.isValidation) {
          const rows: Record<string, string> = {};
          const top: Record<string, string> = {};
          for (const d of err.details) {
            if (d.field?.startsWith("lines.")) rows[d.field] ??= d.message;
            else if (d.field === "lines") setGridMessage(d.message);
            else if (d.field) top[d.field] ??= d.message;
          }
          /* "lines.2" (the line as a whole: "must have either a debit or a credit") shows under its debit */
          for (const k of Object.keys(rows)) if (/^lines\.\d+$/.test(k)) rows[`${k}.debit`] ??= rows[k];
          setLineErrors(rows);
          form.setErrors(top);
          form.setFormError("Please correct the highlighted fields.");
        } else if (isApiError(err) && err.status === 422) {
          setGridMessage(err.message);
          form.setFormError(err.message);
        } else form.setServerErrors(err);
      }
    });
  };

  const status = gridMessage
    ? gridMessage
    : debits === 0 && credits === 0
      ? "Enter the amounts. Debits must equal credits."
      : balanced
        ? "Balanced: debits equal credits."
        : `Not balanced: ${difference > 0 ? "debits" : "credits"} are ${money(Math.abs(difference))} more.`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Journal entries", to: OPS_PATHS.journal }, { label: "New manual entry" }]}
        title="New manual entry"
        subtitle="For adjustments only: fees, payments and refunds post their own entries. Receivables and student credit can't take manual lines."
      />
      <form onSubmit={submit} noValidate className="stack">
        <Card>
          <div className="form-grid">
            <TextInput type="date" label="Date" max={todayIso()} hint="Not in the future" {...form.text("date")} />
            <Textarea label="Narration" required rows={1} maxLength={500} fieldClassName="span-2" placeholder="Electricity bill for September" {...form.text("narration")} />
          </div>
        </Card>
        <Card title="Lines">
          <div className="grid-editor">
            <div className="grid-editor-head" style={{ gridTemplateColumns: COLS }}>
              <span>#</span>
              <span>Account</span>
              <span>Debit</span>
              <span>Credit</span>
              <span>Memo</span>
              <span />
            </div>
            {lines.map((l, i) => (
              <div key={l.key} className="grid-editor-row" style={{ gridTemplateColumns: COLS }}>
                <span className="grid-editor-index">{i + 1}</span>
                <Select
                  label="Account"
                  aria-label={`Account of line ${i + 1}`}
                  required
                  searchable
                  placeholder={accounts.isLoading ? "Loading…" : "Pick an account"}
                  options={accounts.options}
                  value={l.accountId}
                  onChange={e => set(l.key, { accountId: e.target.value })}
                  error={lineErrors[`lines.${i}.accountId`]}
                />
                <MoneyInput
                  label="Debit"
                  aria-label={`Debit of line ${i + 1}`}
                  placeholder="0.00"
                  value={l.debit}
                  onChange={e => set(l.key, { debit: e.target.value.replace(/[^\d.,]/g, ""), ...(e.target.value ? { credit: "" } : {}) })}
                  error={lineErrors[`lines.${i}.debit`]}
                />
                <MoneyInput
                  label="Credit"
                  aria-label={`Credit of line ${i + 1}`}
                  placeholder="0.00"
                  value={l.credit}
                  onChange={e => set(l.key, { credit: e.target.value.replace(/[^\d.,]/g, ""), ...(e.target.value ? { debit: "" } : {}) })}
                  error={lineErrors[`lines.${i}.credit`]}
                />
                <TextInput
                  label="Memo"
                  aria-label={`Memo of line ${i + 1}`}
                  maxLength={200}
                  value={l.memo}
                  onChange={e => set(l.key, { memo: e.target.value })}
                  error={lineErrors[`lines.${i}.memo`]}
                />
                <Button
                  className="remove"
                  size="sm"
                  variant="ghost"
                  icon={<X />}
                  disabled={lines.length <= 2}
                  onClick={() => {
                    setLines(ls => ls.filter(x => x.key !== l.key));
                    setLineErrors({});
                  }}
                  aria-label={`Remove line ${i + 1}`}
                  title="Remove"
                />
              </div>
            ))}
            <div className="grid-editor-foot">
              <Button size="sm" icon={<Plus />} disabled={lines.length >= MAX_LINES} onClick={() => setLines(ls => [...ls, newLine()])}>
                Add line
              </Button>
              <span className={`grid-editor-total${balanced || (debits === 0 && credits === 0) ? "" : " off"}`}>
                Debits {money(debits)} · Credits {money(credits)}
              </span>
            </div>
            <div className={`grid-editor-message${gridMessage || (!balanced && (debits || credits)) ? " field-error" : ""}`} role={gridMessage ? "alert" : undefined} title={status}>
              {status}
            </div>
          </div>
        </Card>
        <FormActions error={form.formError}>
          <Button onClick={() => navigate(OPS_PATHS.journal)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!balanced} loading={post.isPending}>
            Post entry
          </Button>
        </FormActions>
      </form>
    </>
  );
}
