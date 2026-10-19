import { Badge } from "@/common/ui";
import { STATUS_CHOICES } from "../api/attendance";
import "./attendance.css";

/* "92.5%", with a bar coloured by level (below 75% red, below 85% amber) */
export function Percent({ value, bar }: { value: number | null | undefined; bar?: boolean }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  if (!bar) return <>{value}%</>;
  const level = value < 75 ? "is-low" : value < 85 ? "is-mid" : "is-ok";
  return (
    <span className={`pct ${level}`}>
      <span className="progress" aria-hidden>
        <div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </span>
      <span className="pct-value">{value}%</span>
    </span>
  );
}

/* An attendance status in its colour */
export function AttendanceBadge({ status }: { status: string | null | undefined }) {
  const c = STATUS_CHOICES.find(x => x.value === status);
  if (!c) return <span className="muted">Not marked</span>;
  return (
    <Badge tone={c.tone} dot>
      {c.label}
    </Badge>
  );
}
