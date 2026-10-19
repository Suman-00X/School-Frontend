import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useApiList } from "@/common/hooks";

/* The academics reads that admission and the section roster need */

export type SchoolClass = { id: string; className: string; classOrder: number };

export type Section = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionName: string;
  capacity: number | null;
  class?: { id: string; className: string; classOrder: number };
  /* Only the employee code (gap: no name) */
  classTeacher?: { id: string; employeeCode: string } | null;
};

export type Enrollment = {
  id: string;
  academicYearId: string;
  studentId: string;
  sectionId: string;
  rollNumber: string;
  admissionType: string;
  status: string;
  student?: { id: string; studentCode: string; admissionNumber: string; user: { firstName: string; lastName: string } };
  section?: { id: string; sectionName: string };
};

export const useClasses = (enabled = true) =>
  useQuery({
    queryKey: ["/academics/classes", { limit: 100 }],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await api.get<SchoolClass[]>("/academics/classes", { limit: 100 })).data.sort((a, b) => a.classOrder - b.classOrder)
  });

/* Sections of one year (sent as X-Academic-Year-Id), optionally of one class.
   undefined year = the header's year. */
export const useSections = (classId: string | null, academicYearId?: string, enabled = true) =>
  useQuery({
    queryKey: ["/academics/sections", { classId, academicYearId: academicYearId ?? "header" }],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<Section[]>("/academics/sections", { classId, limit: 100 }, academicYearId ? { academicYearId } : {});
      return { rows: res.data, total: res.meta?.total ?? res.data.length };
    }
  });

/* Section roster for the header's year */
export const useRoster = (sectionId: string, page: number) =>
  useApiList<Enrollment>("/academics/enrollments", { sectionId, page, limit: 50 }, { enabled: !!sectionId });

export const sectionLabel = (s: Section, classes?: SchoolClass[]) =>
  `${s.class?.className ?? classes?.find(c => c.id === s.classId)?.className ?? "Class"} – ${s.sectionName}`;
