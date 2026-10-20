import { Fragment, useMemo } from "react";
import { TextInput } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { componentLabel, shortTime, type ExamPaper } from "../../exams/api/exams";
import type { Section } from "../../classes/api/sections";
import type { TimetableRow } from "../api/calendar";
import "./calendar.css";

/* When one subject is sat */
export type Slot = { examDate: string; startTime: string; endTime: string };

/* A subject (or one component of it) a class sits: one date and time for all its sections' papers */
export type TimetableGroup = {
  key: string;
  classId: string;
  className: string;
  classOrder: number;
  title: string;
  sectionNames: string[];
  papers: ExamPaper[];
  /* The papers' current schedule (the first paper's when its sections differ) */
  initial: Slot;
  /* The sections are sat at different times now: saving gives them one */
  differs: boolean;
};

const slotOf = (p: ExamPaper): Slot => ({ examDate: p.examDate ?? "", startTime: shortTime(p.startTime), endTime: shortTime(p.endTime) });
const sameSlot = (a: Slot, b: Slot) => a.examDate === b.examDate && a.startTime === b.startTime && a.endTime === b.endTime;

/* The exam's papers by class, then subject */
export function groupPapers(papers: ExamPaper[], sections: Map<string, Section>): TimetableGroup[] {
  const groups = new Map<string, TimetableGroup>();
  for (const p of papers) {
    const section = sections.get(p.sectionId);
    const classId = section?.classId ?? p.sectionId;
    const key = `${classId}|${p.subjectId}|${p.component ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        classId,
        className: section?.class?.className ?? "Class",
        classOrder: section?.class?.classOrder ?? 0,
        title: p.component ? `${p.subject.subjectName} · ${componentLabel(p.component)}` : p.subject.subjectName,
        sectionNames: [],
        papers: [],
        initial: slotOf(p),
        differs: false
      };
      groups.set(key, g);
    }
    g.papers.push(p);
    g.sectionNames.push(p.section.sectionName);
    if (!sameSlot(g.initial, slotOf(p))) g.differs = true;
  }
  return [...groups.values()]
    .map(g => ({ ...g, sectionNames: g.sectionNames.sort() }))
    .sort((a, b) => a.classOrder - b.classOrder || a.className.localeCompare(b.className) || a.title.localeCompare(b.title));
}

/* Every paper once, as the API takes it */
export const timetableBody = (groups: TimetableGroup[], slots: Record<string, Slot>): TimetableRow[] =>
  groups.flatMap(g => g.papers.map(p => ({ paperId: p.id, ...slots[g.key]! })));

/* Client checks, keyed `${group.key}.examDate` etc.; closed: why a date is closed ("Weekly off") */
export function validateTimetable(groups: TimetableGroup[], slots: Record<string, Slot>, closed: (date: string) => string | null) {
  const e: Record<string, string> = {};
  for (const g of groups) {
    const s = slots[g.key];
    if (!s?.examDate) e[`${g.key}.examDate`] = "Pick the day";
    else {
      const why = closed(s.examDate);
      if (why) e[`${g.key}.examDate`] = `School closed: ${why}`;
    }
    if (!s?.startTime) e[`${g.key}.startTime`] = "Start";
    if (!s?.endTime) e[`${g.key}.endTime`] = "End";
    else if (s.startTime && s.endTime <= s.startTime) e[`${g.key}.endTime`] = "After the start";
  }
  /* A class sits one subject at a time */
  const byClassDay = new Map<string, TimetableGroup[]>();
  for (const g of groups) {
    const s = slots[g.key];
    if (!s?.examDate || !s.startTime || !s.endTime) continue;
    const k = `${g.classId}|${s.examDate}`;
    for (const other of byClassDay.get(k) ?? []) {
      const o = slots[other.key]!;
      if (s.startTime < o.endTime && s.endTime > o.startTime) e[`${g.key}.startTime`] ??= `Same time as ${other.title}`;
    }
    byClassDay.set(k, [...(byClassDay.get(k) ?? []), g]);
  }
  return e;
}

/* AC-05 exam timetable: one row per subject of each class, all its sections sat together.
   A date picked on a row without times takes the times of the row above. */
export function ExamTimetableEditor({
  groups,
  slots,
  onChange,
  errors,
  min,
  max
}: {
  groups: TimetableGroup[];
  slots: Record<string, Slot>;
  onChange: (next: Record<string, Slot>) => void;
  errors: Record<string, string>;
  min?: string;
  max?: string;
}) {
  const classes = useMemo(() => {
    const out: { classId: string; className: string; groups: TimetableGroup[] }[] = [];
    for (const g of groups) {
      const last = out.at(-1);
      if (last?.classId === g.classId) last.groups.push(g);
      else out.push({ classId: g.classId, className: g.className, groups: [g] });
    }
    return out;
  }, [groups]);

  const set = (g: TimetableGroup, change: Partial<Slot>) => {
    const current = slots[g.key] ?? { examDate: "", startTime: "", endTime: "" };
    const next = { ...current, ...change };
    if (change.examDate && !current.startTime && !current.endTime) {
      const i = groups.indexOf(g);
      const above = groups.slice(0, i).reverse().map(x => slots[x.key]).find(s => s?.startTime && s.endTime);
      if (above) Object.assign(next, { startTime: above.startTime, endTime: above.endTime });
    }
    onChange({ ...slots, [g.key]: next });
  };

  return (
    <div className="exam-tt">
      <div className="exam-tt-row exam-tt-head" aria-hidden>
        <span>Subject</span>
        <span>Day</span>
        <span>Starts</span>
        <span>Ends</span>
      </div>
      {classes.map(c => (
        <Fragment key={c.classId}>
          <div className="exam-tt-class">{c.className}</div>
          {c.groups.map(g => {
            const s = slots[g.key] ?? { examDate: "", startTime: "", endTime: "" };
            return (
              <div key={g.key} className="exam-tt-row">
                <span className="exam-tt-subject">
                  <strong>{g.title}</strong>
                  <span className="small muted">
                    {g.sectionNames.length === 1 ? `Section ${g.sectionNames[0]}` : `Sections ${g.sectionNames.join(", ")}`}
                    {g.differs && " · now at different times, saving sets one"}
                  </span>
                </span>
                <TextInput
                  label="Day"
                  aria-label={`${c.className} ${g.title} day`}
                  type="date"
                  min={min}
                  max={max}
                  value={s.examDate}
                  error={errors[`${g.key}.examDate`]}
                  onChange={e => set(g, { examDate: e.target.value })}
                />
                <TextInput
                  label="Starts"
                  aria-label={`${c.className} ${g.title} start time`}
                  type="time"
                  value={s.startTime}
                  error={errors[`${g.key}.startTime`]}
                  onChange={e => set(g, { startTime: e.target.value })}
                />
                <TextInput
                  label="Ends"
                  aria-label={`${c.className} ${g.title} end time`}
                  type="time"
                  value={s.endTime}
                  error={errors[`${g.key}.endTime`]}
                  onChange={e => set(g, { endTime: e.target.value })}
                />
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/* Read-only: the timetable as it is */
export function ExamTimetableView({ groups }: { groups: TimetableGroup[] }) {
  return (
    <div className="exam-tt">
      {groups.map((g, i) => (
        <Fragment key={g.key}>
          {groups[i - 1]?.classId !== g.classId && <div className="exam-tt-class">{g.className}</div>}
          <div className="exam-tt-row exam-tt-read">
            <span className="exam-tt-subject">
              <strong>{g.title}</strong>
              <span className="small muted">Sections {g.sectionNames.join(", ")}</span>
            </span>
            <span>{g.initial.examDate ? formatDate(g.initial.examDate) : <span className="muted">No day</span>}</span>
            <span className="nowrap">{g.initial.startTime ? `${g.initial.startTime}–${g.initial.endTime}` : <span className="muted">—</span>}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
