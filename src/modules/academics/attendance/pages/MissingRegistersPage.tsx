/* AC-11 · Missing registers: registers nobody took (they count against the students), who
   answers for each, and the expected periods marked free instead. Teachers see the ones
   they answer for. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiGet, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Kpi, roleLabel, Select, TextInput, type Column } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { useTeacherOptions } from "../../classes/api/sections";
import { useMyTeaching } from "../../shared/api/teaching";
import { PageIntro } from "../../shared/components/PageIntro";
import { useSectionOptions } from "../../shared/components/SectionSelect";
import { addDays, registerKey, useLockRules, type MissingRegister, type MissingRegisters } from "../api/attendance";
import { registerLink } from "../api/paths";

const MAX_DAYS = 92;
const AS_LABEL: Record<string, string> = { CLASS_TEACHER: "Class teacher", TIMETABLED_TEACHER: "Timetabled", SUBJECT_TEACHER: "Subject teacher" };

const daysBetween = (from: string, to: string) => Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000);

type Row = MissingRegister & { first: boolean; rowId: string };

/* Rows grouped by date: the date shows on the first row of each day */
const grouped = (rows: MissingRegister[]): Row[] =>
  rows.map((r, i) => ({ ...r, first: i === 0 || rows[i - 1]!.date !== r.date, rowId: `${r.date}|${r.section.id}|${registerKey(r.kind, r.periodNumber)}` }));

