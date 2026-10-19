/* AC-02 section drawer tabs: compact read views of a section's subjects (AC-03), teachers (AC-04),
   students (AC-12 roster) and week (AC-07). Editing stays on those pages; the drawer footer links
   to them. Each tab loads its data when it is opened. */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, Clock, UserRound, Users } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList } from "@/common/hooks";
import { Badge, DataTable, DescriptionList, EmptyState, PersonCell, SkeletonBlock, ErrorState } from "@/common/ui";
import { useSectionSubjects, type SectionSubject } from "../../section-subjects/api/sectionSubjects";
import { TEACHER_ASSIGNMENTS_PATH, teacherName, type TeacherAssignment } from "../../teacher-assignments/api/teacherAssignments";
import { admissionLabel, studentLabel, useRoster, type Enrollment } from "../../enrollments/api/enrollments";
import { sectionGridPath, type SectionTimetable } from "../../timetable/api/timetable";
import { TimetableGrid } from "../../timetable/components/TimetableGrid";
import { useTeacherOptions, type Section } from "../api/sections";
import "./sectionTabs.css";

const dash = <span className="muted">—</span>;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* Where the full pages open on this section */
export const sectionLinks = (sectionId: string) => ({
  subjects: `/academics/subjects?tab=sections&section=${sectionId}`,
  teachers: `/academics/teacher-assignments?section=${sectionId}`,
  roster: `/academics/enrollments?section=${sectionId}`,
  timetable: `/academics/timetable?tab=section&sectionId=${sectionId}`
});

/* A one-line summary above each table. Fixed height, so the number arriving moves nothing. */
function Summary({ children }: { children?: ReactNode }) {
  return <div className="small muted section-tab-summary">{children}</div>;
}

export function SectionSubjectsTab({ section }: { section: Section }) {
  const list = useSectionSubjects(section.id);
  const rows = list.rows;
  const weekly = (rows ?? []).reduce((n, r) => n + (r.weeklyNoOfClasses ?? 0), 0);
  return (
    <div className="stack-sm">
      <Summary>{rows && (rows.length ? `${plural(rows.length, "subject")} · ${plural(weekly, "class", "classes")} a week` : "")}</Summary>
      <div className="card card-flush">
        <DataTable<SectionSubject>
          rows={rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          empty={
            <EmptyState icon={<BookOpen />} title="No subjects yet" message="Add the subjects this section is taught on the Subjects page, under By section." />
          }
          columns={[
            {
              key: "subject",
              header: "Subject",
              render: r => (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 550 }}>{r.subject.subjectName}</div>
                  {r.description && <div className="small muted">{r.description}</div>}
                </div>
              )
            },
            {
              key: "code",
              header: "Code",
              render: r => <span className="mono small">{r.displayCode}</span>
            },
            {
              key: "weekly",
              header: "A week",
              align: "right",
              width: 90,
              render: r => r.weeklyNoOfClasses ?? dash
            }
          ]}
        />
      </div>
    </div>
  );
}

export function SectionTeachersTab({ section }: { section: Section }) {
  const teachers = useTeacherOptions();
  const subjects = useSectionSubjects(section.id);
  const assignments = useApiList<TeacherAssignment>(TEACHER_ASSIGNMENTS_PATH, {
    sectionId: section.id,
    limit: 100
  });

  /* Teachers can't list teachers: name the class teacher from an assignment when there is one */
  const nameOf = (ref: Section["classTeacher"]) => {
    if (!ref) return null;
    const a = assignments.rows?.find(x => x.teacherId === ref.id);
    return a ? teacherName(a.teacher) : teachers.label(ref);
  };

  type Row = { subject: SectionSubject; assignment?: TeacherAssignment };
  const rows: Row[] | undefined =
    subjects.rows && assignments.rows
      ? subjects.rows.map(s => ({
          subject: s,
          assignment: assignments.rows!.find(a => a.subjectId === s.subjectId)
        }))
      : undefined;
  const unassigned = rows?.filter(r => !r.assignment).length ?? 0;

  return (
    <div className="stack-sm">
      <DescriptionList
        items={[
          { label: "Class teacher", value: nameOf(section.classTeacher) },
          {
            label: "Deputy class teacher",
            value: nameOf(section.deputyClassTeacher)
          }
        ]}
      />
      <Summary>
        {rows && rows.length > 0 && (unassigned ? `${unassigned} of ${plural(rows.length, "subject")} have no teacher` : "Every subject has a teacher")}
      </Summary>
      <div className="card card-flush">
        <DataTable<Row>
          rows={rows}
          rowKey={r => r.subject.id}
          loading={subjects.isLoading || assignments.isLoading}
          error={subjects.error ?? assignments.error}
          onRetry={() => {
            void subjects.refetch();
            void assignments.refetch();
          }}
          empty={<EmptyState icon={<UserRound />} title="No subjects yet" message="Add this section's subjects first, then assign who teaches each one." />}
          columns={[
            {
              key: "subject",
              header: "Subject",
              render: r => <span style={{ fontWeight: 550 }}>{r.subject.subject.subjectName}</span>
            },
            {
              key: "teacher",
              header: "Teacher",
              render: r =>
                r.assignment ? (
                  <PersonCell name={teacherName(r.assignment.teacher)} sub={r.assignment.teacher.employeeCode} />
                ) : (
                  <Badge tone="warning">Unassigned</Badge>
                )
            }
          ]}
        />
      </div>
    </div>
  );
}

