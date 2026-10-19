import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, FileUp, GraduationCap, House, KeyRound, School, ShieldCheck, UserPlus, Users } from "lucide-react";

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
};

export type NavModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  tabs: NavTab[];
};

export const MODULES: NavModule[] = [
  { id: "home", label: "Home", icon: House, tabs: [{ label: "Dashboard", to: "/", end: true, match: ["/me"] }] },
  {
    id: "people",
    label: "People",
    icon: Users,
    tabs: [
      { label: "Students", to: "/users/students", permissions: ["users.students.read"] },
      { label: "Parents", to: "/users/parents", permissions: ["users.parents.read"] },
      { label: "Teachers", to: "/users/teachers", permissions: ["users.teachers.read"] },
      { label: "Staff", to: "/users/staff", permissions: ["users.staff.read"] },
      { label: "Accounts", to: "/users", permissions: ["users.accounts.read"] },
      { label: "Activity", to: "/users/activity", permissions: ["users.activity.read"] }
    ]
  },
  {
    id: "academics",
    label: "Academics",
    icon: GraduationCap,
    tabs: [
      { label: "Academic years", to: "/academics/academic-years", permissions: ["academics.academicYears.read"] },
      { label: "Classes & sections", to: "/academics/classes", permissions: ["academics.classes.read"] }
    ]
  },
  {
    id: "administration",
    label: "Admin",
    icon: ShieldCheck,
    tabs: [
      { label: "School settings", to: "/administration/settings", permissions: ["administration.settings.read"] },
      { label: "Imports", to: "/administration/imports", permissions: ["administration.imports.read"] },
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
  { label: "New operator role", to: "/administration/access/operator-roles/new", icon: KeyRound, permissions: ["administration.access.manage"] }
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
