import { useQueryClient } from "@tanstack/react-query";
import { api, type AcademicYear } from "@/common/api";
import { academicYearsQueryKey } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";

/* GET /academics/academic-years rows */
export type AcademicYearRecord = AcademicYear & {
  /* 0 = Sunday … 6 = Saturday */
  weeklyOffDays: number[];
  /* Saturdays of the month that are off: 1 = first … 5 = fifth ([2] = second Saturday) */
  offSaturdays: number[];
  description: string | null;
  /* When it stopped being current; its teachers keep it for a month after */
  currentUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

/* No name: the server derives it from the dates ("2026-27") and re-derives it when they change */
export type AcademicYearInput = {
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  weeklyOffDays?: number[];
  offSaturdays?: number[];
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

export const SATURDAY = 6;

/* Which Saturday of the month: 1 -> "1st" … 5 -> "5th" */
export const SATURDAY_WEEKS = ["1st", "2nd", "3rd", "4th", "5th"];

/* "Sun, 2nd & 4th Sat"; off Saturdays are left out when every Saturday is off */
export const offDaysLabel = (days: number[], offSaturdays: number[] = []) => {
  const parts = [...days].sort().map(d => WEEKDAYS[d]);
  const weeks = days.includes(SATURDAY) ? [] : [...offSaturdays].sort().map(w => SATURDAY_WEEKS[w - 1]);
  if (weeks.length) parts.push(`${weeks.length > 1 ? `${weeks.slice(0, -1).join(", ")} & ${weeks.at(-1)}` : weeks[0]} Sat`);
  return parts.length ? parts.join(", ") : "None";
};

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
