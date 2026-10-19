import { api } from "@/common/api";

export type StaffAttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "ON_DUTY";

export type MyAttendance = {
  userId: string;
  from: string;
  to: string;
  counts: Record<StaffAttendanceStatus, number>;
  marked: number;
  daysPresent: number;
  days: { date: string; status: StaffAttendanceStatus; checkIn: string | null; checkOut: string | null; remarks: string | null; leaveRequestId: string | null }[];
};

export type LeaveBalance = { leaveTypeId: string; code: string; name: string; isPaid: boolean; quota: number; used: number; pending: number; remaining: number };
export type MyLeaveBalances = { userId: string; year: number; balances: LeaveBalance[] };

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveRequest = {
  id: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  leaveType: { id: string; name: string; code: string; isPaid: boolean } | null;
};

export type LeaveType = { id: string; name: string; code: string; annualQuotaDays: number; isPaid: boolean; requiresApproval: boolean; description: string | null };

export type PayLine = { code: string; name: string; kind: "EARNING" | "DEDUCTION"; calculation: string; value: number; amount: number };
export type Payslip = {
  id: string;
  month: string;
  payslipNumber: string;
  employeeName: string;
  employeeCode: string | null;
  designation: string | null;
  daysInMonth: number;
  paidDays: number;
  lopDays: number;
  earnings: PayLine[];
  deductions: PayLine[];
  totalEarnings: number;
  lopAmount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  bankAccountMasked: string | null;
  bankIfsc?: string | null;
  panMasked: string | null;
};

export const MY_ATTENDANCE_PATH = "/hr/me/attendance";
export const MY_BALANCES_PATH = "/hr/me/leave-balances";
export const MY_LEAVE_PATH = "/hr/me/leave-requests";
export const LEAVE_TYPES_PATH = "/hr/leave-types";
export const MY_PAYSLIPS_PATH = "/hr/me/payslips";

export type LeaveInput = { leaveTypeId: string; fromDate: string; toDate: string; halfDay: boolean; reason: string };
export const applyLeave = (body: LeaveInput) => api.post<LeaveRequest>("/hr/leave-requests", body);
export const cancelLeave = ({ id, reason }: { id: string; reason?: string }) => api.post<LeaveRequest>(`/hr/leave-requests/${id}/cancellation`, reason ? { reason } : {});

export const downloadPayslip = (id: string) => api.download(`${MY_PAYSLIPS_PATH}/${id}/pdf`, undefined, "payslip.pdf");

export const STAFF_STATUS_LABELS: Record<StaffAttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  LEAVE: "On leave",
  ON_DUTY: "On duty"
};
export const STAFF_STATUS_TONES = { PRESENT: "success", ABSENT: "danger", HALF_DAY: "warning", LEAVE: "info", ON_DUTY: "primary" } as const;
export const LEAVE_STATUS_TONES = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral" } as const;
