import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarRange,
  ClipboardList,
  FileUp,
  GraduationCap,
  Home,
  KeyRound,
  Layers,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  Briefcase
} from "lucide-react";

/* The sidebar. An item shows when the person holds any of its permissions;
   an empty group is hidden. Other modules add their groups here as they are built. */

export type NavItem = { label: string; to: string; icon: LucideIcon; permissions?: string[]; end?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

export const NAVIGATION: NavGroup[] = [
  { items: [{ label: "Home", to: "/", icon: Home, end: true }] },
  {
    label: "People",
    items: [
      { label: "Students", to: "/users/students", icon: GraduationCap, permissions: ["users.students.read"] },
      { label: "Parents", to: "/users/parents", icon: UsersRound, permissions: ["users.parents.read"] },
      { label: "Teachers", to: "/users/teachers", icon: Briefcase, permissions: ["users.teachers.read"] },
      { label: "Staff", to: "/users/staff", icon: UserCog, permissions: ["users.staff.read"] },
      { label: "User accounts", to: "/users", icon: Users, permissions: ["users.accounts.read"], end: true }
    ]
  },
  {
    label: "Academics setup",
    items: [
      { label: "Academic years", to: "/academics/academic-years", icon: CalendarRange, permissions: ["academics.academicYears.read"] },
      { label: "Classes & sections", to: "/academics/classes", icon: Layers, permissions: ["academics.classes.read"] }
    ]
  },
  {
    label: "Administration",
    items: [
      { label: "School settings", to: "/administration/settings", icon: Settings, permissions: ["administration.settings.read"] },
      { label: "Imports", to: "/administration/imports", icon: FileUp, permissions: ["administration.imports.read"] },
      { label: "Operator roles", to: "/administration/access/operator-roles", icon: KeyRound, permissions: ["administration.access.read"] },
      { label: "Access assignments", to: "/administration/access/assignments", icon: ShieldCheck, permissions: ["administration.access.read"] },
      { label: "Audit log", to: "/administration/audit-logs", icon: ScrollText, permissions: ["administration.auditLogs.read"] }
    ]
  }
];

export const BRAND_ICON = Building2;
export const PLACEHOLDER_ICON = ClipboardList;
