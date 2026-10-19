import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Tone } from "./Badge";
import "./GridEditor.css";

/* Bulk entry: rows (students, staff) × columns (one register, several periods, days), each
   cell holding one of a few choices (Present, Absent…).
   <GridEditor rows={[{ id, label, sub }]} columns={[{ key: "DAY", label: "Day" }]}
     choices={[{ value: "PRESENT", label: "Present", short: "P", key: "p", tone: "success" }]}
     value={(rowId, col) => …} onChange={(rowId, col, value) => …} />
   - One column: each row shows one-tap buttons for every choice. Several columns: each cell
     shows the choice's short code and cycles on click.
   - Keyboard: arrows move between cells, a choice's key sets it and moves down, Space cycles,
     Delete clears (with allowClear). Only the active cell is in the tab order.
   - Without onChange (or with readOnly) nothing can be changed.
   - A row's `error` replaces its `sub` line, so an error never moves the rows below. */

export type GridChoice = { value: string; label: string; short: string; key?: string; tone?: Tone };
export type GridRow = { id: string; label: ReactNode; sub?: ReactNode; error?: string | null };
export type GridColumn = { key: string; label: ReactNode; title?: string; readOnly?: boolean };
export type GridExtraColumn = { key: string; header: ReactNode; render: (row: GridRow) => ReactNode; width?: number | string; align?: "left" | "right" | "center" };

