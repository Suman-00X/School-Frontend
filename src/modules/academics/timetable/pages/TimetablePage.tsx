/* AC-07 · Timetables (Academics › Setup › Calendar): a section's week (edited cell by cell), a
   teacher's week, and for teachers their own week (GET /me/teaching/timetable). The periods
   lessons are placed in are on the Periods page. */
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Clock } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Card, EmptyState, ErrorState, Page, PageHeader, Select, SkeletonBlock, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { useTeacherOptions } from "../../classes/api/sections";
import { useMyTeaching } from "../../shared/api/teaching";
import { useSectionOptions } from "../../shared/components/SectionSelect";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { MY_TIMETABLE_PATH, sectionGridPath, teacherGridPath, type SectionTimetable, type TeacherTimetable } from "../api/timetable";
import { LessonDialog, type LessonTarget } from "../components/LessonDialog";
import { TimetableGrid } from "../components/TimetableGrid";
import { GenerateTimetableLink } from "../../scheduling";

const lessons = (n: number) => `${n} lesson${n === 1 ? "" : "s"} a week`;

export default function TimetablePage() {
  const { can } = useAuth();
  const teaching = useMyTeaching();
  const tabs: TabItem[] = [
    { id: "mine", label: "My week", hidden: !can("portal.learning.teaching") },
    { id: "section", label: "Section timetable" },
    { id: "teacher", label: "Teacher timetable", hidden: !can("users.teachers.read") }
  ];
  const [tab] = useTabParam(tabs);
  const [, setSearch] = useSearchParams();
  /* Each view keeps its own picker in the URL: switching starts clean */
  const switchTab = (id: string) => setSearch(id === tabs.find(t => !t.hidden)?.id ? {} : { tab: id }, { replace: true });

  const intro = {
    mine: "Your lessons this week in the current academic year. The period running now is outlined.",
    section: teaching.scoped
      ? "A section's week, for the sections you lead as class teacher or deputy."
      : can("academics.timetable.manage")
        ? "Click a cell to place a lesson, or a lesson to change or clear it. Clashes are shown on the cell."
        : "A section's week: subject, teacher and room for each period.",
    teacher: "One teacher's week across their sections."
  }[tab];

  return (
    <Page>
      <PageHeader title="Timetables" subtitle={intro} actions={<GenerateTimetableLink />} />
      <Tabs tabs={tabs} value={tab} onChange={switchTab} />
      {tab === "mine" && <MyWeek />}
      {tab === "section" && <SectionView />}
      {tab === "teacher" && <TeacherView />}
    </Page>
  );
}

