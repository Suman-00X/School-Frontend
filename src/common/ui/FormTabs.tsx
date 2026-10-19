import { useEffect, useState, type ReactNode } from "react";

export type FormTab = {
  id: string;
  label: string;
  /* One line above the tab's fields */
  hint?: ReactNode;
  /* Fields on this tab with an error: shown as a count on the tab */
  errors?: number;
  content: ReactNode;
};

/* A long form split into tabs of related fields, saved together by one button below it:
   <FormTabs attempt={attempts} tabs={[{ id: "personal", label: "Personal details", errors: 2, content: … }]} />
   Every tab stays mounted, so moving between tabs keeps what was typed. Bump `attempt` on each
   failed save: if the open tab has no errors, the first tab that has some is opened. */
export function FormTabs({ tabs, attempt = 0 }: { tabs: FormTab[]; attempt?: number }) {
  const [value, setValue] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    if (!attempt || tabs.find(t => t.id === value)?.errors) return;
    const first = tabs.find(t => t.errors);
    if (first) setValue(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <section className="card form-tabs">
      <div className="tabs" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            id={`form-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={t.id === value}
            aria-controls={`form-panel-${t.id}`}
            className={`tab${t.id === value ? " active" : ""}`}
            onClick={() => setValue(t.id)}
          >
            {t.label}
            {!!t.errors && (
              <span className="tab-errors" aria-label={`${t.errors} field${t.errors === 1 ? "" : "s"} to correct`}>
                {t.errors}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Panels share one grid cell: the card is as tall as its tallest tab, so the buttons below
          don't move when switching tabs */}
      <div className="form-tab-panels">
        {tabs.map(t => (
          <div
            key={t.id}
            id={`form-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`form-tab-${t.id}`}
            className="form-tab-panel"
            hidden={t.id !== value}
          >
            {t.hint && <p className="muted small form-tab-hint">{t.hint}</p>}
            {t.content}
          </div>
        ))}
      </div>
    </section>
  );
}

/* How many of `keys` have an error, for FormTab.errors */
export const errorCount = (errors: Record<string, string>, keys: readonly string[]) => keys.filter(k => errors[k]).length;
