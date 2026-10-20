import { api } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import { formatDate } from "@/common/utils/format";

/* GET /academics/student-leaves (header's year) and the portal's /me/students/:id/leave-requests:
   leave a parent asked for their child, decided by the class teacher */
export type StudentLeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type StudentLeaveSession = "FULL_DAY" | "FORENOON" | "AFTERNOON";

type Person = { id: string; firstName: string; lastName: string; role: string };

export type StudentLeave = {
  id: string;
  academicYearId: string;
  studentId: string;
  sectionId: string;
  fromDate: string;
  toDate: string;
  session: StudentLeaveSession;
  /* School days in the range, fixed when applying (0.5 for a half day) */
  days: number;
  reasonCategory: string;
  reason: string;
  status: StudentLeaveStatus;
  requestedBy: string;
  requester: Person | null;
  decidedAt: string | null;
  decider: Person | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  canceller: Person | null;
  cancelReason: string | null;
  student: { id: string; admissionNumber: string; studentCode: string; user: { firstName: string; lastName: string } } | null;
  section: { id: string; sectionName: string; class: { id: string; className: string } | null } | null;
  createdAt: string;
  /* Staff API: pending, and the caller is the class teacher or deputy, the principal or an admin */
  canDecide?: boolean;
  /* Portal: pending, or approved and not started */
  canCancel?: boolean;
  /* After approving: absences changed to excused */
  excusedMarks?: number;
};

/* GET …/on-leave: a section's students with a pending or approved leave on a date */
export type OnLeave = {
  requestId: string;
  studentId: string;
  status: "PENDING" | "APPROVED";
  session: StudentLeaveSession;
  reasonCategory: string;
  fromDate: string;
  toDate: string;
};

export const STUDENT_LEAVES_PATH = "/academics/student-leaves";
export const ON_LEAVE_PATH = `${STUDENT_LEAVES_PATH}/on-leave`;

export const LEAVE_REASONS = [
  { value: "ILLNESS", label: "Illness" },
  { value: "MEDICAL", label: "Doctor or hospital visit" },
  { value: "FAMILY", label: "Family function or emergency" },
  { value: "TRAVEL", label: "Travel / out of station" },
  { value: "RELIGIOUS", label: "Festival or religious occasion" },
  { value: "EVENT", label: "Competition or event outside school" },
  { value: "OTHER", label: "Other" }
];

export const reasonLabel = (key: string) => LEAVE_REASONS.find(r => r.value === key)?.label ?? key;

export const SESSION_LABELS: Record<StudentLeaveSession, string> = { FULL_DAY: "Full day", FORENOON: "Forenoon", AFTERNOON: "Afternoon" };

export const LEAVE_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending", description: "Waiting for a decision" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled", description: "Withdrawn by the family" },
  { value: "ALL", label: "All requests" }
];

/* "12 Nov 2026", "12 Nov 2026 (forenoon)" or "12 Nov 2026 – 14 Nov 2026" */
export const leaveDates = (l: Pick<StudentLeave, "fromDate" | "toDate" | "session">) =>
  l.fromDate === l.toDate
    ? `${formatDate(l.fromDate)}${l.session === "FULL_DAY" ? "" : ` (${SESSION_LABELS[l.session].toLowerCase()})`}`
    : `${formatDate(l.fromDate)} – ${formatDate(l.toDate)}`;

/* "1 day", "½ day", "3 days" */
export const leaveDays = (days: number) => (days === 0.5 ? "½ day" : `${days} day${days === 1 ? "" : "s"}`);

export const studentName = (l: StudentLeave) => (l.student?.user ? `${l.student.user.firstName} ${l.student.user.lastName}`.trim() : "Student");
export const sectionName = (l: StudentLeave) => (l.section ? `${l.section.class?.className ?? ""}-${l.section.sectionName}` : "—");

export const decideLeave = ({ id, decision, note }: { id: string; decision: "APPROVED" | "REJECTED"; note?: string }) =>
  api.post<StudentLeave>(`${STUDENT_LEAVES_PATH}/${id}/decision`, { decision, ...(note && { note }) });

/* Students on leave in a section on a date, for the register */
export const useOnLeave = (sectionId: string, date: string, enabled = true) =>
  useApiGet<OnLeave[]>(ON_LEAVE_PATH, { sectionId, date }, { enabled: enabled && !!sectionId && !!date });