function GridCard({
  toolbar,
  subtitle,
  loading,
  error,
  onRetry,
  children
}: {
  toolbar?: ReactNode;
  subtitle?: ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <Card flush>
      {toolbar && (
        <div className="tt-toolbar">
          {toolbar}
          <span className="tt-toolbar-note">{subtitle}</span>
        </div>
      )}
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : loading ? (
        <div style={{ padding: 18 }}>
          <SkeletonBlock lines={6} />
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

/* The teacher's own week (PO-10 shows the same grid) */
function MyWeek() {
  const grid = useApiGet<TeacherTimetable>(MY_TIMETABLE_PATH);
  const g = grid.data;
  return (
    <GridCard toolbar={<strong>My week</strong>} subtitle={g && lessons(g.weeklyLessons)} loading={grid.isLoading} error={grid.error} onRetry={() => void grid.refetch()}>
      {g && (g.weeklyLessons === 0 ? (
        <EmptyState icon={<CalendarDays />} title="No lessons on your timetable" message="Your lessons appear here once the timetable is built." />
      ) : (
        <TimetableGrid grid={g} show="section" highlightNow aria-label="My week" />
      ))}
    </GridCard>
  );
}

function SectionView() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const sectionsList = useSectionOptions();
  const [search, setSearch] = useSearchParams();
  const [target, setTarget] = useState<LessonTarget | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* Teachers see a section's grid only as its class teacher or deputy */
  const options = teaching.scoped ? sectionsList.options.filter(o => teaching.leads(o.value)) : sectionsList.options;
  const sectionId = search.get("sectionId") ?? "";
  const grid = useApiGet<SectionTimetable>(sectionId ? sectionGridPath(sectionId) : null);
  const g = grid.data;
  const canEdit = can("academics.timetable.manage") && !readOnly;
  const count = g ? g.days.reduce((n, d) => n + d.slots.length, 0) : 0;

  const pick = (id: string) => {
    setErrors({});
    setSearch(prev => {
      const next = new URLSearchParams(prev);
      if (id) next.set("sectionId", id);
      else next.delete("sectionId");
      return next;
    }, { replace: true });
  };

  const toolbar = (
    <Select
      label="Section"
      className="select-sm"
      value={sectionId}
      onChange={e => pick(e.target.value)}
      options={options}
      placeholder={sectionsList.isLoading || teaching.isLoading ? "Loading sections…" : "Pick a section"}
      required
    />
  );

  if (!sectionId)
    return (
      <GridCard toolbar={toolbar}>
        {teaching.scoped && !teaching.isLoading && !options.length ? (
          <EmptyState
            icon={<CalendarDays />}
            title="No section to show"
            message="You can see a section's timetable as its class teacher or deputy. Your own lessons are under My week."
          />
        ) : (
          <EmptyState icon={<CalendarDays />} title="Pick a section" message="Its week appears here, period by period." />
        )}
      </GridCard>
    );

  return (
    <GridCard toolbar={toolbar} subtitle={g && lessons(count)} loading={grid.isLoading} error={grid.error} onRetry={() => void grid.refetch()}>
      {g &&
        (g.periods.length === 0 ? (
          <EmptyState
            icon={<Clock />}
            title="No periods yet"
            message={
              <>
                Add the periods of the school day on <Link to={SETUP_PATHS.periods}>Periods</Link> first.
              </>
            }
          />
        ) : (
          <TimetableGrid
            grid={g}
            show="teacher"
            errors={errors}
            onCellClick={canEdit ? (day, period, slot) => setTarget({ day, period, slot }) : undefined}
            aria-label={`${g.section.name} timetable`}
          />
        ))}
      {g && target && (
        <LessonDialog
          sectionId={g.section.id}
          sectionName={g.section.name}
          target={target}
          days={g.days}
          periods={g.periods}
          onClose={() => setTarget(null)}
          onCellError={(key, message) =>
            setErrors(prev => {
              const next = { ...prev };
              if (message) next[key] = message;
              else delete next[key];
              return next;
            })
          }
        />
      )}
    </GridCard>
  );
}

function TeacherView() {
  const teachers = useTeacherOptions();
  const [search, setSearch] = useSearchParams();
  const teacherId = search.get("teacherId") ?? "";
  const grid = useApiGet<TeacherTimetable>(teacherId ? teacherGridPath(teacherId) : null);
  const g = grid.data;
  const toolbar = (
    <Select
      label="Teacher"
      className="select-sm"
      value={teacherId}
      required
      onChange={e =>
        setSearch(prev => {
          const next = new URLSearchParams(prev);
          if (e.target.value) next.set("teacherId", e.target.value);
          else next.delete("teacherId");
          return next;
        }, { replace: true })
      }
      options={teachers.options}
      placeholder={teachers.isLoading ? "Loading teachers…" : "Pick a teacher"}
    />
  );
  if (!teacherId)
    return (
      <GridCard toolbar={toolbar}>
        <EmptyState icon={<CalendarDays />} title="Pick a teacher" message="Their week across every section appears here." />
      </GridCard>
    );
  return (
    <GridCard toolbar={toolbar} subtitle={g && lessons(g.weeklyLessons)} loading={grid.isLoading} error={grid.error} onRetry={() => void grid.refetch()}>
      {g &&
        (g.weeklyLessons === 0 ? (
          <EmptyState icon={<CalendarDays />} title="No lessons on this teacher's timetable" />
        ) : (
          <TimetableGrid grid={g} show="section" aria-label="Teacher timetable" />
        ))}
    </GridCard>
  );
}
