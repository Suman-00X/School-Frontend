/* AC-09 · Attendance register: one section's day. Register chips (Day / Forenoon / Afternoon /
   Period n, as the school's mode takes them), one register's student list to take or retake,
   or the whole day read-only. Summary tab: totals per student over a date range. */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarOff, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, ErrorState, GridEditor, Kpi, Select, SkeletonBlock, Tabs, TextInput, useTabParam, type Column, type TabItem } from "@/common/ui";
import { formatDate, formatDateTime, todayIso } from "@/common/utils/format";
import { useMyTeaching } from "../../shared/api/teaching";
import { PageIntro } from "../../shared/components/PageIntro";
import { useSectionOptions } from "../../shared/components/SectionSelect";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { useSectionSubjects } from "../../timetable/api/timetable";
import {
  addDays,
  CLOSURE_TEXT,
  MODE_TEXT,
  parseRegisterKey,
  REGISTER_PATH,
  STATUS_CHOICES,
  useAttendancePolicy,
  useWorkingDays,
  weekdayName,
  type RegisterDay,
  type RegisterInfo,
  type SectionSummary
} from "../api/attendance";
import { AttendanceBadge, Percent } from "../components/Percent";
import { RegisterEditor } from "../components/RegisterEditor";
import { StudentAttendanceDrawer } from "../components/StudentAttendanceDrawer";

const WHOLE_DAY = "day";
const studentName = (s: { firstName?: string; lastName?: string }) => [s.firstName, s.lastName].filter(Boolean).join(" ") || "Student";

export default function RegisterPage() {
  const policy = useAttendancePolicy();
  const tabs: TabItem[] = [
    { id: "register", label: "Register" },
    { id: "summary", label: "Summary" }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const p = policy.data;
  const lockText = p ? (p.editWindowDays === 0 ? "the same day" : `${p.editWindowDays} day${p.editWindowDays === 1 ? "" : "s"} after their date`) : "";

  return (
    <div className="stack">
      <PageIntro actions={<Link to={SETUP_PATHS.attendancePolicy} className="btn btn-sm btn-ghost">Attendance policy</Link>}>
        {p ? `The school takes attendance ${MODE_TEXT[p.mode]}. Registers lock ${lockText}.` : "Take and review a section's registers."}
      </PageIntro>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "register" ? <RegisterTab /> : <SummaryTab />}
    </div>
  );
}

/* The section from the URL, else the person's first section */
function useSectionParam() {
  const [search, setSearch] = useSearchParams();
  const sections = useSectionOptions();
  const teaching = useMyTeaching();
  /* A class teacher (or deputy) starts on the section they lead */
  const led = teaching.scoped ? teaching.sections.find(s => (s.isClassTeacher || s.isDeputyClassTeacher) && sections.byId.has(s.sectionId))?.sectionId : undefined;
  const sectionId = search.get("sectionId") ?? led ?? "";
  const set = (changes: Record<string, string | null>) =>
    setSearch(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });
  return { sectionId, sections, search, set };
}

