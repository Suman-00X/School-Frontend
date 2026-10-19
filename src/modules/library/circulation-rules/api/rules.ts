import { api } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import type { CirculationRule, LoanableItemType } from "../../shared/api/types";

export const RULES_PATH = "/library/circulation-rules";

export type RuleInput = {
  borrowerRole: string | null;
  classId: string | null;
  itemType: LoanableItemType | null;
  loanDays: number;
  maxLoans: number;
  maxRenewals: number;
  finePerDay: number;
  fineGraceDays: number;
  maxFine: number | null;
};

const invalidate = [RULES_PATH];

export const useCreateRule = () => useApiMutation((body: RuleInput) => api.post<CirculationRule>(RULES_PATH, body), { invalidate });

export const useUpdateRule = () =>
  useApiMutation(({ id, ...body }: Partial<RuleInput> & { id: string }) => api.patch<CirculationRule>(`${RULES_PATH}/${id}`, body), { invalidate });

export const useDeleteRule = () => useApiMutation((id: string) => api.delete<CirculationRule>(`${RULES_PATH}/${id}`), { invalidate });
