import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";

/* Teachers' own marked work counted in assessment-scheme buckets (backend academics/assessments).
   Per subject, a student's counted items are averaged (each item's percentage counts equally)
   and the average carries the bucket's weight in the scheme. */

export type AssessmentType = "TEST" | "ASSIGNMENT" | "PROJECT" | "HOMEWORK" | "OTHER";
/* Homework items are made from the homework itself (its "Counts toward" bucket) */
export const ITEM_TYPES: AssessmentType[] = ["TEST", "ASSIGNMENT", "PROJECT", "OTHER"];
export const TYPE_LABELS: Record<AssessmentType, string> = {
  TEST: "Test",
  ASSIGNMENT: "Assignment",
  PROJECT: "Project",
  HOMEWORK: "Homework",
  OTHER: "Other"
};

/* ABSENT counts 0%; EXEMPT and MEDICAL leave the item out for the student */
export type EntryStatus = "MARKED" | "ABSENT" | "EXEMPT" | "MEDICAL";
export const STATUS_LABELS: Record<EntryStatus, string> = {
  MARKED: "Marked",
  ABSENT: "Absent (0)",
  EXEMPT: "Exempt",
  MEDICAL: "Medical"
};

export type Bucket = {
  id: string;
  name: string;
  weight: number;
  scheme: { id: string; name: string; resultsPublishedAt: string | null };
  /* The scheme's results are published: its items can't change */
  locked: boolean;
};

export type Assessment = {
  id: string;
  academicYearId: string;
  bucketId: string;
  sectionId: string;
  subjectId: string;
  assessmentType: AssessmentType;
  title: string;
  assessedOn: string | null;
  maxMarks: number;
  counts: boolean;
  homeworkId: string | null;
  description: string | null;
  createdBy: string;
  section?: { id: string; sectionName: string; classId: string };
  subject?: { id: string; subjectName: string; subjectCode: string };
  bucket: Bucket | null;
  /* List only: students with an entry */
  entries?: number;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentInput = {
  bucketId: string;
  sectionId: string;
  subjectId: string;
  assessmentType: AssessmentType;
  title: string;
  assessedOn?: string;
  maxMarks: number;
  counts: boolean;
  description?: string;
};

export type AssessmentPatch = Partial<Pick<AssessmentInput, "bucketId" | "title" | "assessedOn" | "maxMarks" | "counts" | "description">>;

/* GET /academics/assessments/:id/marks: every student of the section */
export type ItemMarks = {
  assessment: Assessment;
  students: {
    studentId: string;
    rollNumber: string | null;
    firstName?: string;
    lastName?: string;
    enrollmentStatus: string;
    status: EntryStatus | null;
    /* Homework: the graded submission's marks */
    marksObtained: number | null;
    remarks: string | null;
    percentage: number | null;
  }[];
};

export type MarksEntry = { studentId: string; status?: EntryStatus; marksObtained?: number; remarks?: string; clear?: boolean };

export const ASSESSMENTS_PATH = "/academics/assessments";
export const assessmentPath = (id: string) => `${ASSESSMENTS_PATH}/${id}`;

export const createAssessment = (body: AssessmentInput) => api.post<Assessment>(ASSESSMENTS_PATH, body);
export const updateAssessment = ({ id, ...body }: AssessmentPatch & { id: string }) => api.patch<Assessment>(assessmentPath(id), body);
export const deleteAssessment = (id: string) => api.delete<null>(assessmentPath(id));
/* At most 500 entries -> { created, updated, cleared } */
export const recordItemMarks = ({ id, marks }: { id: string; marks: MarksEntry[] }) =>
  api.post<{ created: number; updated: number; cleared: number }>(`${assessmentPath(id)}/marks`, { marks });

export const useAssessment = (id: string | null | undefined) => useApiGet<Assessment>(id ? assessmentPath(id) : null);
export const useItemMarks = (id: string | null | undefined) => useApiGet<ItemMarks>(id ? `${assessmentPath(id)}/marks` : null);

/* The header year's buckets teachers can fill */
export function useBuckets(enabled = true) {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: [`${ASSESSMENTS_PATH}/buckets`],
    enabled: enabled && can("academics.assessments.read"),
    staleTime: 30_000,
    queryFn: async () => (await api.get<Bucket[]>(`${ASSESSMENTS_PATH}/buckets`)).data
  });
  const buckets = q.data ?? [];
  return {
    ...q,
    buckets,
    byId: new Map(buckets.map(b => [b.id, b])),
    /* "Teacher assessments · 20% of Annual" */
    options: buckets.map(b => ({
      value: b.id,
      label: `${b.name} · ${b.weight}% of ${b.scheme.name}`,
      disabled: b.locked,
      description: b.locked ? "Results published" : undefined
    }))
  };
}

/* "75 of 100" / "Graded by homework" */
export const percentLabel = (p: number | null | undefined) => (p === null || p === undefined ? "—" : `${Math.round(p * 100) / 100}%`);
