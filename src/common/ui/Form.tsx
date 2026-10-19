import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Check, Circle, Eye, EyeOff, Search } from "lucide-react";

/* Label + control + hint/error. Pass the control as children, or use the field-wrapped inputs below. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${className ? " " + className : ""}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {/* Always rendered: an error appearing replaces the hint in the same reserved line */}
      <div className={`field-message${error ? " field-error" : " field-hint"}`} role={error ? "alert" : undefined} title={typeof (error ?? hint) === "string" ? (error ?? hint) as string : undefined}>
        {error ?? hint}
      </div>
    </div>
  );
}

type Common = { label?: ReactNode; hint?: ReactNode; error?: string | null; fieldClassName?: string };

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & Common;

/* Wrapped in a Field (label + reserved message line) when it has a label or hint, or when an
   `error` prop is passed at all, even undefined: the markup then stays the same when an error arrives */
const wantsField = (props: object & Common) => props.label !== undefined || props.hint !== undefined || "error" in props;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(props, ref) {
  const { label, hint, error, fieldClassName, id, className, required, ...rest } = props;
  const auto = useId();
  const inputId = id ?? auto;
  const input = (
    <input
      ref={ref}
      id={inputId}
      className={`input${error ? " invalid" : ""}${className ? " " + className : ""}`}
      aria-invalid={!!error || undefined}
      required={required}
      {...rest}
    />
  );
  if (!wantsField(props)) return input;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={fieldClassName}>
      {input}
    </Field>
  );
});

export function PasswordInput(props: Omit<TextInputProps, "type">) {
  const [show, setShow] = useState(false);
  const auto = useId();
  const id = props.id ?? auto;
  const { label, hint, error, fieldClassName, className, required, ...rest } = props;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={fieldClassName}>
      <div className="input-group">
        <input
          id={id}
          type={show ? "text" : "password"}
          className={`input${error ? " invalid" : ""}${className ? " " + className : ""}`}
          aria-invalid={!!error || undefined}
          required={required}
          {...rest}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon input-addon"
          onClick={() => setShow(s => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </Field>
  );
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`input-group${className ? " " + className : ""}`}>
      <Search className="icon-left" />
      <input type="search" className="input has-icon-left" {...rest} />
    </div>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Common;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, fieldClassName, id, className, required, ...rest },
  ref
) {
  const auto = useId();
  const areaId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={areaId} className={fieldClassName}>
      <textarea
        ref={ref}
        id={areaId}
        className={`textarea${error ? " invalid" : ""}${className ? " " + className : ""}`}
        aria-invalid={!!error || undefined}
        required={required}
        {...rest}
      />
    </Field>
  );
});

export function Checkbox({
  label,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode }) {
  return (
    <label className={`check${className ? " " + className : ""}`}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

/* A few choices shown at once, each with an optional line of explanation. Better than a
   dropdown when there are two to four options the reader should compare. */
export function RadioGroup<V extends string>({
  name,
  options,
  value,
  onChange,
  disabled,
  title,
  "aria-label": ariaLabel
}: {
  name?: string;
  options: { value: V; label: ReactNode; description?: ReactNode }[];
  value: V | "";
  onChange: (value: V) => void;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}) {
  const auto = useId();
  return (
    <div className="radio-group" role="radiogroup" aria-label={ariaLabel} title={title}>
      {options.map(o => (
        <label key={o.value} className={`radio-option${o.value === value ? " is-checked" : ""}${disabled ? " is-disabled" : ""}`}>
          <input type="radio" name={name ?? auto} value={o.value} checked={o.value === value} disabled={disabled} onChange={() => onChange(o.value)} />
          <span>
            <span className="radio-label">{o.label}</span>
            {o.description && <span className="radio-desc">{o.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
  disabled
}: {
  label?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="switch-track" />
      {label && <span>{label}</span>}
    </label>
  );
}

/* The backend's password policy: 8–128 characters, a Latin letter and a digit */
export const passwordChecks = (pw: string) => [
  { label: "8 to 128 characters", ok: pw.length >= 8 && pw.length <= 128 },
  { label: "At least one letter (A–Z)", ok: /[A-Za-z]/.test(pw) },
  { label: "At least one digit", ok: /\d/.test(pw) }
];

export const passwordOk = (pw: string) => passwordChecks(pw).every(c => c.ok);

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="checklist">
      {passwordChecks(password).map(c => (
        <li key={c.label} className={c.ok ? "ok" : ""}>
          {c.ok ? <Check /> : <Circle />}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
