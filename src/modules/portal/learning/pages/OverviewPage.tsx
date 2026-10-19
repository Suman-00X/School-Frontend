import type { ReactNode } from "react";
import { ArrowRight, School } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList } from "@/common/hooks";
import { Badge, ButtonLink, Card, EmptyState, Page, PageHeader, SkeletonBlock } from "@/common/ui";
import { formatDate, formatMoney, todayIso } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { studentFullName, studentLine, studentPath } from "../../shared/api/students";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { cardErrorText } from "../../shared/components/PortalError";
import { formatClock, isWeekdayToday, minutesOf, useNow } from "../../shared/utils/time";
import { homeworkListPath, type Homework } from "../../homework/api/homework";
import { feesPath, invoicePagePath, isPayable, type Statement } from "../../fees/api/fees";
import {
  CALENDAR_PATH,
  EVENT_LABELS,
  EVENT_TONES,
  RESULT_LABELS,
  RESULT_TONES,
  attendancePath,
  reportCardsPath,
  reportName,
  timetablePath,
  type CalendarEvent,
  type ReportCards,
  type StudentAttendance,
  type StudentTimetable
} from "../api/learning";

/* One card of the overview: loads on its own, keeps its size, links to the full page */
function OverviewCard({ title, to, linkLabel, loading, error, children }: { title: string; to: string; linkLabel: string; loading: boolean; error?: unknown; children?: ReactNode }) {
  return (
    <Card
      title={title}
      footer={
        <ButtonLink variant="link" to={to}>
          {linkLabel} <ArrowRight size={14} />
        </ButtonLink>
      }
    >
      {error ? <p className="muted">{cardErrorText(error)}</p> : loading ? <SkeletonBlock lines={4} /> : children}
    </Card>
  );
}

/* PO-01 · Portal home: the selected child's day at a glance */
export default function OverviewPage() {
  const { student } = usePortalStudent();
  const { can } = useAuth();
  const enrolled = !!student.current;
  const base = studentPath(student.id);

  return (
    <Page>
      <PageHeader title={studentFullName(student)} subtitle={`${studentLine(student)} · ${student.studentCode}`} />
      <div className="portal-cards">
        {enrolled ? (
          <>
            <TodayCard studentId={student.id} to={`${base}/timetable`} />
            <AttendanceCard studentId={student.id} to={`${base}/attendance`} />
            {can("portal.homework.read") && <HomeworkCard studentId={student.id} to={`${base}/homework`} />}
          </>
        ) : (
          <Card title="This year">
            <EmptyState icon={<School />} title="Not enrolled this year" message="Timetable, attendance and homework show once the school enrolls the student in a section." />
          </Card>
        )}
        {can("portal.fees.read") && <FeesCard studentId={student.id} to={`${base}/fees`} />}
        {can("portal.learning.calendar") && <ComingUpCard />}
        {enrolled && <ResultCard studentId={student.id} to={`${base}/results`} />}
      </div>
    </Page>
  );
}

function TodayCard({ studentId, to }: { studentId: string; to: string }) {
  const tt = useApiGet<StudentTimetable>(timetablePath(studentId));
  const now = useNow();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = tt.data?.days.find(d => isWeekdayToday(d.weekday, now));
  const slots = [...(today?.slots ?? [])].sort((a, b) => a.period.periodNumber - b.period.periodNumber);
  return (
    <OverviewCard title="Today's classes" to={to} linkLabel="Full timetable" loading={tt.isLoading} error={tt.error}>
      {!slots.length ? (
        <p className="muted">No classes today.</p>
      ) : (
        <ul className="portal-list">
          {slots.slice(0, 7).map(s => {
            const live = minutes >= minutesOf(s.period.startTime) && minutes < minutesOf(s.period.endTime);
            return (
              <li key={s.id} className={live ? "now" : undefined}>
                <span className="small muted nowrap" style={{ width: 64 }}>
                  {formatClock(s.period.startTime)}
                </span>
                <span className="grow" title={s.subject?.subjectName}>
                  {s.subject?.subjectName ?? "Lesson"}
                </span>
                {live ? <Badge tone="primary">Now</Badge> : <span className="small muted nowrap">{s.room ?? ""}</span>}
              </li>
            );
          })}
          {slots.length > 7 && <li className="small muted">and {slots.length - 7} more</li>}
        </ul>
      )}
    </OverviewCard>
  );
}

