import { api } from "@/common/api";
import { useApiList } from "@/common/hooks";
import type { SubjectInput, SubjectType } from "../../subjects/api/subjects";

/* A subject a class is taught in one year (the header's year). A required one goes to every
   section of the class (a section may drop it); an optional one to the sections given it. */
export type ClassSubject = {
  id: string;
  academicYearId: string;
  classId: string;
  subjectId: string;
  isOptional: boolean;
  /* MA221: subject code, the class's stage and position (Policy › Subject codes), 1 required / 0 optional */
  code: string;
  weeklyNoOfClasses: number | null;
  description: string | null;
  subject: { id: string; subjectName: string; subjectCode: string; subjectType: SubjectType | null };
  /* The class's sections in the year; sectionSubjectId is null where the section is not taught it */
  sections: { id: string; sectionName: string; sectionSubjectId: string | null }[];
};

type Settings = {
  isOptional?: boolean;
  /* 1–50 */
  weeklyNoOfClasses?: number;
  description?: string;
};

/* An existing subject (subjectId) or a new one, created with it (subject) */
export type ClassSubjectInput = Settings & { classId: string } & (
    | { subjectId: string; subject?: never }
    | { subject: Omit<SubjectInput, "isOptional">; subjectId?: never }
  );

export const CLASS_SUBJECTS_PATH = "/academics/class-subjects";

export const addClassSubject = (body: ClassSubjectInput) => api.post<ClassSubject>(CLASS_SUBJECTS_PATH, body);

/* Made required: added to the sections that lack it; classes a week and the note follow to the sections */
export const updateClassSubject = ({ id, ...body }: Settings & { id: string }) => api.patch<ClassSubject>(`${CLASS_SUBJECTS_PATH}/${id}`, body);

/* Also takes it off every section of the class */
export const removeClassSubject = (id: string) => api.delete<null>(`${CLASS_SUBJECTS_PATH}/${id}`);

/* A class's subjects (a class has a handful, so one page holds them): required first, then by name */
export function useClassSubjects(classId: string | null | undefined) {
  const list = useApiList<ClassSubject>(CLASS_SUBJECTS_PATH, { classId: classId ?? "", limit: 100 }, { enabled: !!classId });
  const rows = list.rows
    ? [...list.rows].sort((a, b) => Number(a.isOptional) - Number(b.isOptional) || a.subject.subjectName.localeCompare(b.subject.subjectName))
    : undefined;
  return { ...list, rows };
}
