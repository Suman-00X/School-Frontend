import { useState } from "react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Card, DataTable, ErrorState, Kpi, SkeletonBlock, TextInput } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { useStudentAttendance } from "../api/records";
import { useHideOnForbidden } from "./useHideOnForbidden";

const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n}%`);

/* Summary for a date range (default: start of the year to today) */
export function AttendanceTab({ studentId, onForbidden }: { studentId: string; onForbidden?: () => void }) {
  const { selected } = useAcademicYear();
  const today = todayIso();
  const [from, setFrom] = useState(selected?.startDate ?? "");
  const [to, setTo] = useState(selected && selected.endDate < today ? selected.endDate : today);
  const summary = useStudentAttendance(studentId, from, to);
  useHideOnForbidden(summary.error, onForbidden);
  const a = summary.data;

  return (
    <div className="stack">
      <div className="row">
        <TextInput label="From" type="date" className="input-sm" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
        <TextInput label="To" type="date" className="input-sm" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
        {a && (
          <span className="small muted" style={{ alignSelf: "flex-end", paddingBottom: 8 }}>
            {formatDate(a.from)} – {formatDate(a.to)}
          </span>
        )}
      </div>
      {summary.isLoading && <SkeletonBlock lines={4} />}
      {summary.error && <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />}
      {a && (
        <>
          <div className="kpis">
            <Kpi label={a.basis === "PERIODS" ? "Period attendance" : "Attendance"} value={pct(a.percentage)} hint={`${a.attendedDays} of ${a.countableDays} days`} />
            <Kpi label="Present" value={a.counts.PRESENT} />
            <Kpi label="Absent" value={a.counts.ABSENT} />
            <Kpi label="Late" value={a.counts.LATE} />
            <Kpi label="Half day" value={a.counts.HALF_DAY} />
            <Kpi label="Excused" value={a.counts.EXCUSED} />
            <Kpi label="Not marked" value={a.unmarked} hint={`of ${a.workingDays} working days`} />
          </div>
          {a.subjects && a.subjects.length > 0 && (
            <Card flush title="By subject">
              <DataTable
                rows={a.subjects}
                rowKey={s => s.subjectId}
                columns={[
                  { key: "name", header: "Subject" },
                  { key: "held", header: "Periods held", align: "right" },
                  { key: "attended", header: "Attended", align: "right" },
                  { key: "excused", header: "Excused", align: "right" },
                  { key: "percentage", header: "Attendance", align: "right", render: s => pct(s.percentage) }
                ]}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
