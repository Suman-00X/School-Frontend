import type { ReactNode } from "react";
import "./hostel.css";

/* A label over a value, in a header card; a grey bar while the value loads */
export function Fact({ label, value }: { label: string; value: ReactNode | undefined }) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">{value === undefined ? <span className="skeleton" style={{ display: "inline-block", width: 110, height: 14 }} /> : value}</span>
    </div>
  );
}

/* Beds taken of beds in all: "4 / 7" with a small bar */
export function BedsUsed({ occupied, capacity }: { occupied: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  return (
    <span className="beds-used" title={`${occupied} of ${capacity} beds taken`}>
      <span className="beds-used-text">
        {occupied} / {capacity}
      </span>
      <span className="progress" aria-hidden>
        <div style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
