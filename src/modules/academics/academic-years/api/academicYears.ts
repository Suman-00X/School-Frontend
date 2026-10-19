import { useQueryClient } from "@tanstack/react-query";
import { api, type AcademicYear } from "@/common/api";
import { academicYearsQueryKey } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";

/* GET /academics/academic-years rows */
export type AcademicYearRecord = AcademicYear & {
  /* 0 = Sunday … 6 = Saturday */
  weeklyOffDays: number[];
  description: string | null;
  /* When it stopped being current; its teachers keep it for a month after */
  currentUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AcademicYearInput = {
  yearName: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  weeklyOffDays?: number[];
  /* "" clears it (the API refuses null) */
  description?: string;
};

export const ACADEMIC_YEARS_PATH = "/academics/academic-years";

/* The year list itself is school-wide: never send the header's year */
const noYear = { academicYearId: null };

export const createAcademicYear = (body: AcademicYearInput) => api.post<AcademicYearRecord>(ACADEMIC_YEARS_PATH, body, noYear);

export const updateAcademicYear = ({ id, ...body }: Partial<AcademicYearInput> & { id: string }) =>
  api.patch<AcademicYearRecord>(`${ACADEMIC_YEARS_PATH}/${id}`, body, noYear);

export const archiveAcademicYear = (id: string) => api.post<AcademicYearRecord>(`${ACADEMIC_YEARS_PATH}/${id}/archival`, undefined, noYear);

export const restoreAcademicYear = (id: string) => api.delete<AcademicYearRecord>(`${ACADEMIC_YEARS_PATH}/${id}/archival`, noYear);

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const offDaysLabel = (days: number[]) => (days.length ? [...days].sort().map(d => WEEKDAYS[d]).join(", ") : "None");

/* Year writes also refresh the header's switcher; a change of current or archived year
   changes what every year-scoped page shows, so those refresh everything */
export function useAcademicYearMutation<TVars>(
  fn: (vars: TVars) => Promise<{ data: AcademicYearRecord; message: string }>,
  opts: { everything?: (vars: TVars) => boolean } = {}
) {
  const qc = useQueryClient();
  return useApiMutation(fn, {
    invalidate: [ACADEMIC_YEARS_PATH],
    onSuccess: (_res, vars) => {
      if (opts.everything?.(vars)) void qc.invalidateQueries();
      else void qc.invalidateQueries({ queryKey: academicYearsQueryKey });
    }
  });
}
