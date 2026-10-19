import { formatDate } from "@/common/utils/format";
import type { InstallmentPlan } from "../api/installmentPlans";
import "./installmentPlans.css";

/* A plan's due dates and shares: a bar split by share, then each installment's date */
export function PlanTimeline({ plan }: { plan: Pick<InstallmentPlan, "installments"> }) {
  return (
    <div className="plan-timeline">
      <div className="plan-bar" aria-hidden>
        {plan.installments.map((i, n) => (
          <span key={i.id} style={{ flexGrow: i.sharePercent, opacity: n % 2 ? 0.6 : 1 }} title={`${i.name}: ${i.sharePercent}%`} />
        ))}
      </div>
      <ol className="plan-dates">
        {plan.installments.map(i => (
          <li key={i.id}>
            <span className="plan-date">{formatDate(i.dueDate)}</span>
            <span className="small muted">
              {i.name} · {i.sharePercent}%
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
