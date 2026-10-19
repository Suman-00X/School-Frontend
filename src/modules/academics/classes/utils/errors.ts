import { isApiError } from "@/common/api";

/* 409s name the column ("A record with this classOrder already exists"): put them on the field */
export function classConflict(err: unknown): Record<string, string> | null {
  if (!isApiError(err) || err.status !== 409) return null;
  if (/classOrder/.test(err.message)) return { classOrder: "Another class already has this order" };
  if (/className/.test(err.message)) return { className: "A class with this name already exists" };
  return null;
}
