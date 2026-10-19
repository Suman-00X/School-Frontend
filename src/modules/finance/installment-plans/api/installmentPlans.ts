import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";

/* One due date of a plan; shares add up to 100, the last absorbs rounding */
export type Installment = { id: string; sequence: number; name: string; dueDate: string; sharePercent: number };

/* How a year's fee is spread over the year (belongs to one academic year, D-17) */
export type InstallmentPlan = {
  id: string;
  academicYearId: string;
  name: string;
  description: string | null;
  installments: Installment[];
  installmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InstallmentInput = { name: string; dueDate: string; sharePercent: number };
export type PlanInput = { name: string; description?: string; installments: InstallmentInput[] };

export const PLANS_PATH = "/finance/installment-plans";
export const ASSIGNMENTS_PATH = "/finance/plan-assignments";
export const MAX_INSTALLMENTS = 24;

export const createPlan = (body: PlanInput) => api.post<InstallmentPlan>(PLANS_PATH, body);
export const updatePlan = ({ id, ...body }: Partial<PlanInput> & { id: string }) => api.patch<InstallmentPlan>(`${PLANS_PATH}/${id}`, body);
export const removePlan = (id: string) => api.delete<unknown>(`${PLANS_PATH}/${id}`);

/* "4 installments" */
export const installmentsLabel = (n: number) => `${n} installment${n === 1 ? "" : "s"}`;

/* Every plan of the header's year, for pickers */
export function usePlanOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("finance.installmentPlans.read");
  const q = useQuery({
    queryKey: [PLANS_PATH, { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: InstallmentPlan[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await api.get<InstallmentPlan[]>(PLANS_PATH, { page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows;
    }
  });
  const options = useMemo<Option[]>(
    () => (q.data ?? []).map(p => ({ value: p.id, label: p.name, description: installmentsLabel(p.installmentCount) })),
    [q.data]
  );
  const byId = useMemo(() => new Map((q.data ?? []).map(p => [p.id, p])), [q.data]);
  return { allowed, plans: q.data ?? [], options, byId, isLoading: q.isLoading };
}

/* Whether invoices exist under a plan (its installments are then locked). Needs invoices.read;
   without it the answer is unknown (null) and the server's 409 tells. */
export function usePlanHasInvoices(planId: string | null) {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: ["/finance/invoices", { installmentPlanId: planId, limit: 1, probe: true }],
    enabled: !!planId && can("finance.invoices.read"),
    staleTime: 30_000,
    queryFn: async () => ((await api.get<unknown[]>("/finance/invoices", { installmentPlanId: planId, limit: 1 })).meta?.total ?? 0) > 0
  });
  return q.data ?? null;
}

/* ---- plan assignments (which plan each student pays by this year) ---- */

export type PlanAssignment = {
  id: string;
  studentId: string;
  academicYearId: string;
  installmentPlanId: string;
  assignedBy: string | null;
  updatedAt: string;
  plan: { id: string; name: string };
  student: { id: string; studentCode: string; admissionNumber: string; user: { firstName: string; lastName: string } };
};

type InvoiceRef = { id: string; invoiceNumber?: string };

export type AssignResult = {
  changed: number;
  invoicesCancelled: InvoiceRef[];
  invoicesIssued: InvoiceRef[];
  installmentPlan: { id: string; name: string; installmentCount: number } | null;
  studentName?: string;
  students?: number;
  scope?: string | null;
};

/* installmentPlanId null: back to each fee structure's default plan */
export const assignPlan = (body: { studentId: string; installmentPlanId: string | null }) => api.post<AssignResult>(ASSIGNMENTS_PATH, body);

/* Exactly one scope */
export type BulkScope = { sectionId: string } | { classId: string } | { studentIds: string[] };
export const assignPlanBulk = (body: { installmentPlanId: string | null } & BulkScope) => api.post<AssignResult>(`${ASSIGNMENTS_PATH}/bulk`, body);
