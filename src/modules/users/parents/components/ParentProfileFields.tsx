import { TextInput, Textarea } from "@/common/ui";
import type { ParentProfileValues } from "../utils/profile";

type Bind = {
  values: ParentProfileValues;
  errors: Record<string, string>;
  set: (key: keyof ParentProfileValues, value: string) => void;
};

/* Occupation, annual income and notes (the backend's parentProfileSchema) */
export function ParentProfileFields({ form, disabled, currency }: { form: Bind; disabled?: boolean; currency?: string }) {
  const f = (key: keyof ParentProfileValues) => ({
    value: form.values[key],
    error: form.errors[key],
    disabled,
    onChange: (e: { target: { value: string } }) => form.set(key, e.target.value)
  });
  return (
    <div className="form-grid">
      <TextInput label="Occupation" maxLength={100} {...f("occupation")} />
      <TextInput
        label={currency ? `Annual income (${currency})` : "Annual income"}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        {...f("annualIncome")}
      />
      <Textarea label="Notes" rows={2} maxLength={1000} fieldClassName="span-2" {...f("description")} />
    </div>
  );
}