const byRoll = (a: Enrollment, b: Enrollment) =>
  (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, {
    numeric: true
  });

/* Active students by roll number; those who left are counted, and listed on the roster page */
export function SectionStudentsTab({ section }: { section: Section }) {
  const { can } = useAuth();
  const roster = useRoster(section.id);
  const all = roster.data;
  const active = all?.filter(e => e.status === "ACTIVE").sort(byRoll);
  const left = (all?.length ?? 0) - (active?.length ?? 0);
  const canOpen = can("users.students.read");
  const capacity = section.capacity ? ` of ${section.capacity}` : "";

  return (
    <div className="stack-sm">
      <Summary>{active && (all!.length ? `${active.length}${capacity} active${left ? ` · ${left} left` : ""}` : "")}</Summary>
      <div className="card card-flush">
        <DataTable<Enrollment>
          rows={active}
          rowKey={e => e.id}
          loading={roster.isLoading}
          error={roster.error}
          onRetry={() => void roster.refetch()}
          empty={
            <EmptyState
              icon={<Users />}
              title={all?.length ? "No active students" : "No students yet"}
              message={all?.length ? "Everyone enrolled has left this section." : "Admit or enroll students, or promote last year's section into this one."}
            />
          }
          columns={[
            {
              key: "roll",
              header: "Roll",
              width: 100,
              render: e => (e.rollNumber ? <span className="mono">{e.rollNumber}</span> : dash)
            },
            {
              key: "name",
              header: "Name",
              render: e =>
                canOpen ? (
                  <Link to={`/users/students/${e.studentId}`} style={{ fontWeight: 550 }}>
                    {studentLabel(e)}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 550 }}>{studentLabel(e)}</span>
                )
            },
            {
              key: "type",
              header: "Type",
              render: e => <Badge>{admissionLabel(e.admissionType)}</Badge>
            }
          ]}
        />
      </div>
    </div>
  );
}

export function SectionTimetableTab({ section }: { section: Section }) {
  const grid = useApiGet<SectionTimetable>(sectionGridPath(section.id));
  const g = grid.data;
  const lessons = g ? g.days.reduce((n, d) => n + d.slots.length, 0) : 0;
  let body;
  if (grid.isLoading) body = <SkeletonBlock lines={6} />;
  else if (grid.error) body = <ErrorState error={grid.error} onRetry={() => void grid.refetch()} />;
  else if (!g || !g.periods.length)
    body = <EmptyState icon={<Clock />} title="No bell schedule yet" message="Add the periods of the school day on the Timetable page, under Bell schedule." />;
  else if (!lessons) body = <EmptyState icon={<CalendarDays />} title="No lessons yet" message="Place this section's lessons on the Timetable page." />;
  else body = <TimetableGrid grid={g} show="teacher" aria-label={`${g.section.name} timetable`} />;
  return (
    <div className="stack-sm">
      <Summary>{g && lessons > 0 && `${plural(lessons, "lesson")} a week`}</Summary>
      {body}
    </div>
  );
}
