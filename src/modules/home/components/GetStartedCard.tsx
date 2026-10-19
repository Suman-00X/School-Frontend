import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList } from "@/common/hooks";
import { Card } from "@/common/ui";
import "./home.css";

type Status = "done" | "warn" | "todo" | "loading";
type Step = { key: string; title: string; to: string; show: boolean; status: Status; note: ReactNode };

/* How many rows a list has (meta.total), or null while unknown or refused */
function useTotal(path: string, enabled: boolean) {
  const q = useApiList<unknown>(path, { limit: 1 }, { enabled });
  return { total: enabled && !q.error ? (q.meta?.total ?? null) : null, loading: enabled && q.isLoading, error: q.error };
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/* The setup steps before a school can admit students, each shown with its permission.
   Which steps show depends on permissions only, never on the counts, so the card keeps its height. */
export function GetStartedCard() {
  const { can, canAny } = useAuth();
  const { years, current, selected, canSwitch, isLoading: yearsLoading } = useAcademicYear();
  const yearName = selected?.yearName ?? "this year";

  const classes = useTotal("/academics/classes", can("academics.classes.read"));
  const sections = useTotal("/academics/sections", can("academics.sections.read") && !!current);
  const students = useTotal("/users/students", can("users.students.read"));
  const teachers = useTotal("/users/teachers", can("users.teachers.read"));
  const staff = useTotal("/users/staff", can("users.staff.read"));

  const count = (t: { total: number | null; loading: boolean }, one: string, many?: string): Pick<Step, "status" | "note"> | null =>
    t.loading ? { status: "loading", note: null } : t.total === null ? null : t.total > 0 ? { status: "done", note: plural(t.total, one, many) } : null;

  const yearStep = (): Pick<Step, "status" | "note"> => {
    if (!canSwitch) return { status: "todo", note: "Dates and weekly off days" };
    if (yearsLoading) return { status: "loading", note: null };
    if (years.length === 0) return { status: "warn", note: "No academic year yet. Create one first." };
    if (!current) return { status: "warn", note: "No year is marked current." };
    return { status: "done", note: `Current year: ${current.yearName}` };
  };

  const classStep = (): Pick<Step, "status" | "note"> => {
    if (classes.loading || sections.loading) return { status: "loading", note: null };
    if (classes.total === 0) return { status: "warn", note: "No classes yet." };
    if (classes.total === null) return { status: "todo", note: "Grade levels and their sections" };
    if (sections.total === 0) return { status: "warn", note: `${plural(classes.total, "class", "classes")}, but no sections in ${yearName}.` };
    if (sections.total === null) return { status: "done", note: plural(classes.total, "class", "classes") };
    return { status: "done", note: `${plural(classes.total, "class", "classes")}, ${plural(sections.total, "section")} in ${yearName}` };
  };

  const notReadyToAdmit = years.length === 0 || !current || classes.total === 0 || sections.total === 0;

  const all: Step[] = [
    {
      key: "settings",
      title: "School settings",
      to: "/administration/settings",
      show: can("administration.settings.update"),
      status: "todo",
      note: "Name, logo, contact details and time zone"
    },
    { key: "years", title: "Academic years", to: "/academics/academic-years", show: can("academics.academicYears.create"), ...yearStep() },
    {
      key: "classes",
      title: "Classes & sections",
      to: "/academics/classes",
      show: canAny("academics.classes.create", "academics.sections.create"),
      ...classStep()
    },
    {
      key: "teachers",
      title: "Teachers",
      to: "/users/teachers",
      show: can("users.teachers.create"),
      ...(count(teachers, "teacher") ?? { status: "todo", note: "Add teachers so they can be class teachers" })
    },
    {
      key: "staff",
      title: "Staff",
      to: "/users/staff",
      show: can("users.staff.create"),
      ...(count(staff, "staff member", "staff members") ?? { status: "todo", note: "Office and support staff" })
    },
    {
      key: "admit",
      title: "Admit a student",
      to: "/users/students/new",
      show: can("users.students.admit"),
      ...(count(students, "student") ??
        (notReadyToAdmit
          ? { status: "todo", note: "Needs a current academic year, a class and a section first" }
          : { status: "todo", note: "Admit one student, or import a list" }))
    }
  ];
  const steps = all.filter(s => s.show);

  if (steps.length === 0) return null;
  const done = steps.filter(s => s.status === "done").length;

  return (
    <Card title="Get started" subtitle={`${done} of ${steps.length} done`}>
      <ul className="setup-list">
        {steps.map(s => (
          <li key={s.key} className={`setup-item ${s.status}`}>
            {s.status === "done" ? <CheckCircle2 /> : s.status === "warn" ? <AlertTriangle /> : <Circle />}
            <div className="setup-text">
              <Link to={s.to} className="setup-title">
                {s.title}
              </Link>
              {/* One line in every state (the count arriving never makes the card taller) */}
              <div className="small muted setup-note" title={typeof s.note === "string" ? s.note : undefined}>
                {s.status === "loading" ? <span className="skeleton home-bar" style={{ width: "40%" }} /> : s.note}
              </div>
            </div>
            <Link to={s.to} className="btn btn-ghost btn-sm btn-icon" aria-label={`Open ${s.title}`}>
              <ChevronRight />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
