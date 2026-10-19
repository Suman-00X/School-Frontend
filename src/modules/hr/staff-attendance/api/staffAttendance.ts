import { api } from "@/common/api";
import type { AttendanceStatus } from "../../shared/utils/format";

export const STAFF_ATTENDANCE_PATH = "/hr/staff-attendance";

export type StatusCounts = Record<AttendanceStatus, number>;

export type RegisterRow = {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  employeeCode: string | null;
  designation: string | null;
  department: string | null;
  status: AttendanceStatus | null;
  /* "09:15:00" */
  checkIn: string | null;
  checkOut: string | null;
  remarks: string | null;
  /* Set when an approved leave wrote the mark */
  leaveRequestId: string | null;
};

export type Register = {
  date: string;
  closure: "WEEKLY_OFF" | "HOLIDAY" | "VACATION" | null;
  summary: { employees: number; marked: number; unmarked: number; counts: StatusCounts };
  employees: RegisterRow[];
};

export type MarkInput = { userId: string; status: AttendanceStatus; checkIn?: string; checkOut?: string; remarks?: string };

export type RecordResult = { date: string; created: number; updated: number; counts: StatusCounts };

export type SummaryRow = Omit<RegisterRow, "status" | "checkIn" | "checkOut" | "remarks" | "leaveRequestId"> & {
  counts: StatusCounts;
  marked: number;
  /* PRESENT + ON_DUTY + half of HALF_DAY */
  daysPresent: number;
};

export type Summary = { from: string; to: string; workingDays: number; employees: SummaryRow[] };

export const recordAttendance = (body: { date: string; records: MarkInput[] }) => api.post<RecordResult>(STAFF_ATTENDANCE_PATH, body);
