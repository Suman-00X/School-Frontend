import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { Check, Search } from "lucide-react";
import { Field } from "./Form";

export type Option = { value: string; label: string; disabled?: boolean; description?: string };

export type SelectProps = {
  options: Option[];
  value?: string;
  /* Shown while nothing is chosen. When the field isn't required it is also the first row, to clear the choice. */
  placeholder?: string;
  /* Called like a native select's onChange; only target.value and target.name are set */
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  /* Default: a search box when there are more than SEARCH_FROM options */
  searchable?: boolean;
  /* The search can also pick what was typed when no option matches it (implies searchable) */
  creatable?: boolean;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  fieldClassName?: string;
  id?: string;
  name?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
};

const SEARCH_FROM = 10;
const LIST_MAX = 320;
const GAP = 4;

type Row = Option & { clear?: boolean };
type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/* A dropdown in the app's own style (not the browser's): a button that opens a list of options,
   with a search box for long lists. Drop-in for the old native select: same props, and onChange
   gets { target: { value } }. The list is portalled, so drawers and dialogs never clip it. */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(props, ref) {
  const { label, hint, error, fieldClassName, id, className, required, options, placeholder, value = "", onChange, onBlur, name, disabled, style, title } = props;
  const auto = useId();
  const triggerId = id ?? auto;
  const listId = `${triggerId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<Place | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const { creatable } = props;
  const searchable = creatable || (props.searchable ?? options.length > SEARCH_FROM);
  const selected = options.find(o => o.value === value);
  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching: Row[] = q ? options.filter(o => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)) : [...options];
    if (creatable && q && !options.some(o => o.label.toLowerCase() === q)) matching.push({ value: query.trim(), label: `Use “${query.trim()}”` });
    /* A typed value from before stays visible (and ticked) at the top */
    else if (creatable && !q && value && !options.some(o => o.value === value)) matching.unshift({ value, label: value });
    return placeholder !== undefined && !required && !q ? [{ value: "", label: placeholder, clear: true }, ...matching] : matching;
  }, [options, query, placeholder, required, creatable, value]);

  const setRefs = useCallback(
    (el: HTMLButtonElement | null) => {
      triggerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );

  const position = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - GAP * 2;
    const above = r.top - GAP * 2;
    const width = Math.max(r.width, 200);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    /* Opens upwards only when the list wouldn't fit below and there is more room above */
    if (below < Math.min(LIST_MAX, 200) && above > below)
      setPlace({ left, width, bottom: window.innerHeight - r.top + GAP, maxHeight: Math.min(LIST_MAX, above) });
    else setPlace({ left, width, top: r.bottom + GAP, maxHeight: Math.min(LIST_MAX, below) });
  }, []);

  const show = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, rows.findIndex(r => r.value === value)));
    position();
    setOpen(true);
  };
  const hide = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (row: Row) => {
    if (row.disabled) return;
    hide();
    if (row.value === value) return;
    const target = { value: row.value, name: name ?? "" };
    onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>);
  };

  /* Keep the list on the trigger while the page or a drawer scrolls; close on a click outside */
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
    if (!open) return;
    (searchable ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
  }, [open, searchable]);

  useLayoutEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < rows.length; i += dir) if (!rows[i].disabled) return i;
    return from;
  };

  /* Type-ahead without a search box: jump to the first option starting with what was typed */
  const typeAhead = (key: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at > 700 ? key : typed.current.text + key, at: now };
    const t = typed.current.text.toLowerCase();
    const i = rows.findIndex(r => !r.disabled && !r.clear && r.label.toLowerCase().startsWith(t));
    if (i >= 0) setActive(i);
  };

  const onListKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(a => step(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(a => step(a, -1));
        break;
      case "Home":
        if (searchable) return;
        e.preventDefault();
        setActive(step(-1, 1));
        break;
      case "End":
        if (searchable) return;
        e.preventDefault();
        setActive(step(rows.length, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (rows[active]) choose(rows[active]);
        break;
      case " ":
        if (searchable) return;
        e.preventDefault();
        if (rows[active]) choose(rows[active]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        hide();
        break;
      case "Tab":
        hide();
        break;
      default:
        if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey) typeAhead(e.key);
    }
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (open) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      show();
    }
  };

  /* A typed value (creatable) shows as itself; an id not in the options (still loading) shows the placeholder */
  const typedValue = creatable && !!value && !selected;
  const shown = selected?.label ?? (typedValue ? value : placeholder);
  const trigger = (
    <button
      ref={setRefs}
      id={triggerId}
      type="button"
      name={name}
      className={`select select-trigger${!selected && !typedValue ? " is-placeholder" : ""}${error ? " invalid" : ""}${className ? " " + className : ""}`}
      style={style}
      title={title ?? selected?.label}
      disabled={disabled}
      aria-label={props["aria-label"]}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-invalid={!!error || undefined}
      aria-required={required || undefined}
      onClick={() => (open ? hide() : show())}
      onKeyDown={onTriggerKey}
      onBlur={onBlur}
    >
      <span className="select-value">{shown ?? " "}</span>
    </button>
  );

  const popover =
    open &&
    place &&
    createPortal(
      <div
        ref={popRef}
        className="select-pop"
        style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
        onKeyDown={onListKey}
      >
        {searchable && (
          <div className="select-search">
            <Search />
            <input
              ref={searchRef}
              type="text"
              placeholder={creatable ? "Search or type" : "Search"}
              value={query}
              aria-label="Search options"
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              onChange={e => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          </div>
        )}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="select-list"
          aria-labelledby={triggerId}
          aria-activedescendant={!searchable && active >= 0 ? `${listId}-${active}` : undefined}
        >
          {rows.length === 0 && <div className="select-empty">No matches</div>}
          {rows.map((r, i) => {
            const isSelected = r.clear ? !value : r.value === value;
            return (
              <div
                key={r.clear ? "\0clear" : r.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-disabled={r.disabled || undefined}
                className={`select-option${i === active ? " is-active" : ""}${isSelected ? " is-selected" : ""}${r.clear ? " is-clear" : ""}`}
                onMouseMove={() => !r.disabled && active !== i && setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => choose(r)}
              >
                <span className="select-option-text">
                  <span>{r.label}</span>
                  {r.description && <span className="select-option-desc">{r.description}</span>}
                </span>
                {isSelected && !r.clear && <Check />}
              </div>
            );
          })}
        </div>
      </div>,
      document.body
    );

  const control = (
    <>
      {trigger}
      {popover}
    </>
  );
  if (label === undefined && hint === undefined && !("error" in props)) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={triggerId} className={fieldClassName}>
      {control}
    </Field>
  );
});
