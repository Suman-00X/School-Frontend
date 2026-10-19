import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList } from "@/common/hooks";

/* The API gives only the employee code; names come from GET /users/teachers when permitted */
export type TeacherRef = { id: string; employeeCode: string } | null;

/* A class's division in one academic year (the header's year) */
export type Section = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionName: string;
  capacity: number | null;
  classTeacherId: string | null;
  deputyClassTeacherId: string | null;
  description: string | null;
  class: { id: string; className: string; classOrder: number };
  classTeacher: TeacherRef;
  deputyClassTeacher: TeacherRef;
};

export type SectionInput = {
  classId: string;
  /* 1–5 letters or digits, upper-cased by the API */
  sectionName: string;
  capacity?: number;
  classTeacherId?: string;
  /* null removes the deputy */
  deputyClassTeacherId?: string | null;
  description?: string;
};

export const SECTIONS_PATH = "/academics/sections";

export const createSection = (body: SectionInput) => api.post<Section>(SECTIONS_PATH, body);

/* All or nothing, at most 200 */
export const createSections = (sections: SectionInput[]) => api.post<Section[]>(`${SECTIONS_PATH}/bulk`, { sections });

export const updateSection = ({ id, ...body }: Partial<SectionInput> & { id: string }) => api.patch<Section>(`${SECTIONS_PATH}/${id}`, body);

/* GET /users/teachers rows, as much as the pickers need */
export type TeacherOption = {
  id: string;
  employeeCode: string;
  user: { firstName: string; lastName: string; email: string };
};

/* Teachers for the class-teacher pickers (ADMIN, PRINCIPAL, STAFF can list them) */
export function useTeacherOptions() {
  const { can } = useAuth();
  const enabled = can("users.teachers.read");
  const list = useApiList<TeacherOption>("/users/teachers", { limit: 100 }, { enabled });
  const byId = new Map((list.rows ?? []).map(t => [t.id, t]));
  const label = (ref: TeacherRef) => {
    if (!ref) return null;
    const t = byId.get(ref.id);
    return t ? `${t.user.firstName} ${t.user.lastName} (${t.employeeCode})` : ref.employeeCode;
  };
  const options = (list.rows ?? []).map(t => ({ value: t.id, label: `${t.user.firstName} ${t.user.lastName}`, description: t.employeeCode }));
  return { enabled, options, label, isLoading: list.isLoading };
}