function RegisterTab() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const { sectionId, sections, search, set } = useSectionParam();
  const today = todayIso();
  const raw = search.get("date");
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
  const chosen = search.get("register");
  const subjects = useSectionSubjects(sectionId);

  const calendar = useWorkingDays(addDays(date, -45), addDays(date, 45));
  const closed = calendar.data?.closedDays.find(c => c.date === date);
  const working = calendar.data?.workingDays ?? [];
  const prevDay = [...working].reverse().find(d => d < date);
  const nextDay = working.find(d => d > date && d <= today);

  const day = useApiGet<RegisterDay>(sectionId && !closed ? REGISTER_PATH : null, { sectionId, date });
  const d = day.data;
  const multi = d && d.mode !== "DAILY";
  const key = chosen ?? (d && !multi ? "DAY" : WHOLE_DAY);
  const register = d?.registers.find(r => r.key === key);
  const parsed = key !== WHOLE_DAY ? parseRegisterKey(key) : null;

  /* Daily and half-day registers: class teacher or deputy; period registers: any teacher of the section */
  const mayRecord = (kind: string) =>
    can("academics.attendance.record") && !readOnly && (kind === "PERIOD" ? teaching.teaches(sectionId) : teaching.leads(sectionId));

  const sectionOptions = sections.options;
  const label = sections.byId.get(sectionId);

  const bar = (
    <div className="reg-bar">
      <Select
        label="Section"
        className="select-sm"
        value={sectionId}
        required
        onChange={e => set({ sectionId: e.target.value, register: null })}
        options={sectionOptions}
        placeholder={sections.isLoading ? "Loading sections…" : "Pick a section"}
      />
      <div className="reg-date">
        <Button size="sm" icon={<ChevronLeft />} aria-label="Previous school day" title="Previous school day" disabled={!prevDay} onClick={() => set({ date: prevDay!, register: null })} />
        <TextInput
          label="Date"
          type="date"
          className="input-sm"
          value={date}
          max={today}
          error={undefined}
          onChange={e => e.target.value && set({ date: e.target.value === today ? null : e.target.value, register: null })}
        />
        <Button size="sm" icon={<ChevronRight />} aria-label="Next school day" title="Next school day" disabled={!nextDay} onClick={() => set({ date: nextDay === today ? null : nextDay!, register: null })} />
      </div>
      <span className="small muted" style={{ alignSelf: "center", marginLeft: "auto" }}>
        {weekdayName(date)}
        {d ? ` · ${MODE_TEXT[d.mode]}` : ""}
      </span>
    </div>
  );

  const chips = (
    <div className="reg-chips" role="tablist" aria-label="Registers">
      {d && multi && (
        <button type="button" role="tab" aria-selected={key === WHOLE_DAY} className={`reg-chip${key === WHOLE_DAY ? " is-active" : ""}`} onClick={() => set({ register: null })}>
          <span className="reg-chip-label">Whole day</span>
          <span className="reg-chip-state">
            {d.registers.filter(r => r.taken).length} of {d.registers.filter(r => !r.free).length} taken
          </span>
        </button>
      )}
      {d?.registers.map(r => (
        <RegisterChip key={r.key} register={r} active={key === r.key} onClick={() => set({ register: r.key })} />
      ))}
      {d && multi && d.registers.length === 0 && <span className="small muted">Nothing is timetabled for this section on {weekdayName(date)}s.</span>}
    </div>
  );

  let body;
  if (!sectionId)
    body = <EmptyState icon={<ClipboardList />} title="Pick a section" message="Its registers for the day appear here." />;
  else if (date > today) body = <EmptyState icon={<CalendarOff />} title="That day hasn't come yet" message="Attendance can be taken for today or an earlier day." />;
  else if (closed)
    body = (
      <EmptyState
        icon={<CalendarOff />}
        title={`${weekdayName(date)} ${formatDate(date)} is ${CLOSURE_TEXT[closed.reason] ?? "a closed day"}`}
        message={closed.title ? `${closed.title}: no registers are taken.` : "No registers are taken on closed days."}
        actions={prevDay && <Button onClick={() => set({ date: prevDay, register: null })}>Go to {formatDate(prevDay)}</Button>}
      />
    );
  else if (day.error) body = <ErrorState error={day.error} onRetry={() => void day.refetch()} />;
  else if (!d)
    body = (
      <div style={{ padding: 18 }}>
        <SkeletonBlock lines={6} />
      </div>
    );
  else if (key === WHOLE_DAY) body = <WholeDay day={d} />;
  else if (parsed)
    body = (
      <RegisterEditor
        key={`${sectionId}|${date}|${key}`}
        sectionId={sectionId}
        date={date}
        kind={parsed.kind}
        periodNumber={parsed.periodNumber}
        title={`${register?.label ?? key} · ${label ? `${label.class.className}-${label.sectionName}` : ""} · ${formatDate(date)}`}
        canRecord={mayRecord(parsed.kind)}
        subjects={(subjects.data ?? []).map(s => ({ id: s.subjectId, subjectName: s.subject.subjectName }))}
        defaultSubjectId={register?.subject?.id ?? null}
        onSaved={() => void day.refetch()}
      />
    );

  return (
    <div className="stack">
      <Card flush>
        {bar}
        {chips}
      </Card>
      {key === WHOLE_DAY || !parsed || !d || closed || !sectionId ? <Card flush>{body}</Card> : body}
    </div>
  );
}

function RegisterChip({ register: r, active, onClick }: { register: RegisterInfo; active: boolean; onClick: () => void }) {
  const state = r.free ? "Free" : r.taken ? (r.substitute ? "Substitute" : "Taken") : "Not taken";
  const cls = r.free ? "is-free" : r.taken ? (r.substitute ? "is-sub" : "is-taken") : "is-open";
  const label = r.kind === "PERIOD" ? r.label : { DAY: "Day", FORENOON: "Forenoon", AFTERNOON: "Afternoon", PERIOD: "" }[r.kind];
  const title = [r.label, r.teacher?.name, r.free ? `Free: ${r.free.reason}` : r.taken ? `Taken ${formatDateTime(r.takenAt)}` : "Not taken yet"].filter(Boolean).join(" · ");
  return (
    <button type="button" role="tab" aria-selected={active} className={`reg-chip ${cls}${active ? " is-active" : ""}`} onClick={onClick} title={title}>
      <span className="reg-chip-label">{label}</span>
      <span className="reg-chip-state">{state}</span>
    </button>
  );
}

