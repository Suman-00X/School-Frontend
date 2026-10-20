/* AC-20 · Diary: a section's daily diary. Teachers write the day's classwork, homework,
   reminders and notes (to the whole class or one family); online homework set that day shows
   beside them. Parents sign each day in the app, optionally with a note back; the class
   teacher sees who signed. */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCheck, Clock, MessageSquareText, PenLine, Plus } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Page, Select, SkeletonBlock, Tabs, type Column } from "@/common/ui";
import { formatDateTime, todayIso } from "@/common/utils/format";
import { useMyTeaching } from "../../shared/api/teaching";
import { PageIntro } from "../../shared/components/PageIntro";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import {
  dayLabel,
  shiftDate,
  useDiarySignatures,
  useSectionDiaryDay,
  useSectionDiaryDays,
  weekStart,
  type DiaryEntry,
  type SignatureRow
} from "../api/diary";
import { DateNav, DiaryLines, NoLines } from "../components/DiaryLines";
import { DiaryEntryDrawer } from "../components/DiaryEntryDrawer";

const SIGNATURE_TABS = [
  { id: "", label: "All" },
  { id: "unsigned", label: "Not signed" },
  { id: "notes", label: "With a note" }
];

export default function DiaryPage() {
  const { can } = useAuth();
  const { selected: year, readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const sections = useSectionOptions();
  const [search, setSearch] = useSearchParams();
  const [open, setOpen] = useState<{ entry: DiaryEntry | null } | null>(null);
  const [signatureTab, setSignatureTab] = useState("");

  const today = todayIso();
  const minDate = year?.startDate;
  const maxDate = year && year.endDate < today ? year.endDate : today;
  const clamp = (d: string) => (minDate && d < minDate ? minDate : maxDate && d > maxDate ? maxDate : d);

  const sectionOptions = teaching.scoped ? sections.options.filter(o => teaching.teaches(o.value)) : sections.options;
  /* A teacher starts on the section they lead, else the first they teach */
  const fallbackSection = (teaching.scoped && teaching.sections.find(s => s.isClassTeacher)?.sectionId) || sectionOptions[0]?.value || "";
  const sectionId = search.get("sectionId") || fallbackSection;
  const date = clamp(search.get("date") || today);

  const set = (changes: Record<string, string>) =>
    setSearch(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
      return next;
    }, { replace: true });

  /* Keep the URL on a section the person can open */
  useEffect(() => {
    if (!sections.isLoading && sectionId && sectionOptions.length && !sectionOptions.some(o => o.value === sectionId)) set({ sectionId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.isLoading, sectionId, sectionOptions.length]);

  const monday = weekStart(date);
  const day = useSectionDiaryDay(sectionId, date);
  const week = useSectionDiaryDays(sectionId, monday, shiftDate(monday, 6));
  const signatures = useDiarySignatures(sectionId, date);

  const section = sections.byId.get(sectionId);
  const sectionName = section ? sectionTitle(section) : "";
  const canWrite = can("academics.diary.write") && !readOnly && !!sectionId && teaching.teaches(sectionId);
  const students = useMemo(
    () => (signatures.data ?? []).map(r => ({ value: r.studentId, label: `${r.rollNumber ? `${r.rollNumber}. ` : ""}${r.firstName} ${r.lastName}`.trim() })),
    [signatures.data]
  );

  const writeButton = canWrite && (
    <Button variant="primary" icon={<Plus />} onClick={() => setOpen({ entry: null })}>
      Write in the diary
    </Button>
  );

  if (!sections.isLoading && !sectionOptions.length)
    return (
      <Page>
        <EmptyState icon={<PenLine />} title="No sections to show" message={teaching.scoped ? "You don't teach a section this year." : "Add sections for this year first."} />
      </Page>
    );

  return (
    <Page>
      <PageIntro actions={writeButton}>
        The day's classwork, homework, reminders and notes for a section. Parents read and sign it in the app.
      </PageIntro>
      <Card>
        <div className="stack">
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Select label="Section" className="select-sm" value={sectionId} onChange={e => set({ sectionId: e.target.value })} options={sectionOptions} placeholder={sections.isLoading ? "Loading sections…" : "Pick a section"} required />
            <DateNav value={date} min={minDate} max={maxDate} onChange={d => set({ date: d === today ? "" : d })} />
          </div>
          <WeekStrip monday={monday} selected={date} maxDate={maxDate} minDate={minDate} days={week.data} onPick={d => set({ date: d === today ? "" : d })} />
        </div>
      </Card>

      <div className="dy-layout">
        <Card title={dayLabel(date)} subtitle={sectionName}>
          {day.error ? (
            <ErrorState error={day.error} onRetry={() => void day.refetch()} />
          ) : !day.data ? (
            <SkeletonBlock lines={6} />
          ) : (
            <DiaryLines
              entries={day.data.entries}
              homework={day.data.homework}
              showStudent
              onEntryClick={entry => setOpen({ entry })}
              homeworkHref={h => `/academics/homework/${h.id}`}
              empty={<NoLines message={canWrite ? "Write what was done in class, homework, and anything families should know." : "No teacher has written in the diary for this day."} actions={writeButton} />}
            />
          )}
        </Card>
        <Card
          title="Signed by parents"
          subtitle={day.data ? `${day.data.signatures.signed} of ${day.data.signatures.students} · ${day.data.signatures.notes} with a note` : undefined}
          flush
        >
          <div style={{ padding: "0 14px" }}>
            <Tabs tabs={SIGNATURE_TABS} value={signatureTab} onChange={setSignatureTab} />
          </div>
          <SignatureTable rows={signatures.data} loading={signatures.isLoading} error={signatures.error} onRetry={() => void signatures.refetch()} tab={signatureTab} />
        </Card>
      </div>

      {sectionId && (
        <DiaryEntryDrawer open={!!open} entry={open?.entry ?? null} sectionId={sectionId} sectionName={sectionName} date={date} students={students} onClose={() => setOpen(null)} />
      )}
    </Page>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* The selected week, one chip per day: how many lines were written and how many families signed */
function WeekStrip({
  monday,
  selected,
  minDate,
  maxDate,
  days,
  onPick
}: {
  monday: string;
  selected: string;
  minDate?: string;
  maxDate?: string;
  days: { date: string; entries: number; signed: number }[] | undefined;
  onPick: (date: string) => void;
}) {
  const byDate = new Map((days ?? []).map(d => [d.date, d]));
  return (
    <div className="dy-week">
      {WEEKDAYS.map((name, i) => {
        const date = shiftDate(monday, i);
        const info = byDate.get(date);
        const outside = (!!minDate && date < minDate) || (!!maxDate && date > maxDate);
        return (
          <button key={date} type="button" className={`dy-chip${date === selected ? " is-selected" : ""}`} disabled={outside} onClick={() => onPick(date)}>
            <span className="dy-chip-day">{name}</span>
            <span className="dy-chip-date">{Number(date.slice(8))}</span>
            <span className={`dy-chip-meta${info?.entries ? " has-lines" : ""}`}>
              {info?.entries ? `${info.entries} line${info.entries === 1 ? "" : "s"}` : "—"}
              {info?.signed ? ` · ${info.signed}✓` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SignatureTable({ rows, loading, error, onRetry, tab }: { rows: SignatureRow[] | undefined; loading: boolean; error: unknown; onRetry: () => void; tab: string }) {
  const shown = (rows ?? []).filter(r => (tab === "unsigned" ? !r.signature : tab === "notes" ? !!r.signature?.parentNote : true));
  const columns: Column<SignatureRow>[] = [
    { key: "roll", header: "Roll", width: 56, render: r => r.rollNumber || "—" },
    {
      key: "student",
      header: "Student",
      render: r => (
        <div style={{ minWidth: 0 }}>
          <div>
            {r.firstName} {r.lastName}
          </div>
          {r.signature?.parentNote && (
            <div className="small row" style={{ gap: 4, alignItems: "flex-start", color: "var(--text-2)" }}>
              <MessageSquareText size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span className="dy-note">{r.signature.parentNote}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: "signed",
      header: "Parent",
      render: r =>
        !r.signature ? (
          <Badge>
            <Clock size={12} /> Not yet
          </Badge>
        ) : r.changedSinceSigned ? (
          <span title={`Signed ${formatDateTime(r.signature.signedAt)}, before the diary changed`}>
            <Badge tone="warning">Signed before a change</Badge>
          </span>
        ) : (
          <span title={`${r.signature.signer ? `${r.signature.signer.firstName} ${r.signature.signer.lastName}, ` : ""}${formatDateTime(r.signature.signedAt)}`}>
            <Badge tone="success">
              <CheckCheck size={12} /> Signed
            </Badge>
          </span>
        )
    }
  ];
  return (
    <DataTable
      rows={loading && !rows ? undefined : shown}
      rowKey={r => r.studentId}
      loading={loading}
      error={error}
      onRetry={onRetry}
      columns={columns}
      empty={
        <EmptyState
          title={tab === "unsigned" ? "Every family has signed" : tab === "notes" ? "No notes from parents" : "No students in the section"}
          message={tab ? "Nothing to show for this day." : "Students enrolled in the section show here."}
        />
      }
    />
  );
}
