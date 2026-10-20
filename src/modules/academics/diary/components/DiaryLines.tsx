import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, Laptop, Lock } from "lucide-react";
import { Badge, Button, EmptyState, TextInput } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { DIARY_KIND_OF, dayLabel, shiftDate, type DiaryEntry, type DiaryHomework } from "../api/diary";
import "./diary.css";

const personName = (p: DiaryEntry["writer"]) => (p ? `${p.firstName} ${p.lastName}`.trim() : "A teacher");

/* Classwork first, then homework, reminders and notes */
const ORDER = { CLASSWORK: 0, HOMEWORK: 1, REMINDER: 2, NOTE: 3 } as const;
const byKind = (a: DiaryEntry, b: DiaryEntry) => ORDER[a.kind] - ORDER[b.kind] || a.createdAt.localeCompare(b.createdAt);

/* A day of the diary, the way a printed school diary reads: lines for the whole section,
   then each subject's classwork and homework, online homework set that day, and notes to
   single families. Shared by the staff page (AC-20) and the portal (PO-15). */
export function DiaryLines({
  entries,
  homework,
  onEntryClick,
  homeworkHref,
  showStudent,
  empty
}: {
  entries: DiaryEntry[];
  homework: DiaryHomework[];
  onEntryClick?: (entry: DiaryEntry) => void;
  homeworkHref?: (h: DiaryHomework) => string;
  /* Staff: name the student a private note is for */
  showStudent?: boolean;
  empty: ReactNode;
}) {
  if (!entries.length && !homework.length) return <>{empty}</>;
  const general = entries.filter(e => !e.subjectId && !e.studentId).sort(byKind);
  const personal = entries.filter(e => e.studentId).sort(byKind);
  const subjects = new Map<string, { name: string; lines: DiaryEntry[] }>();
  for (const e of entries.filter(e => e.subjectId && !e.studentId)) {
    const group = subjects.get(e.subjectId!) ?? { name: e.subject?.subjectName ?? "Subject", lines: [] };
    group.lines.push(e);
    subjects.set(e.subjectId!, group);
  }
  const subjectGroups = [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name));
  const line = (e: DiaryEntry) => <Line key={e.id} entry={e} onClick={onEntryClick} showStudent={showStudent} />;

  return (
    <div className="dy-day">
      {general.length > 0 && (
        <section className="dy-group">
          <h3 className="dy-group-title">For everyone</h3>
          <ul className="dy-lines">{general.map(line)}</ul>
        </section>
      )}
      {subjectGroups.map(g => (
        <section key={g.name} className="dy-group">
          <h3 className="dy-group-title">
            <BookOpen size={15} /> {g.name}
          </h3>
          <ul className="dy-lines">{g.lines.sort(byKind).map(line)}</ul>
        </section>
      ))}
      {homework.length > 0 && (
        <section className="dy-group">
          <h3 className="dy-group-title">
            <Laptop size={15} /> Online homework set today
          </h3>
          <ul className="dy-lines">
            {homework.map(h => (
              <li key={h.id} className="dy-line">
                <Badge tone="primary">Homework</Badge>
                <div className="dy-line-body">
                  {homeworkHref ? <Link to={homeworkHref(h)}>{h.title}</Link> : h.title}
                  <div className="small muted">
                    {h.subject?.subjectName ?? "—"} · due {formatDate(h.dueDate)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {personal.length > 0 && (
        <section className="dy-group">
          <h3 className="dy-group-title">
            <Lock size={15} /> {showStudent ? "Notes to one family" : "Notes for your family"}
          </h3>
          <ul className="dy-lines">{personal.map(line)}</ul>
        </section>
      )}
    </div>
  );
}

function Line({ entry: e, onClick, showStudent }: { entry: DiaryEntry; onClick?: (e: DiaryEntry) => void; showStudent?: boolean }) {
  const kind = DIARY_KIND_OF[e.kind];
  const content = (
    <>
      <Badge tone={kind.tone}>{kind.label}</Badge>
      <div className="dy-line-body">
        {showStudent && e.student && (
          <div className="small dy-for">
            To the family of {e.student.user.firstName} {e.student.user.lastName}
          </div>
        )}
        <p className="dy-text">{e.body}</p>
        <div className="small muted">
          {personName(e.writer)}
          {e.studentId && e.subject ? ` · ${e.subject.subjectName}` : ""}
          {new Date(e.updatedAt).getTime() - new Date(e.createdAt).getTime() > 1000 ? " · edited" : ""}
        </div>
      </div>
    </>
  );
  return (
    <li className="dy-line">
      {onClick ? (
        <button type="button" className="dy-line-button" onClick={() => onClick(e)} title={e.canEdit ? "Edit this line" : "Open this line"}>
          {content}
        </button>
      ) : (
        content
      )}
    </li>
  );
}

/* ‹ date › and Today, kept inside [min, max] */
export function DateNav({ value, onChange, min, max }: { value: string; onChange: (date: string) => void; min?: string; max?: string }) {
  const today = todayIso();
  const clamp = (d: string) => (min && d < min ? min : max && d > max ? max : d);
  return (
    <div className="dy-datenav">
      <Button size="sm" variant="ghost" icon={<ChevronLeft />} aria-label="Previous day" disabled={!!min && value <= min} onClick={() => onChange(clamp(shiftDate(value, -1)))} />
      <TextInput aria-label="Day" type="date" className="input-sm" value={value} min={min} max={max} onChange={e => e.target.value && onChange(clamp(e.target.value))} />
      <Button size="sm" variant="ghost" icon={<ChevronRight />} aria-label="Next day" disabled={!!max && value >= max} onClick={() => onChange(clamp(shiftDate(value, 1)))} />
      <Button size="sm" disabled={value === clamp(today)} onClick={() => onChange(clamp(today))}>
        Today
      </Button>
      <span className="dy-dayname">{dayLabel(value)}</span>
    </div>
  );
}

export const NoLines = ({ message, actions }: { message: string; actions?: ReactNode }) => (
  <EmptyState icon={<BookOpen />} title="Nothing written for this day" message={message} actions={actions} />
);
