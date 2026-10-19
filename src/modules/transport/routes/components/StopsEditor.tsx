import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button, TextInput } from "@/common/ui";
import { hhmm } from "../../shared/utils/format";
import type { RouteStop, StopInput } from "../api/routes";
import "../../shared/components/transport.css";

/* One row of the editor. `key` is local (new rows have no id yet). */
export type StopRow = {
  key: string;
  id?: string;
  name: string;
  pickupTime: string;
  dropTime: string;
  landmark: string;
  monthlyFee: string;
  assignedCount: number;
};

let seq = 0;
const newKey = () => `new-${++seq}`;

export const blankStop = (): StopRow => ({ key: newKey(), name: "", pickupTime: "", dropTime: "", landmark: "", monthlyFee: "", assignedCount: 0 });

export const stopRowsFrom = (stops: (RouteStop & { assignedCount?: number })[]): StopRow[] =>
  [...stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map(s => ({
      key: s.id,
      id: s.id,
      name: s.name,
      pickupTime: hhmm(s.pickupTime),
      dropTime: hhmm(s.dropTime),
      landmark: s.landmark ?? "",
      monthlyFee: s.monthlyFee ? String(s.monthlyFee) : "",
      assignedCount: s.assignedCount ?? 0
    }));

/* The list as the API takes it: in the order shown (sequence left out, so the server numbers them) */
export const stopsBody = (rows: StopRow[]): StopInput[] =>
  rows.map(r => {
    const s: StopInput = { name: r.name.trim().replace(/\s+/g, " "), monthlyFee: r.monthlyFee.trim() ? Number(r.monthlyFee) : 0 };
    if (r.id) s.id = r.id;
    if (r.pickupTime) s.pickupTime = r.pickupTime;
    if (r.dropTime) s.dropTime = r.dropTime;
    if (r.landmark.trim()) s.landmark = r.landmark.trim();
    return s;
  });

/* Client checks, keyed like the server's details ("stops.2.name"); "stops" for the list itself */
export function validateStops(rows: StopRow[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!rows.length) e.stops = "Add at least one stop";
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const name = r.name.trim().replace(/\s+/g, " ").toLowerCase();
    if (!name) e[`stops.${i}.name`] = "Name the stop";
    else if (seen.has(name)) e[`stops.${i}.name`] = `Same name as stop ${seen.get(name)! + 1}`;
    else seen.set(name, i);
    if (r.monthlyFee.trim()) {
      const fee = Number(r.monthlyFee);
      if (!Number.isFinite(fee) || fee < 0) e[`stops.${i}.monthlyFee`] = "0 or more";
      else if (Math.round(fee * 100) !== fee * 100) e[`stops.${i}.monthlyFee`] = "At most 2 decimals";
    }
  });
  return e;
}

/* TR-02 stops editor: an ordered list (drag the handle or use the arrows), saved as a whole.
   Stops with students can't be deleted (the server refuses too). */
export function StopsEditor({
  rows,
  onChange,
  errors,
  currency
}: {
  rows: StopRow[];
  onChange: (rows: StopRow[]) => void;
  errors: Record<string, string>;
  currency: string;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const patch = (key: string, change: Partial<StopRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...change } : r)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    onChange(next);
  };

  const drop = (targetKey: string) => {
    if (dragKey && dragKey !== targetKey) move(rows.findIndex(r => r.key === dragKey), rows.findIndex(r => r.key === targetKey));
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <div className="stops-editor">
      <div className="stop-row stop-row-head" aria-hidden>
        <span>#</span>
        <span>Stop</span>
        <span>Pickup</span>
        <span>Drop</span>
        <span>Landmark</span>
        <span>Monthly fee ({currency})</span>
        <span style={{ textAlign: "right" }}>Students</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div
          key={r.key}
          className={`stop-row${dragKey === r.key ? " is-dragging" : ""}${overKey === r.key && dragKey !== r.key ? " is-drop-target" : ""}`}
          draggable={dragKey === r.key}
          onDragStart={e => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", r.key);
          }}
          onDragOver={e => {
            if (!dragKey) return;
            e.preventDefault();
            setOverKey(r.key);
          }}
          onDrop={e => {
            e.preventDefault();
            drop(r.key);
          }}
          onDragEnd={() => {
            setDragKey(null);
            setOverKey(null);
          }}
        >
          <span className="stop-handle" title="Drag to reorder" onPointerDown={() => setDragKey(r.key)} onPointerUp={() => !overKey && setDragKey(null)}>
            <GripVertical size={14} />
            {i + 1}
          </span>
          <TextInput
            fieldClassName="stop-name"
            label="Stop"
            aria-label={`Stop ${i + 1} name`}
            maxLength={100}
            value={r.name}
            error={errors[`stops.${i}.name`]}
            onChange={e => patch(r.key, { name: e.target.value })}
            placeholder="e.g. Main gate"
          />
          <TextInput
            label="Pickup"
            aria-label={`Stop ${i + 1} pickup time`}
            type="time"
            value={r.pickupTime}
            error={errors[`stops.${i}.pickupTime`]}
            onChange={e => patch(r.key, { pickupTime: e.target.value })}
          />
          <TextInput
            label="Drop"
            aria-label={`Stop ${i + 1} drop time`}
            type="time"
            value={r.dropTime}
            error={errors[`stops.${i}.dropTime`]}
            onChange={e => patch(r.key, { dropTime: e.target.value })}
          />
          <TextInput
            fieldClassName="stop-landmark"
            label="Landmark"
            aria-label={`Stop ${i + 1} landmark`}
            maxLength={200}
            value={r.landmark}
            error={errors[`stops.${i}.landmark`]}
            onChange={e => patch(r.key, { landmark: e.target.value })}
          />
          <TextInput
            label={`Monthly fee (${currency})`}
            aria-label={`Stop ${i + 1} monthly fee`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={r.monthlyFee}
            placeholder="0"
            error={errors[`stops.${i}.monthlyFee`]}
            onChange={e => patch(r.key, { monthlyFee: e.target.value })}
          />
          <span className="stop-count" title={r.id ? `${r.assignedCount} student(s) use this stop` : "New stop"}>
            {r.id ? r.assignedCount : <span className="muted">New</span>}
          </span>
          <span className="stop-actions">
            <Button size="sm" variant="ghost" icon={<ArrowUp />} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move stop ${i + 1} up`} title="Move up" />
            <Button
              size="sm"
              variant="ghost"
              icon={<ArrowDown />}
              disabled={i === rows.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label={`Move stop ${i + 1} down`}
              title="Move down"
            />
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 />}
              disabled={r.assignedCount > 0 || rows.length === 1}
              onClick={() => onChange(rows.filter(x => x.key !== r.key))}
              aria-label={`Delete stop ${i + 1}`}
              title={r.assignedCount > 0 ? "Students use this stop: move or end their seats first" : rows.length === 1 ? "A route needs at least one stop" : "Delete stop"}
            />
          </span>
        </div>
      ))}
      <div className="row-between">
        <Button size="sm" icon={<Plus />} onClick={() => onChange([...rows, blankStop()])} disabled={rows.length >= 100}>
          Add stop
        </Button>
        <span className={`small ${errors.stops ? "field-error" : "muted"}`} role={errors.stops ? "alert" : undefined}>
          {errors.stops ?? "Stops are numbered in the order shown. Times are optional."}
        </span>
      </div>
    </div>
  );
}
