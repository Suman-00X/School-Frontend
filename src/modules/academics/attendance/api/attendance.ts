import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { GridChoice } from "@/common/ui";

/* The school's attendance mode (D-66, D-71): the same for every class, changing from a date on */
export type AttendanceMode = "DAILY" | "TWO_SESSIONS" | "PERIOD_WISE";
/* What one register covers */
export type RegisterKind = "DAY" | "FORENOON" | "AFTERNOON" | "PERIOD";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "EXCUSED";

export const MODE_TEXT: Record<AttendanceMode, string> = {
  DAILY: "once a day",
  TWO_SESSIONS: "twice a day (forenoon and afternoon)",
  PERIOD_WISE: "period by period"
};

export const STATUS_CHOICES: GridChoice[] = [
  { value: "PRESENT", label: "Present", short: "P", key: "p", tone: "success" },
  { value: "ABSENT", label: "Absent", short: "A", key: "a", tone: "danger" },
  { value: "LATE", label: "Late", short: "L", key: "l", tone: "warning" },
  { value: "HALF_DAY", label: "Half day", short: "H", key: "h", tone: "info" },
  { value: "EXCUSED", label: "Excused", short: "E", key: "e", tone: "neutral" }
];
export const STATUS_LABELS = Object.fromEntries(STATUS_CHOICES.map(c => [c.value, c.label])) as Record<AttendanceStatus, string>;

/* GET /academics/attendance/policy */
export type AttendancePolicy = {
  editWindowDays: number;
  overrideRoles: string[];
  periodPresenceThreshold: number;
  mode: AttendanceMode;
  scheduled: { mode: AttendanceMode; effectiveFrom: string }[];
};

export type FreeMark = { id: string; reason: string; markedBy: string; markedAt: string };
export type LockOverride = { reason: string; by: string; at: string };

/* One register of a section's day ("DAY", "FN", "AN", "P1" …) */
export type RegisterInfo = {
  key: string;
  kind: RegisterKind;
  periodNumber: number;
  label: string;
  subject: { id: string; subjectName: string } | null;
  teacher: { id: string; name: string } | null;
  taken: boolean;
  takenAt: string | null;
  /* An account id */
  takenBy: string | null;
  substitute: boolean;
  free: FreeMark | null;
  lockOverride: LockOverride | null;
};

type StudentBase = { studentId: string; rollNumber: string | null; firstName?: string; lastName?: string };

/* GET /academics/attendance/register: one register (with kind, or in DAILY mode) or the whole day */
export type RegisterDay = {
  section: { id: string; sectionName: string; className: string };
  date: string;
  mode: AttendanceMode;
  /* null: the whole day */
  kind: RegisterKind | null;
  periodNumber: number | null;
  taken: boolean;
  takenAt: string | null;
  takenBy: string | null;
  substitute: boolean;
  free: FreeMark | null;
  locked: boolean;
  editableUntil: string;
  lockOverride: LockOverride | null;
  registers: RegisterInfo[];
  /* One register: status and remarks; whole day: marks per register key and the day status */
  students: (StudentBase & { status: AttendanceStatus | null; remarks?: string | null; marks?: Record<string, AttendanceStatus | null> })[];
};

export type RecordInput = {
  sectionId: string;
  date: string;
  kind: RegisterKind;
  periodNumber?: number;
  subjectId?: string;
  remarks?: string;
  overrideReason?: string;
  records: { studentId: string; status: AttendanceStatus; remarks?: string }[];
};

export type RecordResult = {
  created: boolean;
  overridden: boolean;
  session: { id: string; label: string; kind: RegisterKind; periodNumber: number; substitute: boolean };
  summary: { rosterSize: number; marked: number; unmarked: number; counts: Record<AttendanceStatus, number> };
};

type Tally = { held: number; attended: number; excused: number; percentage: number | null };
export type SubjectTally = Tally & { subjectId: string; name: string | null; daysAttended: number };

export type Totals = {
  workingDays: number;
  marked: number;
  unmarked: number;
  counts: Record<AttendanceStatus, number>;
  attendedDays: number;
  countableDays: number;
  dayPercentage: number | null;
  periods: Tally | null;
  subjects: SubjectTally[] | null;
  basis: "DAYS" | "PERIODS";
  percentage: number | null;
};

/* GET /academics/attendance/summary */
export type SectionSummary = {
  section: { id: string; sectionName: string; className: string };
  from: string;
  to: string;
  workingDays: number;
  modes: { mode: AttendanceMode; from: string; to: string }[];
  basis: "DAYS" | "PERIODS";
  periodPresenceThreshold: number;
  averagePercentage: number | null;
  students: (StudentBase & Totals)[];
};

/* GET /academics/attendance/students/:studentId */
export type StudentAttendance = Totals & {
  studentId: string;
  from: string;
  to: string;
  mode: AttendanceMode | null;
  periodPresenceThreshold: number;
  days: {
    date: string;
    status: AttendanceStatus;
    remarks: string | null;
    attended: number;
    periods?: Tally;
    breakdown: { kind: RegisterKind; periodNumber: number; label: string; subject: { id: string; subjectName: string } | null; status: AttendanceStatus | null; remarks: string | null }[];
  }[];
};