export function GridEditor({
  rows,
  columns,
  choices,
  value,
  onChange,
  readOnly,
  mode,
  rowHeader = "Name",
  extraColumns = [],
  hiddenChoices = [],
  allowClear,
  legend = true,
  emptyCell = "–",
  "aria-label": ariaLabel
}: {
  rows: GridRow[];
  columns: GridColumn[];
  choices: GridChoice[];
  value: (rowId: string, colKey: string) => string | null | undefined;
  onChange?: (rowId: string, colKey: string, value: string | null) => void;
  readOnly?: boolean;
  /* Default: "buttons" with one column, "codes" with more */
  mode?: "buttons" | "codes";
  rowHeader?: ReactNode;
  /* After the choice columns (a remark input, a total…) */
  extraColumns?: GridExtraColumn[];
  /* Choices that can't be picked here (still shown when a cell already holds one) */
  hiddenChoices?: string[];
  allowClear?: boolean;
  /* The keys line under the grid */
  legend?: boolean;
  emptyCell?: ReactNode;
  "aria-label"?: string;
}) {
  const [active, setActive] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const cells = useRef(new Map<string, HTMLDivElement>());
  const layout = mode ?? (columns.length === 1 ? "buttons" : "codes");
  const pickable = choices.filter(c => !hiddenChoices.includes(c.value));
  const byValue = new Map(choices.map(c => [c.value, c]));
  const editable = (c: number) => !!onChange && !readOnly && !columns[c]?.readOnly;

  const focus = (r: number, c: number) => {
    const row = Math.max(0, Math.min(rows.length - 1, r));
    const col = Math.max(0, Math.min(columns.length - 1, c));
    setActive({ r: row, c: col });
    cells.current.get(`${row}:${col}`)?.focus();
  };

  const set = (r: number, c: number, next: string | null) => {
    if (!editable(c)) return;
    onChange!(rows[r]!.id, columns[c]!.key, next);
  };

  const cycle = (r: number, c: number) => {
    const current = value(rows[r]!.id, columns[c]!.key) ?? null;
    const at = pickable.findIndex(ch => ch.value === current);
    const next = pickable[(at + 1) % pickable.length];
    if (next) set(r, c, next.value);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, r: number, c: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
      Enter: [r + 1, c],
      Home: [r, 0],
      End: [r, columns.length - 1]
    };
    if (moves[e.key]) {
      e.preventDefault();
      focus(...moves[e.key]!);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " ") {
      e.preventDefault();
      cycle(r, c);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && allowClear) {
      e.preventDefault();
      set(r, c, null);
      return;
    }
    const choice = pickable.find(ch => ch.key && ch.key.toLowerCase() === e.key.toLowerCase());
    if (choice && editable(c)) {
      e.preventDefault();
      set(r, c, choice.value);
      focus(r + 1, c);
    }
  };

  const cell = (row: GridRow, r: number, c: number) => {
    const col = columns[c]!;
    const current = value(row.id, col.key) ?? null;
    const chosen = current ? byValue.get(current) : undefined;
    const canEdit = editable(c);
    const isActive = active.r === r && active.c === c;
    return (
      <div
        ref={el => {
          if (el) cells.current.set(`${r}:${c}`, el);
          else cells.current.delete(`${r}:${c}`);
        }}
        role="gridcell"
        tabIndex={isActive ? 0 : -1}
        aria-readonly={!canEdit || undefined}
        aria-label={typeof col.label === "string" ? `${col.label}: ${chosen?.label ?? "not marked"}` : chosen?.label ?? "Not marked"}
        className={`ge-cell ge-${layout}${canEdit ? "" : " is-readonly"}`}
        onFocus={() => setActive({ r, c })}
        onKeyDown={e => onKey(e, r, c)}
        onClick={layout === "codes" && canEdit ? () => cycle(r, c) : undefined}
      >
        {layout === "buttons" ? (
          <div className="ge-seg">
            {(canEdit ? pickable : choices.filter(ch => ch.value === current)).map(ch => (
              <button
                key={ch.value}
                type="button"
                tabIndex={-1}
                disabled={!canEdit}
                className={`ge-choice tone-${ch.tone ?? "neutral"}${ch.value === current ? " is-on" : ""}`}
                aria-pressed={ch.value === current}
                title={ch.key ? `${ch.label} (${ch.key.toUpperCase()})` : ch.label}
                onClick={() => {
                  set(r, c, ch.value === current && allowClear ? null : ch.value);
                  setActive({ r, c });
                }}
              >
                <span className="ge-short">{ch.short}</span>
                <span className="ge-label">{ch.label}</span>
              </button>
            ))}
            {!canEdit && !chosen && <span className="ge-empty">{emptyCell}</span>}
          </div>
        ) : (
          <span className={`ge-code tone-${chosen?.tone ?? "neutral"}${chosen ? " is-on" : ""}`} title={chosen?.label}>
            {chosen?.short ?? emptyCell}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="grid-editor">
      <div className="table-wrap">
        <table className="table ge-table" role="grid" aria-label={ariaLabel}>
          <thead>
            <tr>
              <th className="ge-rowhead">{rowHeader}</th>
              {columns.map(col => (
                <th key={col.key} className="ge-colhead" title={col.title}>
                  {col.label}
                </th>
              ))}
              {extraColumns.map(x => (
                <th key={x.key} style={{ width: x.width }} className={x.align ? `align-${x.align}` : undefined}>
                  {x.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.id} className={row.error ? "ge-row-error" : undefined}>
                <td className="ge-rowhead">
                  <div className="ge-name">{row.label}</div>
                  <div className={`ge-sub${row.error ? " ge-sub-error" : ""}`} title={row.error ?? undefined}>
                    {row.error ?? row.sub}
                  </div>
                </td>
                {columns.map((col, c) => (
                  <td key={col.key} className="ge-td">
                    {cell(row, r, c)}
                  </td>
                ))}
                {extraColumns.map(x => (
                  <td key={x.key} className={x.align ? `align-${x.align}` : undefined}>
                    {x.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {legend && (
        <div className="ge-legend small muted">
          {choices.map(ch => (
            <span key={ch.value}>
              <span className={`ge-code tone-${ch.tone ?? "neutral"} is-on`}>{ch.short}</span> {ch.label}
            </span>
          ))}
          {onChange && !readOnly && (
            <span className="ge-keys">
              Keys: {pickable.filter(ch => ch.key).map(ch => ch.key!.toUpperCase()).join(" ")} to mark and move down · arrows to move · Space to cycle
              {allowClear ? " · Delete to clear" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
