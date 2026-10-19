import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";
import { fetchAll } from "../../shared/api/fetchAll";

/* How marks become results. School-wide; applied to an exam, a class, or an exam in one class
   (assignments), else the school default, else the built-in standard rules. */
export type GradingMode = "MARKS" | "GRADES" | "GPA" | "PASS_FAIL";
export type AbsenceTreatment = "ZERO_FAIL" | "EXCLUDE";
export type RankingMethod = "COMPETITION" | "DENSE" | "NONE";
export type RankScope = "SECTION" | "CLASS" | "BOTH";
export type RoundingMode = "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN";
export type SubjectCategory = "SCHOLASTIC" | "CO_SCHOLASTIC";

export type PolicySubjectRule = {
  subjectId: string;
  category: SubjectCategory;
  credits: number;
  isMandatory: boolean;
  minPercent: number | null;
  subject?: { id: string; subjectName: string; subjectCode: string };
};

export type PolicySettings = {
  gradingMode: GradingMode;
  gradeScaleId: string | null;
  coScholasticScaleId: string | null;
  gpaScale: number | null;
  usePaperPassMarks: boolean;
  subjectMinPercent: number | null;
  requirePassingGrade: boolean;
  requireComponentPass: boolean;
  overallMinPercent: number | null;
  maxCompartmentSubjects: number;
  graceMaxPerSubject: number;
  graceMaxTotal: number;
  graceCountsInTotal: boolean;
  bestOfSubjects: number | null;
  absentTreatment: AbsenceTreatment;
  medicalTreatment: AbsenceTreatment;
  exemptTreatment: AbsenceTreatment;
  rankingMethod: RankingMethod;
  rankScope: RankScope;
  rankFailedStudents: boolean;
  showRankToStudents: boolean;
  percentageDecimals: number;
  gpaDecimals: number;
  roundingMode: RoundingMode;
};

export type ResultPolicy = PolicySettings & {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  subjects: PolicySubjectRule[];
  createdAt: string;
  updatedAt: string;
};

export type ResultPolicyInput = Partial<PolicySettings> & {
  name?: string;
  description?: string;
  isDefault?: boolean;
  subjects?: Omit<PolicySubjectRule, "subject">[];
};

/* The rules a policy starts from (the built-in standard) */
export const BUILT_IN: PolicySettings = {
  gradingMode: "GRADES",
  gradeScaleId: null,
  coScholasticScaleId: null,
  gpaScale: null,
  usePaperPassMarks: true,
  subjectMinPercent: null,
  requirePassingGrade: true,
  requireComponentPass: true,
  overallMinPercent: null,
  maxCompartmentSubjects: 0,
  graceMaxPerSubject: 0,
  graceMaxTotal: 0,
  graceCountsInTotal: true,
  bestOfSubjects: null,
  absentTreatment: "ZERO_FAIL",
  medicalTreatment: "ZERO_FAIL",
  exemptTreatment: "EXCLUDE",
  rankingMethod: "COMPETITION",
  rankScope: "SECTION",
  rankFailedStudents: true,
  showRankToStudents: true,
  percentageDecimals: 2,
  gpaDecimals: 2,
  roundingMode: "HALF_UP"
};

export const RESULT_POLICIES_PATH = "/academics/result-policies";
export const POLICY_ASSIGNMENTS_PATH = "/academics/result-policy-assignments";

export const createPolicy = (body: ResultPolicyInput) => api.post<ResultPolicy>(RESULT_POLICIES_PATH, body);
export const updatePolicy = ({ id, ...body }: ResultPolicyInput & { id: string }) => api.patch<ResultPolicy>(`${RESULT_POLICIES_PATH}/${id}`, body);
export const deletePolicy = (id: string) => api.delete<ResultPolicy>(`${RESULT_POLICIES_PATH}/${id}`);

export const GRADING_MODES: { value: GradingMode; label: string; description: string }[] = [
  { value: "MARKS", label: "Marks", description: "Marks and percentages" },
  { value: "GRADES", label: "Letter grades", description: "A grade from the scale" },
  { value: "GPA", label: "GPA", description: "Grade points averaged" },
  { value: "PASS_FAIL", label: "Pass / fail", description: "Only the outcome" }
];

export const gradingModeLabel = (m: GradingMode | string) => GRADING_MODES.find(x => x.value === m)?.label ?? m;

/* Every policy, for pickers */
export function usePolicyOptions() {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: [RESULT_POLICIES_PATH, { all: true }],
    enabled: can("academics.resultPolicies.read"),
    staleTime: 60_000,
    queryFn: () => fetchAll<ResultPolicy>(RESULT_POLICIES_PATH)
  });
  const policies = q.data;
  const options = useMemo<Option[]>(
    () => (policies ?? []).map(p => ({ value: p.id, label: p.name, description: `${gradingModeLabel(p.gradingMode)}${p.isDefault ? " · school default" : ""}` })),
    [policies]
  );
  const byId = useMemo(() => new Map((policies ?? []).map(p => [p.id, p])), [policies]);
  return { policies: policies ?? [], options, byId, isLoading: q.isLoading };
}

/* A policy applied to an exam, a class, or an exam in one class */
export type PolicyAssignment = {
  id: string;
  policyId: string;
  examId: string | null;
  classId: string | null;
  policy: { id: string; name: string; gradingMode: GradingMode };
  exam: { id: string; examName: string; academicYearId: string } | null;
  class: { id: string; className: string } | null;
};

export const createAssignment = (body: { policyId: string; examId?: string; classId?: string }) => api.post<PolicyAssignment>(POLICY_ASSIGNMENTS_PATH, body);
export const changeAssignment = ({ id, policyId }: { id: string; policyId: string }) => api.patch<PolicyAssignment>(`${POLICY_ASSIGNMENTS_PATH}/${id}`, { policyId });
export const deleteAssignment = (id: string) => api.delete<PolicyAssignment>(`${POLICY_ASSIGNMENTS_PATH}/${id}`);

/* "Final for Class 10", "Final (every class)", "Class 10 (every exam)" */
export const assignmentTarget = (a: Pick<PolicyAssignment, "exam" | "class">) =>
  a.exam && a.class ? `${a.exam.examName} for ${a.class.className}` : a.exam ? `${a.exam.examName} (every class)` : `${a.class?.className ?? "A class"} (every exam)`;

/* GET /result-policies/resolution: which policy applies, and why */
export type PolicySource = "EXAM_CLASS" | "EXAM" | "CLASS" | "SCHOOL_DEFAULT" | "BUILT_IN";
export type Resolution = {
  source: PolicySource;
  assignmentId: string | null;
  examId: string | null;
  classId: string | null;
  policy: PolicySettings & { id: string | null; name: string };
};

export const SOURCE_TEXT: Record<PolicySource, string> = {
  EXAM_CLASS: "assigned to this exam in this class",
  EXAM: "assigned to this exam, for every class",
  CLASS: "assigned to this class, for every exam",
  SCHOOL_DEFAULT: "the school default (nothing more specific is assigned)",
  BUILT_IN: "the built-in standard rules (no school default is set)"
};
