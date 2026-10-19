import { Link } from "react-router-dom";
import { Badge, type Tone } from "@/common/ui";
import { OPS_PATHS } from "../utils/opsPaths";
import { studentLabel, type StudentBrief } from "../api/records";
import "../finance.css";

const INVOICE: Record<string, { label: string; tone: Tone }> = {
  ISSUED: { label: "Issued", tone: "info" },
  PARTIALLY_PAID: { label: "Part paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" }
};

/* An invoice's status, with a red "Overdue" tag next to it while it is open and past due */
export function InvoiceStatus({ status, overdue }: { status: string; overdue?: boolean }) {
  const s = INVOICE[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <span className="chips" style={{ flexWrap: "nowrap" }}>
      <Badge tone={s.tone} dot>
        {s.label}
      </Badge>
      {overdue && <Badge tone="danger">Overdue</Badge>}
    </span>
  );
}

const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Waiting", tone: "warning" },
  SUCCEEDED: { label: "Received", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" }
};

export function PaymentStatus({ status }: { status: string }) {
  const s = PAYMENT[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const REFUND: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Waiting for approval", tone: "warning" },
  PENDING: { label: "Being paid out", tone: "info" },
  PROCESSED: { label: "Refunded", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "neutral" }
};

export const refundStatusLabel = (status: string) => REFUND[status]?.label ?? status;

export function RefundStatus({ status }: { status: string }) {
  const s = REFUND[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

/* A student's name (to their finance account) with the admission number under it */
export function StudentCell({ student, link = true }: { student: StudentBrief | null | undefined; link?: boolean }) {
  if (!student) return <span className="muted">—</span>;
  const name = studentLabel(student);
  return (
    <div style={{ minWidth: 0 }}>
      <div className="nowrap">
        {link ? (
          <Link to={OPS_PATHS.student(student.id)} onClick={e => e.stopPropagation()}>
            {name}
          </Link>
        ) : (
          name
        )}
      </div>
      <div className="small muted nowrap">{student.admissionNumber}</div>
    </div>
  );
}

/* A right-aligned amount cell: tabular digits, a dash for zero when asked */
export function Amount({ value, format, dashZero }: { value: number | null | undefined; format: (n: number) => string; dashZero?: boolean }) {
  if (value === null || value === undefined || (dashZero && value === 0)) return <span className="muted">—</span>;
  return <span className="amount">{format(value)}</span>;
}