export default function MissingRegistersPage() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const lock = useLockRules();
  const sections = useSectionOptions();
  const teachers = useTeacherOptions();
  const today = todayIso();
  const { params, setParams } = useListParams({ from: addDays(today, -6), to: today, sectionId: "", teacherId: "" });
  const [showFree, setShowFree] = useState(false);
  const allTeachers = !teaching.scoped;

  const span = params.from && params.to ? daysBetween(params.from, params.to) : -1;
  const valid = span >= 0 && span <= MAX_DAYS && params.to <= today;
  const q = useApiGet<MissingRegisters>(valid ? "/academics/attendance/missing-registers" : null, {
    from: params.from,
    to: params.to,
    sectionId: params.sectionId,
    teacherId: allTeachers ? params.teacherId : ""
  });
  const d = q.data;
  const canRecord = can("academics.attendance.record") && !readOnly;

  const takeNow = (r: Row) => {
    const locked = lock.isLocked(r.date, today);
    const blocked = locked && !lock.canOverride;
    const title = blocked ? `Locked after ${formatDate(lock.editableUntil(r.date))}: only ${lock.policy?.overrideRoles.map(roleLabel).join(" or ")} can take it now` : undefined;
    if (!canRecord) return null;
    return blocked ? (
      <span title={title}>
        <Button size="sm" disabled>
          Take now
        </Button>
      </span>
    ) : (
      <Link className="btn btn-sm" to={registerLink(r.section.id, r.date, registerKey(r.kind, r.periodNumber))} title={locked ? "Locked: you'll be asked for the reason" : undefined}>
        Take now
      </Link>
    );
  };

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", render: r => (r.first ? <span className="mr-date">{formatDate(r.date)}</span> : "") },
    { key: "section", header: "Section", render: r => r.section.name },
    { key: "label", header: "Register", render: r => <span className="nowrap">{r.label}</span> },
    { key: "subject", header: "Subject", render: r => r.subject?.subjectName ?? <span className="muted">—</span> },
    {
      key: "responsible",
      header: "Answerable",
      render: r =>
        r.responsible ? (
          <div>
            <div>{r.responsible.name}</div>
            {r.responsibleAs && <div className="small muted">{AS_LABEL[r.responsibleAs]}</div>}
          </div>
        ) : (
          <Badge tone="warning">Unassigned</Badge>
        )
    },
    { key: "reason", header: "Why", render: r => <span className="small">{r.free ? `Free: ${r.free.reason}` : r.reason}</span> },
    { key: "actions", header: "", align: "right", render: r => (r.free ? null : takeNow(r)) }
  ];

  const filtersBar = (
    <div className="filter-bar">
      <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || today} onChange={e => setParams({ from: e.target.value })} />
      <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from} max={today} onChange={e => setParams({ to: e.target.value })} />
      <Select label="Section" className="select-sm" value={params.sectionId} onChange={e => setParams({ sectionId: e.target.value })} options={sections.options} placeholder="All sections" />
      {allTeachers && teachers.enabled && (
        <Select label="Teacher" className="select-sm" value={params.teacherId} onChange={e => setParams({ teacherId: e.target.value })} options={teachers.options} placeholder="All teachers" />
      )}
    </div>
  );

  const rows = d ? grouped(d.registers) : undefined;
  const byTeacher = allTeachers && (
    <Card flush title="By teacher" subtitle="Most missed first; click to filter">
      {!d ? (
        <div style={{ padding: 14 }} className="small muted">
          {valid ? "Loading…" : "Pick a range"}
        </div>
      ) : d.byTeacher.length === 0 ? (
        <div style={{ padding: 14 }} className="small muted">
          Nobody has a missing register.
        </div>
      ) : (
        <div className="mr-teachers">
          {d.byTeacher.map(t => (
            <button
              key={t.teacherId}
              type="button"
              className={`mr-teacher${params.teacherId === t.teacherId ? " is-active" : ""}`}
              onClick={() => setParams({ teacherId: params.teacherId === t.teacherId ? "" : t.teacherId })}
            >
              <span className="mr-teacher-name">{t.name}</span>
              <Badge tone="danger">{t.missing}</Badge>
            </button>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="stack">
      <PageIntro>
        {teaching.scoped
          ? "Registers you have not taken. Each one counts against the students until it is taken."
          : "Registers nobody took, and who answers for each. They count against the students until taken."}
      </PageIntro>
      <div className="kpis">
        <Kpi label={teaching.scoped ? "Registers you have not taken" : "Missing registers"} value={d ? d.total : "–"} hint={d ? `${formatDate(d.from)} – ${formatDate(d.to)}` : "In the range"} />
        <Kpi label="Unassigned" value={d ? d.unassigned : "–"} hint="Nobody with an active account answers for them" />
        <Kpi label="Marked free" value={d ? d.freePeriods.length : "–"} hint="Expected periods with no register due" />
      </div>
      <div className={allTeachers ? "mr-layout" : undefined}>
        <Card flush>
          {filtersBar}
          <DataTable
            rows={valid ? rows : []}
            rowKey={r => r.rowId}
            loading={q.isLoading}
            error={q.error}
            onRetry={() => void q.refetch()}
            columns={columns}
            empty={
              !valid ? (
                <EmptyState icon={<CalendarRange />} title="Pick a range of up to 92 days" message="From must be on or before To, and To no later than today." />
              ) : (
                <EmptyState
                  icon={<CheckCircle2 />}
                  title="Every register was taken"
                  message={d ? `Nothing is missing from ${formatDate(d.from)} to ${formatDate(d.to)}${params.sectionId || params.teacherId ? " for this filter" : ""}.` : undefined}
                />
              )
            }
          />
        </Card>
        {byTeacher}
      </div>
      {d && d.freePeriods.length > 0 && (
        <Card flush>
          <button type="button" className="mr-teacher" style={{ width: "100%" }} onClick={() => setShowFree(v => !v)} aria-expanded={showFree}>
            {showFree ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="mr-teacher-name">
              <strong>Marked free</strong> <span className="muted small">· expected periods with no register due</span>
            </span>
            <Badge>{d.freePeriods.length}</Badge>
          </button>
          {showFree && <DataTable rows={grouped(d.freePeriods)} rowKey={r => r.rowId} columns={columns.filter(c => c.key !== "actions")} />}
        </Card>
      )}
    </div>
  );
}
