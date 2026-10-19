import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  actions,
  footer,
  flush,
  className,
  children
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  /* No body padding (for tables) */
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`card${flush ? " card-flush" : ""}${className ? " " + className : ""}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className="card-body">{children}</div>}
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

export function Kpi({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="small muted">{hint}</div>}
    </div>
  );
}
