import type { LucideIcon } from "lucide-react";
import {
  Backpack,
  BedDouble,
  BriefcaseBusiness,
  Bus,
  ChartColumn,
  ClipboardList,
  FileUp,
  FolderOpen,
  GraduationCap,
  HandCoins,
  House,
  IdCard,
  KeyRound,
  MessageSquarePlus,
  LibraryBig,
  Megaphone,
  Package,
  PenLine,
  School,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet
} from "lucide-react";

/* Navigation: a module is an icon in the left rail; its submodules are the tabs in the header.
   A tab shows when the person holds any of its permissions; a module shows when any tab does.
   Other modules add an entry here as they are built. */

export type NavTab = {
  label: string;
  to: string;
  permissions?: string[];
  /* Active only on this exact path (for a tab whose path prefixes its siblings', e.g. /users) */
  end?: boolean;
  /* Extra path prefixes that belong to this tab */
  match?: string[];
  /* Where the tab opens: the first of these the person may see (default: `to`) */
  opens?: { to: string; permission: string }[];
};

export const tabTarget = (tab: NavTab, can: (key: string) => boolean) => tab.opens?.find(o => can(o.permission))?.to ?? tab.to;

export type NavModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  tabs: NavTab[];
};

export const MODULES: NavModule[] = [
  { id: "home", label: "Home", icon: House, tabs: [{ label: "Dashboard", to: "/", end: true, match: ["/me"] }] },
  /* Self-service. Students and parents: "Student" is the selected child's pages (side list with
     the child switcher; /me/school opens the remembered child). Teachers: their sections and week.
     Every employee: their attendance, leave and payslips. Everyone: own library and the calendar. */
  {
    id: "portal",
    label: "My school",
    icon: Backpack,
    tabs: [
      { label: "Student", to: "/me/school", permissions: ["portal.learning.students"], match: ["/me/students"] },
      { label: "My sections", to: "/me/teaching/sections", permissions: ["portal.learning.teaching"] },
      { label: "My timetable", to: "/me/teaching/timetable", permissions: ["portal.learning.teaching"] },
      { label: "My attendance", to: "/hr/me/attendance", permissions: ["hr.staffAttendance.readOwn"] },
      { label: "My leave", to: "/hr/me/leave", permissions: ["hr.leaveRequests.readOwn", "hr.leaveBalances.readOwn"] },
      { label: "My payslips", to: "/hr/me/payslips", permissions: ["hr.payslips.readOwn"] },
      { label: "Library", to: "/library/my-loans", permissions: ["library.loans.readOwn", "library.holds.own"] },
      { label: "Calendar", to: "/me/calendar", permissions: ["portal.learning.calendar"] }
    ]
  },
  {
    id: "academics",
    label: "Academics",
    icon: GraduationCap,
    tabs: [
      /* Setup: a side list of the year's setup pages: Curriculum first, then three groups: school structure,
         calendar (periods, timetables, school calendar) and policy (academics/shared/components/SetupLayout).
         The school calendar is in it but doesn't open the tab on its own: families read it in the portal. */
      {
        label: "Setup",
        to: "/academics/curriculum",
        permissions: [
          "academics.academicYears.read",
          "academics.classes.read",
          "academics.subjects.read",
          "academics.classSubjects.read",
          "academics.sectionSubjects.read",
          "academics.teacherAssignments.read",
          "academics.timetable.read",
          "academics.gradeScales.read",
          "academics.resultPolicies.read",
          "academics.assessmentSchemes.read"
        ],
        match: [
          "/academics/classes",
          "/academics/subjects",
          "/academics/periods",
          "/academics/timetable",
          "/academics/calendar",
          "/academics/grading",
          "/academics/attendance/policy"
        ],
        opens: [
          { to: "/academics/academic-years", permission: "academics.academicYears.read" },
          { to: "/academics/classes", permission: "academics.classes.read" },
          { to: "/academics/subjects", permission: "academics.subjects.read" },
          { to: "/academics/timetable", permission: "academics.timetable.read" },
          { to: "/academics/grading", permission: "academics.gradeScales.read" }
        ]
      },
      { label: "Enrollments", to: "/academics/enrollments", permissions: ["academics.enrollments.read"] },
      /* Attendance: a side list (register, cover & substitute, missing registers); the policy is under Setup */
      {
        label: "Attendance",
        to: "/academics/attendance",
        permissions: ["academics.attendance.read", "academics.attendance.readMissingRegisters"],
        opens: [
          { to: "/academics/attendance", permission: "academics.attendance.read" },
          { to: "/academics/attendance/missing-registers", permission: "academics.attendance.readMissingRegisters" }
        ]
      },
      /* Exams & results: a side list (exams, marks entry, report cards); one exam's page drills in */
      {
        label: "Exams & results",
        to: "/academics/exams",
        permissions: ["academics.exams.read", "academics.marks.record", "academics.assessments.read", "academics.reportCards.read", "academics.assessmentSchemes.read"],
        match: ["/academics/marks", "/academics/assessments", "/academics/results"],
        opens: [
          { to: "/academics/exams", permission: "academics.exams.read" },
          { to: "/academics/marks", permission: "academics.marks.record" },
          { to: "/academics/assessments", permission: "academics.assessments.read" },
          { to: "/academics/results", permission: "academics.reportCards.read" },
          { to: "/academics/results", permission: "academics.assessmentSchemes.read" }
        ]
      },
      { label: "Homework", to: "/academics/homework", permissions: ["academics.homework.read"] },
      { label: "Activity", to: "/academics/activity", permissions: ["academics.activity.read"] }
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    /* Order: Collect, Invoices, Payments, Ledger, Setup, Activity */
    tabs: [
      { label: "Collect", to: "/finance/counter", permissions: ["finance.payments.collect"] },
      { label: "Invoices", to: "/finance/invoices", permissions: ["finance.invoices.read"], match: ["/finance/students"] },
      {
        label: "Payments",
        to: "/finance/payments",
        permissions: ["finance.payments.read", "finance.settlements.read"],
        match: ["/finance/refunds", "/finance/settlements"],
        opens: [
          { to: "/finance/payments", permission: "finance.payments.read" },
          { to: "/finance/settlements", permission: "finance.settlements.read" }
        ]
      },
      { label: "Ledger", to: "/finance/ledger", permissions: ["finance.ledger.read"] },
      {
        label: "Setup",
        to: "/finance/fee-heads",
        permissions: [
          "finance.feeHeads.read",
          "finance.feeStructures.read",
          "finance.installmentPlans.read",
          "finance.lateFeeRules.read",
          "finance.concessions.read",
          "finance.settings.read",
          "finance.paymentSettings.read"
        ],
        match: [
          "/finance/fee-structures",
          "/finance/installment-plans",
          "/finance/plan-assignments",
          "/finance/late-fee-rules",
          "/finance/concessions",
          "/finance/concession-grants",
          "/finance/settings"
        ],
        opens: [
          { to: "/finance/fee-heads", permission: "finance.feeHeads.read" },
          { to: "/finance/fee-structures", permission: "finance.feeStructures.read" },
          { to: "/finance/installment-plans", permission: "finance.installmentPlans.read" },
          { to: "/finance/late-fee-rules", permission: "finance.lateFeeRules.read" },
          { to: "/finance/concessions", permission: "finance.concessions.read" },
          { to: "/finance/settings", permission: "finance.settings.read" },
          { to: "/finance/settings", permission: "finance.paymentSettings.read" }
        ]
      },
      { label: "Activity", to: "/finance/activity", permissions: ["finance.activity.read"] }
    ]
  },
  {
    id: "communication",
    label: "Messages",
    icon: Megaphone,
    tabs: [
      { label: "Announcements", to: "/communication/announcements", permissions: ["communication.announcements.read"] },
      { label: "Send message", to: "/communication/messages/new", permissions: ["communication.notifications.send"] },
      { label: "Activity", to: "/communication/activity", permissions: ["communication.activity.read"] }
    ]
  },
  {
    id: "library",
    label: "Library",
    icon: LibraryBig,
    tabs: [
      { label: "Desk", to: "/library/desk", permissions: ["library.loans.circulate"] },
      { label: "Loans & fines", to: "/library/loans", permissions: ["library.loans.read"], match: ["/library/borrowers"] },
      { label: "Holds", to: "/library/holds", permissions: ["library.holds.read"] },
      {
        label: "Catalogue",
        to: "/library/books",
        permissions: ["library.books.read", "library.books.browse"],
        match: ["/library/catalogue"],
        opens: [
          { to: "/library/books", permission: "library.books.read" },
          { to: "/library/catalogue", permission: "library.books.browse" }
        ]
      },
      { label: "Stock checks", to: "/library/stock-checks", permissions: ["library.stockChecks.read"] },
      { label: "Reports", to: "/library/reports", permissions: ["library.reports.read"] },
      {
        /* Policy, circulation rules, closures and the activity log, in a side list */
        label: "Setup",
        to: "/library/policy",
        permissions: ["library.policy.manage", "library.circulationRules.manage", "library.closures.manage", "library.books.read", "library.loans.read"],
        match: ["/library/circulation-rules", "/library/closures", "/library/activity"]
      }
    ]
  },
  {
    id: "transport",
    label: "Transport",
    icon: Bus,
    tabs: [
      { label: "Vehicles", to: "/transport/vehicles", permissions: ["transport.vehicles.read"] },
      { label: "Routes", to: "/transport/routes", permissions: ["transport.routes.read"] },
      { label: "Seat assignments", to: "/transport/assignments", permissions: ["transport.assignments.read"] },
      { label: "Rosters", to: "/transport/rosters", permissions: ["transport.roster.read"] },
      { label: "Activity", to: "/transport/activity", permissions: ["transport.activity.read"] }
    ]
  },
  {
    id: "hostel",
    label: "Hostel",
    icon: BedDouble,
    tabs: [
      { label: "Hostels", to: "/hostel/hostels", permissions: ["hostel.hostels.read"] },
      { label: "Bed allocations", to: "/hostel/allocations", permissions: ["hostel.allocations.read"] },
      { label: "Resources", to: "/hostel/resources", permissions: ["hostel.resources.read"] },
      { label: "Resource assignments", to: "/hostel/resource-assignments", permissions: ["hostel.resourceAssignments.read"] },
      { label: "Activity", to: "/hostel/activity", permissions: ["hostel.activity.read"] }
    ]
  },
  {
    id: "hr",
    label: "HR",
    icon: IdCard,
    tabs: [
      { label: "Attendance", to: "/hr/staff-attendance", permissions: ["hr.staffAttendance.read"] },
      {
        label: "Leave",
        to: "/hr/leave-requests",
        permissions: ["hr.leaveRequests.read", "hr.leaveBalances.read"]
      },
      { label: "Payroll", to: "/hr/payroll-runs", permissions: ["hr.payrollRuns.read"], match: ["/hr/payslips"] },
      {
        label: "Salaries",
        to: "/hr/employee-salaries",
        permissions: ["hr.employeeSalaries.read", "hr.salaryComponents.read"],
        match: ["/hr/salary-components", "/hr/salary"],
        opens: [
          { to: "/hr/employee-salaries", permission: "hr.employeeSalaries.read" },
          { to: "/hr/salary-components", permission: "hr.salaryComponents.read" }
        ]
      },
      { label: "Leave types", to: "/hr/leave-types", permissions: ["hr.leaveTypes.manage"] },
      { label: "Activity", to: "/hr/activity", permissions: ["hr.activity.read"] }
    ]
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    tabs: [
      { label: "Items", to: "/inventory/items", permissions: ["inventory.items.read"] },
      { label: "Stock movements", to: "/inventory/movements", permissions: ["inventory.stock.read"] },
      { label: "Reports", to: "/inventory/reports", permissions: ["inventory.reports.read"] },
      { label: "Vendors", to: "/inventory/vendors", permissions: ["inventory.vendors.read"] },
      { label: "Categories", to: "/inventory/categories", permissions: ["inventory.categories.read"] },
      { label: "Activity", to: "/inventory/activity", permissions: ["inventory.activity.read"] }
    ]
  },
  {
    id: "reports",
    label: "Reports",
    icon: ChartColumn,
    tabs: [
      {
        label: "Dashboards",
        to: "/reports/dashboards",
        permissions: ["reports.dashboards.overview", "reports.dashboards.attendance", "reports.dashboards.fees", "reports.dashboards.academics"],
        opens: [
          { to: "/reports/dashboards/overview", permission: "reports.dashboards.overview" },
          { to: "/reports/dashboards/attendance", permission: "reports.dashboards.attendance" },
          { to: "/reports/dashboards/fees", permission: "reports.dashboards.fees" },
          { to: "/reports/dashboards/academics", permission: "reports.dashboards.academics" }
        ]
      },
      {
        label: "Exports",
        to: "/reports/exports",
        permissions: ["reports.exports.students", "reports.exports.attendance", "reports.exports.fees", "reports.exports.results"]
      }
    ]
  },
  {
    id: "files",
    label: "Files",
    icon: FolderOpen,
    tabs: [
      { label: "Documents", to: "/files", permissions: ["files.documents.read"] },
      { label: "Activity", to: "/files/activity", permissions: ["files.activity.read"] }
    ]
  },
  {
    id: "administration",
    label: "Admin",
    icon: ShieldCheck,
    tabs: [
      {
        label: "User Management",
        to: "/users",
        permissions: [
          "users.accounts.read",
          "users.students.read",
          "users.parents.read",
          "users.teachers.read",
          "users.staff.read",
          "administration.imports.read"
        ],
        match: ["/administration/imports"],
        opens: [
          { to: "/users", permission: "users.accounts.read" },
          { to: "/users/students", permission: "users.students.read" },
          { to: "/users/parents", permission: "users.parents.read" },
          { to: "/users/teachers", permission: "users.teachers.read" },
          { to: "/users/staff", permission: "users.staff.read" },
          { to: "/administration/imports", permission: "administration.imports.read" }
        ]
      },
      { label: "School settings", to: "/administration/settings", permissions: ["administration.settings.read"] },
      { label: "Access control", to: "/administration/access", permissions: ["administration.access.read"] },
      { label: "Audit log", to: "/administration/audit-logs", permissions: ["administration.auditLogs.read"] }
    ]
  }
];

/* "Quick add" in the right panel: the create actions the person may use */
export type QuickAction = { label: string; to: string; icon: LucideIcon; permissions: string[] };

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Admit a student", to: "/users/students/new", icon: UserPlus, permissions: ["users.students.admit"] },
  { label: "New parent", to: "/users/parents/new", icon: Users, permissions: ["users.parents.create"] },
  { label: "New teacher", to: "/users/teachers/new", icon: GraduationCap, permissions: ["users.teachers.create"] },
  { label: "New staff member", to: "/users/staff/new", icon: BriefcaseBusiness, permissions: ["users.staff.create"] },
  { label: "Import students", to: "/administration/imports", icon: FileUp, permissions: ["administration.imports.create"] },
  { label: "New operator role", to: "/administration/access/operator-roles/new", icon: KeyRound, permissions: ["administration.access.manage"] },
  { label: "New announcement", to: "/communication/announcements?new=1", icon: Megaphone, permissions: ["communication.announcements.manage"] },
  { label: "Send a message", to: "/communication/messages/new", icon: MessageSquarePlus, permissions: ["communication.notifications.send"] },
  { label: "Assign a bus seat", to: "/transport/assignments?new=1", icon: Bus, permissions: ["transport.assignments.manage"] },
  { label: "Mark staff attendance", to: "/hr/staff-attendance", icon: IdCard, permissions: ["hr.staffAttendance.record"] },
  { label: "Run payroll", to: "/hr/payroll-runs?run=1", icon: Wallet, permissions: ["hr.payrollRuns.run"] },
  { label: "New fee structure", to: "/finance/fee-structures/new", icon: Wallet, permissions: ["finance.feeStructures.manage"] },
  { label: "Collect a payment", to: "/finance/counter", icon: HandCoins, permissions: ["finance.payments.collect"] },
  { label: "Allocate a bed", to: "/hostel/allocations?view=list&new=1", icon: BedDouble, permissions: ["hostel.allocations.manage"] },
  { label: "Issue a book", to: "/library/desk", icon: LibraryBig, permissions: ["library.loans.circulate"] },
  { label: "New exam", to: "/academics/exams?new=1", icon: ClipboardList, permissions: ["academics.exams.create"] },
  { label: "Enter marks", to: "/academics/marks", icon: PenLine, permissions: ["academics.marks.record"] },
  { label: "Record stock received", to: "/inventory/movements?new=RECEIPT", icon: Package, permissions: ["inventory.stock.move"] },
  { label: "Issue stock", to: "/inventory/movements?new=ISSUE", icon: Package, permissions: ["inventory.stock.move"] }
];

export const BRAND_ICON = School;

/* How well a path matches a tab (length of the matching prefix, -1 for none); the longest wins */
export function tabMatches(tab: NavTab, pathname: string): number {
  let best = -1;
  for (const p of [tab.to, ...(tab.match ?? [])]) {
    const nested = p !== tab.to || !tab.end;
    if (pathname === p || (nested && p !== "/" && pathname.startsWith(p + "/"))) best = Math.max(best, p.length);
  }
  return best;
}

export function activeLocation(pathname: string, visible: NavModule[]) {
  let found: { module: NavModule; tab: NavTab; score: number } | null = null;
  for (const module of visible)
    for (const tab of module.tabs) {
      const score = tabMatches(tab, pathname);
      if (score >= 0 && (!found || score > found.score)) found = { module, tab, score };
    }
  return found;
}
