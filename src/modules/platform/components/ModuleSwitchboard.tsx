import { Lock } from "lucide-react";
import { Badge, Button, Switch } from "@/common/ui";
import type { CatalogueModule } from "../api/schools";

/* Every module as a tile with an on/off switch. Core modules are always on (locked);
   `value` holds the switched-on add-on modules. */
export function ModuleSwitchboard({
  catalogue,
  value,
  onChange,
  disabled
}: {
  catalogue: CatalogueModule[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const core = catalogue.filter(m => m.core);
  const addOns = catalogue.filter(m => !m.core);
  const on = new Set(value);
  const toggle = (key: string, checked: boolean) =>
    onChange(addOns.map(m => m.key).filter(k => (k === key ? checked : on.has(k))));

  return (
    <div className="stack">
      <div className="module-section">
        <div className="module-section-head">
          <span className="module-section-title">Add-on modules</span>
          <span className="small muted">
            {on.size} of {addOns.length} switched on
          </span>
          <span className="row" style={{ marginLeft: "auto" }}>
            <Button size="sm" variant="ghost" disabled={disabled || on.size === addOns.length} onClick={() => onChange(addOns.map(m => m.key))}>
              Switch all on
            </Button>
            <Button size="sm" variant="ghost" disabled={disabled || on.size === 0} onClick={() => onChange([])}>
              Switch all off
            </Button>
          </span>
        </div>
        <div className="module-grid">
          {addOns.map(m => (
            <label key={m.key} className={`module-tile${on.has(m.key) ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}>
              <span className="module-tile-text">
                <span className="module-tile-name">{m.label}</span>
                <span className="module-tile-desc">{m.description}</span>
              </span>
              <Switch checked={on.has(m.key)} disabled={disabled} onChange={checked => toggle(m.key, checked)} />
            </label>
          ))}
        </div>
      </div>
      <div className="module-section">
        <div className="module-section-head">
          <span className="module-section-title">Always included</span>
          <span className="small muted">Every school needs these</span>
        </div>
        <div className="module-grid">
          {core.map(m => (
            <div key={m.key} className="module-tile is-core">
              <span className="module-tile-text">
                <span className="module-tile-name">{m.label}</span>
                <span className="module-tile-desc">{m.description}</span>
              </span>
              <Badge tone="neutral">
                <Lock size={11} /> Included
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
