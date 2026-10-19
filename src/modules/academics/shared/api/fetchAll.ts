import { api, type Query } from "@/common/api";

/* Every row of a paginated list, 100 at a time (for pickers over short school-wide lists) */
export async function fetchAll<T>(path: string, query: Query = {}, opts: { max?: number; academicYearId?: string | null } = {}) {
  const rows: T[] = [];
  const max = opts.max ?? 1000;
  for (let page = 1; rows.length < max; page++) {
    const res = await api.get<T[]>(path, { ...query, page, limit: 100 }, opts.academicYearId !== undefined ? { academicYearId: opts.academicYearId } : undefined);
    rows.push(...res.data);
    if (!res.meta || page >= res.meta.totalPages) break;
  }
  return rows;
}
