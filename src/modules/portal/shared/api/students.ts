import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

/* GET /me/students: the signed-in student, or a parent's linked children */
export type PortalStudent = {
  id: string;
  studentCode: string;
  admissionNumber: string | null;
  firstName: string;
  lastName: string;
  /* null: not enrolled this year, or the school has no current year */
  current: {
    academicYearId: string;
    sectionId: string;
    section: string;
    rollNumber: string | null;
    status: string;
  } | null;
};

export const MY_STUDENTS_PATH = "/me/students";

/* Loaded once per session: the switcher, the child header and the redirects all share it */
export function useMyStudents() {
  const { can } = useAuth();
  return useQuery({
    queryKey: [MY_STUDENTS_PATH],
    enabled: can("portal.learning.students"),
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => (await api.get<PortalStudent[]>(MY_STUDENTS_PATH, undefined, { signal, academicYearId: null })).data
  });
}

export const studentFullName = (s: Pick<PortalStudent, "firstName" | "lastName">) => [s.firstName, s.lastName].filter(Boolean).join(" ");

/* "Class 6-A · roll 6A-001", or the notice for a child without a section this year */
export const studentLine = (s: PortalStudent) =>
  s.current ? [s.current.section, s.current.rollNumber && `roll ${s.current.rollNumber}`].filter(Boolean).join(" · ") : "Not enrolled this year";

/* The child endpoints all live under this path */
export const studentPath = (studentId: string) => `/me/students/${studentId}`;
