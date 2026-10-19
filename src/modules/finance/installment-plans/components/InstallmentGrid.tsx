import { Divide, Plus, X } from "lucide-react";
import { Button, TextInput } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { sumAmounts } from "../../shared";
import { MAX_INSTALLMENTS, type Installment, type InstallmentInput } from "../api/installmentPlans";
import "../../shared/finance.css";

export type InstallmentRow = { key: string; name: string; dueDate: string; share: string };

let seq = 0;
export const newRow = (init: Partial<InstallmentRow> = {}): InstallmentRow => ({ key: `r${++seq}`, name: "", dueDate: "", share: "", ...init });

export const rowsFrom = (installments: Installment[]) =>
  installments.map(i => newRow({ name: i.name, dueDate: i.dueDate, share: String(i.sharePercent) }));

export const parseShare = (text: string) => {
  const t = text.trim();
  if (!t || !/^\d*(\.\d{0,2})?$/.test(t)) return null;
  return Number(t);
};

export const shareTotal = (rows: InstallmentRow[]) => sumAmounts(rows.map(r => parseShare(r.share)));

export const toInput = (rows: InstallmentRow[]): InstallmentInput[] =>
  rows.map(r => ({ name: r.name.trim(), dueDate: r.dueDate, sharePercent: parseShare(r.share) ?? 0 }));

/* The first rule the rows break (the server checks again and is the authority) */
export function gridProblem(rows: InstallmentRow[], year: { startDate: string; endDate: string; yearName: string } | null): string | null {
  for (const [i, r] of rows.entries()) {
    if (!r.dueDate) continue;
    if (year && (r.dueDate < year.startDate || r.dueDate > year.endDate)) return `${r.name || `Installment ${i + 1}`} is due outside ${year.yearName}`;
    const prev = rows[i - 1];
    if (prev?.dueDate && r.dueDate <= prev.dueDate) return `${r.name || `Installment ${i + 1}`} must be due after ${prev.name || `installment ${i}`} (${formatDate(prev.dueDate)})`;
  }
  const names = rows.map(r => r.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) return "Two installments have the same name";
  return null;
}

const COLS = "28px minmax(0, 1fr) 150px 96px 34px";

/* Name, due date and share of each installment, up to 24, with a running total that must reach 100% */
export function InstallmentGrid({
  rows,
  onChange,
  errors,
  message,
  locked,
  year,
  note
}: {
  rows: InstallmentRow[];
  onChange: (rows: InstallmentRow[]) => void;
  /* "installments.0.sharePercent" → message (the server's field names) */
  errors: Record<string, string>;
  /* The grid's own line: the server's refusal, else a broken rule */
  message: string | null;
  locked: boolean;
  year: { startDate: string; endDate: string; yearName: string } | null;
  /* The locked grid's line (default: why it is locked) */
  note?: string;
}) {
  const total = shareTotal(rows);
  const set = (key: string, patch: Partial<InstallmentRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));

  /* Equal shares, the last absorbing the rounding (25 / 25 / 25 / 25, 33.33 / 33.33 / 33.34) */
  const splitEqually = () => {
    const n = rows.length;
    const each = Math.floor(10000 / n) / 100;
    onChange(rows.map((r, i) => ({ ...r, share: String(i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each) })));
  };

  const add = () => {
    const last = rows.at(-1);
    onChange([...rows, newRow({ name: `Installment ${rows.length + 1}`, share: last && total < 100 ? String(Math.round((100 - total) * 100) / 100) : "" })]);
  };

  if (locked)
    return (
      <div className="grid-editor">
        <div className="grid-editor-head" style={{ gridTemplateColumns: "28px minmax(0, 1fr) 150px 96px" }}>
          <span>#</span>
          <span>Name</span>
          <span>Due date</span>
          <span style={{ textAlign: "right" }}>Share</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.key} className="grid-editor-row" style={{ gridTemplateColumns: "28px minmax(0, 1fr) 150px 96px", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
            <span className="muted small">{i + 1}</span>
            <span>{r.name}</span>
            <span className="nowrap">{formatDate(r.dueDate)}</span>
            <span className="amount" style={{ textAlign: "right" }}>
              {r.share}%
            </span>
          </div>
        ))}
        <div className="grid-editor-message" title={message ?? undefined}>
          {message ?? note ?? "Invoices have been issued under this plan, so its installments can no longer change."}
        </div>
      </div>
    );

  return (
    <div className="grid-editor">
      <div className="grid-editor-head" style={{ gridTemplateColumns: COLS }}>
        <span>#</span>
        <span>Name</span>
        <span>Due date</span>
        <span>Share %</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className="grid-editor-row" style={{ gridTemplateColumns: COLS }}>
          <span className="grid-editor-index">{i + 1}</span>
          <TextInput
            label="Name"
            aria-label={`Installment ${i + 1} name`}
            maxLength={50}
            placeholder={`Installment ${i + 1}`}
            value={r.name}
            onChange={e => set(r.key, { name: e.target.value })}
            error={errors[`installments.${i}.name`]}
          />
          <TextInput
            label="Due date"
            aria-label={`Installment ${i + 1} due date`}
            type="date"
            min={year?.startDate}
            max={year?.endDate}
            value={r.dueDate}
            onChange={e => set(r.key, { dueDate: e.target.value })}
            error={errors[`installments.${i}.dueDate`]}
          />
          <TextInput
            label="Share %"
            aria-label={`Installment ${i + 1} share in percent`}
            inputMode="decimal"
            placeholder="25"
            className="amount"
            value={r.share}
            onChange={e => set(r.key, { share: e.target.value.replace(/[^\d.]/g, "") })}
            error={errors[`installments.${i}.sharePercent`]}
          />
          <Button
            className="remove"
            size="sm"
            variant="ghost"
            icon={<X />}
            disabled={rows.length <= 1}
            onClick={() => onChange(rows.filter(x => x.key !== r.key))}
            aria-label={`Remove installment ${i + 1}`}
            title="Remove"
          />
        </div>
      ))}
      <div className="grid-editor-foot">
        <div className="row">
          <Button size="sm" icon={<Plus />} onClick={add} disabled={rows.length >= MAX_INSTALLMENTS} title={rows.length >= MAX_INSTALLMENTS ? `At most ${MAX_INSTALLMENTS} installments` : undefined}>
            Add installment
          </Button>
          <Button size="sm" variant="ghost" icon={<Divide />} onClick={splitEqually} disabled={rows.length < 2}>
            Split equally
          </Button>
        </div>
        <span className={`grid-editor-total${total === 100 ? "" : " off"}`} aria-live="polite">
          Total {total}%{total !== 100 && <span className="small" style={{ fontWeight: 400 }}> · {total < 100 ? `${Math.round((100 - total) * 100) / 100}% to go` : `${Math.round((total - 100) * 100) / 100}% too much`}</span>}
        </span>
      </div>
      <div className={`grid-editor-message${message ? " field-error" : ""}`} role={message ? "alert" : undefined} title={message ?? undefined}>
        {message ?? "Due dates in order, inside the year. Shares must add up to 100%; the last installment absorbs rounding."}
      </div>
    </div>
  );
}
