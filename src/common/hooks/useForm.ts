import { useCallback, useState, type ChangeEvent } from "react";
import { isApiError } from "@/common/api";

type Values = Record<string, unknown>;

/* Small form state helper.
   const form = useForm({ firstName: "", email: "" });
   <TextInput {...form.text("firstName")} label="First name" />
   On submit failure: form.setServerErrors(err) maps VALIDATION_ERROR details to fields.
   Server field names can be renamed with a map, e.g. { "user.email": "email" }. */
export function useForm<T extends Values>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues(v => ({ ...v, [key]: value }));
    setErrors(e => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  /* Props for TextInput / Textarea / Select bound to a string field */
  const text = (key: keyof T & string) => ({
    name: key,
    value: (values[key] ?? "") as string,
    error: errors[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value as T[typeof key])
  });

  const setServerErrors = useCallback((err: unknown, fieldMap: Record<string, string> = {}) => {
    if (isApiError(err) && err.isValidation && err.details.length) {
      const mapped: Record<string, string> = {};
      const unplaced: string[] = [];
      for (const d of err.details) {
        const field = fieldMap[d.field] ?? d.field;
        if (field) mapped[field] ??= d.message;
        else unplaced.push(d.message);
      }
      setErrors(mapped);
      setFormError(unplaced.length ? unplaced.join("; ") : "Please correct the highlighted fields.");
      return;
    }
    setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
  }, []);

  const reset = useCallback((next?: T) => {
    setValues(next ?? initial);
    setErrors({});
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { values, setValues, set, text, errors, setErrors, formError, setFormError, setServerErrors, reset };
}

/* Only the fields that changed, for PATCH bodies. Empty strings become null. */
export function changedFields<T extends Values>(original: Partial<T>, current: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(current) as (keyof T)[]) {
    const now = current[key] === "" ? null : current[key];
    const before = original[key] === "" || original[key] === undefined ? null : original[key];
    if (JSON.stringify(now) !== JSON.stringify(before)) out[key] = now as T[keyof T];
  }
  return out;
}

/* Strip empty strings so optional fields are left out of POST bodies */
export function compact<T extends Values>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== "" && v !== undefined && v !== null) out[k as keyof T] = v as T[keyof T];
  return out;
}