/* Read-only: students × the day's registers, and the day status the registers make */
function WholeDay({ day }: { day: RegisterDay }) {
  const regs = day.registers.filter(r => !r.free);
  if (!regs.length) return <EmptyState icon={<ClipboardList />} title="No registers expected" message="Nothing is timetabled for this section on this day." />;
  if (!day.students.length) return <EmptyState title="No students in this section" />;
  return (
    <GridEditor
      aria-label="Whole day"
      rowHeader="Student"
      rows={day.students.map(s => ({ id: s.studentId, label: studentName(s), sub: s.rollNumber ? `Roll ${s.rollNumber}` : undefined }))}
      columns={regs.map(r => ({ key: r.key, label: r.kind === "PERIOD" ? `P${r.periodNumber}` : r.label, title: r.label }))}
      choices={STATUS_CHOICES}
      mode="codes"
      value={(rowId, col) => day.students.find(s => s.studentId === rowId)?.marks?.[col] ?? null}
      extraColumns={[{ key: "day", header: "Day", render: row => <AttendanceBadge status={day.students.find(s => s.studentId === row.id)?.status} /> }]}
    />
  );
}

function SummaryTab() {
  const { sectionId, sections, search, set } = useSectionParam();
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  const summary = useApiGet<SectionSummary>(sectionId ? "/academics/attendance/summary" : null, { sectionId, from, to });
  const [student, setStudent] = useState<{ studentId: string; name: string; rollNumber: string | null } | null>(null);
  const s = summary.data;
  const periodWise = s?.basis === "PERIODS";

  type Row = SectionSummary["students"][number];
  const subjectNames = periodWise ? [...new Map((s?.students ?? []).flatMap(st => st.subjects ?? []).map(x => [x.subjectId, x.name ?? "Subject"])).entries()] : [];
  const columns: Column<Row>[] = [
    { key: "rollNumber", header: "Roll", width: 90, render: r => <span className="mono">{r.rollNumber ?? "—"}</span> },
    { key: "name", header: "Student", render: r => <strong>{studentName(r)}</strong> },
    { key: "percentage", header: periodWise ? "Periods attended" : "Attendance", render: r => <Percent value={r.percentage} bar /> },
    { key: "days", header: "Days", align: "right", render: r => <span className="nowrap">{r.attendedDays} / {r.countableDays}</span> },
    { key: "absent", header: "Absent", align: "right", render: r => r.counts.ABSENT },
    { key: "late", header: "Late", align: "right", render: r => r.counts.LATE },
    { key: "unmarked", header: "Not marked", align: "right", render: r => (r.unmarked ? <span className="muted">{r.unmarked}</span> : 0) },
    ...subjectNames.map(([id, name]) => ({
      key: `s-${id}`,
      header: name,
      align: "right" as const,
      render: (r: Row) => <Percent value={r.subjects?.find(x => x.subjectId === id)?.percentage} />
    }))
  ];

  return (
    <div className="stack">
      <Card flush>
        <div className="reg-bar">
          <Select
            label="Section"
            className="select-sm"
            value={sectionId}
            required
            onChange={e => set({ sectionId: e.target.value })}
            options={sections.options}
            placeholder={sections.isLoading ? "Loading sections…" : "Pick a section"}
          />
          <TextInput label="From" type="date" className="input-sm" value={from} max={to || todayIso()} onChange={e => set({ from: e.target.value })} error={undefined} />
          <TextInput label="To" type="date" className="input-sm" value={to} min={from} max={todayIso()} onChange={e => set({ to: e.target.value })} error={undefined} />
          <span className="small muted" style={{ alignSelf: "center", marginLeft: "auto" }}>
            {s ? `${formatDate(s.from)} – ${formatDate(s.to)}` : "Year start to today unless you pick dates"}
          </span>
        </div>
      </Card>
      <div className="kpis">
        <Kpi label="Working days" value={s ? s.workingDays : "–"} hint="School days in the range" />
        <Kpi label="Average attendance" value={s ? <Percent value={s.averagePercentage} /> : "–"} hint={periodWise ? "By periods attended" : "By days"} />
        <Kpi
          label="Mode"
          value={<span style={{ fontSize: 15 }}>{s ? (s.modes.length === 1 ? MODE_TEXT[s.modes[0]!.mode] : `${s.modes.length} modes`) : "–"}</span>}
          hint={s && s.modes.length > 1 ? s.modes.map(m => `${MODE_TEXT[m.mode]} ${formatDate(m.from)}–${formatDate(m.to)}`).join("; ") : periodWise ? `A day counts as present from ${s?.periodPresenceThreshold}% of its periods` : "From the attendance policy"}
        />
      </div>
      <Card flush>
        {sectionId ? (
          <DataTable
            rows={s?.students}
            rowKey={r => r.studentId}
            loading={summary.isLoading}
            error={summary.error}
            onRetry={() => void summary.refetch()}
            onRowClick={r => setStudent({ studentId: r.studentId, name: studentName(r), rollNumber: r.rollNumber })}
            columns={columns}
            empty={<EmptyState title="No students in this section" />}
          />
        ) : (
          <EmptyState icon={<ClipboardList />} title="Pick a section" message="Each student's attendance over the range appears here." />
        )}
      </Card>
      <StudentAttendanceDrawer student={student} from={from || undefined} to={to || undefined} onClose={() => setStudent(null)} />
    </div>
  );
}
