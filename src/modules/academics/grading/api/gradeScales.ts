import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";
import { fetchAll } from "../../shared/api/fetchAll";

/* Grade scales are school-wide. Bands tile 0–100%: each runs from minPercent (included) to
   maxPercent (excluded; 100% falls in the top band). */
export type GradeBand = {
  id?: string;
  grade: string;
  minPercent: number;
  maxPercent: number;
  gradePoint?: number | null;
  remark?: string | null;
  isPassing: boolean;
};

export type GradeScale = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  /* Lowest band first */
  bands: GradeBand[];
  createdAt: string;
  updatedAt: string;
};

export type GradeScaleTemplate = { key: string; name: string; description: string; bands: GradeBand[] };

export type BandInput = { grade: string; minPercent: number; maxPercent: number; gradePoint?: number; remark?: string; isPassing: boolean };

export type GradeScaleInput = {
  name?: string;
  description?: string;
  isDefault?: boolean;
  /* Either bands or templateKey on create */
  bands?: BandInput[];
  templateKey?: string;
};

export const GRADE_SCALES_PATH = "/academics/grade-scales";

export const createGradeScale = (body: GradeScaleInput) => api.post<GradeScale>(GRADE_SCALES_PATH, body);
export const updateGradeScale = ({ id, ...body }: GradeScaleInput & { id: string }) => api.patch<GradeScale>(`${GRADE_SCALES_PATH}/${id}`, body);
export const deleteGradeScale = (id: string) => api.delete<GradeScale>(`${GRADE_SCALES_PATH}/${id}`);

export function useGradeScaleTemplates(enabled = true) {
  return useQuery({
    queryKey: [`${GRADE_SCALES_PATH}/templates`],
    enabled,
    staleTime: Infinity,
    queryFn: async () => (await api.get<GradeScaleTemplate[]>(`${GRADE_SCALES_PATH}/templates`)).data
  });
}

/* Every scale, for pickers */
export function useGradeScaleOptions() {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: [GRADE_SCALES_PATH, { all: true }],
    enabled: can("academics.gradeScales.read"),
    staleTime: 60_000,
    queryFn: () => fetchAll<GradeScale>(GRADE_SCALES_PATH)
  });
  const scales = q.data;
  const options = useMemo<Option[]>(
    () => (scales ?? []).map(s => ({ value: s.id, label: s.name, description: `${bandSummary(s.bands)}${s.isDefault ? " · school default" : ""}` })),
    [scales]
  );
  const byId = useMemo(() => new Map((scales ?? []).map(s => [s.id, s])), [scales]);
  return { scales: scales ?? [], options, byId, isLoading: q.isLoading };
}

const byMin = (a: { minPercent: number }, b: { minPercent: number }) => a.minPercent - b.minPercent;

/* "A1 … E2 (9 grades)" from best to worst */
export const bandSummary = (bands: GradeBand[]) => {
  const sorted = [...bands].sort(byMin).reverse();
  if (!sorted.length) return "No bands";
  return `${sorted[0].grade} … ${sorted.at(-1)!.grade} (${sorted.length} grades)`;
};

/* The lowest % that earns a passing grade, or null when every band passes */
export const passFrom = (bands: GradeBand[]) => {
  if (!bands.some(b => !b.isPassing)) return null;
  const passing = bands.filter(b => b.isPassing).map(b => b.minPercent);
  return passing.length ? Math.min(...passing) : null;
};

/* The server's band rules, checked before sending: the first problem, else null */
export function bandProblem(bands: BandInput[]): string | null {
  if (bands.length < 2) return "A scale needs at least two bands";
  if (bands.length > 20) return "A scale has at most 20 bands";
  const grades = bands.map(b => b.grade.trim().toLowerCase());
  if (grades.some(g => !g)) return "Every band needs a grade";
  if (new Set(grades).size !== grades.length) return "Each grade can appear only once";
  for (const b of bands) if (!(b.maxPercent > b.minPercent)) return `${b.grade}: "to" must be above "from"`;
  const sorted = [...bands].sort(byMin);
  if (sorted[0].minPercent !== 0) return "The lowest band must start at 0%";
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.minPercent < prev.maxPercent) return `Bands overlap: ${prev.grade} ends at ${prev.maxPercent}% but ${cur.grade} starts at ${cur.minPercent}%`;
    if (cur.minPercent > prev.maxPercent) return `Gap: nothing covers ${prev.maxPercent}% to ${cur.minPercent}%`;
  }
  if (sorted.at(-1)!.maxPercent !== 100) return "The highest band must end at 100%";
  return null;
}
