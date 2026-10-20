import { api } from "@/common/api";

/* Who may sit an exam (backend academics/exam-eligibility): the school's rules, and each
   exam's students judged against them. A student gets an admit card only when eligible. */

export type ExamEligibilityPolicy = {
  id: string;
  attendanceRuleEnabled: boolean;
  /* % of the year's attendance up to the day before the exam starts */
  minAttendancePercentage: number;
  duesRuleEnabled: boolean;
  /* Fees past their due date a student may still owe (0: everything due is paid) */
  maxOverdueAmount: number;
  updatedAt: string;
};

export type ExamEligibilityPolicyChanges = Partial<Omit<ExamEligibilityPolicy, "id" | "updatedAt">>;

export type StudentEligibility = {
  studentId: string;
  enrollmentId: string;
  rollNumber: string | null;
  admissionNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  /* percentage null: no working day yet (never blocks); required null: rule off */
  attendance: { percentage: number | null; required: number | null; met: boolean };
  dues: { overdue: number; allowed: number | null; met: boolean };
  meetsRules: boolean;
  exemption: { reason: string; grantedBy: string | null; grantedAt: string } | null;
  eligible: boolean;
  reasons: string[];
};

export type ExamEligibility = {
  exam: { id: string; examName: string; startDate: string | null; endDate: string | null; academicYearId: string };
  policy: ExamEligibilityPolicy;
  /* Attendance counts up to this day; dues are those overdue on duesAsOf (today) */
  attendanceThrough: string;
  duesAsOf: string;
  totals: { students: number; eligible: number; notEligible: number; exempted: number };
  sections: { section: { id: string; name: string }; students: StudentEligibility[] }[];
};

export const EXAM_ELIGIBILITY_POLICY_PATH = "/academics/exam-eligibility/policy";
export const EXAM_ELIGIBILITY_PAGE = "/academics/exam-eligibility";

export const eligibilityPath = (examId: string) => `/academics/exams/${examId}/eligibility`;

export const updateExamEligibilityPolicy = (body: ExamEligibilityPolicyChanges) =>
  api.patch<ExamEligibilityPolicy>(EXAM_ELIGIBILITY_POLICY_PATH, body);

export const exemptStudent = ({ examId, studentId, reason }: { examId: string; studentId: string; reason: string }) =>
  api.post(`/academics/exams/${examId}/eligibility-exemptions`, { studentId, reason });

export const removeExemption = ({ examId, studentId }: { examId: string; studentId: string }) =>
  api.delete(`/academics/exams/${examId}/eligibility-exemptions/${studentId}`);

/* "Attendance at least 75% and no overdue fees" */
export const rulesSentence = (p: Pick<ExamEligibilityPolicy, "attendanceRuleEnabled" | "minAttendancePercentage" | "duesRuleEnabled" | "maxOverdueAmount">, money: (n: number) => string) => {
  const parts = [
    p.attendanceRuleEnabled && `attendance of at least ${p.minAttendancePercentage}%`,
    p.duesRuleEnabled && (p.maxOverdueAmount > 0 ? `overdue fees of at most ${money(p.maxOverdueAmount)}` : "no overdue fees")
  ].filter(Boolean) as string[];
  return parts.length ? `Students need ${parts.join(" and ")}.` : "No rules are on: every student may sit exams.";
};
