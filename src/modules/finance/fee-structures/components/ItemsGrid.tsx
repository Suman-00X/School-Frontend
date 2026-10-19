import { Plus, X } from "lucide-react";
import { Button, Select, type Option } from "@/common/ui";
import { MoneyInput, parseAmount, sumAmounts, useMoney } from "../../shared";
import type { StructureItem } from "../api/feeStructures";

export type ItemRow = { key: string; feeHeadId: string; amount: string };

let seq = 0;
export const newItem = (init: Partial<ItemRow> = {}): ItemRow => ({ key: `i${++seq}`, feeHeadId: "", amount: "", ...init });
export const itemsFrom = (items: StructureItem[]) => items.map(i => newItem({ feeHeadId: i.feeHeadId, amount: String(i.amount) }));
export const itemsTotal = (rows: ItemRow[]) => sumAmounts(rows.map(r => parseAmount(r.amount)));
export const itemsInput = (rows: ItemRow[]) => rows.map(r => ({ feeHeadId: r.feeHeadId, amount: parseAmount(r.amount) ?? 0 }));

const COLS = "minmax(0, 1fr) 170px 34px";
const MAX_ITEMS = 50;

/* FI-03 items: fee head and annual amount, each head once, the total at the bottom.
   Read-only when the person can't edit or invoices froze the items. */
export function ItemsGrid({
  rows,
  onChange,
  headOptions,
  errors,
  message,
  readOnly,
  frozenNote
}: {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  headOptions: Option[];
  /* "items.0.amount" → message */
  errors: Record<string, string>;
  message: string | null;
  readOnly: boolean;
  frozenNote?: string | null;
}) {
  const money = useMoney();
  const total = itemsTotal(rows);
  const set = (key: string, patch: Partial<ItemRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const labelOf = (id: string) => headOptions.find(o => o.value === id);

  if (readOnly)
    return (
      <div className="grid-editor">
        <div className="grid-editor-head" style={{ gridTemplateColumns: "minmax(0, 1fr) 170px" }}>
          <span>Fee head</span>
          <span style={{ textAlign: "right" }}>Annual amount</span>
        </div>
        {rows.map(r => (
          <div key={r.key} className="grid-editor-row" style={{ gridTemplateColumns: "minmax(0, 1fr) 170px", padding: "7px 0", borderTop: "1px solid var(--border)" }}>
            <span>
              {labelOf(r.feeHeadId)?.label ?? "Fee head"} <span className="small muted mono">{labelOf(r.feeHeadId)?.description}</span>
            </span>
            <span className="amount" style={{ textAlign: "right" }}>
              {money(parseAmount(r.amount))}
            </span>
          </div>
        ))}
        <div className="grid-editor-foot">
          <span className="small muted">{rows.length} fee head{rows.length === 1 ? "" : "s"}</span>
          <span className="grid-editor-total">Total {money(total)}</span>
        </div>
        <div className="grid-editor-message" title={frozenNote ?? undefined}>
          {frozenNote}
        </div>
      </div>
    );

  return (
    <div className="grid-editor">
      <div className="grid-editor-head" style={{ gridTemplateColumns: COLS }}>
        <span>Fee head</span>
        <span>Annual amount</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const taken = new Set(rows.filter(x => x.key !== r.key).map(x => x.feeHeadId));
        return (
          <div key={r.key} className="grid-editor-row" style={{ gridTemplateColumns: COLS }}>
            <Select
              label="Fee head"
              aria-label={`Fee head of row ${i + 1}`}
              required
              placeholder="Pick a fee head"
              options={headOptions.map(o => ({ ...o, disabled: taken.has(o.value) }))}
              value={r.feeHeadId}
              onChange={e => set(r.key, { feeHeadId: e.target.value })}
              error={errors[`items.${i}.feeHeadId`]}
            />
            <MoneyInput
              label="Annual amount"
              aria-label={`Annual amount of row ${i + 1}`}
              placeholder="0.00"
              value={r.amount}
              onChange={e => set(r.key, { amount: e.target.value.replace(/[^\d.,]/g, "") })}
              error={errors[`items.${i}.amount`]}
            />
            <Button
              className="remove"
              size="sm"
              variant="ghost"
              icon={<X />}
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter(x => x.key !== r.key))}
              aria-label={`Remove row ${i + 1}`}
              title="Remove"
            />
          </div>
        );
      })}
      <div className="grid-editor-foot">
        <Button size="sm" icon={<Plus />} onClick={() => onChange([...rows, newItem()])} disabled={rows.length >= Math.min(MAX_ITEMS, headOptions.length)}>
          Add fee head
        </Button>
        <span className="grid-editor-total">Total {money(total)}</span>
      </div>
      <div className={`grid-editor-message${message ? " field-error" : ""}`} role={message ? "alert" : undefined} title={message ?? undefined}>
        {message ?? "Annual amounts. Each installment takes its share of every item."}
      </div>
    </div>
  );
}
