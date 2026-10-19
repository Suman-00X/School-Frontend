import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { TabItem } from "@/common/ui/Tabs";

/* The shell's header shows the module's submodule tabs. A page that drills into one record
   (a student, an account, an import) or into an area with its own sections replaces them with
   <DrillHeader back title tabs />, like a settings area: back arrow, title, its own tabs. */

type Slot = { node: HTMLElement | null; claim: () => () => void };

export const ShellHeaderContext = createContext<Slot | null>(null);

export function useShellHeaderSlot() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const slot: Slot = {
    node,
    claim: () => {
      setClaims(c => c + 1);
      return () => setClaims(c => c - 1);
    }
  };
  return { slot, setNode, drilled: claims > 0 };
}

export function DrillHeader({
  back,
  backLabel = "Back",
  title,
  tabs,
  value,
  onChange,
  actions
}: {
  back: string;
  backLabel?: string;
  title: ReactNode;
  tabs?: TabItem[];
  value?: string;
  onChange?: (id: string) => void;
  /* Small actions on the right of the header (keep page actions in the page) */
  actions?: ReactNode;
}) {
  const slot = useContext(ShellHeaderContext);
  const claim = slot?.claim;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => claim?.(), []);
  if (!slot?.node) return null;
  return createPortal(
    <div className="drill">
      <Link to={back} className="drill-back" aria-label={backLabel} title={backLabel}>
        <ArrowLeft />
      </Link>
      <div className="drill-title" title={typeof title === "string" ? title : undefined}>
        {title}
      </div>
      {tabs && (
        <nav className="header-tabs" role="tablist">
          {tabs
            .filter(t => !t.hidden)
            .map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === value}
                className={`header-tab${t.id === value ? " active" : ""}`}
                onClick={() => onChange?.(t.id)}
              >
                {t.label}
                {t.count !== undefined && <span className="header-tab-count">{t.count}</span>}
              </button>
            ))}
        </nav>
      )}
      {actions && <div className="drill-actions">{actions}</div>}
    </div>,
    slot.node
  );
}
