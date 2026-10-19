import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import type { InstallmentPlan } from "../../installment-plans";

export type StructureItem = { id: string; feeHeadId: string; amount: number; feeHead: { id: string; name: string; code: string } };

export type OfferedPlan = Pick<InstallmentPlan, "id" | "name" | "academicYearId" | "installments"> & { isDefault: boolean };

/* What a class pays in a year (annual amounts per fee head), its plans and late-fee rule.
   classId null = every class. chargesLateFee true with no rule = the school's default rule. */
export type FeeStructure = {
  id: string;
  academicYearId: string;
  classId: string | null;
  name: string;
  description: string | null;
  chargesLateFee: boolean;
  lateFeeRuleId: string | null;
  items: StructureItem[];
  class: { id: string; className: string } | null;
  lateFeeRule: { id: string; name: string } | null;
  totalAmount: number;
  defaultInstallmentPlanId: string | null;
  /* Default first */
  installmentPlans: OfferedPlan[];
  createdAt: string;
  updatedAt: string;
};

export type StructureInput = {
  name: string;
  classId?: string;
  description?: string;
  items: { feeHeadId: string; amount: number }[];
  installmentPlanIds: string[];
  defaultInstallmentPlanId: string;
  chargesLateFee: boolean;
  /* PATCH: null goes back to the school default */
  lateFeeRuleId?: string | null;
};

export const STRUCTURES_PATH = "/finance/fee-structures";

export const createStructure = (body: StructureInput) => api.post<FeeStructure>(STRUCTURES_PATH, body);
/* No classId on update */
export const updateStructure = ({ id, ...body }: Partial<Omit<StructureInput, "classId">> & { id: string }) => api.patch<FeeStructure>(`${STRUCTURES_PATH}/${id}`, body);
export const removeStructure = (id: string) => api.delete<unknown>(`${STRUCTURES_PATH}/${id}`);

export const useStructure = (id: string | null) => useApiGet<FeeStructure>(id ? `${STRUCTURES_PATH}/${id}` : null);

/* "School default", the rule's name, or "None" */
export const lateFeeLabel = (s: Pick<FeeStructure, "chargesLateFee" | "lateFeeRule">) => (!s.chargesLateFee ? "None" : (s.lateFeeRule?.name ?? "School default"));

/* Whether invoices were issued from the structure (its items are then frozen). Needs invoices.read;
   null when unknown, and the server's 409 tells. */
export function useStructureHasInvoices(id: string | null) {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: ["/finance/invoices", { feeStructureId: id, limit: 1, probe: true }],
    enabled: !!id && can("finance.invoices.read"),
    staleTime: 30_000,
    queryFn: async () => ((await api.get<unknown[]>("/finance/invoices", { feeStructureId: id, limit: 1 })).meta?.total ?? 0) > 0
  });
  return q.data ?? null;
}
