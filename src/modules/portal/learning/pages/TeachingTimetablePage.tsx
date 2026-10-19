import { CalendarOff, Users } from "lucide-react";
import { isApiError } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import { Card, EmptyState, Page, PageHeader, SkeletonBlock } from "@/common/ui";
import { PortalError } from "../../shared/components/PortalError";
import { WeekTimetable } from "../../shared/components/WeekTimetable";
import { TEACHING_TIMETABLE_PATH, type TeacherTimetable } from "../api/learning";
import "../../shared/portal.css";

/* PO-10 · My timetable: the teacher's week across sections, read-only */
export default function TeachingTimetablePage() {
  const tt = useApiGet<TeacherTimetable>(TEACHING_TIMETABLE_PATH);
  const t = tt.data;
  const noProfile = isApiError(tt.error) && tt.error.status === 404;

  return (
    <Page>
      <PageHeader title="My timetable" subtitle={t ? (t.weeklyLessons === 1 ? "1 lesson a week" : `${t.weeklyLessons} lessons a week`) : "Your lessons this week"} />
      {noProfile ? (
        <EmptyState icon={<Users />} title="Your account has no teacher profile" message="Contact the office." />
      ) : tt.error ? (
        <PortalError error={tt.error} onRetry={() => void tt.refetch()} />
      ) : (
        <Card flush>
          {!t ? (
            <div className="card-body">
              <SkeletonBlock lines={8} />
            </div>
          ) : !t.weeklyLessons ? (
            <EmptyState icon={<CalendarOff />} title="No lessons in the timetable yet" message="Your lessons show here once the school builds the timetable." />
          ) : (
            <WeekTimetable grid={t} show="section" />
          )}
        </Card>
      )}
    </Page>
  );
}
