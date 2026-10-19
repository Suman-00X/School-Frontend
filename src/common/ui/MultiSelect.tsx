import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { Field } from "./Form";
import type { Option } from "./Select";

/* A dropdown that picks several options (ticks), in the same style as Select. The trigger is one
   line ("Class 6, Class 7" or "12 selected"), so picking never changes the field's height.
   The list has a search box above SEARCH_FROM options, and "Select all" / "Clear" at the bottom. */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Choose…",
  label,
  hint,
  error,
  fieldClassName,
  className,
  disabled,
  required,
  searchable,
  max,
  noun = "selected",
  "aria-label": ariaLabel
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  /* At most this many can be picked */
  max?: number;
  /* "12 students" rather than "12 selected" */
  noun?: string;
  "aria-label"?: string;
}) {
  const auto = useId();
  const listId = `${auto}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const withSearch = searchable ?? options.length > 10;
  const chosen = useMemo(() => new Set(value), [value]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const position = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const width = Math.max(r.width, 220);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    if (below < 220 && above > below) setPlace({ left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(360, above) });
    else setPlace({ left, width, top: r.bottom + 4, maxHeight: Math.min(360, below) });
  }, []);

  const hide = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popRef.current?.contains(t)) hide(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position]);

  useLayoutEffect(() => {
    if (open) (withSearch ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
  }, [open, withSearch]);

  useLayoutEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const full = max !== undefined && value.length >= max;
  const toggle = (o: Option) => {
    if (o.disabled) return;
    if (chosen.has(o.value)) onChange(value.filter(v => v !== o.value));
    else if (!full) onChange([...value, o.value]);
  };

  const shown = rows.filter(o => !o.disabled);
  const allShownChosen = shown.length > 0 && shown.every(o => chosen.has(o.value));
  const selectShown = () => {
    const next = [...value];
    for (const o of shown) if (!chosen.has(o.value) && (max === undefined || next.length < max)) next.push(o.value);
    onChange(next);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => Math.max(0, a - 1));
    } else if (e.key === "Enter" || (e.key === " " && !withSearch)) {
      e.preventDefault();
      if (rows[active]) toggle(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hide();
    } else if (e.key === "Tab") hide(false);
  };

  const labels = options.filter(o => chosen.has(o.value)).map(o => o.label);
  const summary = value.length === 0 ? placeholder : value.length <= 3 && labels.length === value.length ? labels.join(", ") : `${value.length} ${noun}`;

  const trigger = (
    <button
      ref={triggerRef}
      id={auto}
      type="button"
      className={`select select-trigger${value.length === 0 ? " is-placeholder" : ""}${error ? " invalid" : ""}${className ? " " + className : ""}`}
      disabled={disabled}
      title={labels.join(", ") || undefined}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-invalid={!!error || undefined}
      onClick={() => {
        if (open) return hide();
        setQuery("");
        setActive(0);
        position();
        setOpen(true);
      }}
      onKeyDown={e => {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setQuery("");
          setActive(0);
          position();
          setOpen(true);
        }
      }}
    >
      <span className="select-value">{summary}</span>
    </button>
  );

  const pop =
    open &&
    place &&
    createPortal(
      <div ref={popRef} className="select-pop" style={{ ...place }} onKeyDown={onKey}>
        {withSearch && (
          <div className="select-search">
            <Search />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search"
              value={query}
              aria-label="Search options"
              onChange={e => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          </div>
        )}
        <div ref={listRef} id={listId} role="listbox" aria-multiselectable="true" tabIndex={-1} className="select-list" aria-labelledby={auto}>
          {rows.length === 0 && <div className="select-empty">No matches</div>}
          {rows.map((o, i) => {
            const on = chosen.has(o.value);
            const blocked = o.disabled || (!on && full);
            return (
              <div
                key={o.value}
                data-index={i}
                role="option"
                aria-selected={on}
                aria-disabled={blocked || undefined}
                className={`select-option${i === active ? " is-active" : ""}${on ? " is-selected" : ""}`}
                onMouseMove={() => active !== i && setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => toggle(o)}
              >
                <input type="checkbox" checked={on} readOnly tabIndex={-1} disabled={blocked} style={{ pointerEvents: "none" }} />
                <span className="select-option-text">
                  <span>{o.label}</span>
                  {o.description && <span className="select-option-desc">{o.description}</span>}
                </span>
              </div>
            );
          })}
        </div>
        <div className="row-between" style={{ padding: "6px 8px", borderTop: "1px solid var(--border)", flex: "none" }}>
          <span className="small muted">
            {value.length} {noun}
            {max !== undefined && ` (max ${max})`}
          </span>
          <span className="row" style={{ gap: 4 }}>
            {!allShownChosen && shown.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onMouseDown={e => e.preventDefault()} onClick={selectShown}>
                {query.trim() ? "Select matches" : "Select all"}
              </button>
            )}
            {value.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </span>
        </div>
      </div>,
      document.body
    );

  if (label === undefined && hint === undefined && error === undefined)
    return (
      <>
        {trigger}
        {pop}
      </>
    );
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={auto} className={fieldClassName}>
      {trigger}
      {pop}
    </Field>
  );
}
