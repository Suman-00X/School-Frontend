import { api, type Query } from "@/common/api";

/* The account summary embedded in every profile (student, parent, teacher, staff) */
export type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
};

/* For lists the API can't search: load up to `max` rows, 100 a page, and filter on the device */
export async function fetchAllPages<T>(path: string, query: Query = {}, max = 500): Promise<{ rows: T[]; total: number }> {
  const rows: T[] = [];
  let total = 0;
  for (let page = 1; rows.length < max; page++) {
    const res = await api.get<T[]>(path, { ...query, page, limit: 100 });
    rows.push(...res.data);
    total = res.meta?.total ?? rows.length;
    if (!res.meta || page >= res.meta.totalPages) break;
  }
  return { rows, total };
}

/* Case-insensitive match of every word in `search` against the joined fields */
export const matchesSearch = (search: string, ...fields: (string | null | undefined)[]) => {
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(word => haystack.includes(word));
};
