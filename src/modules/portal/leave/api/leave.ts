import { api } from "@/common/api";
import type { StudentLeave, StudentLeaveSession } from "@/modules/academics";
import { studentPath } from "../../shared/api/students";

/* GET/POST /me/students/:studentId/leave-requests (the list is the header's year; applying
   picks the year the dates fall in) and POST …/:requestId/cancellation */
export const leavePath = (studentId: string) => `${studentPath(studentId)}/leave-requests`;

export type LeaveApplication = {
  fromDate: string;
  toDate: string;
  session: StudentLeaveSession;
  reasonCategory: string;
  reason: string;
};

export const applyLeave = ({ studentId, ...body }: LeaveApplication & { studentId: string }) =>
  api.post<StudentLeave>(leavePath(studentId), body);

export const cancelLeave = ({ studentId, requestId, reason }: { studentId: string; requestId: string; reason?: string }) =>
  api.post<StudentLeave>(`${leavePath(studentId)}/${requestId}/cancellation`, reason ? { reason } : {});
