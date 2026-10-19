import { api } from "@/common/api";
import { studentPath } from "../../shared/api/students";

export type InvoiceStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export type InvoiceLine = {
  id: string;
  description: string;
  amount: number;
  discount: number;
  netAmount: number;
  feeHead?: { id: string; name: string; code: string } | null;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  lateFee: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  isOverdue: boolean;
  notes: string | null;
  cancelReason: string | null;
  lateFeeWaiver: { amount: number; reason: string; waivedAt: string } | null;
  installment?: { id: string; name: string; dueDate: string } | null;
  plan?: { id: string; name: string } | null;
  structure?: { id: string; name: string } | null;
  lines: InvoiceLine[];
  concessions?: { concessionId: string; name: string; amount: number }[];
};

export type Payment = {
  id: string;
  invoiceId: string;
  receiptNumber: string | null;
  paidAt: string;
  amount: number;
  method: string;
  status: string;
  excessAmount: number;
  refundedAmount: number;
  reference: string | null;
};

export type Refund = { id: string; refundNumber: string | null; amount: number; status: "PENDING" | "PROCESSED" | "FAILED"; processedAt: string | null; createdAt?: string };

export type CreditEntry = { id: string; entryType: "OVERPAYMENT" | "APPLIED" | "REFUNDED" | "REFUND_REVERSED"; amount: number; createdAt: string; invoice?: { id: string; invoiceNumber: string } | null; notes?: string | null };

export type Statement = {
  studentId: string;
  academicYearId: string;
  installmentPlan: { id: string; name: string; installmentCount: number } | null;
  concessions: { grantId: string; name: string; category: string | null; concessionType: string; value: number; amount: number; reason: string | null }[];
  totals: { gross: number; concessions: number; lateFees: number; lateFeesWaived: number; billed: number; paid: number; refunded: number; balance: number; overdue: number };
  credit: { balance: number };
  invoices: Invoice[];
  payments: Payment[];
  refunds: Refund[];
  creditEntries: CreditEntry[];
};

export type InvoiceDetail = Invoice & { payments: Payment[]; creditApplications: { id: string; amount: number; createdAt: string }[] };

export type PaymentOrder = {
  paymentId: string;
  provider: string;
  orderId: string;
  keyId: string;
  amount: number;
  amountMinor: number;
  currency: string;
  invoiceNumber: string;
  invoiceBalance: number;
};

export const feesPath = (studentId: string) => `${studentPath(studentId)}/fees`;
export const invoicePath = (studentId: string, invoiceId: string) => `${studentPath(studentId)}/invoices/${invoiceId}`;
/* The page routes (the API's invoice path is …/invoices/:id) */
export const invoicePagePath = (studentId: string, invoiceId: string) => `${feesPath(studentId)}/invoices/${invoiceId}`;

export const startPayment = ({ studentId, invoiceId, amount }: { studentId: string; invoiceId: string; amount?: number }) =>
  api.post<PaymentOrder>(`${invoicePath(studentId, invoiceId)}/payment-orders`, amount === undefined ? {} : { amount });

export const confirmPayment = (body: { orderId: string; paymentId: string; signature: string }) => api.post<Payment>("/me/payments/confirmations", body);

export const downloadReceipt = (paymentId: string) => api.download(`/me/payments/${paymentId}/receipt`, undefined, "receipt.pdf");
export const downloadRefundReceipt = (refundId: string) => api.download(`/me/refunds/${refundId}/receipt`, undefined, "refund-receipt.pdf");

/* The smallest online payment, unless the balance is smaller (finance MIN_ONLINE_PAYMENT) */
export const MIN_ONLINE_PAYMENT = 100;

export const isPayable = (i: Invoice) => i.balance > 0 && (i.status === "ISSUED" || i.status === "PARTIALLY_PAID");

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { ISSUED: "Due", PARTIALLY_PAID: "Part paid", PAID: "Paid", CANCELLED: "Cancelled" };
export const INVOICE_STATUS_TONES = { ISSUED: "warning", PARTIALLY_PAID: "info", PAID: "success", CANCELLED: "neutral" } as const;
export const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CHEQUE: "Cheque",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  ONLINE: "Online"
};
export const REFUND_STATUS_LABELS: Record<string, string> = { PENDING: "Being processed", PROCESSED: "Refunded", FAILED: "Failed" };
export const REFUND_STATUS_TONES = { PENDING: "warning", PROCESSED: "success", FAILED: "danger" } as const;
export const CREDIT_LABELS: Record<string, string> = {
  OVERPAYMENT: "Paid more than due",
  APPLIED: "Used on an invoice",
  REFUNDED: "Paid back",
  REFUND_REVERSED: "Refund reversed"
};
