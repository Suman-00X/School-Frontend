import { useApiGet } from "@/common/hooks";
import { useAuth } from "@/common/auth";

/* GET /finance/settings (FI-06 owns the page; refunds only read the approval limit) */
export type FinanceSettings = { refundApprovalLimit: number; updatedBy: string | null; updatedAt: string | null };

export function useRefundApprovalLimit() {
  const { can } = useAuth();
  const q = useApiGet<FinanceSettings>("/finance/settings", undefined, { enabled: can("finance.settings.read") });
  return q.data?.refundApprovalLimit;
}

/* What happens when this person asks for a refund: an administrator's runs at once; an
   accountant's waits for approval unless it is within the school's limit (D-63) */
export function useRefundOutcome() {
  const { can } = useAuth();
  const limit = useRefundApprovalLimit();
  const approves = can("finance.payments.approveRefund");
  return (amount: number | null, format: (n: number) => string) => {
    if (approves) return "You approve it as you save it: the money is paid back now and a refund number is given.";
    if (limit === undefined) return "Above the school's approval limit, the refund waits for an administrator's approval.";
    if (limit <= 0) return "An administrator must approve it before any money is paid back.";
    if (amount !== null && amount > limit) return `Above the approval limit of ${format(limit)}, so it waits for an administrator's approval.`;
    return `Up to ${format(limit)} (counting earlier refunds of the same payment) is paid back at once; above that, an administrator approves it.`;
  };
}
