import { isApiError } from "@/common/api";
import { emptyPerson, personPayload, validatePerson, type PersonValues, type UserSummary } from "@/modules/users/shared";
import { emptyParentProfile, parentProfilePayload, validateParentProfile, type ParentProfileValues } from "@/modules/users/parents";
import type { AdmissionParent, ParentRelation } from "../../api/students";

export const STEPS = ["Student", "Parents", "Enrollment", "Review"];
export const MAX_PARENTS = 4;

/* An existing parent as the wizard needs it (from the picker or a sibling's links) */
export type PickedParent = { id: string; parentCode: string; user: UserSummary };

export type ParentCard = {
  key: string;
  mode: "new" | "existing";
  parent: PickedParent | null;
  person: PersonValues;
  profile: ParentProfileValues;
  relation: string;
  isPrimaryContact: boolean;
  /* Field errors (person, profile and relation fields share one map: the names don't clash) */
  errors: Record<string, string>;
  error?: string;
};

export type EnrollmentValues = { academicYearId: string; classId: string; sectionId: string; admissionType: string };

let seq = 0;
export const newCard = (mode: ParentCard["mode"], init: Partial<ParentCard> = {}): ParentCard => ({
  key: `p${++seq}`,
  mode,
  parent: null,
  person: emptyPerson(),
  profile: emptyParentProfile(),
  relation: "",
  isPrimaryContact: false,
  errors: {},
  ...init
});

export const cardName = (c: ParentCard) =>
  c.mode === "existing"
    ? c.parent
      ? `${c.parent.user.firstName} ${c.parent.user.lastName}`
      : "Existing parent"
    : `${c.person.firstName} ${c.person.lastName}`.trim() || "New parent";

/* Step 2 checks; returns the cards with their errors set */
export function validateCards(cards: ParentCard[], studentEmail: string): { cards: ParentCard[]; ok: boolean } {
  const emails = new Map<string, number>();
  const bump = (e: string) => e && emails.set(e, (emails.get(e) ?? 0) + 1);
  bump(studentEmail.trim().toLowerCase());
  for (const c of cards) if (c.mode === "new") bump(c.person.email.trim().toLowerCase());
  const seen = new Set<string>();

  let ok = true;
  const next = cards.map(c => {
    const errors: Record<string, string> = {};
    let error: string | undefined;
    if (!c.relation) errors.relation = "is required";
    if (c.mode === "existing") {
      if (!c.parent) error = "Choose a parent.";
      else if (seen.has(c.parent.id)) error = "This parent is on the form twice.";
      else seen.add(c.parent.id);
    } else {
      Object.assign(errors, validatePerson(c.person), validateParentProfile(c.profile));
      const email = c.person.email.trim().toLowerCase();
      if (!errors.email && (emails.get(email) ?? 0) > 1) errors.email = "is used twice on this form";
    }
    if (error || Object.keys(errors).length) ok = false;
    return { ...c, errors, error };
  });
  return { cards: next, ok };
}

export const cardsPayload = (cards: ParentCard[]): AdmissionParent[] =>
  cards.map(c => {
    const link = { relation: c.relation as ParentRelation, isPrimaryContact: c.isPrimaryContact };
    return c.mode === "existing"
      ? { parentId: c.parent!.id, ...link }
      : { user: personPayload(c.person), profile: parentProfilePayload(c.profile), ...link };
  });

/* Where a failed admission's errors belong */
export type RoutedErrors = {
  step: number;
  person: Record<string, string>;
  profile: Record<string, string>;
  cards: Record<number, { errors: Record<string, string>; error?: string }>;
  enrollment: Record<string, string>;
  /* Shown at the top of the step we jump to */
  message: string | null;
};

/* knownEmails: emails of parents and students already loaded on this device, to tell
   whose email a 409 is about (the API doesn't say) */
export function routeAdmissionError(
  err: unknown,
  ctx: { studentEmail: string; cards: ParentCard[]; knownStudentEmails: Set<string>; knownParentEmails: Set<string> }
): RoutedErrors {
  const r: RoutedErrors = { step: 3, person: {}, profile: {}, cards: {}, enrollment: {}, message: null };
  const card = (i: number) => (r.cards[i] ??= { errors: {} });
  const at = (step: number) => (r.step = Math.min(r.step, step));

  if (!isApiError(err)) {
    r.message = "Something went wrong. Please try again.";
    return r;
  }

  if (err.isValidation) {
    const unplaced: string[] = [];
    for (const d of err.details) {
      let m: RegExpExecArray | null;
      if ((m = /^parents\.(\d+)(?:\.(?:user|profile))?\.(\w+)$/.exec(d.field))) {
        card(Number(m[1])).errors[m[2]] ??= d.message;
        at(1);
      } else if ((m = /^parents\.(\d+)$/.exec(d.field))) {
        /* The union of new/existing parent didn't match: "does not match any accepted shape" */
        card(Number(m[1])).error = `This parent's details are incomplete (${d.message}).`;
        at(1);
      } else if ((m = /^user\.(\w+)$/.exec(d.field))) {
        r.person[m[1]] ??= d.message;
        at(0);
      } else if ((m = /^profile\.(\w+)$/.exec(d.field))) {
        r.profile[m[1]] ??= d.message;
        at(0);
      } else if ((m = /^enrollment\.(\w+)$/.exec(d.field))) {
        r.enrollment[m[1]] ??= d.message;
        at(2);
      } else unplaced.push(`${d.field} ${d.message}`);
    }
    r.message = unplaced.length ? unplaced.join("; ") : "Please correct the highlighted fields.";
    return r;
  }

  const msg = err.message;
  if (err.status === 409 && /email/i.test(msg)) {
    const student = ctx.studentEmail.trim().toLowerCase();
    const newCards = ctx.cards.map((c, i) => ({ i, email: c.person.email.trim().toLowerCase(), mode: c.mode })).filter(c => c.mode === "new");
    const parentHit = newCards.find(c => ctx.knownParentEmails.has(c.email) || ctx.knownStudentEmails.has(c.email));
    if (!newCards.length || ctx.knownStudentEmails.has(student) || ctx.knownParentEmails.has(student)) {
      r.person.email = "already belongs to another account";
      at(0);
    } else if (parentHit) {
      card(parentHit.i).errors.email = "already belongs to another account. Pick them as an existing parent instead.";
      at(1);
    } else {
      /* Can't tell which: flag every email that's new on this form */
      r.person.email = "may already belong to another account";
      for (const c of newCards) card(c.i).errors.email = "may already belong to another account";
      at(0);
    }
    r.message = msg;
    return r;
  }

  const parentIndex = /parents\[(\d+)\]/.exec(msg);
  if (parentIndex) {
    card(Number(parentIndex[1])).error = msg;
    r.message = msg;
    at(1);
    return r;
  }

  /* Archived year (409), section not in the year (422), unknown section or year (404) */
  if (/academic year|section|archived/i.test(msg)) {
    r.message = msg;
    at(2);
    return r;
  }

  r.message = err.status >= 500 ? "Something went wrong. Please try again." : msg;
  return r;
}
