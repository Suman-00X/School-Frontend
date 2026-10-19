import type { Account } from "@/common/api";
import { compact } from "@/common/hooks";

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME"] as const;
export const PARENT_RELATIONS = ["FATHER", "MOTHER", "GUARDIAN"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/* Common teacher qualifications (stored as the text shown). Anything else can be typed in the dropdown. */
export const TEACHER_QUALIFICATIONS: { value: string; description?: string }[] = [
  { value: "NTT", description: "Nursery Teacher Training" },
  { value: "D.El.Ed", description: "Diploma in Elementary Education" },
  { value: "B.El.Ed", description: "Bachelor of Elementary Education" },
  { value: "B.Ed", description: "Bachelor of Education" },
  { value: "M.Ed", description: "Master of Education" },
  { value: "B.P.Ed", description: "Bachelor of Physical Education" },
  { value: "M.P.Ed", description: "Master of Physical Education" },
  { value: "Graduate", description: "B.A., B.Sc., B.Com. or similar" },
  { value: "Post-graduate", description: "M.A., M.Sc., M.Com. or similar" },
  { value: "M.Phil" },
  { value: "Ph.D" }
];

/* Form values are strings; "" means not set */
export type PersonValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  address: string;
};

export type EmploymentValues = {
  qualification: string;
  joiningDate: string;
  employmentType: string;
  bloodGroup: string;
  description: string;
};

export const emptyPerson = (): PersonValues => ({
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  dob: "",
  address: ""
});

export const emptyEmployment = (): EmploymentValues => ({
  qualification: "",
  joiningDate: "",
  employmentType: "",
  bloodGroup: "",
  description: ""
});

/* An account's details as form values (for the edit form) */
export const personFromAccount = (a: Partial<Account>): PersonValues => ({
  firstName: a.firstName ?? "",
  middleName: a.middleName ?? "",
  lastName: a.lastName ?? "",
  email: a.email ?? "",
  phone: a.phone ?? "",
  gender: a.gender ?? "",
  dob: a.dob ?? "",
  address: a.address ?? ""
});

export const employmentFrom = (p: Partial<Record<keyof EmploymentValues, unknown>>): EmploymentValues => ({
  qualification: (p.qualification as string) ?? "",
  joiningDate: (p.joiningDate as string) ?? "",
  employmentType: (p.employmentType as string) ?? "",
  bloodGroup: (p.bloodGroup as string) ?? "",
  description: (p.description as string) ?? ""
});

/* POST bodies leave unset optional fields out (the API rejects "" for phone, dates, enums) */
export const personPayload = (v: PersonValues) => compact({ ...v, email: v.email.trim() });
export const employmentPayload = (v: EmploymentValues) => compact(v);

/* Validation errors on a nested body ("user.email") back onto flat form fields ("email") */
export const nestedFieldMap = (prefix: string, keys: string[]) =>
  Object.fromEntries(keys.map(k => [`${prefix}.${k}`, k]));

export const PERSON_KEYS = Object.keys(emptyPerson());
export const EMPLOYMENT_KEYS = Object.keys(emptyEmployment());

/* The client-side checks Next/Save runs before calling the API */
export function validatePerson(v: PersonValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.firstName.trim()) e.firstName = "is required";
  if (!v.lastName.trim()) e.lastName = "is required";
  if (!v.email.trim()) e.email = "is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "must be a valid email";
  if (v.phone && !/^[+0-9 ()-]{5,20}$/.test(v.phone)) e.phone = "must be a valid phone number";
  return e;
}
