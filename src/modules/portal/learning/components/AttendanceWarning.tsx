import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Alert, ButtonLink } from "@/common/ui";
import { studentPath } from "../../shared/api/students";
import { ATTENDANCE_ALERTS_PATH, type AttendanceAlert, type AttendanceAlerts } from "../api/learning";

const recoverText = (r: AttendanceAlert["toRecover"]) =>
  r ? `${r.count} ${r.unit === "PERIODS" ? "period" : "school day"}${r.count === 1 ? "" : "s"}` : null;

/* Home, for parents (and students): a warning box when a child's attendance for the year is
   under the school's threshold, one line per child, each opening the child's attendance */
export function AttendanceWarning() {
  const { can, me, session } = useAuth();
  const enabled = can("portal.learning.students");
  const self = (me?.role ?? session?.user.role) === "STUDENT";
  const { data } = useQuery({
    queryKey: [ATTENDANCE_ALERTS_PATH],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => (await api.get<AttendanceAlerts>(ATTENDANCE_ALERTS_PATH, undefined, { signal, academicYearId: null })).data
  });
  if (!enabled || !data?.students.length) return null;

  const title = self
    ? `Your attendance is below ${data.threshold}%`
    : data.students.length === 1
      ? `${data.students[0].firstName}'s attendance is below ${data.threshold}%`
      : `Attendance is below ${data.threshold}% for ${data.students.length} of your children`;

  return (
    <Alert tone="warning" title={title}>
      <ul className="att-warning-list">
        {data.students.map(s => {
          const recover = recoverText(s.toRecover);
          return (
            <li key={s.studentId}>
              {self ? "You have" : <><strong>{s.firstName}</strong> ({s.section}) has</>} attended <strong>{s.percentage}%</strong> this year; the school expects at least{" "}
              {data.threshold}%.{recover ? ` Attending the next ${recover} without a break brings it back to ${data.threshold}%.` : ""}{" "}
              <ButtonLink size="sm" variant="link" to={`${studentPath(s.studentId)}/attendance`}>
                See attendance <ChevronRight />
              </ButtonLink>
            </li>
          );
        })}
      </ul>
    </Alert>
  );
}
