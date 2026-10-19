import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import type { Option } from "@/common/ui";
import { fetchAll } from "../../shared/api/fetchAll";
import { sectionTitle } from "../../shared/components/SectionSelect";
import type { Section } from "../../classes/api/sections";
import { ENROLLMENTS_PATH } from "../../classes/api/rollNumbers";

export { ENROLLMENTS_PATH };

/* A student's place in one section for one academic year */
export type EnrollmentStatus = "ACTIVE" | "LEFT";
export type AdmissionType = "NEW" | "PROMOTED" | "REPEAT";

export type Enrollment = {
  id: string;
  academicYearId: string;
  studentId: string;
  sectionId: string;
  rollNumber: string | null;
  admissionType: AdmissionType;
  status: EnrollmentStatus;
  description: string | null;
  student: { id: string; studentCode: string; admissionNumber: string | null; user: { firstName: string; lastName: string } };
  section: { id: string; sectionName: string };
  createdAt: string;
  updatedAt: string;
};

export type EnrollInput = { studentId: string; sectionId: string; rollNumber?: string; admissionType?: AdmissionType; description?: string };
export type EnrollmentChanges = Partial<{ sectionId: string; rollNumber: string; status: EnrollmentStatus; admissionType: AdmissionType; description: string }>;

export const enroll = (body: EnrollInput) => api.post<Enrollment>(ENROLLMENTS_PATH, body);
export const updateEnrollment = ({ id, ...body }: EnrollmentChanges & { id: string }) => api.patch<Enrollment>(`${ENROLLMENTS_PATH}/${id}`, body);

/* One student into a section of another year; their old enrollment is closed (LEFT) */
export type PromoteInput = { studentId: string; fromAcademicYearId: string; toAcademicYearId: string; toSectionId: string; admissionType?: AdmissionType };
export const promote = (body: PromoteInput) => api.post<Enrollment>(`${ENROLLMENTS_PATH}/promotions`, body, { academicYearId: null });

/* A whole section: everyone PROMOTE to toSectionId unless an override says otherwise */
export type PromotionAction = "PROMOTE" | "REPEAT" | "LEAVE";
export type PromotionOverride = { studentId: string; action: PromotionAction; toSectionId?: string };
export type BulkPromoteInput = { fromSectionId: string; toAcademicYearId: string; toSectionId: string; overrides: PromotionOverride[] };
export type BulkPromotionResult = {
  promoted: number;
  repeated: number;
  left: number;
  skipped: { studentId: string; reason: string }[];
  enrollments: Enrollment[];
};
export const promoteSection = (body: BulkPromoteInput) => api.post<BulkPromotionResult>(`${ENROLLMENTS_PATH}/promotions/bulk`, body);

export const studentLabel = (e: Pick<Enrollment, "student">) => `${e.student.user.firstName} ${e.student.user.lastName}`.trim();

export const ADMISSION_TYPES: { value: AdmissionType; label: string; description: string }[] = [
  { value: "NEW", label: "New", description: "Joined the school this year" },
  { value: "PROMOTED", label: "Promoted", description: "Moved up from last year" },
  { value: "REPEAT", label: "Repeat", description: "Repeating the class" }
];
export const admissionLabel = (t: AdmissionType) => ADMISSION_TYPES.find(a => a.value === t)?.label ?? t;

/* The whole roster of a section (a section has at most a few dozen students) */
export function useRoster(sectionId: string, academicYearId?: string | null) {
  return useQuery({
    queryKey: [ENROLLMENTS_PATH, { sectionId, all: true, academicYearId: academicYearId ?? "header" }],
    enabled: !!sectionId,
    queryFn: () => fetchAll<Enrollment>(ENROLLMENTS_PATH, { sectionId }, academicYearId !== undefined ? { academicYearId } : {})
  });
}

/* Sections of another academic year (promotion targets), sent with that year's header */
export function useYearSections(yearId: string) {
  const q = useQuery({
    queryKey: ["/academics/sections", { yearId, all: true }],
    enabled: !!yearId,
    staleTime: 60_000,
    queryFn: async () =>
      (await fetchAll<Section>("/academics/sections", {}, { academicYearId: yearId })).sort(
        (a, b) => (a.class?.classOrder ?? 0) - (b.class?.classOrder ?? 0) || a.sectionName.localeCompare(b.sectionName)
      )
  });
  const sections = q.data;
  const options = useMemo<Option[]>(() => (sections ?? []).map(s => ({ value: s.id, label: sectionTitle(s) })), [sections]);
  const byId = useMemo(() => new Map((sections ?? []).map(s => [s.id, s])), [sections]);
  return { sections: sections ?? [], options, byId, isLoading: q.isLoading && !!yearId, error: q.error };
}
