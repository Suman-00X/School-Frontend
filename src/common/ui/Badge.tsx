import type { ReactNode } from "react";
import { enumLabel } from "@/common/utils/format";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export function Badge({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={`badge${tone !== "neutral" ? " badge-" + tone : ""}${dot ? " badge-dot" : ""}`}>{children}</span>;
}

/* Common statuses across the API mapped to a colour; anything else is neutral */
const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "success",
  COMPLETED: "success",
  PAID: "success",
  APPROVED: "success",
  SCHEDULED: "info",
  QUEUED: "info",
  PROCESSING: "info",
  MAPPING: "warning",
  PENDING: "warning",
  REQUESTED: "warning",
  PARTIAL: "warning",
  INACTIVE: "neutral",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  BLOCKED: "danger",
  FAILED: "danger",
  REVOKED: "danger",
  REJECTED: "danger",
  OVERDUE: "danger"
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot>
      {label ?? enumLabel(status)}
    </Badge>
  );
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PRINCIPAL: "Principal",
  ACCOUNTANT: "Accountant",
  STAFF: "Office staff",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  HR_MANAGER: "HR manager",
  LIBRARIAN: "Librarian",
  TRANSPORT_MANAGER: "Transport manager",
  HOSTEL_MANAGER: "Hostel manager",
  INVENTORY_MANAGER: "Inventory manager"
};

export const roleLabel = (role: string | null | undefined) => (role ? (ROLE_LABELS[role] ?? enumLabel(role)) : "");

export function RoleBadge({ role }: { role: string | null | undefined }) {
  if (!role) return null;
  const tone: Tone = role === "ADMIN" ? "primary" : role === "STUDENT" || role === "PARENT" ? "info" : "neutral";
  return <Badge tone={tone}>{roleLabel(role)}</Badge>;
}

const METHOD_TONES: Record<string, Tone> = { POST: "success", PATCH: "info", PUT: "warning", DELETE: "danger" };
const METHOD_LABELS: Record<string, string> = { POST: "Create", PATCH: "Edit", PUT: "Replace", DELETE: "Remove" };

export function MethodBadge({ method }: { method: string }) {
  return (
    <Badge tone={METHOD_TONES[method] ?? "neutral"}>
      <span title={method}>{METHOD_LABELS[method] ?? method}</span>
    </Badge>
  );
}
