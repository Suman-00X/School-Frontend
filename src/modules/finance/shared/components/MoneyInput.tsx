import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Field } from "@/common/ui";
import { useMoney } from "../utils/money";
import "../finance.css";

/* An amount in the school's currency: the currency sign inside the box, decimal keyboard on
   phones. Keeps its value as typed text; parse it with parseAmount(). Always wrapped in a Field
   (label + reserved message line), so an error never moves anything. */
export function MoneyInput({
  label,
  hint,
  error,
  fieldClassName,
  id,
  className,
  required,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode; hint?: ReactNode; error?: string | null; fieldClassName?: string }) {
  const money = useMoney();
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={fieldClassName}>
      <div className="input-group money-input">
        <span className="money-sign" aria-hidden>
          {money.symbol}
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={`input${error ? " invalid" : ""}${className ? " " + className : ""}`}
          aria-invalid={!!error || undefined}
          required={required}
          {...rest}
        />
      </div>
    </Field>
  );
}
