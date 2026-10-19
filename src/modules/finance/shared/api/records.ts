/* Shapes embedded across the finance operations endpoints (invoices, payments, refunds, ledger) */

/* The student embedded in invoices, payments and refunds */
export type StudentBrief = {
  id: string;
  studentCode: string;
  admissionNumber: string;
  user: { firstName: string; lastName: string };
};

/* A staff member embedded as requester, approver, poster */
export type ActorBrief = { id: string; firstName: string; lastName: string; role: string };

export const studentLabel = (s: StudentBrief | null | undefined) => (s ? `${s.user.firstName} ${s.user.lastName}`.trim() : "");

export const actorName = (a: ActorBrief | null | undefined) => (a ? `${a.firstName} ${a.lastName}`.trim() : "");

/* The backend's enums (finance.constants.js) */
export const INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "CHEQUE", "UPI", "CARD", "BANK_TRANSFER", "ONLINE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const OFFLINE_METHODS = ["CASH", "CHEQUE", "UPI", "CARD", "BANK_TRANSFER"] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];

export const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_METHODS = ["ORIGINAL", "CASH", "CHEQUE", "UPI", "BANK_TRANSFER"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

export const REFUND_STATUSES = ["REQUESTED", "PENDING", "PROCESSED", "FAILED", "REJECTED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const CREDIT_ENTRY_TYPES = ["OVERPAYMENT", "APPLIED", "REFUNDED", "REFUND_REVERSED"] as const;
export type CreditEntryType = (typeof CREDIT_ENTRY_TYPES)[number];

export const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CHEQUE: "Cheque",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  ONLINE: "Online",
  ORIGINAL: "Back to card or UPI"
};

export const methodLabel = (m: string | null | undefined) => (m ? (METHOD_LABELS[m] ?? m) : "");

/* A reference is needed for every method but cash (payments) */
export const needsReference = (m: string) => m !== "CASH" && m !== "ORIGINAL";
