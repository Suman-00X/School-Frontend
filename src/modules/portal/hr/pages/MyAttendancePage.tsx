import { useMemo } from "react";
import { useApiGet, useListParams } from "@/common/hooks";
import { CalendarLegend, Card, ErrorState, Kpi, MonthCalendar, Page, PageHeader, Skeleton, monthOf, monthRange } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { formatClock } from "../../shared/utils/time";
import { MY_ATTENDANCE_PATH, STAFF_STATUS_LABELS, STAFF_STATUS_TONES, type MyAttendance, type StaffAttendanceStatus } from "../api/hr";
import "../../shared/portal.css";

const STATUSES: StaffAttendanceStatus[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "ON_DUTY"];

/* PO-11 · My attendance: a month of the employee's own attendance, coloured by status, with
   check-in and check-out times on each day */
export default function MyAttendancePage() {
  const today = todayIso();
  const { params, setParams } = useListParams({ month: "" });
  const month = params.month || monthOf(today);
  const range = monthRange(month);
  const query = { from: range.from, to: range.to < today ? range.to : today };
  const att = useApiGet<MyAttendance>(MY_ATTENDANCE_PATH, query);
  const a = att.data;

  const events = useMemo(
    () =>
      (a?.days ?? []).map(d => {
        const times = d.checkIn || d.checkOut ? ` · ${formatClock(d.checkIn) || "?"}–${formatClock(d.checkOut) || "?"}` : "";
        return { id: d.date, title: `${STAFF_STATUS_LABELS[d.status]}${times}${d.remarks ? ` · ${d.remarks}` : ""}`, startDate: d.date, tone: STAFF_STATUS_TONES[d.status] };
      }),
    [a]
  );

  const value = (n: number | undefined) => (a ? (n ?? 0) : <Skeleton width={40} height={24} />);

  return (
    <Page>
      <PageHeader title="My attendance" subtitle="Your days at work as the office marked them" />
      {att.error ? (
        <ErrorState error={att.error} onRetry={() => void att.refetch()} />
      ) : (
        <>
          <div className="kpis">
            <Kpi label="Days present" value={value(a?.daysPresent)} hint="On duty counts; half days count half" />
            {STATUSES.filter(s => s !== "PRESENT").map(s => (
              <Kpi key={s} label={STAFF_STATUS_LABELS[s]} value={value(a?.counts[s])} />
            ))}
          </div>
          <Card>
            <MonthCalendar
              month={month}
              onMonthChange={m => setParams({ month: m === monthOf(today) ? "" : m })}
              maxMonth={monthOf(today)}
              events={events}
              maxChips={1}
              summary={a ? (a.marked ? `${a.marked} day${a.marked === 1 ? "" : "s"} marked` : "No attendance marked this month") : undefined}
            />
            <div style={{ marginTop: 10 }}>
              <CalendarLegend items={STATUSES.map(s => ({ tone: STAFF_STATUS_TONES[s], label: STAFF_STATUS_LABELS[s] }))} />
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}
