import { useMemo, useState, type ReactNode } from "react";
import { CalendarOff } from "lucide-react";
import { useApiGet, useListParams } from "@/common/hooks";
import {
  Badge,
  CalendarLegend,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  Kpi,
  MonthCalendar,
  Page,
  PageHeader,
  Select,
  Skeleton,
  TextInput,
  monthOf,
  monthRange,
  type CalendarItem
} from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  ATTENDANCE_TONES,
  attendancePath,
  type AttendanceDay,
  type StudentAttendance
} from "../api/learning";

const RANGES = [
  { value: "year", label: "Year so far" },
  { value: "month", label: "Month shown" },
  { value: "custom", label: "Dates…" }
];

const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n}%`);

/* PO-03 · Attendance: totals for a range, a month calendar coloured by the day's mark, and
   per-subject attendance in period-wise schools. Clicking a day shows its sessions or periods. */
export default function AttendancePage() {
  const { student } = usePortalStudent();
  const { params, setParams } = useListParams({ range: "year", month: "", from: "", to: "" });
  const month = params.month || monthOf(todayIso());
  const [openDay, setOpenDay] = useState<AttendanceDay | null>(null);

  const query = useMemo(() => {
    if (params.range === "month") return monthRange(month);
    if (params.range === "custom" && params.from && params.to && params.from <= params.to) return { from: params.from, to: params.to };
    return {};
  }, [params.range, params.from, params.to, month]);
  const waitingForDates = params.range === "custom" && !("from" in query);

  const att = useApiGet<StudentAttendance>(student.current && !waitingForDates ? attendancePath(student.id) : null, query, {
    key: [attendancePath(student.id), query]
  });
  const a = att.data;

  const byDate = useMemo(() => new Map((a?.days ?? []).map(d => [d.date, d])), [a]);
  const events: CalendarItem[] = useMemo(
    () => (a?.days ?? []).map(d => ({ id: d.date, title: ATTENDANCE_LABELS[d.status] ?? d.status, startDate: d.date, tone: ATTENDANCE_TONES[d.status] ?? "neutral" })),
    [a]
  );

  if (!student.current)
    return (
      <Page>
        <PageHeader title="Attendance" subtitle={studentFullName(student)} />
        <EmptyState icon={<CalendarOff />} title="Not enrolled this year" message="Attendance appears once the school enrolls the student in a section." />
      </Page>
    );

  const kpi = (label: string, value: ReactNode, hint?: ReactNode) => <Kpi label={label} value={a ? value : <Skeleton width={56} height={24} />} hint={hint} />;

  return (
    <Page>
      <PageHeader title="Attendance" subtitle={studentFullName(student)} />
      <Card flush>
        <div className="filter-bar">
          <Select label="Range" className="select-sm" value={params.range} required options={RANGES} onChange={e => setParams({ range: e.target.value })} />
          {params.range === "custom" && (
            <>
              <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParams({ from: e.target.value })} />
              <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParams({ to: e.target.value })} />
            </>
          )}
          <span className="small muted" style={{ alignSelf: "center" }}>
            {a ? `${formatDate(a.from)} – ${formatDate(a.to)} · ${a.workingDays} school days, ${a.unmarked} not marked` : waitingForDates ? "Pick both dates" : ""}
          </span>
        </div>
      </Card>

      {att.error ? (
        <PortalError error={att.error} onRetry={() => void att.refetch()} />
      ) : (
        <>
          <div className="kpis">
            {kpi("Attendance", pct(a?.percentage), a ? (a.basis === "PERIODS" ? "By periods" : "By days") : " ")}
            {ATTENDANCE_STATUSES.map(s => (
              <Kpi key={s} label={ATTENDANCE_LABELS[s]} value={a ? (a.counts[s] ?? 0) : <Skeleton width={40} height={24} />} />
            ))}
          </div>

          <Card>
            <MonthCalendar
              month={month}
              onMonthChange={m => setParams({ month: m === monthOf(todayIso()) ? "" : m })}
              maxMonth={monthOf(todayIso())}
              events={events}
              onEventClick={id => setOpenDay(byDate.get(id) ?? null)}
              onDayClick={d => byDate.get(d) && setOpenDay(byDate.get(d)!)}
              summary={params.range === "month" && a ? `${pct(a.percentage)} this month` : undefined}
            />
            <div style={{ marginTop: 10 }}>
              <CalendarLegend items={ATTENDANCE_STATUSES.map(s => ({ tone: ATTENDANCE_TONES[s], label: ATTENDANCE_LABELS[s] }))} />
            </div>
          </Card>

          {a?.subjects && a.subjects.length > 0 && (
            <Card title="By subject" subtitle={`A period counts as attended at ${a.periodPresenceThreshold}% presence or more`} flush>
              <DataTable
                rows={a.subjects}
                rowKey={s => s.subjectId}
                columns={[
                  { key: "name", header: "Subject", render: s => s.name ?? "—" },
                  { key: "held", header: "Periods held", align: "right", render: s => s.held },
                  { key: "attended", header: "Attended", align: "right", render: s => s.attended },
                  { key: "excused", header: "Excused", align: "right", render: s => s.excused },
                  { key: "percentage", header: "Attendance", align: "right", render: s => <strong>{pct(s.percentage)}</strong> }
                ]}
              />
            </Card>
          )}
        </>
      )}

      <Dialog open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? formatDate(openDay.date) : ""}>
        {openDay && <DayDetail day={openDay} />}
      </Dialog>
    </Page>
  );
}

function DayDetail({ day }: { day: AttendanceDay }) {
  const lines = day.breakdown.filter(b => b.kind !== "DAY" || day.breakdown.length > 1);
  return (
    <div className="stack-sm">
      <div className="row">
        <Badge tone={ATTENDANCE_TONES[day.status]} dot>
          {ATTENDANCE_LABELS[day.status]}
        </Badge>
        {day.periods && (
          <span className="small muted">
            {day.periods.attended} of {day.periods.held} periods
          </span>
        )}
      </div>
      {day.remarks && <p>{day.remarks}</p>}
      {lines.length > 0 && (
        <ul className="po-lines">
          {lines.map(b => (
            <li key={`${b.kind}-${b.periodNumber}`}>
              <div style={{ minWidth: 0 }}>
                <div>{b.subject ? `${b.label} · ${b.subject.subjectName}` : b.label}</div>
                {b.remarks && <div className="small muted">{b.remarks}</div>}
              </div>
              {b.status ? (
                <Badge tone={ATTENDANCE_TONES[b.status]} dot>
                  {ATTENDANCE_LABELS[b.status]}
                </Badge>
              ) : (
                <span className="small muted">Not marked</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
