import "./transport.css";

/* Seats used on a route: "12 / 40" with a small bar. No vehicle: no capacity, so a dash. */
export function SeatsBar({ assigned, capacity, wide }: { assigned: number; capacity: number | null; wide?: boolean }) {
  if (capacity === null) return <span className="muted">– / –</span>;
  const pct = capacity > 0 ? Math.min(100, Math.round((assigned / capacity) * 100)) : 0;
  const tone = assigned >= capacity ? " is-full" : pct >= 90 ? " is-near" : "";
  return (
    <div className={`seats-bar${wide ? " seats-bar-wide" : ""}${tone}`} title={`${assigned} of ${capacity} seats taken`}>
      <span className="seats-bar-text">
        {assigned} / {capacity}
      </span>
      <span className="progress" aria-hidden>
        <div style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
