import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";

/* Options for the invoice filters and the generation wizard. Fee structures belong to the
   header's academic year; the setup pages own them, these only read. (Installment plan
   options come from the installment-plans submodule.) */

export type StructureOption = { id: string; name: string; classId: string; academicYearId: string };

async function allPages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await api.get<T[]>(path, { page, limit: 100 });
    rows.push(...res.data);
    if (!res.meta || page >= res.meta.totalPages) break;
  }
  return rows;
}

export function useStructureOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("finance.feeStructures.read");
  const q = useQuery({
    queryKey: ["/finance/fee-structures", { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: () => allPages<StructureOption>("/finance/fee-structures")
  });
  const options = useMemo<Option[]>(() => (q.data ?? []).map(s => ({ value: s.id, label: s.name })), [q.data]);
  const byId = useMemo(() => new Map((q.data ?? []).map(s => [s.id, s])), [q.data]);
  return { allowed, options, byId, structures: q.data ?? [], isLoading: q.isLoading };
}

/* A section's active students (GET /academics/enrollments?sectionId=) */
export type RosterRow = {
  id: string;
  studentId: string;
  rollNumber: string | null;
  status: string;
  student: { id: string; studentCode: string; admissionNumber: string; user: { firstName: string; lastName: string } };
};

export function useSectionRoster(sectionId: string | null) {
  return useQuery({
    queryKey: ["/academics/enrollments", { sectionId, all: true }],
    enabled: !!sectionId,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: RosterRow[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await api.get<RosterRow[]>("/academics/enrollments", { sectionId, page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows.filter(r => r.status === "ACTIVE");
    }
  });
}
