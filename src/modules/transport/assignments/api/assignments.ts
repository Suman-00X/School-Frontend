import { api } from "@/common/api";
import type { Direction } from "../../shared/utils/format";

export const ASSIGNMENTS_PATH = "/transport/assignments";

/* GET /transport/assignments rows (and GET …/:assignmentId) */
export type SeatAssignment = {
  id: string;
  academicYearId: string;
  studentId: string;
  routeId: string;
  stopId: string;
  direction: Direction;
  startDate: string;
  /* The last day of use; set when ended */
  endDate: string | null;
  status: "ACTIVE" | "ENDED";
  endedAt: string | null;
  previousAssignmentId: string | null;
  notes: string | null;
  student: { id: string; studentCode: string; admissionNumber: string; user: { firstName: string; lastName: string } };
  route: { id: string; name: string; code: string };
  stop: { id: string; name: string; sequence: number; pickupTime: string | null; dropTime: string | null; landmark: string | null; monthlyFee: number };
  createdAt: string;
};

export type AssignInput = { studentId: string; routeId: string; stopId: string; direction?: Direction; startDate?: string; notes?: string };
export type ChangeInput = { routeId: string; stopId: string; direction?: Direction; effectiveDate?: string };

export const assignSeat = (body: AssignInput) => api.post<SeatAssignment>(ASSIGNMENTS_PATH, body);

export const changeSeat = ({ id, ...body }: ChangeInput & { id: string }) => api.post<SeatAssignment>(`${ASSIGNMENTS_PATH}/${id}/change`, body);

export const endSeat = ({ id, endDate }: { id: string; endDate?: string }) =>
  api.post<SeatAssignment>(`${ASSIGNMENTS_PATH}/${id}/end`, endDate ? { endDate } : {});

export const riderName = (a: Pick<SeatAssignment, "student">) => `${a.student.user.firstName} ${a.student.user.lastName}`.trim();
