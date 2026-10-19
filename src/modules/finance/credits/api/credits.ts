import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import type { CreditEntryType, RefundMethod } from "../../shared/api/records";
import type { Invoice } from "../../invoices/api/invoices";
import type { Refund } from "../../payments/api/refunds";

export type CreditEntry = {
  id: string;
  studentId: string;
  entryType: CreditEntryType;
  amount: number;
  paymentId: string | null;
  invoiceId: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  invoice: { id: string; invoiceNumber: string } | null;
};

/* GET /finance/students/:studentId/credits */
export type StudentCredit = { studentId: string; balance: number; entries: CreditEntry[] };

export const creditsPath = (studentId: string) => `/finance/students/${studentId}/credits`;

export const useStudentCredit = (studentId: string | null, enabled = true) =>
  useApiGet<StudentCredit>(studentId ? creditsPath(studentId) : null, undefined, { enabled });

export type CreditApplicationResult = { applied: number; remainingCredit: number; invoice: Invoice };

/* amount left out: as much as the credit and the invoice balance allow */
export const applyCredit = ({ invoiceId, amount }: { invoiceId: string; amount?: number }) =>
  api.post<CreditApplicationResult>(`/finance/invoices/${invoiceId}/credit-application`, amount ? { amount } : {});

export type CreditRefundInput = {
  studentId: string;
  amount?: number;
  method: Exclude<RefundMethod, "ORIGINAL">;
  reason: string;
  reference?: string;
};

export const refundCredit = ({ studentId, ...body }: CreditRefundInput) => api.post<Refund>(`/finance/students/${studentId}/credit-refunds`, body);

export const CREDIT_ENTRY_LABELS: Record<CreditEntryType, string> = {
  OVERPAYMENT: "Kept from an overpayment",
  APPLIED: "Used on an invoice",
  REFUNDED: "Paid back",
  REFUND_REVERSED: "Put back (refund failed)"
};
