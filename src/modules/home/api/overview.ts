/* GET /reports/dashboards/overview (reports.dashboards.overview) */
export type Overview = {
  academicYear: { id: string; yearName: string };
  /* the school's today (its time zone) */
  today: string;
  currency: string;
  headcounts: {
    students: number;
    teachers: number;
    staff: number;
    sections: number;
    classes: number;
    admissionsLast30Days: number;
  };
  attendanceToday: {
    date: string;
    sectionsTaken: number;
    sectionsTotal: number;
    absent: number;
    partlyAbsent: number;
    presentPercentage: number | null;
  };
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

export const OVERVIEW_PATH = "/reports/dashboards/overview";
