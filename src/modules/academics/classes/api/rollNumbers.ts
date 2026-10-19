import { api } from "@/common/api";

/* Roll numbers (AC-12): the school's rule for ordering them, and renumbering sections by it.
   Numbers keep their format (6A-001); only the order follows the rule. */

export type RollNumberOrder = "ALPHABETICAL" | "RESULT_RANK";

export const ROLL_NUMBER_ORDERS: { value: RollNumberOrder; label: string; hint: string }[] = [
  { value: "ALPHABETICAL", label: "Alphabetical", hint: "By first, middle and last name" },
  { value: "RESULT_RANK", label: "By last year's result", hint: "Best final result of last year first, then the rest A–Z" }
];

export const orderLabel = (o: RollNumberOrder | undefined) => ROLL_NUMBER_ORDERS.find(r => r.value === o)?.label ?? "";

export type RollNumberPolicy = { rollNumberOrder: RollNumberOrder; updatedAt: string | null };

export const ROLL_POLICY_PATH = "/academics/enrollments/policy";
export const ENROLLMENTS_PATH = "/academics/enrollments";

export const updateRollPolicy = (body: { rollNumberOrder: RollNumberOrder }) => api.patch<RollNumberPolicy>(ROLL_POLICY_PATH, body);

/* Exactly one: a section, every section of a class, or every section of the year */
export type RollTarget = { sectionId: string } | { classId: string } | { all: true };

export type RollOrderRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  admissionNumber: string | null;
  currentRollNumber: string | null;
  rollNumber: string;
  /* RESULT_RANK only; null when the student has no ranked result */
  previousResult?: { percentage: number; result: string; source: string | null } | null;
};

export type RollSectionReport = {
  sectionId: string;
  /* "Class 6-A" */
  sectionName: string;
  classId: string;
  students: number;
  changed: number;
  ranked?: number;
  unranked?: number;
  left: number;
  nextRollNumber: string;
  /* In a preview only */
  order?: RollOrderRow[];
};

export type RollAssignment = {
  rule: RollNumberOrder;
  academicYear: { id: string; yearName: string };
  previousAcademicYear?: { id: string; yearName: string } | null;
  dryRun: boolean;
  totals: { sections: number; students: number; changed: number };
  sections: RollSectionReport[];
};

/* The year comes from the header switcher (X-Academic-Year-Id). dryRun: nothing is saved. */
export const assignRollNumbers = ({ target, dryRun }: { target: RollTarget; dryRun?: boolean }) =>
  api.post<RollAssignment>(`${ENROLLMENTS_PATH}/roll-number-assignments`, { ...target, ...(dryRun ? { dryRun: true } : {}) });
