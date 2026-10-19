/* GET /reports/dashboards/* (current year, or the header's X-Academic-Year-Id) */

export type Overview = {
  academicYear: { id: string; yearName: string };
  today: string;
  currency: string;
  headcounts: { students: number; teachers: number; staff: number; sections: number; classes: number; admissionsLast30Days: number };
  attendanceToday: { date: string; sectionsTaken: number; sectionsTotal: number; absent: number; partlyAbsent: number; presentPercentage: number | null };
  fees: {
    collectedThisMonth: number;
    collectedThisYear: number;
    refundedThisYear: number;
    netCollectedThisYear: number;
    billed: number;
    outstanding: number;
    overdue: number;
    overdueInvoices: number;
    /* null: nothing billed yet */
    collectionRate: number | null;
    concessions: number;
    lateFees: number;
    lateFeesWaived: number;
    creditHeld: number;
  };
  exams: { papersInNext14Days: number };
};

export type AttendanceReport = {
  from: string;
  to: string;
  threshold: number;
  modes: { mode: string; from: string; to: string }[];
  bySection: { sectionId: string; section: string; daysRecorded: number; percentage: number | null; periodPercentage: number | null }[];
  trend: { date: string; absent: number; percentage: number | null }[];
  lowAttendance: { studentId: string; firstName: string; lastName: string; section: string; percentage: number }[];
};

export type FeesReport = {
  from: string;
  to: string;
  collections: {
    /* month "2026-06" */
    byMonth: { month: string; amount: number; payments: number }[];
    byMethod: { method: string; amount: number; payments: number }[];
  };
  byClass: { classId: string; className: string; billed: number; concessions: number; collected: number; outstanding: number }[];
  concessions: { byCategory: { category: string; amount: number; students: number }[] };
  defaulters: {
    studentId: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    section: string;
    overdue: number;
    invoices: number;
    oldestDueDate: string;
  }[];
};

export type AcademicsReport = {
  exam: { id: string; examName: string; resultsPublishedAt: string | null };
  overall: { students: number; passed: number; compartment: number; failed: number; incomplete: number; passPercentage: number | null; averageGpa: number | null };
  bySection: {
    section: { id: string; name: string; classId: string };
    policy: { id: string; name: string; gradingMode: string };
    students: number;
    appeared: number;
    passed: number;
    compartment: number;
    failed: number;
    incomplete: number;
    passPercentage: number | null;
    averagePercentage: number | null;
    highestPercentage: number | null;
    averageGpa: number | null;
  }[];
  bySubject: { subject: { id: string; subjectName: string; subjectCode: string }; averageMarks: number | null }[];
  toppers: { studentId: string; firstName: string; lastName: string; section: string; percentage: number; grade: string | null; gpa: number | null; result: string }[];
};

export const DASHBOARDS_PATH = "/reports/dashboards";

export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview", permission: "reports.dashboards.overview" },
  { id: "attendance", label: "Attendance", permission: "reports.dashboards.attendance" },
  { id: "fees", label: "Fees", permission: "reports.dashboards.fees" },
  { id: "academics", label: "Academics", permission: "reports.dashboards.academics" }
] as const;

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n}%`);

/* "2026-06" -> "Jun 2026" */
export const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

/* "2026-06-01" -> "1 Jun" */
export const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
