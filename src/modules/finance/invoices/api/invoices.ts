import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type Query } from "@/common/api";
import { useApiGet, useApiList, useApiMutation } from "@/common/hooks";
import type { InvoiceStatus, StudentBrief } from "../../shared/api/records";

export const INVOICES_PATH = "/finance/invoices";

export type InvoiceLine = {
  id: string;
  feeHeadId: string;
  description: string;
  amount: number;
  discount: number;
  netAmount: number;
  feeHead: { id: string; name: string; code: string } | null;
  concessions: { concessionId: string; name: string; amount: number }[];
};

/* GET /finance/invoices rows (lines included) */
export type Invoice = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  academicYearId: string;
  feeStructureId: string;
  installmentPlanId: string | null;
  planInstallmentId: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  lateFee: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  lateFeeWaivedAmount: number;
  lines: InvoiceLine[];
  installment: { id: string; name: string; sequence: number; dueDate: string; sharePercent: number } | null;
  plan: { id: string; name: string } | null;
  structure: { id: string; name: string } | null;
  student: StudentBrief | null;
  isOverdue: boolean;
  concessions: { concessionId: string; name: string; amount: number }[];
  lateFeeWaiver: { amount: number; reason: string; waivedAt: string; waivedBy: string } | null;
  createdAt: string;
};

/* What a payment row looks like when embedded in an invoice or a statement */
export type InvoicePayment = {
  id: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  excessAmount: number;
  refundedAmount: number;
  balanceAfter: number | null;
  method: string;
  status: string;
  receiptNumber: string | null;
  paidAt: string | null;
  reference: string | null;
  receivedBy: string | null;
  notes: string | null;
  createdAt: string;
};

export type CreditApplication = {
  id: string;
  entryType: string;
  amount: number;
  invoiceId: string | null;
  notes: string | null;
  createdAt: string;
  createdBy?: string | null;
};

/* GET /finance/invoices/:invoiceId */
export type InvoiceDetail = Invoice & { payments: InvoicePayment[]; creditApplications: CreditApplication[] };

export type InvoiceFilters = {
  status?: string;
  studentId?: string;
  feeStructureId?: string;
  installmentPlanId?: string;
  overdue?: string;
  page?: number;
  limit?: number;
};

export const useInvoices = (filters: InvoiceFilters, enabled = true) => useApiList<Invoice>(INVOICES_PATH, filters as Query, { enabled });

export const useInvoice = (invoiceId: string | null) => useApiGet<InvoiceDetail>(invoiceId ? `${INVOICES_PATH}/${invoiceId}` : null);

/* Every finance read can change after a money write (invoice, payments, statement, credit, ledger) */
export const FINANCE_READS = ["/finance/"];

export type GenerationInput = {
  feeStructureId: string;
  sectionId?: string;
  studentIds?: string[];
  throughDate?: string;
  issueDate?: string;
  notes?: string;
};

export type GenerationResult = {
  created: number;
  skipped: number;
  throughDate: string;
  byPlan: { installmentPlanId?: string; name: string; invoices: number }[];
};

export const generateInvoices = (body: GenerationInput) => api.post<GenerationResult>(`${INVOICES_PATH}/generation`, body);

export const cancelInvoice = ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
  api.post<Invoice>(`${INVOICES_PATH}/${invoiceId}/cancellation`, { reason });

export const waiveLateFee = ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
  api.post<Invoice>(`${INVOICES_PATH}/${invoiceId}/late-fee-waiver`, { reason });

export const reinstateLateFee = (invoiceId: string) => api.delete<Invoice>(`${INVOICES_PATH}/${invoiceId}/late-fee-waiver`);

export const useInvoiceMutation = <V, D>(fn: (v: V) => Promise<{ data: D; message: string }>) => useApiMutation(fn, { invalidate: FINANCE_READS });

/* ---- the student's statement (FI-11, FI-08) ---- */

export type StatementRefund = {
  id: string;
  refundNumber: string | null;
  paymentId: string | null;
  invoiceId: string | null;
  amount: number;
  method: string;
  status: string;
  reason: string | null;
  createdAt: string;
};

export type StatementConcession = {
  grantId: string;
  concessionId: string;
  name: string;
  category: string;
  concessionType: "PERCENT" | "FIXED";
  value: number;
  reason: string | null;
  amount: number;
};

export type Statement = {
  studentId: string;
  academicYearId: string;
  installmentPlan: { id: string; name: string; installmentCount: number } | null;
  concessions: StatementConcession[];
  totals: {
    gross: number;
    concessions: number;
    lateFees: number;
    lateFeesWaived: number;
    billed: number;
    paid: number;
    refunded: number;
    balance: number;
    overdue: number;
  };
  credit: { balance: number };
  invoices: Invoice[];
  payments: InvoicePayment[];
  refunds: StatementRefund[];
};

/* The previous year's result stays on screen while another year loads */
export const useStatement = (studentId: string | null, academicYearId?: string) =>
  useQuery({
    queryKey: [`/finance/students/${studentId}/statement`, { academicYearId: academicYearId || undefined }],
    enabled: !!studentId,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) =>
      (await api.get<Statement>(`/finance/students/${studentId}/statement`, { academicYearId: academicYearId || undefined }, { signal })).data
  });

export const isOpen = (i: Pick<Invoice, "status">) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID";
