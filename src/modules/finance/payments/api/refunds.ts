import { api, type Query } from "@/common/api";
import { useApiGet, useApiList } from "@/common/hooks";
import type { ActorBrief, RefundMethod, RefundStatus, StudentBrief } from "../../shared/api/records";

export const REFUNDS_PATH = "/finance/refunds";

/* GET /finance/refunds rows and GET /finance/refunds/:refundId */
export type Refund = {
  id: string;
  paymentId: string | null;
  invoiceId: string | null;
  studentId: string;
  /* Given when the refund is executed (approved), so requests have none */
  refundNumber: string | null;
  amount: number;
  fromInvoice: number;
  fromCredit: number;
  /* A gateway refund the books could not cover (to review) */
  unallocated: number;
  method: RefundMethod;
  status: RefundStatus;
  source: "STAFF" | "GATEWAY";
  reason: string | null;
  reference: string | null;
  gatewayProvider: string | null;
  gatewayRefundId: string | null;
  autoApproved: boolean;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  processedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  payment: { id: string; receiptNumber: string | null; method: string; amount: number; refundedAmount: number; paidAt: string | null; reference: string | null } | null;
  invoice: { id: string; invoiceNumber: string; total: number; amountPaid: number; balance: number; status: string } | null;
  student: StudentBrief | null;
  requester: ActorBrief | null;
  approver: ActorBrief | null;
  rejecter: ActorBrief | null;
};

export type RefundFilters = {
  status?: string;
  studentId?: string;
  paymentId?: string;
  creditOnly?: string;
  needsReview?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export const useRefunds = (filters: RefundFilters, opts: { enabled?: boolean } = {}) => useApiList<Refund>(REFUNDS_PATH, filters as Query, opts);

export const useRefund = (refundId: string | null) => useApiGet<Refund>(refundId ? `${REFUNDS_PATH}/${refundId}` : null);

export const approveRefund = (refundId: string) => api.post<Refund>(`${REFUNDS_PATH}/${refundId}/approval`);

export const rejectRefund = ({ refundId, reason }: { refundId: string; reason: string }) => api.post<Refund>(`${REFUNDS_PATH}/${refundId}/rejection`, { reason });

/* Processed refunds, and pending ones (printed as pending) */
export const hasRefundReceipt = (r: Pick<Refund, "status">) => r.status === "PROCESSED" || r.status === "PENDING";

export const downloadRefundReceipt = (r: Pick<Refund, "id" | "refundNumber">) =>
  api.download(`${REFUNDS_PATH}/${r.id}/receipt`, undefined, `${r.refundNumber ?? "refund"}.pdf`);
