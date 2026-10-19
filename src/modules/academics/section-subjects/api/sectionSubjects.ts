import { api } from "@/common/api";
import { useApiList } from "@/common/hooks";

/* A subject taught in one section in one year (the header's year) */
export type SectionSubject = {
  id: string;
  academicYearId: string;
  sectionId: string;
  subjectId: string;
  /* Generated: "MAT-6A" */
  displayCode: string;
  weeklyNoOfClasses: number | null;
  description: string | null;
  subject: { id: string; subjectName: string; subjectCode: string };
};

export type SectionSubjectInput = {
  sectionId: string;
  subjectId: string;
  /* 1–50 */
  weeklyNoOfClasses?: number;
  description?: string;
};

export const SECTION_SUBJECTS_PATH = "/academics/section-subjects";

export const addSectionSubject = (body: SectionSubjectInput) => api.post<SectionSubject>(SECTION_SUBJECTS_PATH, body);

export const removeSectionSubject = (id: string) => api.delete<SectionSubject>(`${SECTION_SUBJECTS_PATH}/${id}`);

/* A section's subjects (a section has a handful, so one page holds them), by name */
export function useSectionSubjects(sectionId: string | null | undefined) {
  const list = useApiList<SectionSubject>(SECTION_SUBJECTS_PATH, { sectionId: sectionId ?? "", limit: 100 }, { enabled: !!sectionId });
  const rows = list.rows ? [...list.rows].sort((a, b) => a.subject.subjectName.localeCompare(b.subject.subjectName)) : undefined;
  return { ...list, rows };
}
