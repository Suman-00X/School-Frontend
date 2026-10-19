import { useId, useMemo, useState } from "react";
import { Alert, Button, Field, PersonCell, RoleBadge, SearchInput, Spinner, TextInput } from "@/common/ui";
import { useEmployees, type Person } from "../api/people";
import "../access.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SHOWN = 8;

/* The person a resolved id stands for (from the employee lists or known people) */
export function usePersonById(id: string | null | undefined, known: Person[] = []) {
  const { people } = useEmployees();
  return useMemo<Person | null>(() => {
    if (!id) return null;
    return people.find(p => p.id === id) ?? known.find(p => p.id === id) ?? { id, name: `User ${id.slice(0, 8)}…` };
  }, [id, people, known]);
}

/* Pick an employee. Search runs on the client over GET /users/staff and /users/teachers.
   Someone who can't list them (module owners) picks from `known` people or pastes a user id. */
export function PersonPicker({
  label,
  value,
  onChange,
  known = [],
  exclude = [],
  required,
  error,
  hint,
  disabled
}: {
  label: string;
  value: Person | null;
  onChange: (p: Person | null) => void;
  known?: Person[];
  exclude?: string[];
  required?: boolean;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const { people, canList, isLoading } = useEmployees();
  const [search, setSearch] = useState("");
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const pool = useMemo(() => {
    const byId = new Map<string, Person>();
    for (const p of [...people, ...known]) if (!exclude.includes(p.id) && p.role !== "ADMIN") byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [people, known, exclude]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return canList ? [] : pool;
    return pool.filter(p => p.name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q));
  }, [pool, search, canList]);

  if (value)
    return (
      <Field label={label} required={required} error={error} hint={hint}>
        <div className="picker-selected">
          <PersonCell name={value.name} sub={value.email} extra={<RoleBadge role={value.role} />} />
          {!disabled && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              Change
            </Button>
          )}
        </div>
      </Field>
    );

  const usePasted = () => {
    const v = pasted.trim();
    if (!UUID.test(v)) return setPasteError("must be a user id such as 3f2c…-…");
    if (exclude.includes(v)) return setPasteError("pick someone else");
    setPasteError(null);
    setPasted("");
    onChange(pool.find(p => p.id === v) ?? { id: v, name: `User ${v.slice(0, 8)}…` });
  };

  return (
    <Field label={label} required={required} error={error} hint={hint} htmlFor={id}>
      <div className="stack-sm">
        {!canList && (
          <Alert tone="info">
            You can't search the school's staff list.{" "}
            {known.length ? "Pick someone who already has access in this module, or paste a user id." : "Paste the person's user id."}
          </Alert>
        )}
        {(canList || known.length > 0) && (
          <SearchInput
            id={id}
            placeholder={canList ? "Search staff and teachers by name or email" : "Filter by name or email"}
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
        )}
        {isLoading && canList && (
          <span className="row small muted">
            <Spinner /> Loading staff and teachers…
          </span>
        )}
        {matches.length > 0 && (
          <div className="picker-list" role="listbox" aria-label={label}>
            {matches.slice(0, MAX_SHOWN).map(p => (
              <button key={p.id} type="button" role="option" aria-selected={false} className="picker-option" onClick={() => onChange(p)} disabled={disabled}>
                <PersonCell name={p.name} sub={p.email} extra={<RoleBadge role={p.role} />} />
              </button>
            ))}
            {matches.length > MAX_SHOWN && (
              <div className="small muted" style={{ padding: "6px 10px" }}>
                {matches.length - MAX_SHOWN} more: type more of the name
              </div>
            )}
          </div>
        )}
        {canList && search.trim() && !isLoading && matches.length === 0 && (
          <div className="small muted">No staff member or teacher matches “{search.trim()}”.</div>
        )}
        {!canList && (
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <TextInput
                placeholder="User id"
                value={pasted}
                onChange={e => setPasted(e.target.value)}
                error={pasteError}
                disabled={disabled}
                aria-label="User id"
              />
            </div>
            <Button onClick={usePasted} disabled={disabled || !pasted.trim()}>
              Use
            </Button>
          </div>
        )}
      </div>
    </Field>
  );
}
