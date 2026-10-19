import { useQuery } from "@tanstack/react-query";
import { api, type Query } from "@/common/api";
import { useApiGet, useApiList } from "@/common/hooks";
import { fetchAllPages, type PersonValues, type UserSummary } from "@/modules/users/shared";
import type { ParentProfileBody } from "@/modules/users/parents";
import type { Enrollment } from "./placement";

export const STUDENTS_PATH = "/users/students";

export type Student = {
  id: string;
  userId: string;
  studentCode: string;
  admissionNumber: string;
  admissionDate: string | null;
  bloodGroup: string | null;
  category: string | null;
  religion: string | null;
  description: string | null;
  createdAt: string;
  user: UserSummary;
};

export type ParentRelation = "FATHER" | "MOTHER" | "GUARDIAN";

/* A student ↔ parent link */
export type ParentLink = {
  id: string;
  studentId: string;
  parentId: string;
  relation: ParentRelation;
  isPrimaryContact: boolean;
};

/* GET /users/students/:id/parents rows */
export type StudentParent = ParentLink & {
  parent: { id: string; parentCode: string; occupation: string | null; user: UserSummary };
};

/* Profile form values ("" = not set) */
export type StudentProfileValues = {
  admissionNumber: string;
  admissionDate: string;
  bloodGroup: string;
  category: string;
  religion: string;
  description: string;
};

export const STUDENT_PROFILE_KEYS = ["admissionNumber", "admissionDate", "bloodGroup", "category", "religion", "description"];
/* Fields that may be emptied on edit (dates can't be cleared once set) */
export const STUDENT_PROFILE_TEXT_KEYS = ["bloodGroup", "category", "religion", "description"];

export const ADMISSION_TYPES = ["NEW", "PROMOTED", "REPEAT"] as const;

export type AdmissionParent =
  | { parentId: string; relation: ParentRelation; isPrimaryContact: boolean }
  | { user: Partial<PersonValues>; profile: ParentProfileBody; relation: ParentRelation; isPrimaryContact: boolean };

export type AdmissionBody = {
  user: Partial<PersonValues>;
  profile: Partial<StudentProfileValues>;
  parents: AdmissionParent[];
  enrollment: { academicYearId: string; sectionId: string; admissionType: string };
};

export type AdmissionResult = Student & { parents: ParentLink[]; enrollment: Enrollment };

export const useStudents = (query: Query, enabled = true) => useApiList<Student>(STUDENTS_PATH, query, { enabled });
export const useStudent = (studentId: string | undefined) => useApiGet<Student>(studentId ? `${STUDENTS_PATH}/${studentId}` : null);

export const useStudentParents = (studentId: string | null | undefined, enabled = true) =>
  useApiList<StudentParent>(`${STUDENTS_PATH}/${studentId}/parents`, { limit: 100 }, { enabled: !!studentId && enabled });

/* GET /users/students has no search (gap): the sibling picker loads up to 500 and filters on the device */
export const useAllStudents = (enabled = true) =>
  useQuery({
    queryKey: [STUDENTS_PATH, "all"],
    enabled,
    staleTime: 60_000,
    queryFn: () => fetchAllPages<Student>(STUDENTS_PATH)
  });

export const admitStudent = (body: AdmissionBody) => api.post<AdmissionResult>(STUDENTS_PATH, body);

/* The row comes back without `user`; callers refetch */
export const updateStudent = ({ studentId, ...body }: Partial<StudentProfileValues> & { studentId: string }) =>
  api.patch<Student>(`${STUDENTS_PATH}/${studentId}`, body);

export const linkParent = ({ studentId, ...body }: { studentId: string; parentId: string; relation: ParentRelation; isPrimaryContact: boolean }) =>
  api.post<ParentLink>(`${STUDENTS_PATH}/${studentId}/parents`, body);

export const unlinkParent = ({ studentId, parentId }: { studentId: string; parentId: string }) =>
  api.delete<null>(`${STUDENTS_PATH}/${studentId}/parents/${parentId}`);

export const emptyStudentProfile = (): StudentProfileValues => ({
  admissionNumber: "",
  admissionDate: "",
  bloodGroup: "",
  category: "",
  religion: "",
  description: ""
});

export const studentProfileFrom = (s: Partial<Student>): StudentProfileValues => ({
  admissionNumber: s.admissionNumber ?? "",
  admissionDate: s.admissionDate ?? "",
  bloodGroup: s.bloodGroup ?? "",
  category: s.category ?? "",
  religion: s.religion ?? "",
  description: s.description ?? ""
});

export function validateStudentProfile(v: StudentProfileValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.admissionNumber.trim()) e.admissionNumber = "is required";
  if (v.admissionDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.admissionDate)) e.admissionDate = "must be a date (YYYY-MM-DD)";
  return e;
}
