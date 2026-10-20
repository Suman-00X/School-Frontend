import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { fetchAll } from "../../shared/api/fetchAll";

/* A term or annual result that combines exams of one year with weights adding up to 100.
   Configuration only here; publishing its results is on the exams pages. */
export type SchemeExam = {
  examId: string;
  weight: number;
  exam?: { id: string; examName: string; examType: string; startDate: string; endDate: string };
};

/* A share filled by teachers' own tests, assignments, projects and homework (Teacher assessments 20%) */
export type SchemeBucket = { id: string; name: string; weight: number; sortOrder: number };

export type AssessmentScheme = {
  id: string;
  academicYearId: string;
  name: string;
  description: string | null;
  /* Own result policy; null: the class's, the school default or the built-in rules */
  policyId: string | null;
  resultsPublishedAt: string | null;
  exams: SchemeExam[];
  buckets: SchemeBucket[];
  policy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type SchemeInput = {
  name?: string;
  description?: string;
  policyId?: string | null;
  exams?: { examId: string; weight: number }[];
  /* id keeps an existing bucket (and the items teachers put in it) */
  buckets?: { id?: string; name: string; weight: number }[];
};

export const SCHEMES_PATH = "/academics/assessment-schemes";

export const createScheme = (body: SchemeInput) => api.post<AssessmentScheme>(SCHEMES_PATH, body);
export const updateScheme = ({ id, ...body }: SchemeInput & { id: string }) => api.patch<AssessmentScheme>(`${SCHEMES_PATH}/${id}`, body);
export const deleteScheme = (id: string) => api.delete<AssessmentScheme>(`${SCHEMES_PATH}/${id}`);

/* Exams of the header's year, for pickers */
export type ExamRef = { id: string; examName: string; examType: string; startDate: string | null; endDate: string | null; academicYearId: string };

export function useExamOptions() {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: ["/academics/exams", { all: true }],
    enabled: can("academics.exams.read"),
    staleTime: 60_000,
    queryFn: async () => (await fetchAll<ExamRef>("/academics/exams")).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
  });
  const exams = q.data;
  const options = useMemo<Option[]>(
    () =>
      (exams ?? []).map(e => ({
        value: e.id,
        label: e.examName,
        description: [e.examType === "FINAL" ? "Final" : "Internal", e.startDate && formatDate(e.startDate)].filter(Boolean).join(" · ")
      })),
    [exams]
  );
  const byId = useMemo(() => new Map((exams ?? []).map(e => [e.id, e])), [exams]);
  return { allowed: can("academics.exams.read"), exams: exams ?? [], options, byId, isLoading: q.isLoading };
}
