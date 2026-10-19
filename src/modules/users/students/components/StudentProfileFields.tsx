import { TextInput, Textarea } from "@/common/ui";
import type { StudentProfileValues } from "../api/students";

type Bind = {
  values: StudentProfileValues;
  errors: Record<string, string>;
  set: (key: keyof StudentProfileValues, value: string) => void;
};

/* Admission number, date and the other profile fields (the backend's student profileSchema) */
export function StudentProfileFields({ form, disabled }: { form: Bind; disabled?: boolean }) {
  const f = (key: keyof StudentProfileValues) => ({
    value: form.values[key],
    error: form.errors[key],
    disabled,
    onChange: (e: { target: { value: string } }) => form.set(key, e.target.value)
  });
  return (
    <div className="form-grid">
      <TextInput label="Admission number" required maxLength={50} autoComplete="off" {...f("admissionNumber")} />
      <TextInput label="Admission date" type="date" {...f("admissionDate")} />
      <TextInput label="Blood group" maxLength={10} placeholder="e.g. O+" {...f("bloodGroup")} />
      <TextInput label="Category" maxLength={50} placeholder="e.g. General" {...f("category")} />
      <TextInput label="Religion" maxLength={50} {...f("religion")} />
      <Textarea label="Notes" rows={2} maxLength={1000} fieldClassName="span-2" {...f("description")} />
    </div>
  );
}
