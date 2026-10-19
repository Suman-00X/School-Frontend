import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Inbox, XCircle } from "lucide-react";

type AlertTone = "info" | "success" | "warning" | "danger";
const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export function Alert({ tone = "info", title, children, action }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actions
}: {
  icon?: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Inbox />}</div>
      <div className="empty-title">{title}</div>
      {message && <div>{message}</div>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}
