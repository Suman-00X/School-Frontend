import { CalendarOff } from "lucide-react";
import { useApiGet } from "@/common/hooks";
import { Card, EmptyState, Page, PageHeader, SkeletonBlock } from "@/common/ui";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { WeekTimetable } from "../../shared/components/WeekTimetable";
import { studentFullName } from "../../shared/api/students";
import { timetablePath, type StudentTimetable } from "../api/learning";

/* PO-02 · Timetable: the child's weekly classes, read-only */
export default function TimetablePage() {
  const { student } = usePortalStudent();
  const tt = useApiGet<StudentTimetable>(student.current ? timetablePath(student.id) : null);
  const data = tt.data;
  const empty = data && (!data.periods.length || data.days.every(d => !d.slots.length));

  return (
    <Page>
      <PageHeader title="Timetable" subtitle={data ? `${data.section.name} · ${studentFullName(student)}` : student.current?.section ?? studentFullName(student)} />
      {!student.current ? (
        <EmptyState icon={<CalendarOff />} title="Not enrolled in a section this year" message="The timetable appears once the school enrolls the student in a section." />
      ) : tt.error ? (
        <PortalError error={tt.error} onRetry={() => void tt.refetch()} notEnrolled="Not enrolled in a section this year" />
      ) : (
        <Card flush>
          {!data ? (
            <div className="card-body">
              <SkeletonBlock lines={8} />
            </div>
          ) : empty ? (
            <EmptyState icon={<CalendarOff />} title="No timetable yet" message="The school has not published this section's timetable." />
          ) : (
            <WeekTimetable grid={data} show="teacher" />
          )}
        </Card>
      )}
    </Page>
  );
}
