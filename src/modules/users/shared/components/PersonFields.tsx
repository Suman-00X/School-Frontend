import { Select, TextInput, Textarea } from "@/common/ui";
import { enumOptions } from "@/common/utils/format";
import { EMPLOYMENT_TYPES, GENDERS, type EmploymentValues, type PersonValues } from "../utils/person";

type Bind<T> = {
  values: T;
  errors: Record<string, string>;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
};

/* Personal details shared by every kind of person (the backend's personSchema).
   Use with useForm(emptyPerson()) and send personPayload(values) as `user`. */
export function PersonFields({ form, disabled, emailHint }: { form: Bind<PersonValues>; disabled?: boolean; emailHint?: string }) {
  const f = (key: keyof PersonValues) => ({
    value: form.values[key],
    error: form.errors[key],
    disabled,
    onChange: (e: { target: { value: string } }) => form.set(key, e.target.value)
  });
  return (
    <div className="form-grid">
      <TextInput label="First name" required maxLength={100} autoComplete="off" {...f("firstName")} />
      <TextInput label="Middle name" maxLength={100} autoComplete="off" {...f("middleName")} />
      <TextInput label="Last name" required maxLength={100} autoComplete="off" {...f("lastName")} />
      <TextInput label="Email" type="email" required autoComplete="off" hint={emailHint} {...f("email")} />
      <TextInput label="Phone" type="tel" placeholder="+91 98765 43210" {...f("phone")} />
      <Select label="Gender" placeholder="Not set" options={enumOptions(GENDERS)} {...f("gender")} />
      <TextInput label="Date of birth" type="date" {...f("dob")} />
      <Textarea label="Address" maxLength={500} rows={2} fieldClassName="span-2" {...f("address")} />
    </div>
  );
}

/* Employment details shared by teachers and staff */
export function EmploymentFields({ form, disabled }: { form: Bind<EmploymentValues>; disabled?: boolean }) {
  const f = (key: keyof EmploymentValues) => ({
    value: form.values[key],
    error: form.errors[key],
    disabled,
    onChange: (e: { target: { value: string } }) => form.set(key, e.target.value)
  });
  return (
    <div className="form-grid">
      <TextInput label="Qualification" maxLength={255} {...f("qualification")} />
      <TextInput label="Joining date" type="date" {...f("joiningDate")} />
      <Select label="Employment type" placeholder="Not set" options={enumOptions(EMPLOYMENT_TYPES)} {...f("employmentType")} />
      <TextInput label="Blood group" maxLength={10} placeholder="e.g. O+" {...f("bloodGroup")} />
      <Textarea label="Notes" rows={2} fieldClassName="span-2" {...f("description")} />
    </div>
  );
}
