import { compact } from "@/common/hooks";
import type { Parent, ParentProfileBody } from "../api/parents";

/* Parent profile form values ("" = not set) */
export type ParentProfileValues = { occupation: string; annualIncome: string; description: string };

export const PARENT_PROFILE_KEYS = ["occupation", "annualIncome", "description"];
/* Fields that may be emptied on edit; annual income can't (the API reads an empty value as 0) */
export const PARENT_PROFILE_TEXT_KEYS = ["occupation", "description"];

export const emptyParentProfile = (): ParentProfileValues => ({ occupation: "", annualIncome: "", description: "" });

export const parentProfileFrom = (p: Partial<Parent>): ParentProfileValues => ({
  occupation: p.occupation ?? "",
  annualIncome: p.annualIncome ? String(Number(p.annualIncome)) : "",
  description: p.description ?? ""
});

export const parentProfilePayload = (v: ParentProfileValues): ParentProfileBody => {
  const { annualIncome, ...rest } = compact(v);
  return { ...rest, ...(annualIncome !== undefined && { annualIncome: Number(annualIncome) }) };
};

export function validateParentProfile(v: ParentProfileValues): Record<string, string> {
  const e: Record<string, string> = {};
  const income = v.annualIncome.trim();
  if (income && (!Number.isFinite(Number(income)) || Number(income) < 0)) e.annualIncome = "must be a number, 0 or more";
  else if (income && Number(income) > 9_999_999_999) e.annualIncome = "is too large";
  if (v.occupation.length > 100) e.occupation = "must be at most 100 characters";
  return e;
}
