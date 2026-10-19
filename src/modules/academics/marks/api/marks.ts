import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

/* Marks of students in exam papers (backend academics/marks) */

export type AbsenceReason = "ABSENT" | "MEDICAL" | "EXEMPT";
export const ABSENCE_REASONS: AbsenceReason[] = ["ABSENT", "MEDICAL", "EXEMPT"];
export const ABSENCE_LABELS: Record<AbsenceReason, string> = {
  ABSENT: "Absent",
  MEDICAL: "Medical",
  EXEMPT: "Exempt"
};
/* Short forms used in the grid */
export const ABSENCE_SHORT: Record<AbsenceReason, string> = {
  ABSENT: "AB",
  MEDICAL: "ML",
  EXEMPT: "EX"
};

/* One entry of POST /academics/marks/bulk (upsert per student and paper) */
export type MarkEntry = {
  studentId: string;
  examPaperId: string;
  marksObtained?: number;
  grade?: string;
  isAbsent: boolean;
  absenceReason?: AbsenceReason;
  remarks?: string;
};

/* GET /academics/marks rows */
export type MarkRecord = {
  id: string;
  studentId: string;
  examPaperId: string;
  marksObtained: number | null;
  grade: string | null;
  gradeIsManual: boolean;
  isAbsent: boolean;
  absenceReason: AbsenceReason | null;
  remarks: string | null;
  evaluatedAt: string | null;
  examPaper: {
    id: string;
    displayCode: string;
    component: string | null;
    gradingType: "MARKS" | "GRADE";
    maxMarks: number | null;
    passMarks: number | null;
    exam: { id: string; examName: string; examType: string | null };
    subject: { id: string; subjectName: string; subjectCode: string };
  };
};

export const MARKS_PATH = "/academics/marks";

/* All or nothing, at most 500 entries -> { created, updated } */
export const recordMarks = (marks: MarkEntry[]) =>
  api.post<{ created: number; updated: number }>(`${MARKS_PATH}/bulk`, {
    marks
  });

/* One student's marks in one exam */
export const fetchStudentMarks = async (studentId: string, examId: string) =>
  (await api.get<MarkRecord[]>(MARKS_PATH, { studentId, examId, limit: 100 })).data;

export function useStudentMarks(studentId: string | null, examId: string | null) {
  return useQuery({
    queryKey: [MARKS_PATH, { studentId, examId }],
    enabled: !!studentId && !!examId,
    queryFn: () => fetchStudentMarks(studentId!, examId!)
  });
}

/* GET /me/teaching/sections: what a teacher may mark (class teacher: every subject) */
export type TeachingSection = {
  sectionId: string;
  section: string;
  isClassTeacher: boolean;
  isDeputyClassTeacher: boolean;
  subjectIds: string[];
};

/* null for everyone who isn't a teacher (they are not limited by section) */
export function useTeachingSections() {
  const { can } = useAuth();
  const teacher = can("portal.learning.teaching");
  const q = useQuery({
    queryKey: ["/me/teaching/sections"],
    enabled: teacher,
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.get<TeachingSection[]>("/me/teaching/sections")).data
  });
  const rows = q.data ?? [];
  const bySection = new Map(rows.map(r => [r.sectionId, r]));
  return {
    teacher,
    isLoading: teacher && q.isLoading,
    rows,
    /* May this person record marks for this subject in this section? */
    canMark: (sectionId: string, subjectId: string) => {
      if (!teacher) return can("academics.marks.record");
      const s = bySection.get(sectionId);
      return !!s && (s.isClassTeacher || s.subjectIds.includes(subjectId));
    },
    /* Report cards are for the class teacher only (not the deputy) */
    isClassTeacher: (sectionId: string) => !teacher || !!bySection.get(sectionId)?.isClassTeacher
  };
}

/* Run tasks with at most `limit` at a time (one marks call per student) */
export async function inBatches<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await run(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