function AttendanceCard({ studentId, to }: { studentId: string; to: string }) {
  const att = useApiGet<StudentAttendance>(attendancePath(studentId));
  const a = att.data;
  return (
    <OverviewCard title="Attendance" to={to} linkLabel="Attendance by day" loading={att.isLoading} error={att.error}>
      {a && (
        <div className="stack-sm">
          <div className="portal-card-figure">{a.percentage === null ? "—" : `${a.percentage}%`}</div>
          <div className="small muted">This year so far, {a.basis === "PERIODS" ? "by periods" : "by days"}</div>
          <div className="row" style={{ marginTop: 6 }}>
            <Badge tone={a.counts.ABSENT ? "danger" : "neutral"}>{a.counts.ABSENT} absent</Badge>
            <Badge tone={a.counts.LATE ? "warning" : "neutral"}>{a.counts.LATE} late</Badge>
            <Badge>{a.counts.PRESENT} present</Badge>
          </div>
        </div>
      )}
    </OverviewCard>
  );
}

function HomeworkCard({ studentId, to }: { studentId: string; to: string }) {
  const list = useApiList<Homework>(homeworkListPath(studentId), { status: "pending", limit: 5 });
  const today = todayIso();
  const total = list.meta?.total ?? 0;
  return (
    <OverviewCard title="Homework due" to={to} linkLabel="All homework" loading={list.isLoading} error={list.error}>
      {total === 0 ? (
        <p className="muted">Nothing pending.</p>
      ) : (
        <div className="stack-sm">
          <div className="small muted">{total === 1 ? "1 piece of homework to do" : `${total} pieces of homework to do`}</div>
          <ul className="portal-list">
            {(list.rows ?? []).slice(0, 4).map(h => (
              <li key={h.id}>
                <span className="grow" title={h.title}>
                  {h.title}
                </span>
                <span className={`small nowrap${h.dueDate < today ? " po-danger" : " muted"}`}>{formatDate(h.dueDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </OverviewCard>
  );
}

function FeesCard({ studentId, to }: { studentId: string; to: string }) {
  const currency = useSchoolCurrency();
  const st = useApiGet<Statement>(feesPath(studentId));
  const s = st.data;
  const next = s?.invoices.filter(isPayable).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return (
    <OverviewCard title="Fees" to={to} linkLabel="Fee statement" loading={st.isLoading} error={st.error}>
      {s && (
        <div className="stack-sm">
          <div className="portal-card-figure">{formatMoney(s.totals.balance, currency)}</div>
          <div className="small muted">
            Balance due
            {s.totals.overdue > 0 && (
              <>
                {" · "}
                <span className="po-danger">{formatMoney(s.totals.overdue, currency)} overdue</span>
              </>
            )}
          </div>
          {next ? (
            <ButtonLink variant="link" to={invoicePagePath(studentId, next.id)} style={{ justifyContent: "flex-start", padding: 0, marginTop: 6 }}>
              Next: {next.invoiceNumber} · {formatMoney(next.balance, currency)} by {formatDate(next.dueDate)}
            </ButtonLink>
          ) : (
            <span className="small muted" style={{ marginTop: 6 }}>
              {s.invoices.length ? "All invoices are paid." : "No fees billed yet this year."}
            </span>
          )}
        </div>
      )}
    </OverviewCard>
  );
}

function ComingUpCard() {
  const list = useApiList<CalendarEvent>(CALENDAR_PATH, { from: todayIso(), limit: 5 });
  return (
    <OverviewCard title="Coming up" to={CALENDAR_PATH} linkLabel="School calendar" loading={list.isLoading} error={list.error}>
      {!list.rows?.length ? (
        <p className="muted">Nothing on the calendar.</p>
      ) : (
        <ul className="portal-list">
          {list.rows.slice(0, 5).map(e => (
            <li key={e.id}>
              <span className="small muted nowrap" style={{ width: 92 }}>
                {formatDate(e.startDate)}
              </span>
              <span className="grow" title={e.title}>
                {e.title}
              </span>
              <Badge tone={EVENT_TONES[e.eventType]}>{EVENT_LABELS[e.eventType]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

function ResultCard({ studentId, to }: { studentId: string; to: string }) {
  const rc = useApiGet<ReportCards>(reportCardsPath(studentId));
  const latest = [...(rc.data?.reports ?? [])].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const score = latest
    ? latest.display.marks && latest.percentage !== null
      ? `${latest.percentage}%`
      : latest.grade
        ? `Grade ${latest.grade}`
        : null
    : null;
  return (
    <OverviewCard title="Latest result" to={to} linkLabel="All results" loading={rc.isLoading} error={rc.error}>
      {!latest ? (
        <p className="muted">No results published yet this year.</p>
      ) : (
        <div className="stack-sm">
          <div className="portal-card-figure">{score ?? "—"}</div>
          <div style={{ fontWeight: 550 }}>{reportName(latest)}</div>
          <div className="row">
            <Badge tone={RESULT_TONES[latest.result] ?? "neutral"} dot>
              {RESULT_LABELS[latest.result] ?? latest.result}
            </Badge>
            <span className="small muted">Published {formatDate(latest.publishedAt)}</span>
          </div>
        </div>
      )}
    </OverviewCard>
  );
}
