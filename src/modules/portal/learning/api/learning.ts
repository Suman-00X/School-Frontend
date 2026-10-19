import { api } from "@/common/api";
import type { TimetableDay, TimetablePeriod } from "../../shared/components/WeekTimetable";
import { studentPath } from "../../shared/api/students";

/* ---- PO-02 timetable ---- */

export type StudentTimetable = {
  section: { id: string; name: string };
  academicYearId: string;
  periods: TimetablePeriod[];
  days: TimetableDay[];
};
export const timetablePath = (studentId: string) => `${studentPath(studentId)}/timetable`;

/* ---- PO-03 attendance ---- */

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "EXCUSED";
export type Tally = { held: number; attended: number; excused: number; percentage: number | null };

export type AttendanceDay = {
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  attended: number;
  periods?: Tally;
  breakdown: {
    kind: string;
    periodNumber: number;
    label: string;
    subject: { id: string; subjectName: string } | null;
    status: AttendanceStatus | null;
    remarks: string | null;
  }[];
};

export type StudentAttendance = {
  studentId: string;
  academicYearId: string;
  from: string;
  to: string;
  mode: string | null;
  periodPresenceThreshold: number;
  workingDays: number;
  marked: number;
  unmarked: number;
  counts: Record<AttendanceStatus, number>;
  attendedDays: number;
  countableDays: number;
  dayPercentage: number | null;
  periods: Tally | null;
  subjects: ({ subjectId: string; name: string | null; daysAttended: number } & Tally)[] | null;
  basis: "DAYS" | "PERIODS";
  percentage: number | null;
  days: AttendanceDay[];
};
export const attendancePath = (studentId: string) => `${studentPath(studentId)}/attendance`;

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"];
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  HALF_DAY: "Half day",
  EXCUSED: "Excused"
};
export const ATTENDANCE_TONES = { PRESENT: "success", ABSENT: "danger", LATE: "warning", HALF_DAY: "info", EXCUSED: "neutral" } as const;

/* ---- PO-05 report cards ---- */

export type ReportLine = {
  subject: { id: string; subjectName: string; subjectCode?: string };
  category?: string;
  maxMarks?: number | null;
  passMarks?: number | null;
  marksObtained?: number | null;
  marksAwarded?: number | null;
  graceMarks?: number | null;
  percentage?: number | null;
  grade: string | null;
  gradePoint: number | null;
  remark: string | null;
  teacherRemarks?: string | null;
  status: string;
  passed: boolean | null;
  components?: { paperId: string; displayCode: string; component: string; maxMarks: number; status: string; marksObtained: number | null; graceMarks?: number }[];
  /* Assessment schemes: each exam's percentage */
  exams?: { examId: string; percentage: number | null }[];
};

export type ReportCard = {
  kind: "EXAM" | "SCHEME";
  exam?: { id: string; examName: string; examType: string; startDate: string; endDate: string };
  scheme?: { id: string; name: string; exams?: { examId: string; examName: string; weight: number }[] };
  policy: { id: string; name: string; gradingMode: string } | null;
  display: { marks: boolean; percentage: boolean; grades: boolean; gradePoints: boolean; rank: boolean; rankToStudents: boolean; sectionRank: boolean; classRank: boolean };
  subjects: ReportLine[];
  coScholastic: ReportLine[];
  totalObtained: number | null;
  totalMax: number | null;
  graceTotal: number | null;
  percentage: number | null;
  grade: string | null;
  gpa: number | null;
  cgpa?: number | null;
  result: "PASS" | "FAIL" | "COMPARTMENT" | "INCOMPLETE" | string;
  failedSubjects: { subjectName: string }[];
  compartmentSubjects: { subjectName: string }[];
  rank: number | null;
  classRank: number | null;
  sectionSize: number | null;
  classSize: number | null;
  sectionAverage: number | null;
  snapshotId: string;
  version: number;
  publishedAt: string;
};

export type ReportCards = {
  student: { id: string; rollNumber: string | null; section: { id: string; name: string } };
  academicYearId: string;
  reports: ReportCard[];
};
export const reportCardsPath = (studentId: string) => `${studentPath(studentId)}/report-cards`;

export const reportName = (r: ReportCard) => (r.kind === "SCHEME" ? (r.scheme?.name ?? "Annual result") : (r.exam?.examName ?? "Exam"));

export const RESULT_TONES: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  PASS: "success",
  FAIL: "danger",
  COMPARTMENT: "warning",
  INCOMPLETE: "neutral"
};
export const RESULT_LABELS: Record<string, string> = { PASS: "Pass", FAIL: "Fail", COMPARTMENT: "Compartment", INCOMPLETE: "Marks pending" };

/* The PDF of one published report (fetched with the token) */
export const downloadReportCard = (studentId: string, r: ReportCard) =>
  api.download(`${reportCardsPath(studentId)}/pdf`, r.kind === "SCHEME" ? { schemeId: r.scheme?.id } : { examId: r.exam?.id }, "report-card.pdf");

/* ---- PO-09 calendar ---- */

export type EventType = "HOLIDAY" | "VACATION" | "EXAM" | "EVENT" | "MEETING" | "OTHER";
export type CalendarEvent = {
  id: string;
  title: string;
  eventType: EventType;
  startDate: string;
  endDate: string | null;
  isHoliday: boolean;
  description: string | null;
};
export const CALENDAR_PATH = "/me/calendar";
export const EVENT_TYPES: EventType[] = ["HOLIDAY", "VACATION", "EXAM", "EVENT", "MEETING", "OTHER"];
export const EVENT_LABELS: Record<EventType, string> = {
  HOLIDAY: "Holiday",
  VACATION: "Vacation",
  EXAM: "Exam",
  EVENT: "Event",
  MEETING: "Meeting",
  OTHER: "Other"
};
export const EVENT_TONES = { HOLIDAY: "danger", VACATION: "warning", EXAM: "primary", EVENT: "success", MEETING: "info", OTHER: "neutral" } as const;

/* ---- PO-10 teaching ---- */

export type TeachingSection = { sectionId: string; section: string; isClassTeacher: boolean; isDeputyClassTeacher: boolean; subjectIds: string[] };
export type TeacherTimetable = { teacherId: string; academicYearId: string; weeklyLessons: number; periods: TimetablePeriod[]; days: TimetableDay[] };
export const TEACHING_SECTIONS_PATH = "/me/teaching/sections";
export const TEACHING_TIMETABLE_PATH = "/me/teaching/timetable";
export type Subject = { id: string; subjectName: string; subjectCode: string };
