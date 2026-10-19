import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Briefcase, FileUp, GraduationCap, Layers, UserCog, UserPlus, UserRound } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Card } from "@/common/ui";
import "./home.css";

type QuickLink = { label: string; to: string; icon: LucideIcon; permission?: string };

const LINKS: QuickLink[] = [
  { label: "Admit a student", to: "/users/students/new", icon: UserPlus, permission: "users.students.admit" },
  { label: "Import students", to: "/administration/imports", icon: FileUp, permission: "administration.imports.create" },
  { label: "Students", to: "/users/students", icon: GraduationCap, permission: "users.students.read" },
  { label: "Teachers", to: "/users/teachers", icon: Briefcase, permission: "users.teachers.read" },
  { label: "Staff", to: "/users/staff", icon: UserCog, permission: "users.staff.read" },
  { label: "Classes & sections", to: "/academics/classes", icon: Layers, permission: "academics.classes.read" },
  { label: "My account", to: "/me/account", icon: UserRound }
];

export function QuickLinks() {
  const { can } = useAuth();
  const links = LINKS.filter(l => !l.permission || can(l.permission));
  return (
    <Card title="Quick links">
      <nav className="quick-links" aria-label="Quick links">
        {links.map(l => (
          <Link key={l.to} to={l.to} className="quick-link">
            <l.icon />
            {l.label}
          </Link>
        ))}
      </nav>
    </Card>
  );
}
