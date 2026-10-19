import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { fetchAll } from "./exams";

/* Read-only views of the grading setup (AC-06 owns the editors): scales, policies, which policy applies */

export type GradeBand = {
  id: string;
  grade: string;
  minPercent: number;
  maxPercent: number;
  gradePoint: number | null;
  remark: string | null;
  isPassing: boolean;
  sortOrder: number;
};

export type GradeScale = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  bands: GradeBand[];
};

export type GradingMode = "MARKS" | "GRADES" | "GPA" | "PASS_FAIL";
export type AbsenceTreatment = "ZERO_FAIL" | "EXCLUDE";

/* The settings of a result policy, as the API returns them (and accepts inline for a preview) */
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
  rankingMethod: "COMPETITION" | "DENSE" | "NONE";
  rankScope: "SECTION" | "CLASS" | "BOTH";
  rankFailedStudents: boolean;
  showRankToStudents: boolean;
  percentageDecimals: number;
  gpaDecimals: number;
  roundingMode: "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN";
  subjects: {
    subjectId: string;
    category: "SCHOLASTIC" | "CO_SCHOLASTIC";
    credits: number;
    isMandatory: boolean;
    minPercent: number | null;
  }[];
};

export type ResultPolicy = PolicySettings & {
  id: string | null;
  name: string;
  description?: string | null;
  isDefault?: boolean;
};

export type PolicySource = "EXAM_CLASS" | "EXAM" | "CLASS" | "SCHOOL_DEFAULT" | "BUILT_IN" | "SCHEME" | "PREVIEW";

export const POLICY_SOURCE_LABELS: Record<string, string> = {
  EXAM_CLASS: "set for this exam and class",
  EXAM: "set for this exam",
  CLASS: "set for this class",
  SCHOOL_DEFAULT: "the school default",
  BUILT_IN: "the built-in rules",
  SCHEME: "set on the assessment scheme",
  PREVIEW: "preview"
};

export const GRADING_MODE_LABELS: Record<GradingMode, string> = {
  MARKS: "Marks and percentage",
  GRADES: "Grades",
  GPA: "Grade points (GPA)",
  PASS_FAIL: "Pass or fail only"
};

export const GRADE_SCALES_PATH = "/academics/grade-scales";
export const RESULT_POLICIES_PATH = "/academics/result-policies";

export function useGradeScales(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("academics.gradeScales.read");
  const q = useQuery({
    queryKey: [GRADE_SCALES_PATH, { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: () => fetchAll<GradeScale>(GRADE_SCALES_PATH)
  });
  const scales = q.data ?? [];
  return {
    ...q,
    allowed,
    scales,
    byId: new Map(scales.map(s => [s.id, s])),
    defaultScale: scales.find(s => s.isDefault) ?? null
  };
}

export function useResultPolicies(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("academics.resultPolicies.read");
  const q = useQuery({
    queryKey: [RESULT_POLICIES_PATH, { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: () => fetchAll<ResultPolicy & { id: string }>(RESULT_POLICIES_PATH)
  });
  return { ...q, allowed, policies: q.data ?? [] };
}

export type PolicyResolution = {
  source: PolicySource;
  assignmentId: string | null;
  policy: ResultPolicy;
};

/* Which result policy applies to an exam in a section's class */
export function usePolicyResolution(examId: string | undefined, sectionId: string | undefined) {
  const { can } = useAuth();
  return useQuery({
    queryKey: [`${RESULT_POLICIES_PATH}/resolution`, { examId, sectionId }],
    enabled: !!examId && !!sectionId && can("academics.resultPolicies.read"),
    staleTime: 60_000,
    queryFn: async () =>
      (
        await api.get<PolicyResolution>(`${RESULT_POLICIES_PATH}/resolution`, {
          examId,
          sectionId
        })
      ).data
  });
}

/* Grades of a scale, best first */
export const gradesOf = (scale: GradeScale | null | undefined) => [...(scale?.bands ?? [])].sort((a, b) => b.minPercent - a.minPercent);
