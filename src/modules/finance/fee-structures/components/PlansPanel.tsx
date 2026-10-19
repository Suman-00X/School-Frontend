import { Link } from "react-router-dom";
import { Badge, Checkbox, SkeletonBlock } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { installmentsLabel, type InstallmentPlan } from "../../installment-plans";
import { SETUP_PATHS } from "../../shared";
import "./feeStructures.css";

/* FI-03 plans: which of the year's plans the structure offers, and the default (a radio per row) */
export function PlansPanel({
  plans,
  loading,
  offered,
  defaultId,
  onChange,
  readOnly,
  message
}: {
  plans: Pick<InstallmentPlan, "id" | "name" | "installments">[];
  loading: boolean;
  offered: string[];
  defaultId: string;
  onChange: (offered: string[], defaultId: string) => void;
  readOnly: boolean;
  message: string | null;
}) {
  const toggle = (id: string) => {
    if (offered.includes(id)) {
      const next = offered.filter(x => x !== id);
      onChange(next, defaultId === id ? (next[0] ?? "") : defaultId);
    } else {
      const next = [...offered, id];
      onChange(next, defaultId || id);
    }
  };

  const shown = readOnly ? plans.filter(p => offered.includes(p.id)) : plans;

  return (
    <div className="stack-sm">
      {loading ? (
        <SkeletonBlock lines={3} />
      ) : !shown.length ? (
        <p className="muted small">
          No installment plans in this year yet. <Link to={SETUP_PATHS.installmentPlans}>Create one first</Link>.
        </p>
      ) : (
        <div className="plan-options" role="group" aria-label="Offered plans">
          {shown.map(p => {
            const on = offered.includes(p.id);
            const dates = p.installments.map(i => formatDate(i.dueDate)).join(", ");
            return (
              <div key={p.id} className={`plan-option${on ? " is-on" : ""}`}>
                {readOnly ? (
                  <span style={{ fontWeight: 550 }}>{p.name}</span>
                ) : (
                  <Checkbox label={<span style={{ fontWeight: 550 }}>{p.name}</span>} checked={on} onChange={() => toggle(p.id)} />
                )}
                <span className="small muted plan-option-dates" title={dates}>
                  {installmentsLabel(p.installments.length)} · {dates}
                </span>
                {readOnly ? (
                  defaultId === p.id && <Badge tone="primary">Default</Badge>
                ) : (
                  <label className={`check plan-default${on ? "" : " is-disabled"}`} title={on ? "Students without a plan of their own pay by the default" : "Offer the plan first"}>
                    <input type="radio" name="default-plan" checked={defaultId === p.id} disabled={!on} onChange={() => onChange(offered, p.id)} />
                    Default
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className={`grid-editor-message${message ? " field-error" : ""}`} role={message ? "alert" : undefined} title={message ?? undefined}>
        {message ?? (readOnly ? "" : "Students without a plan of their own pay by the default.")}
      </div>
    </div>
  );
}
