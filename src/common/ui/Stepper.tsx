import { Check } from "lucide-react";

/* Numbered steps for wizards. Steps before the current one can be clicked to go back. */
export function Stepper({ steps, current, onStepClick }: { steps: string[]; current: number; onStepClick?: (index: number) => void }) {
  return (
    <ol className="stepper" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "";
        const content = (
          <>
            <span className="step-num">{i < current ? <Check size={13} /> : i + 1}</span>
            {label}
          </>
        );
        return (
          <li key={label} style={{ flex: 1, display: "flex" }}>
            {onStepClick && i < current ? (
              <button type="button" className={`step ${state}`} onClick={() => onStepClick(i)}>
                {content}
              </button>
            ) : (
              <div className={`step ${state}`} aria-current={i === current ? "step" : undefined}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
