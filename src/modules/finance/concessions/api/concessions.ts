import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";
import { formatAmount } from "../../shared";

export const CATEGORIES = ["SIBLING", "STAFF_WARD", "MERIT", "SCHOLARSHIP", "FINANCIAL_AID", "OTHER"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  SIBLING: "Sibling",
  STAFF_WARD: "Staff ward",
  MERIT: "Merit",
  SCHOLARSHIP: "Scholarship",
  FINANCIAL_AID: "Financial aid",
  OTHER: "Other"
};

export const CATEGORY_OPTIONS: Option[] = [
  { value: "SIBLING", label: "Sibling", description: "A brother or sister also studies here" },
  { value: "STAFF_WARD", label: "Staff ward", description: "Child of a staff member" },
  { value: "MERIT", label: "Merit", description: "For results or achievement" },
  { value: "SCHOLARSHIP", label: "Scholarship", description: "Funded by the school or a sponsor" },
  { value: "FINANCIAL_AID", label: "Financial aid", description: "Need-based support" },
  { value: "OTHER", label: "Other" }
];

/* PERCENT: 0–100 of each matching fee item. FIXED: an amount per year, spread over the installments */
export type ConcessionType = "PERCENT" | "FIXED";

export type Concession = {
  id: string;
  name: string;
  category: Category;
  concessionType: ConcessionType;
  value: number;
  description: string | null;
  /* Empty: every fee head */
  feeHeadIds: string[];
  feeHeads: { id: string; name: string; code: string }[];
  createdAt: string;
  updatedAt: string;
};

export type ConcessionInput = {
  name: string;
  category: Category;
  concessionType: ConcessionType;
  value: number;
  feeHeadIds: string[];
  description?: string;
};

export type Grant = {
  id: string;
  studentId: string;
  concessionId: string;
  academicYearId: string;
  reason: string | null;
  grantedBy: string;
  createdAt: string;
  concession: Concession;
  student: { id: string; studentCode: string; admissionNumber: string; user: { firstName: string; lastName: string } };
};

export type GrantResult = Grant & { studentName: string; recalculatedInvoices: string[] };

export const CONCESSIONS_PATH = "/finance/concessions";
export const GRANTS_PATH = "/finance/concession-grants";

export const createConcession = (body: ConcessionInput) => api.post<Concession>(CONCESSIONS_PATH, body);
export const updateConcession = ({ id, ...body }: Partial<ConcessionInput> & { id: string }) => api.patch<Concession>(`${CONCESSIONS_PATH}/${id}`, body);
export const removeConcession = (id: string) => api.delete<unknown>(`${CONCESSIONS_PATH}/${id}`);

/* academicYearId: default the current year */
export const grantConcession = (body: { studentId: string; concessionId: string; academicYearId?: string; reason?: string }) => api.post<GrantResult>(GRANTS_PATH, body);
export const revokeGrant = (id: string) => api.delete<GrantResult>(`${GRANTS_PATH}/${id}`);

/* "10%" or "5,000.00 / year" */
export const valueLabel = (c: Pick<Concession, "concessionType" | "value">) => (c.concessionType === "PERCENT" ? `${c.value}%` : `${formatAmount(c.value)} / year`);

export const grantStudentName = (g: Pick<Grant, "student">) => `${g.student.user.firstName} ${g.student.user.lastName}`.trim();

/* Every template, for pickers and filters */
export function useConcessionOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("finance.concessions.read");
  const q = useQuery({
    queryKey: [CONCESSIONS_PATH, { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: Concession[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await api.get<Concession[]>(CONCESSIONS_PATH, { page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows;
    }
  });
  const options = useMemo<Option[]>(
    () => (q.data ?? []).map(c => ({ value: c.id, label: c.name, description: `${CATEGORY_LABELS[c.category]} · ${valueLabel(c)}` })),
    [q.data]
  );
  const byId = useMemo(() => new Map((q.data ?? []).map(c => [c.id, c])), [q.data]);
  return { allowed, options, byId, isLoading: q.isLoading };
}

/* How many active grants each template has (one small call per template: the list has no count) */
export function useGrantCounts(ids: string[]) {
  const results = useQueries({
    queries: ids.map(id => ({
      queryKey: [GRANTS_PATH, { concessionId: id, limit: 1, count: true }],
      staleTime: 30_000,
      queryFn: async () => (await api.get<unknown[]>(GRANTS_PATH, { concessionId: id, limit: 1 })).meta?.total ?? 0
    }))
  });
  return new Map(ids.map((id, i) => [id, results[i]?.data]));
}
