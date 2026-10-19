import { api } from "@/common/api";

export const LEAVE_TYPES_PATH = "/hr/leave-types";
export const LEAVE_REQUESTS_PATH = "/hr/leave-requests";
export const LEAVE_BALANCES_PATH = "/hr/leave-balances";

export type LeaveType = {
  id: string;
  name: string;
  code: string;
  /* Days per calendar year, steps of 0.5 */
  annualQuotaDays: number;
  isPaid: boolean;
  requiresApproval: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveTypeInput = {
  name: string;
  code: string;
  annualQuotaDays: number;
  isPaid: boolean;
  requiresApproval: boolean;
  description?: string | null;
};

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export type LeaveRequest = {
  id: string;
  userId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  /* Working days, fixed when applied */
  days: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  leaveType: { id: string; name: string; code: string; isPaid: boolean } | null;
  user: { id: string; firstName: string; lastName: string; role: string } | null;
  /* After a decision or a cancellation */
  markedDates?: string[];
  clearedDates?: string[];
};

export type LeaveBalance = {
  leaveTypeId: string;
  code: string;
  name: string;
  isPaid: boolean;
  quota: number;
  used: number;
  pending: number;
  remaining: number;
};

export type LeaveBalances = { userId: string; year: number; balances: LeaveBalance[] };

export const createLeaveType = (body: LeaveTypeInput) => api.post<LeaveType>(LEAVE_TYPES_PATH, body);
export const updateLeaveType = ({ id, ...body }: Partial<LeaveTypeInput> & { id: string }) => api.patch<LeaveType>(`${LEAVE_TYPES_PATH}/${id}`, body);
export const removeLeaveType = (id: string) => api.delete<LeaveType>(`${LEAVE_TYPES_PATH}/${id}`);

export const decideLeave = ({ id, ...body }: { id: string; decision: "APPROVED" | "REJECTED"; note?: string }) =>
  api.post<LeaveRequest>(`${LEAVE_REQUESTS_PATH}/${id}/decision`, body);

export const cancelLeave = ({ id, ...body }: { id: string; reason?: string }) => api.post<LeaveRequest>(`${LEAVE_REQUESTS_PATH}/${id}/cancellation`, body);
