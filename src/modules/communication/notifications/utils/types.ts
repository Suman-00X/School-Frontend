import type { LucideIcon } from "lucide-react";
import { Banknote, BellRing, ClipboardX, FileUp, GraduationCap, Megaphone, MessageSquare, Receipt, RotateCcw, UserX } from "lucide-react";
import type { Notification, NotificationType } from "../api/notifications";

export const TYPE_META: Record<NotificationType, { label: string; icon: LucideIcon }> = {
  ANNOUNCEMENT: { label: "Announcement", icon: Megaphone },
  MESSAGE: { label: "Message", icon: MessageSquare },
  ATTENDANCE_ABSENT: { label: "Absence", icon: UserX },
  ATTENDANCE_MISSED: { label: "Register not taken", icon: ClipboardX },
  RESULTS_PUBLISHED: { label: "Results published", icon: GraduationCap },
  INVOICE_ISSUED: { label: "Invoice issued", icon: Receipt },
  PAYMENT_RECEIVED: { label: "Payment received", icon: Banknote },
  REFUND_PROCESSED: { label: "Refund paid", icon: RotateCcw },
  REFUND_REQUESTED: { label: "Refund to approve", icon: RotateCcw },
  REFUND_APPROVED: { label: "Refund approved", icon: RotateCcw },
  REFUND_REJECTED: { label: "Refund rejected", icon: RotateCcw },
  FEE_REMINDER: { label: "Fee reminder", icon: BellRing },
  IMPORT_COMPLETED: { label: "Import finished", icon: FileUp }
};

const FAMILY: NotificationType[] = [
  "ANNOUNCEMENT",
  "MESSAGE",
  "ATTENDANCE_ABSENT",
  "RESULTS_PUBLISHED",
  "INVOICE_ISSUED",
  "PAYMENT_RECEIVED",
  "REFUND_PROCESSED",
  "FEE_REMINDER"
];
const TEACHER: NotificationType[] = ["ANNOUNCEMENT", "MESSAGE", "ATTENDANCE_MISSED"];
const STAFF: NotificationType[] = ["ANNOUNCEMENT", "MESSAGE", "ATTENDANCE_MISSED", "REFUND_REQUESTED", "REFUND_APPROVED", "REFUND_REJECTED", "IMPORT_COMPLETED"];

/* The types a person of this role can receive (for the type filter) */
export const typesForRole = (role: string | undefined): NotificationType[] =>
  role === "STUDENT" || role === "PARENT" ? FAMILY : role === "TEACHER" ? TEACHER : STAFF;

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/* Where a notification leads, when the person can open that page; null opens the detail drawer.
   Staff go to the finance record, else the student's profile. Families' portal pages come from the
   portal module; until those routes exist, families read the notification in the drawer. */
export function notificationTarget(n: Notification, can: (key: string) => boolean): string | null {
  const studentId = str(n.data.studentId);
  const invoiceId = str(n.data.invoiceId);
  const paymentId = str(n.data.paymentId);
  const refundId = str(n.data.refundId);
  const studentFees = studentId && can("users.students.read") && can("finance.invoices.read") ? `/users/students/${studentId}?tab=fees` : null;
  switch (n.type) {
    case "IMPORT_COMPLETED": {
      const importId = str(n.data.importId);
      return importId && can("administration.imports.read") ? `/administration/imports/${importId}` : null;
    }
    case "ATTENDANCE_MISSED":
      return can("academics.attendance.readMissingRegisters") ? "/academics/attendance/missing-registers" : null;
    case "INVOICE_ISSUED":
    case "FEE_REMINDER":
      return invoiceId && can("finance.invoices.read") ? `/finance/invoices/${invoiceId}` : studentFees;
    case "PAYMENT_RECEIVED":
      return paymentId && can("finance.payments.read") ? `/finance/payments/${paymentId}` : studentFees;
    case "REFUND_PROCESSED":
    case "REFUND_REQUESTED":
    case "REFUND_APPROVED":
    case "REFUND_REJECTED":
      return refundId && can("finance.payments.read") ? `/finance/refunds/${refundId}` : studentFees;
    case "ATTENDANCE_ABSENT":
      return studentId && can("users.students.read") && can("academics.attendance.read") ? `/users/students/${studentId}?tab=attendance` : null;
    default:
      return null;
  }
}
