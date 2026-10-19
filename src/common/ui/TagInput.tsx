import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Field } from "./Form";
import "./TagInput.css";

/* A list of short texts (authors, keywords) typed one at a time: Enter or a comma adds what was
   typed, Backspace in an empty box removes the last one, and each chip has its own remove button.
   What's still in the box when the field loses focus is added too, so nothing typed is lost. */
export function TagInput({
  value,
  onChange,
  label,
  hint,
  error,
  placeholder,
  max,
  maxLength,
  disabled,
  required,
  fieldClassName,
  "aria-label": ariaLabel
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  placeholder?: string;
  /* At most this many entries */
  max?: number;
  /* Characters per entry */
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
  fieldClassName?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const full = max !== undefined && value.length >= max;

  const add = (text: string) => {
    const parts = text
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some(v => v.toLowerCase() === p.toLowerCase()) && (max === undefined || next.length < max)) next.push(p);
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      if (!draft.trim()) return;
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={fieldClassName}>
      <div className={`tag-input${error ? " invalid" : ""}${disabled ? " is-disabled" : ""}`} onClick={() => document.getElementById(id)?.focus()}>
        {value.map((v, i) => (
          <span key={v + i} className="chip">
            {v}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${v}`}>
                <X />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || full}
          maxLength={maxLength}
          placeholder={full ? "" : value.length ? "Add another" : placeholder}
          aria-label={ariaLabel}
          aria-invalid={!!error || undefined}
          onChange={e => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
        />
      </div>
    </Field>
  );
}
