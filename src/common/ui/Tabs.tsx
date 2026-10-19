import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

export type TabItem = { id: string; label: ReactNode; count?: number; hidden?: boolean };

export function Tabs({ tabs, value, onChange }: { tabs: TabItem[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs
        .filter(t => !t.hidden)
        .map(t => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === value}
            className={`tab${t.id === value ? " active" : ""}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {t.count !== undefined && <span className="badge">{t.count}</span>}
          </button>
        ))}
    </div>
  );
}

/* The open tab kept in the URL (?tab=), so a refresh or shared link keeps it */
export function useTabParam(tabs: TabItem[], param = "tab"): [string, (id: string) => void] {
  const [params, setParams] = useSearchParams();
  const visible = tabs.filter(t => !t.hidden);
  const raw = params.get(param);
  const value = visible.some(t => t.id === raw) ? raw! : (visible[0]?.id ?? "");
  const set = (id: string) =>
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (id === visible[0]?.id) next.delete(param);
        else next.set(param, id);
        return next;
      },
      { replace: true }
    );
  return [value, set];
}
