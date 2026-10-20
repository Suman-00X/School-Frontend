import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, TrendingDown } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Badge, ButtonLink, Dialog } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { LOW_ATTENDANCE_PATH, recoverText, type LowAttendance, type LowAttendanceStudent } from "../api/attendance";
import { ATTENDANCE_PAGES } from "../api/paths";
import { Percent } from "./Percent";
import { StudentAttendanceDrawer } from "./StudentAttendanceDrawer";
import "./attendance.css";

const ROLE_LABELS = { CLASS_TEACHER: "Class teacher", DEPUTY: "Deputy class teacher", SUBJECT: "Subject teacher" } as const;

const nameOf = (s: Pick<LowAttendanceStudent, "firstName" | "lastName">) => [s.firstName, s.lastName].filter(Boolean).join(" ");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* Home, for teachers: students of their sections whose attendance for the year is under the
   school's threshold, highlighted; it goes away when nobody is. Opens the list by section. */
export function LowAttendanceHighlight() {
  const { can, me, session } = useAuth();
  const enabled = can("academics.attendance.readLowAttendance") && (me?.role ?? session?.user.role) === "TEACHER";
  /* Changes once a day at most (registers are taken through the day): no polling */
  const { data } = useQuery({
    queryKey: [LOW_ATTENDANCE_PATH],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => (await api.get<LowAttendance>(LOW_ATTENDANCE_PATH, undefined, { signal, academicYearId: null })).data
  });
  const [open, setOpen] = useState(false);
  if (!enabled || !data?.total) return null;

  const own = data.sections.filter(s => s.role === "CLASS_TEACHER" || s.role === "DEPUTY").reduce((n, s) => n + s.students.length, 0);
  return (
    <>
      <button type="button" className="low-att-highlight" onClick={() => setOpen(true)}>
        <span className="low-att-count">{data.total}</span>
        <span className="low-att-text">
          <strong>
            {data.total === 1 ? "1 student is" : `${data.total} students are`} below {data.threshold}% attendance
          </strong>
          <span className="small">
            {own ? `${own} in your own class · ` : ""}
            {plural(data.sections.length, "section")} · year so far
          </span>
        </span>
        <span className="low-att-go">
          See who <ChevronRight />
        </span>
      </button>
      {open && <LowAttendanceDialog data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function LowAttendanceDialog({ data, onClose }: { data: LowAttendance; onClose: () => void }) {
  const [student, setStudent] = useState<{ studentId: string; name: string; rollNumber: string | null } | null>(null);
  return (
    <Dialog open wide onClose={onClose} title={`Below ${data.threshold}% attendance`}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          <TrendingDown className="low-att-inline-icon" /> Attendance from the start of the year to {formatDate(data.asOf)}, counted once a student has{" "}
          {plural(data.minDays, "school day")}. Parents are told when their child falls below {data.threshold}%.
        </p>
        {data.sections.map(entry => (
          <section key={entry.section.id} className="low-att-section">
            <header className="low-att-section-head">
              <strong>{entry.section.name}</strong>
              {entry.role && <Badge tone={entry.role === "SUBJECT" ? "neutral" : "info"}>{ROLE_LABELS[entry.role]}</Badge>}
              <span className="small muted">{plural(entry.students.length, "student")}</span>
              <ButtonLink size="sm" variant="link" to={`${ATTENDANCE_PAGES.register}?sectionId=${entry.section.id}&tab=summary`} onClick={onClose}>
                Attendance summary
              </ButtonLink>
            </header>
            <ul className="low-att-list">
              {entry.students.map(s => (
                <li key={s.studentId}>
                  <button type="button" onClick={() => setStudent({ studentId: s.studentId, name: nameOf(s), rollNumber: s.rollNumber })}>
                    <span className="low-att-roll small muted">{s.rollNumber ?? "—"}</span>
                    <span className="low-att-name">{nameOf(s)}</span>
                    <Percent value={s.percentage} bar />
                    <span className="small muted low-att-recover">
                      {recoverText(s.toRecover) ? `${recoverText(s.toRecover)} in a row to reach ${data.threshold}%` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <StudentAttendanceDrawer student={student} onClose={() => setStudent(null)} />
    </Dialog>
  );
}
