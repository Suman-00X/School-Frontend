/* PATCH bodies for the users endpoints: only the fields that changed. The API takes no nulls,
   so a cleared text field is sent as "" and a cleared date, choice or phone (which can't be
   emptied once set) comes back as a field error instead of being sent. */
export function patchFrom<T extends Record<string, string>>(
  original: T,
  current: T,
  textKeys: readonly string[]
): { body: Record<string, string>; errors: Record<string, string> } {
  const body: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const key of Object.keys(current)) {
    const now = current[key].trim();
    if (now === (original[key] ?? "").trim()) continue;
    if (now !== "" || textKeys.includes(key)) body[key] = now;
    else errors[key] = "can't be cleared once set";
  }
  return { body, errors };
}

/* Fields of each form that may be emptied */
export const PERSON_TEXT_KEYS = ["middleName", "address"];
export const EMPLOYMENT_TEXT_KEYS = ["qualification", "bloodGroup", "description"];

/* Only these keys of a combined form's values */
export const pick = <T extends Record<string, unknown>>(values: T, keys: readonly string[]) =>
  Object.fromEntries(keys.map(k => [k, values[k]])) as Record<string, string>;