/* GET /academics/attendance/cover and /cover/:sectionId */
export type CoverSections = { date: string; mode: AttendanceMode; workingDay: boolean; sections: { id: string; label: string; className: string }[] };
export type CoverPeriod = {
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  timetabled: { subject: { id: string; subjectName: string }; teacher: { id: string; name: string | null } | null } | null;
  taken: boolean;
  takenBy: string | null;
  substitute: boolean;
  subjectTaught: { id: string; subjectName: string } | null;
  free: FreeMark | null;
};
export type CoverSection = { date: string; section: { id: string; label: string }; periods: CoverPeriod[]; subjects: { id: string; subjectName: string }[] };

/* GET /academics/attendance/free-periods */
export type FreePeriod = {
  id: string;
  section: { id: string; label: string };
  date: string;
  periodNumber: number;
  label: string;
  reason: string;
  markedBy: string;
  markedAt: string;
  lockOverride: LockOverride | null;
};

/* GET /academics/attendance/missing-registers */
export type MissingRegister = {
  date: string;
  section: { id: string; name: string };
  mode: AttendanceMode;
  kind: RegisterKind;
  periodNumber: number;
  label: string;
  subject: { id: string; subjectName: string } | null;
  responsible: { teacherId: string; userId: string; name: string } | null;
  responsibleAs: "CLASS_TEACHER" | "TIMETABLED_TEACHER" | "SUBJECT_TEACHER" | null;
  reason: string;
  free?: FreeMark;
};
export type MissingRegisters = {
  academicYearId: string;
  from: string;
  to: string;
  total: number;
  byTeacher: { teacherId: string; name: string; missing: number }[];
  unassigned: number;
  registers: MissingRegister[];
  freePeriods: MissingRegister[];
};

/* GET /academics/calendar/working-days */
export type WorkingDays = { from: string; to: string; workingDays: string[]; closedDays: { date: string; reason: string; title?: string }[] };

export const ATTENDANCE_PATH = "/academics/attendance";
export const REGISTER_PATH = "/academics/attendance/register";
export const POLICY_PATH = "/academics/attendance/policy";
export const FREE_PERIODS_PATH = "/academics/attendance/free-periods";
export const ATTENDANCE_INVALIDATE = ["/academics/attendance"];

export const recordAttendance = (body: RecordInput) => api.post<RecordResult>(ATTENDANCE_PATH, body);
export const markFree = (body: { sectionId: string; date: string; periodNumber: number; reason: string; overrideReason?: string }) =>
  api.post<FreePeriod>(FREE_PERIODS_PATH, body);
export const removeFree = ({ id, overrideReason }: { id: string; overrideReason?: string }) =>
  api.delete<FreePeriod>(`${FREE_PERIODS_PATH}/${id}`, { query: { overrideReason } });

/* "DAY", "FN", "AN", "P3" */
export const registerKey = (kind: RegisterKind, periodNumber = 0) =>
  kind === "PERIOD" ? `P${periodNumber}` : ({ DAY: "DAY", FORENOON: "FN", AFTERNOON: "AN" } as const)[kind];

export const parseRegisterKey = (key: string): { kind: RegisterKind; periodNumber: number } | null => {
  if (key === "DAY") return { kind: "DAY", periodNumber: 0 };
  if (key === "FN") return { kind: "FORENOON", periodNumber: 0 };
  if (key === "AN") return { kind: "AFTERNOON", periodNumber: 0 };
  const m = /^P(\d{1,2})$/.exec(key);
  return m ? { kind: "PERIOD", periodNumber: Number(m[1]) } : null;
};

/* YYYY-MM-DD arithmetic in the school's calendar (no time zone shifts) */
export const addDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const weekdayName = (date: string) => new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" });

/* The policy: everyone who reads attendance may read it */
export function useAttendancePolicy() {
  const { can } = useAuth();
  return useQuery({
    queryKey: [POLICY_PATH],
    enabled: can("academics.attendance.read"),
    staleTime: 60_000,
    queryFn: async () => (await api.get<AttendancePolicy>(POLICY_PATH)).data
  });
}

/* Locks follow the policy: a register can be changed until editWindowDays after its date,
   then only by the policy's override roles, with a reason */
export function useLockRules() {
  const { me } = useAuth();
  const policy = useAttendancePolicy();
  const role = me?.role ?? "";
  return {
    policy: policy.data,
    canOverride: !!policy.data?.overrideRoles.includes(role),
    editableUntil: (date: string) => (policy.data ? addDays(date, policy.data.editWindowDays) : null),
    isLocked: (date: string, today: string) => (policy.data ? addDays(date, policy.data.editWindowDays) < today : false)
  };
}

/* Working days around a date, to step over closed days and say why a day is closed */
export function useWorkingDays(from: string, to: string, enabled = true) {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["/academics/calendar/working-days", { from, to }],
    enabled: enabled && can("academics.calendar.read") && !!from && !!to,
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.get<WorkingDays>("/academics/calendar/working-days", { from, to })).data
  });
}

export const CLOSURE_TEXT: Record<string, string> = {
  WEEKLY_OFF: "a weekly off day",
  HOLIDAY: "a holiday",
  VACATION: "a vacation day",
  OUTSIDE_ACADEMIC_YEAR: "outside the academic year"
};
