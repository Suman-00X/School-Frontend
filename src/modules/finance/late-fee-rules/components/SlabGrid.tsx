import { Plus, X } from "lucide-react";
import { Button, Select, TextInput } from "@/common/ui";
import { MoneyInput, parseAmount } from "../../shared";
import { MAX_SLABS, type ChargeType, type RuleInput, type Slab } from "../api/lateFeeRules";
import "../../shared/finance.css";

/* Each slab's start is the day after the previous one ends, so only "to day" is typed and the
   slabs can't have gaps or overlaps. An empty "to day" on the last slab means "and beyond". */
export type SlabRow = { key: string; toDay: string; chargeType: ChargeType; amount: string };

let seq = 0;
export const newSlab = (init: Partial<SlabRow> = {}): SlabRow => ({ key: `s${++seq}`, toDay: "", chargeType: "FIXED", amount: "", ...init });
export const slabsFrom = (slabs: Slab[]) => slabs.map(s => newSlab({ toDay: s.toDay === null ? "" : String(s.toDay), chargeType: s.chargeType, amount: String(s.amount) }));

const int = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null);

/* fromDay of each row: 1, then the day after the previous row's toDay */
export const fromDays = (rows: SlabRow[]) => {
  const out: (number | null)[] = [];
  rows.forEach((_, i) => {
    if (i === 0) out.push(1);
    else {
      const prevTo = int(rows[i - 1].toDay);
      out.push(prevTo === null ? null : prevTo + 1);
    }
  });
  return out;
};

export const slabsInput = (rows: SlabRow[]): RuleInput["slabs"] => {
  const from = fromDays(rows);
  return rows.map((r, i) => {
    const toDay = int(r.toDay);
    return { fromDay: from[i] ?? 0, ...(toDay !== null ? { toDay } : {}), chargeType: r.chargeType, amount: parseAmount(r.amount) ?? 0 };
  });
};

/* Row errors before sending ("slabs.0.toDay" keys, as the server names them) */
export function slabErrors(rows: SlabRow[]) {
  const from = fromDays(rows);
  const e: Record<string, string> = {};
  rows.forEach((r, i) => {
    const last = i === rows.length - 1;
    const to = int(r.toDay);
    if (!r.toDay.trim()) {
      if (!last) e[`slabs.${i}.toDay`] = "Only the last slab can be open";
    } else if (to === null || to < 1) e[`slabs.${i}.toDay`] = "A whole number of days";
    else if (from[i] !== null && to < from[i]!) e[`slabs.${i}.toDay`] = `At least ${from[i]}`;
    const amount = parseAmount(r.amount);
    if (amount === null || amount <= 0) e[`slabs.${i}.amount`] = "More than 0";
  });
  return e;
}

const TYPE_OPTIONS = [
  { value: "FIXED", label: "Fixed", description: "The amount is the fee" },
  { value: "PER_DAY", label: "Per day", description: "Added for each day of the slab" }
];

const COLS = "86px 100px minmax(120px, 1fr) minmax(0, 1fr) 34px";

export function SlabGrid({
  rows,
  onChange,
  errors,
  message
}: {
  rows: SlabRow[];
  onChange: (rows: SlabRow[]) => void;
  errors: Record<string, string>;
  /* The server's 422 slab message, under the grid */
  message: string | null;
}) {
  const from = fromDays(rows);
  const set = (key: string, patch: Partial<SlabRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <div className="grid-editor">
      <div className="grid-editor-head" style={{ gridTemplateColumns: COLS }}>
        <span>From day</span>
        <span>To day</span>
        <span>Type</span>
        <span>Amount</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const last = i === rows.length - 1;
        return (
          <div key={r.key} className="grid-editor-row" style={{ gridTemplateColumns: COLS }}>
            <TextInput label="From day" aria-label={`Slab ${i + 1} starts on day`} value={from[i] === null ? "" : String(from[i])} placeholder="—" disabled readOnly error={undefined} />
            <TextInput
              label="To day"
              aria-label={`Slab ${i + 1} ends on day`}
              inputMode="numeric"
              placeholder={last ? "and beyond" : ""}
              value={r.toDay}
              onChange={e => set(r.key, { toDay: e.target.value.replace(/\D/g, "") })}
              error={errors[`slabs.${i}.toDay`]}
            />
            <Select label="Type" aria-label={`Slab ${i + 1} charge type`} required options={TYPE_OPTIONS} value={r.chargeType} onChange={e => set(r.key, { chargeType: e.target.value as ChargeType })} error={undefined} />
            <MoneyInput
              label="Amount"
              aria-label={`Slab ${i + 1} amount`}
              placeholder="0.00"
              value={r.amount}
              onChange={e => set(r.key, { amount: e.target.value.replace(/[^\d.,]/g, "") })}
              error={errors[`slabs.${i}.amount`]}
            />
            <Button
              className="remove"
              size="sm"
              variant="ghost"
              icon={<X />}
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter(x => x.key !== r.key))}
              aria-label={`Remove slab ${i + 1}`}
              title="Remove"
            />
          </div>
        );
      })}
      <div className="grid-editor-foot">
        <Button
          size="sm"
          icon={<Plus />}
          disabled={rows.length >= MAX_SLABS}
          onClick={() => {
            /* The open last slab gets an end so the new one can follow it */
            const lastRow = rows.at(-1);
            const lastFrom = from.at(-1);
            const closed = lastRow && !lastRow.toDay && lastFrom ? rows.map(r => (r.key === lastRow.key ? { ...r, toDay: String(lastFrom + 29) } : r)) : rows;
            onChange([...closed, newSlab()]);
          }}
        >
          Add slab
        </Button>
      </div>
      <div className={`grid-editor-message${message ? " field-error" : ""}`} role={message ? "alert" : undefined} title={message ?? undefined}>
        {message ?? "Leave the last slab's “to day” empty for “and beyond”."}
      </div>
    </div>
  );
}
