import type { LeaveBalance } from "../api/leaves";
import "../../shared/hr.css";

const pct = (part: number, whole: number) => `${whole > 0 ? Math.min(100, (part / whole) * 100) : 0}%`;

/* Used (approved) and pending days against the year's quota */
export function BalanceBar({ balance, legend = true }: { balance: LeaveBalance; legend?: boolean }) {
  const { quota, used, pending, remaining } = balance;
  const over = used + pending > quota;
  return (
    <div>
      <div
        className="hr-bar"
        role="img"
        aria-label={`${used} used and ${pending} pending of ${quota} days; ${remaining} remaining`}
        title={`${used} used · ${pending} pending · ${remaining} left of ${quota}`}
      >
        <span className={over ? "is-over" : "is-used"} style={{ width: pct(used, quota) }} />
        <span className="is-pending" style={{ width: pct(pending, quota) }} />
      </div>
      {legend && (
        <div className="hr-bar-legend">
          <span>
            <i style={{ background: "var(--primary)" }} />
            {used} used
          </span>
          <span>
            <i style={{ background: "var(--warning)" }} />
            {pending} pending
          </span>
          <span>
            <strong style={{ color: "var(--text)" }}>{remaining}</strong> left of {quota}
          </span>
        </div>
      )}
    </div>
  );
}
