import { Select, TextInput, Textarea } from "@/common/ui";
import { enumOptions } from "@/common/utils/format";
import { BLOOD_GROUPS, EMPLOYMENT_TYPES, GENDERS, TEACHER_QUALIFICATIONS, type EmploymentValues, type PersonValues } from "../utils/person";

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

const qualificationOptions = TEACHER_QUALIFICATIONS.map(q => ({ value: q.value, label: q.value, description: q.description }));
const bloodGroupOptions = BLOOD_GROUPS.map(g => ({ value: g, label: g }));

/* Employment details shared by teachers and staff. A teacher's qualification is picked from the
   common ones (or typed); staff roles vary too much for a list, so theirs stays free text. */
export function EmploymentFields({ form, disabled, teacher }: { form: Bind<EmploymentValues>; disabled?: boolean; teacher?: boolean }) {
  const f = (key: keyof EmploymentValues) => ({
    value: form.values[key],
    error: form.errors[key],
    disabled,
    onChange: (e: { target: { value: string } }) => form.set(key, e.target.value)
  });
  return (
    <div className="form-grid">
      {teacher ? (
        <Select label="Qualification" placeholder="Not set" creatable options={qualificationOptions} {...f("qualification")} />
      ) : (
        <TextInput label="Qualification" maxLength={255} {...f("qualification")} />
      )}
      <TextInput label="Joining date" type="date" {...f("joiningDate")} />
      <Select label="Employment type" placeholder="Not set" options={enumOptions(EMPLOYMENT_TYPES)} {...f("employmentType")} />
      <Select label="Blood group" placeholder="Not set" options={bloodGroupOptions} {...f("bloodGroup")} />
      <Textarea label="Notes" rows={2} fieldClassName="span-2" {...f("description")} />
    </div>
  );
}
