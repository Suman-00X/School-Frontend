import { api } from "@/common/api";

/* The school's attendance rules (one per school): how registers are taken, how long they stay
   editable, and who may change a locked one. The mode changes over time, from a date on. */
export type AttendanceMode = "DAILY" | "TWO_SESSIONS" | "PERIOD_WISE";
export type OverrideRole = "ADMIN" | "PRINCIPAL";

export type AttendancePolicy = {
  id: string;
  /* Registers lock this many days after their date (0: the same day) */
  editWindowDays: number;
  overrideRoles: OverrideRole[];
  /* Period-wise: % of a day's periods to attend for the day to count as present */
  periodPresenceThreshold: number;
  /* Low attendance (D-85): teachers and parents are alerted when a student's attendance for
     the year falls under this %, once they have at least `lowAttendanceMinDays` countable days */
  lowAttendanceThreshold: number;
  lowAttendanceMinDays: number;
  /* In force today */
  mode: AttendanceMode;
  /* Changes still to come, in date order */
  scheduled: { mode: AttendanceMode; effectiveFrom: string }[];
  updatedAt: string;
  /* After a PATCH that scheduled (or cancelled) a mode */
  change?: { mode: AttendanceMode; effectiveFrom: string } | null;
};

export type AttendancePolicyChanges = Partial<Pick<AttendancePolicy, "editWindowDays" | "overrideRoles" | "periodPresenceThreshold" | "lowAttendanceThreshold" | "lowAttendanceMinDays">> & {
  mode?: AttendanceMode;
  /* With mode only; tomorrow at the earliest (the default) */
  modeEffectiveFrom?: string;
};

export const ATTENDANCE_POLICY_PATH = "/academics/attendance/policy";

export const updateAttendancePolicy = (body: AttendancePolicyChanges) => api.patch<AttendancePolicy>(ATTENDANCE_POLICY_PATH, body);

export const MODES: { value: AttendanceMode; label: string; description: string; sentence: string }[] = [
  { value: "DAILY", label: "Once a day", description: "One register a day", sentence: "takes attendance once a day" },
  { value: "TWO_SESSIONS", label: "Forenoon and afternoon", description: "Two registers a day; each is half a day", sentence: "takes attendance in the forenoon and the afternoon" },
  { value: "PERIOD_WISE", label: "Every period", description: "One register per timetabled period", sentence: "takes attendance by period" }
];

export const modeLabel = (m: AttendanceMode) => MODES.find(x => x.value === m)?.label ?? m;

/* The mode on a day, from today's mode and the scheduled changes */
export const modeOn = (policy: Pick<AttendancePolicy, "mode" | "scheduled">, date: string) => {
  let mode = policy.mode;
  for (const s of [...policy.scheduled].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))) if (s.effectiveFrom <= date) mode = s.mode;
  return mode;
};
