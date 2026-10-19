import { api, type Query } from "@/common/api";
import { useApiGet, useApiList } from "@/common/hooks";
import type { OfflineMethod, PaymentMethod, PaymentStatus, RefundMethod, StudentBrief } from "../../shared/api/records";
import type { Refund } from "./refunds";

export const PAYMENTS_PATH = "/finance/payments";

/* GET /finance/payments rows and GET /finance/payments/:paymentId */
export type Payment = {
  id: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  /* More than the invoice's balance, kept as the student's credit */
  excessAmount: number;
  refundedAmount: number;
  /* The invoice's balance right after this payment */
  balanceAfter: number | null;
  method: PaymentMethod;
  status: PaymentStatus;
  receiptNumber: string | null;
  paidAt: string | null;
  reference: string | null;
  gatewayProvider: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  receivedBy: string | null;
  notes: string | null;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    discount: number;
    lateFee: number;
    total: number;
    amountPaid: number;
    balance: number;
    status: string;
  } | null;
  student: StudentBrief | null;
};

export type PaymentFilters = { studentId?: string; method?: string; status?: string; from?: string; to?: string; page?: number; limit?: number };

export const usePayments = (filters: PaymentFilters) => useApiList<Payment>(PAYMENTS_PATH, filters as Query);

export const usePayment = (paymentId: string | null) => useApiGet<Payment>(paymentId ? `${PAYMENTS_PATH}/${paymentId}` : null);

export type OfflinePaymentInput = {
  invoiceId: string;
  amount: number;
  method: OfflineMethod;
  reference?: string;
  paidAt?: string;
  notes?: string;
};

export const recordPayment = ({ invoiceId, ...body }: OfflinePaymentInput) => api.post<Payment>(`/finance/invoices/${invoiceId}/payments`, body);

/* The receipt PDF (successful payments only) */
export const downloadReceipt = (p: Pick<Payment, "id" | "receiptNumber">) =>
  api.download(`${PAYMENTS_PATH}/${p.id}/receipt`, undefined, `${p.receiptNumber ?? "receipt"}.pdf`);

export type PaymentRefundInput = { paymentId: string; amount?: number; method?: RefundMethod; reason: string; reference?: string };

export const refundPayment = ({ paymentId, ...body }: PaymentRefundInput) => api.post<Refund>(`${PAYMENTS_PATH}/${paymentId}/refunds`, body);

/* Still refundable on a payment */
export const refundable = (p: Pick<Payment, "amount" | "refundedAmount">) => Math.round((p.amount - (p.refundedAmount ?? 0)) * 100) / 100;
