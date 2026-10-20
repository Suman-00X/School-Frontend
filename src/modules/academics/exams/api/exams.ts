import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";

/* Exams of an academic year and their papers (backend academics/exams) */

export type ExamType = "INTERNAL" | "FINAL";
export const EXAM_TYPES: ExamType[] = ["INTERNAL", "FINAL"];
export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  INTERNAL: "Internal",
  FINAL: "Final"
};

export type Exam = {
  id: string;
  academicYearId: string;
  examName: string;
  examType: ExamType | null;
  startDate: string | null;
  endDate: string | null;
  /* Grades use this scale, else the result policy's, else the school default */
  gradeScaleId: string | null;
  /* Students and parents see results only after publication */
  resultsPublishedAt: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/* PATCH can't clear dates, type or scale (the API refuses null); "" clears the description */
export type ExamInput = {
  examName: string;
  examType?: ExamType;
  startDate?: string;
  endDate?: string;
  gradeScaleId?: string;
  description?: string;
};

export type PaperComponent = "THEORY" | "PRACTICAL" | "INTERNAL" | "PROJECT" | "ORAL";
export const PAPER_COMPONENTS: PaperComponent[] = ["THEORY", "PRACTICAL", "INTERNAL", "PROJECT", "ORAL"];
export const COMPONENT_LABELS: Record<PaperComponent, string> = {
  THEORY: "Theory",
  PRACTICAL: "Practical",
  INTERNAL: "Internal assessment",
  PROJECT: "Project",
  ORAL: "Oral"
};

/* MARKS: marked out of maxMarks. GRADE: a grade only (Art, Conduct), no marks */
export type GradingType = "MARKS" | "GRADE";

export type ExamPaper = {
  id: string;
  academicYearId: string;
  examId: string;
  sectionId: string;
  subjectId: string;
  component: PaperComponent | null;
  gradingType: GradingType;
  displayCode: string;
  examDate: string | null;
  /* "09:00:00" */
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  maxMarks: number | null;
  passMarks: number | null;
  description: string | null;
  section: { id: string; sectionName: string };
  subject: { id: string; subjectName: string; subjectCode: string };
};

export type PaperInput = {
  sectionId: string;
  subjectId: string;
  gradingType: GradingType;
  component?: PaperComponent;
  examDate?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  maxMarks?: number;
  passMarks?: number;
  description?: string;
};

/* Section, subject, grading type and component are fixed once the paper exists */
export type PaperPatch = Partial<Omit<PaperInput, "sectionId" | "subjectId" | "gradingType" | "component">>;

export const EXAMS_PATH = "/academics/exams";
export const examPath = (examId: string) => `${EXAMS_PATH}/${examId}`;
export const papersPath = (examId: string) => `${EXAMS_PATH}/${examId}/papers`;

export const createExam = (body: ExamInput) => api.post<Exam>(EXAMS_PATH, body);
/* All or nothing, at most 200; names must not repeat */
export const createExams = (exams: ExamInput[]) => api.post<Exam[]>(`${EXAMS_PATH}/bulk`, { exams });
export const updateExam = ({ id, ...body }: Partial<ExamInput> & { id: string }) => api.patch<Exam>(examPath(id), body);
/* Refused (409) once results are published, marks are recorded or a scheme combines the exam; its papers go with it */
export const deleteExam = (examId: string) => api.delete<null>(examPath(examId));

export const createPaper = ({ examId, ...body }: PaperInput & { examId: string }) => api.post<ExamPaper>(papersPath(examId), body);
export const updatePaper = ({ examId, paperId, ...body }: PaperPatch & { examId: string; paperId: string }) =>
  api.patch<ExamPaper>(`${papersPath(examId)}/${paperId}`, body);
export const deletePaper = ({ examId, paperId }: { examId: string; paperId: string }) => api.delete<null>(`${papersPath(examId)}/${paperId}`);

export const useExam = (examId: string | null | undefined) => useApiGet<Exam>(examId ? examPath(examId) : null);

/* Every page of a list (lists cap at 100 a page) */
export async function fetchAll<T>(path: string, query: Record<string, string | undefined> = {}) {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const res = await api.get<T[]>(path, { ...query, page, limit: 100 });
    rows.push(...res.data);
    if (!res.meta || page >= res.meta.totalPages) break;
  }
  return rows;
}

/* Every exam of the header's year, earliest first (pickers) */
export function useAllExams(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("academics.exams.read");
  const q = useQuery({
    queryKey: [EXAMS_PATH, { all: true }],
    enabled: allowed,
    staleTime: 30_000,
    queryFn: async () =>
      (await fetchAll<Exam>(EXAMS_PATH)).sort(
        (a, b) => String(a.startDate ?? "9999").localeCompare(String(b.startDate ?? "9999")) || a.examName.localeCompare(b.examName)
      )
  });
  return { ...q, exams: q.data ?? [] };
}

/* Every paper of an exam the person may see (a teacher: their sections only), optionally one section */
export function useExamPapers(examId: string | null | undefined, sectionId?: string) {
  return useQuery({
    queryKey: [papersPath(examId ?? ""), { all: true, sectionId: sectionId ?? "" }],
    enabled: !!examId,
    queryFn: () =>
      fetchAll<ExamPaper>(papersPath(examId!), {
        sectionId: sectionId || undefined
      })
  });
}

/* "Theory", or "" for a whole paper */
export const componentLabel = (c: PaperComponent | null | undefined) => (c ? COMPONENT_LABELS[c] : "");

/* "09:00:00" -> "09:00" */
export const shortTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export const timeRange = (p: Pick<ExamPaper, "startTime" | "endTime">) =>
  p.startTime ? `${shortTime(p.startTime)}${p.endTime ? `–${shortTime(p.endTime)}` : ""}` : "";

/* "English · Theory" */
export const paperTitle = (p: Pick<ExamPaper, "subject" | "component">) =>
  p.component ? `${p.subject.subjectName} · ${componentLabel(p.component)}` : p.subject.subjectName;

export const marksLabel = (p: Pick<ExamPaper, "gradingType" | "maxMarks" | "passMarks">) =>
  p.gradingType === "GRADE" ? "Graded" : `${p.maxMarks ?? "—"}${p.passMarks !== null && p.passMarks !== undefined ? ` (pass ${p.passMarks})` : ""}`;
