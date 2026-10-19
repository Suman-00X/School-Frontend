import { useApiGet } from "@/common/hooks";
import { Badge, Drawer, ErrorState, GridEditor, Kpi, SkeletonBlock } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { STATUS_CHOICES, STATUS_LABELS, type StudentAttendance } from "../api/attendance";
import { AttendanceBadge, Percent } from "./Percent";

/* AC-09 student drawer: one student's totals over the range, per subject (period-wise),
   and each day with every register's mark */
export function StudentAttendanceDrawer({
  student,
  from,
  to,
  onClose
}: {
  student: { studentId: string; name: string; rollNumber: string | null } | null;
  from?: string;
  to?: string;
  onClose: () => void;
}) {
  const q = useApiGet<StudentAttendance>(student ? `/academics/attendance/students/${student.studentId}` : null, { from, to });
  const d = q.data;
  const days = d ? [...d.days].reverse() : [];
  /* Every register seen in the range, in bell order, as the day grid's columns */
  const keys = d
    ? [...new Map(d.days.flatMap(day => day.breakdown).map(b => [b.kind === "PERIOD" ? `P${b.periodNumber}` : b.kind, b])).entries()]
        .sort((a, b) => a[1].periodNumber - b[1].periodNumber)
        .map(([key, b]) => ({ key, label: b.kind === "PERIOD" ? `P${b.periodNumber}` : b.label }))
    : [];
  const mark = (date: string, key: string) => {
    const day = d?.days.find(x => x.date === date);
    return day?.breakdown.find(b => (b.kind === "PERIOD" ? `P${b.periodNumber}` : b.kind) === key)?.status ?? null;
  };

  return (
    <Drawer
      open={!!student}
      onClose={onClose}
      wide
      title={student?.name ?? ""}
      subtitle={d ? `${student?.rollNumber ? `Roll ${student.rollNumber} · ` : ""}${formatDate(d.from)} – ${formatDate(d.to)}` : " "}
    >
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? (
        <SkeletonBlock lines={8} />
      ) : (
        <div className="stack">
          <div className="kpis">
            <Kpi label={d.basis === "PERIODS" ? "Attendance (periods)" : "Attendance"} value={<Percent value={d.percentage} />} />
            <Kpi label="Days attended" value={`${d.attendedDays} / ${d.countableDays}`} hint={`${d.workingDays} working days`} />
            <Kpi label="Not marked" value={d.unmarked} hint="Days with no register" />
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {STATUS_CHOICES.map(c => (
              <Badge key={c.value} tone={c.tone}>
                {c.label}: {d.counts[c.value as keyof typeof d.counts] ?? 0}
              </Badge>
            ))}
          </div>
          {d.subjects && d.subjects.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th className="align-right">Held</th>
                    <th className="align-right">Attended</th>
                    <th className="align-right">Excused</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {d.subjects.map(s => (
                    <tr key={s.subjectId}>
                      <td>{s.name}</td>
                      <td className="align-right">{s.held}</td>
                      <td className="align-right">{s.attended}</td>
                      <td className="align-right">{s.excused}</td>
                      <td>
                        <Percent value={s.percentage} bar />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="section-title">Days</div>
          {days.length === 0 ? (
            <p className="muted">No register has marked this student in the range.</p>
          ) : (
            <GridEditor
              aria-label="Days"
              rowHeader="Date"
              rows={days.map(day => ({ id: day.date, label: formatDate(day.date), sub: day.remarks ?? STATUS_LABELS[day.status] }))}
              columns={keys}
              choices={STATUS_CHOICES}
              value={(date, key) => mark(date, key)}
              mode="codes"
              legend={false}
              extraColumns={[{ key: "day", header: "Day", render: row => <AttendanceBadge status={d.days.find(x => x.date === row.id)?.status} /> }]}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
