import { TextInput } from "@/common/ui";

type Values = { designation: string; department: string };

/* The staff-only profile fields (beside EmploymentFields) */
export function StaffProfileFields({
  form
}: {
  form: { values: Values; errors: Record<string, string>; set: <K extends keyof Values>(key: K, value: Values[K]) => void };
}) {
  const f = (key: keyof Values) => ({
    value: form.values[key],
    error: form.errors[key],
    onChange: (e: { target: { value: string } }) => form.set(key, e.target.value)
  });
  return (
    <div className="form-grid">
      <TextInput label="Designation" maxLength={100} placeholder="e.g. Office manager" {...f("designation")} />
      <TextInput label="Department" maxLength={100} placeholder="e.g. Administration" {...f("department")} />
    </div>
  );
}
