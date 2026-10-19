import type { CatalogueModule } from "../api/access";

/* The module's grantable permissions grouped by resource, with a "select all" per resource */
export function PermissionTree({
  catalogue,
  selected,
  onChange,
  disabled
}: {
  catalogue: CatalogueModule;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const toggle = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  };

  return (
    <div className="perm-tree">
      {catalogue.resources.map(r => {
        const keys = r.permissions.map(p => p.key);
        const count = keys.filter(k => selected.has(k)).length;
        const all = count === keys.length;
        return (
          <div key={r.resource} className="perm-group">
            <div className="perm-group-head">
              <label className="check" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={all}
                  ref={el => {
                    if (el) el.indeterminate = count > 0 && !all;
                  }}
                  disabled={disabled}
                  onChange={() => toggle(keys, !all)}
                  aria-label={`All of ${r.label}`}
                />
                {r.label}
              </label>
              <span className="small muted">
                {count} of {keys.length}
              </span>
            </div>
            <div className="perm-items">
              {r.permissions.map(p => (
                <div key={p.key} className="perm-item">
                  <label className="check">
                    <input type="checkbox" checked={selected.has(p.key)} disabled={disabled} onChange={e => toggle([p.key], e.target.checked)} />
                    <span>
                      {p.label}
                      <span className="perm-key">{p.key}</span>
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
