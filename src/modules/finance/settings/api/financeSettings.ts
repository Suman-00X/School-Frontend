import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";

/* The school's finance settings (a singleton, created on first change) */
export type FinanceSettings = {
  /* Accountants' refunds up to this amount need no administrator. 0: every refund needs one */
  refundApprovalLimit: number;
  updatedBy: string | null;
  updatedAt: string | null;
};

export const FINANCE_SETTINGS_PATH = "/finance/settings";

export const useFinanceSettings = () => useApiGet<FinanceSettings>(FINANCE_SETTINGS_PATH);
export const updateFinanceSettings = (body: { refundApprovalLimit: number }) => api.patch<FinanceSettings>(FINANCE_SETTINGS_PATH, body);
