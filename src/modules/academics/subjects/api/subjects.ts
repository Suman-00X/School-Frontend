import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";
import { fetchAll } from "../../shared/api/fetchAll";

/* A subject is school-wide (shared by every year); sections pick theirs (section subjects) */
export type SubjectType = "THEORY" | "PRACTICAL";

export type Subject = {
  id: string;
  subjectName: string;
  /* 2–10 letters, digits or -, starting with a letter; stored upper-case */
  subjectCode: string;
  subjectType: SubjectType | null;
  /* The default when a class is given it: optional subjects go only to the sections picked */
  isOptional: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubjectInput = {
  subjectName: string;
  subjectCode: string;
  subjectType?: SubjectType;
  isOptional?: boolean;
  description?: string;
};

export const SUBJECTS_PATH = "/academics/subjects";

export const SUBJECT_CODE = /^[A-Z][A-Z0-9-]{1,9}$/;

export const SUBJECT_TYPES: { value: SubjectType; label: string; description: string }[] = [
  { value: "THEORY", label: "Theory", description: "Taught and examined in class" },
  { value: "PRACTICAL", label: "Practical", description: "Lab or hands-on work" }
];

export const subjectTypeLabel = (t: SubjectType | null | undefined) => SUBJECT_TYPES.find(o => o.value === t)?.label ?? "";

export const createSubject = (body: SubjectInput) => api.post<Subject>(SUBJECTS_PATH, body);

/* All or nothing, at most 200 */
export const createSubjects = (subjects: SubjectInput[]) => api.post<Subject[]>(`${SUBJECTS_PATH}/bulk`, { subjects });

export const updateSubject = ({ id, ...body }: Partial<SubjectInput> & { id: string }) => api.patch<Subject>(`${SUBJECTS_PATH}/${id}`, body);

/* Every subject the person may see (a teacher: the ones of their sections), by name */
export function useSubjectOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("academics.subjects.read");
  const q = useQuery({
    queryKey: [SUBJECTS_PATH, { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: async () => (await fetchAll<Subject>(SUBJECTS_PATH)).sort((a, b) => a.subjectName.localeCompare(b.subjectName))
  });
  const subjects = q.data;
  const options = useMemo<Option[]>(
    () => (subjects ?? []).map(s => ({ value: s.id, label: s.subjectName, description: s.subjectCode })),
    [subjects]
  );
  const byId = useMemo(() => new Map((subjects ?? []).map(s => [s.id, s])), [subjects]);
  return { allowed, subjects: subjects ?? [], options, byId, isLoading: q.isLoading };
}
