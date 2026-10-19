import { Plus, X } from "lucide-react";
import { Button, Checkbox } from "@/common/ui";
import type { BandInput, GradeBand } from "../api/gradeScales";

/* A band row while editing: numbers kept as typed */
export type BandRow = { key: number; grade: string; minPercent: string; maxPercent: string; gradePoint: string; remark: string; isPassing: boolean };

let seq = 0;
export const bandRow = (b?: Partial<GradeBand>): BandRow => ({
  key: ++seq,
  grade: b?.grade ?? "",
  minPercent: b?.minPercent !== undefined ? String(b.minPercent) : "",
  maxPercent: b?.maxPercent !== undefined ? String(b.maxPercent) : "",
  gradePoint: b?.gradePoint !== undefined && b.gradePoint !== null ? String(b.gradePoint) : "",
  remark: b?.remark ?? "",
  isPassing: b?.isPassing ?? true
});

/* Best band first, as schools read a scale */
export const rowsOf = (bands: GradeBand[]) => [...bands].sort((a, b) => b.minPercent - a.minPercent).map(bandRow);

export const toBands = (rows: BandRow[]): BandInput[] =>
  rows.map(r => {
    const b: BandInput = { grade: r.grade.trim(), minPercent: Number(r.minPercent), maxPercent: Number(r.maxPercent), isPassing: r.isPassing };
    if (r.gradePoint.trim() !== "") b.gradePoint = Number(r.gradePoint);
    if (r.remark.trim()) b.remark = r.remark.trim();
    return b;
  });

/* Rows with numbers that parse: the ones the coverage bar can draw */
const drawable = (rows: BandRow[]) =>
  rows
    .map(r => ({ ...r, min: Number(r.minPercent), max: Number(r.maxPercent) }))
    .filter(r => r.minPercent !== "" && r.maxPercent !== "" && Number.isFinite(r.min) && Number.isFinite(r.max) && r.max > r.min);

/* The 0–100 bar: each band where it falls, gaps and overlaps marked */
export function CoverageBar({ rows }: { rows: BandRow[] }) {
  const bands = drawable(rows).sort((a, b) => a.min - b.min);
  const marks: { from: number; to: number; kind: "gap" | "overlap" }[] = [];
  let reach = 0;
  for (const b of bands) {
    if (b.min > reach) marks.push({ from: reach, to: Math.min(b.min, 100), kind: "gap" });
    if (b.min < reach) marks.push({ from: b.min, to: Math.min(reach, b.max), kind: "overlap" });
    reach = Math.max(reach, b.max);
  }
  if (reach < 100) marks.push({ from: reach, to: 100, kind: "gap" });
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="band-bar-wrap">
      <div className="band-bar" role="img" aria-label="How the bands cover 0 to 100%">
        {bands.map(b => (
          <div
            key={b.key}
            className={`band-seg${b.isPassing ? "" : " is-failing"}`}
            style={{ left: `${clamp(b.min)}%`, width: `${clamp(b.max) - clamp(b.min)}%` }}
            title={`${b.grade || "?"}: ${b.min}–${b.max}%`}
          >
            <span>{b.grade}</span>
          </div>
        ))}
        {marks.map((m, i) => (
          <div key={i} className={`band-mark is-${m.kind}`} style={{ left: `${clamp(m.from)}%`, width: `${Math.max(clamp(m.to) - clamp(m.from), 0.8)}%` }} title={`${m.kind === "gap" ? "Gap" : "Overlap"}: ${m.from}–${m.to}%`} />
        ))}
      </div>
      <div className="band-scale" aria-hidden>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/* Band rows: grade, from %, to %, grade point, remark, passing. "To" is excluded except at 100%. */
export function BandsEditor({ rows, onChange, disabled }: { rows: BandRow[]; onChange: (rows: BandRow[]) => void; disabled?: boolean }) {
  const set = (key: number, patch: Partial<BandRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  /* A new band below the last one, starting at 0 */
  const add = () => {
    const lowest = drawable(rows).sort((a, b) => a.min - b.min)[0];
    onChange([...rows, bandRow({ minPercent: 0, maxPercent: lowest ? lowest.min : undefined, isPassing: false })]);
  };
  return (
    <div className="bands">
      <div className="bands-head" aria-hidden>
        <span>Grade</span>
        <span>From %</span>
        <span>To %</span>
        <span>Points</span>
        <span>Remark</span>
        <span>Passing</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={r.key} className="bands-row">
          <input className="input" aria-label={`Band ${i + 1} grade`} maxLength={5} value={r.grade} disabled={disabled} onChange={e => set(r.key, { grade: e.target.value })} />
          <input className="input" aria-label={`Band ${i + 1} from %`} type="number" min={0} max={100} step="any" value={r.minPercent} disabled={disabled} onChange={e => set(r.key, { minPercent: e.target.value })} />
          <input className="input" aria-label={`Band ${i + 1} to %`} type="number" min={0} max={100} step="any" value={r.maxPercent} disabled={disabled} onChange={e => set(r.key, { maxPercent: e.target.value })} />
          <input className="input" aria-label={`Band ${i + 1} grade point`} type="number" min={0} max={10} step="any" value={r.gradePoint} disabled={disabled} onChange={e => set(r.key, { gradePoint: e.target.value })} />
          <input className="input" aria-label={`Band ${i + 1} remark`} maxLength={100} value={r.remark} disabled={disabled} onChange={e => set(r.key, { remark: e.target.value })} />
          <Checkbox aria-label={`Band ${i + 1} passing`} checked={r.isPassing} disabled={disabled} onChange={e => set(r.key, { isPassing: e.target.checked })} />
          <Button size="sm" variant="ghost" icon={<X />} aria-label={`Remove band ${i + 1}`} disabled={disabled || rows.length <= 2} onClick={() => onChange(rows.filter(x => x.key !== r.key))} />
        </div>
      ))}
      {!disabled && (
        <div>
          <Button size="sm" icon={<Plus />} disabled={rows.length >= 20} onClick={add}>
            Add band
          </Button>
        </div>
      )}
    </div>
  );
}
