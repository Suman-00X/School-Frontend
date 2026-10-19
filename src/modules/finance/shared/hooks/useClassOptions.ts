import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";

type ClassRow = { id: string; className: string; classOrder: number };

/* The school's classes in order, for class pickers and filters (classes are school-wide) */
export function useClassOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("academics.classes.read");
  const q = useQuery({
    queryKey: ["/academics/classes", { all: true }],
    enabled: allowed,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows: ClassRow[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await api.get<ClassRow[]>("/academics/classes", { page, limit: 100 }, { academicYearId: null });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows.sort((a, b) => a.classOrder - b.classOrder);
    }
  });
  const options = useMemo<Option[]>(() => (q.data ?? []).map(c => ({ value: c.id, label: c.className })), [q.data]);
  const byId = useMemo(() => new Map((q.data ?? []).map(c => [c.id, c])), [q.data]);
  return { allowed, options, byId, isLoading: q.isLoading };
}
