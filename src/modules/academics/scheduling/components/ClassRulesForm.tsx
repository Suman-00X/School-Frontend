import { useMemo, useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { Button, Card, MultiSelect, Select, TextInput, type Option } from "@/common/ui";
import { hhmm } from "../../timetable/api/timetable";
import type { ClassInputs } from "../api/scheduling";
import {
  newAwayRow,
  newClosedRow,
  newSubjectRow,
  newTeacherRow,
  WEIGHTS,
  type ClassRules,
  type ClosedRow,
  type SubjectRow,
  type TeacherRow
} from "./ClassRules";

const counted = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const upTo = (max: number, label: (n: number) => string): Option[] => Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: label(i + 1) }));

const TIME_LIMITS: Option[] = [5, 10, 20, 30, 45, 60].map(s => ({
  value: String(s * 1000),
  label: `${s} seconds`,
  description: s === 20 ? "The default" : s > 20 ? "Slower, sometimes a little better" : "Faster"
}));

/* AC-07b step 2: the rules the timetable must follow. Everything is optional: with no rules each
   subject gets its classes a week from Curriculum, spread over the week. */
export function ClassRulesForm({
  rules,
  onChange,
  inputs,
  errors
}: {
  rules: ClassRules;
  onChange: (update: (prev: ClassRules) => ClassRules) => void;
  inputs: ClassInputs | undefined;
  errors: Record<string, string>;
}) {
  const [advanced, setAdvanced] = useState(false);

  const teaching = useMemo(() => (inputs?.week.periods ?? []).filter(p => !p.isBreak).sort((a, b) => a.periodNumber - b.periodNumber), [inputs]);
  const perDay = Math.max(teaching.length, 1);
  const periodOptions: Option[] = teaching.map(p => ({ value: String(p.periodNumber), label: p.name, description: `${hhmm(p.startTime)}–${hhmm(p.endTime)}` }));
  const dayOptions: Option[] = (inputs?.week.days ?? []).map(d => ({ value: String(d.weekday), label: d.name }));
  const sectionOptions: Option[] = (inputs?.sections ?? []).map(s => ({ value: s.id, label: s.name }));
  const teacherOptions: Option[] = (inputs?.teachers ?? []).map(t => ({
    value: t.teacherId,
    label: t.name ?? "Teacher",
    description: `${counted(t.periodsPerWeek, "period")} a week`
  }));
  const subjectOptions: Option[] = useMemo(() => {
    const bySubject = new Map<string, { name: string; sections: number }>();
    for (const s of inputs?.sections ?? [])
      for (const sub of s.subjects) {
        const entry = bySubject.get(sub.subjectId) ?? { name: sub.subjectName ?? "Subject", sections: 0 };
        entry.sections++;
        bySubject.set(sub.subjectId, entry);
      }
    return [...bySubject.entries()]
      .map(([value, v]) => ({ value, label: v.name, description: `Taught in ${counted(v.sections, "section")}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [inputs]);
  const limitOptions = upTo(perDay, n => counted(n, "period"));

  const setSubject = (key: string, patch: Partial<SubjectRow>) => onChange(r => ({ ...r, subjects: r.subjects.map(s => (s.key === key ? { ...s, ...patch } : s)) }));
  const setTeacher = (key: string, patch: Partial<TeacherRow>) => onChange(r => ({ ...r, teachers: r.teachers.map(t => (t.key === key ? { ...t, ...patch } : t)) }));
  const setClosed = (key: string, patch: Partial<ClosedRow>) => onChange(r => ({ ...r, closed: r.closed.map(c => (c.key === key ? { ...c, ...patch } : c)) }));
  const removeButton = (label: string, onClick: () => void) => <Button variant="ghost" size="sm" icon={<X />} aria-label={label} title={label} className="sch-row-remove" onClick={onClick} />;

  return (
    <div className="stack">
      <Card title="Teachers' day" subtitle="For every teacher; a teacher's own rule below wins">
        <div className="form-grid">
          <Select
            label="Most periods a day"
            value={rules.teacherMaxPerDay}
            onChange={e => onChange(r => ({ ...r, teacherMaxPerDay: e.target.value }))}
            options={limitOptions}
            placeholder="No limit"
          />
          <Select
            label="Most periods in a row"
            value={rules.teacherMaxConsecutive}
            onChange={e => onChange(r => ({ ...r, teacherMaxConsecutive: e.target.value }))}
            options={limitOptions}
            placeholder="No limit"
            hint="A break ends a run"
          />
        </div>
      </Card>

      <Card
        title="Subjects"
        subtitle="Doubles, a daily limit, the periods a subject should be in, a shared room"
        actions={
          <Button size="sm" icon={<Plus />} onClick={() => onChange(r => ({ ...r, subjects: [...r.subjects, newSubjectRow()] }))}>
            Add subject rule
          </Button>
        }
      >
        {rules.subjects.length === 0 ? (
          <p className="muted small">No subject rules: each subject gets its classes a week, spread over the week.</p>
        ) : (
          <div className="stack-sm">
            {rules.subjects.map(s => (
              <div key={s.key} className="sch-rule">
                <Select
                  label="Subject"
                  required
                  value={s.subjectId}
                  onChange={e => setSubject(s.key, { subjectId: e.target.value })}
                  options={subjectOptions}
                  placeholder="Pick a subject"
                  error={errors[`subjects.${s.key}.subjectId`]}
                />
                <MultiSelect
                  label="Only in"
                  value={s.sectionIds}
                  onChange={next => setSubject(s.key, { sectionIds: next })}
                  options={sectionOptions}
                  placeholder="Every section"
                  noun="sections"
                  error={undefined}
                />
                <Select
                  label="Doubles a week"
                  value={s.doublePeriods}
                  onChange={e => setSubject(s.key, { doublePeriods: e.target.value })}
                  options={upTo(5, n => counted(n, "double"))}
                  placeholder="None"
                  hint="Two periods in a row"
                />
                <Select
                  label="Most a day"
                  value={s.maxPerDay}
                  onChange={e => setSubject(s.key, { maxPerDay: e.target.value })}
                  options={upTo(Math.min(perDay, 10), n => counted(n, "period"))}
                  placeholder="Default"
                  hint="Default: spread evenly"
                />
                {removeButton("Remove this subject rule", () => onChange(r => ({ ...r, subjects: r.subjects.filter(x => x.key !== s.key) })))}
                <MultiSelect
                  label="Preferred periods"
                  value={s.preferredPeriods}
                  onChange={next => setSubject(s.key, { preferredPeriods: next })}
                  options={periodOptions}
                  placeholder="Any"
                  noun="periods"
                  hint="e.g. the morning"
                />
                <MultiSelect
                  label="Avoid periods"
                  value={s.avoidPeriods}
                  onChange={next => setSubject(s.key, { avoidPeriods: next })}
                  options={periodOptions}
                  placeholder="None"
                  noun="periods"
                  error={errors[`subjects.${s.key}.avoidPeriods`]}
                  hint="e.g. the last period"
                />
                <TextInput
                  label="Shared room"
                  maxLength={30}
                  value={s.room}
                  onChange={e => setSubject(s.key, { room: e.target.value })}
                  placeholder="e.g. Science lab"
                  error={errors[`subjects.${s.key}.room`]}
                  hint="Never two classes in it at once"
                  fieldClassName="sch-span-2"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Teacher availability"
        subtitle="Part-time days, duties, a teacher's own daily limits"
        actions={
          <Button size="sm" icon={<Plus />} onClick={() => onChange(r => ({ ...r, teachers: [...r.teachers, newTeacherRow()] }))} disabled={!teacherOptions.length}>
            Add teacher
          </Button>
        }
      >
        {rules.teachers.length === 0 ? (
          <p className="muted small">Every teacher can teach in any period they are free.</p>
        ) : (
          <div className="stack-sm">
            {rules.teachers.map(t => (
              <div key={t.key} className="sch-rule">
                <Select
                  label="Teacher"
                  required
                  value={t.teacherId}
                  onChange={e => setTeacher(t.key, { teacherId: e.target.value })}
                  options={teacherOptions}
                  placeholder="Pick a teacher"
                  error={errors[`teachers.${t.key}.teacherId`]}
                  fieldClassName="sch-span-2"
                />
                <Select label="Most a day" value={t.maxPerDay} onChange={e => setTeacher(t.key, { maxPerDay: e.target.value })} options={limitOptions} placeholder="As for everyone" />
                <Select
                  label="Most in a row"
                  value={t.maxConsecutive}
                  onChange={e => setTeacher(t.key, { maxConsecutive: e.target.value })}
                  options={limitOptions}
                  placeholder="As for everyone"
                />
                {removeButton("Remove this teacher's rules", () => onChange(r => ({ ...r, teachers: r.teachers.filter(x => x.key !== t.key) })))}
                {t.unavailable.map(u => (
                  <div key={u.key} className="sch-away">
                    <Select
                      label="Away on"
                      value={u.weekday}
                      onChange={e => setTeacher(t.key, { unavailable: t.unavailable.map(x => (x.key === u.key ? { ...x, weekday: e.target.value } : x)) })}
                      options={dayOptions}
                      placeholder="Pick a day"
                      error={errors[`teachers.${t.key}.${u.key}.weekday`]}
                    />
                    <MultiSelect
                      label="Periods"
                      value={u.periodNumbers}
                      onChange={next => setTeacher(t.key, { unavailable: t.unavailable.map(x => (x.key === u.key ? { ...x, periodNumbers: next } : x)) })}
                      options={periodOptions}
                      placeholder="The whole day"
                      noun="periods"
                      error={undefined}
                    />
                    {removeButton("Remove this time away", () => setTeacher(t.key, { unavailable: t.unavailable.filter(x => x.key !== u.key) }))}
                  </div>
                ))}
                <div className="sch-span-all">
                  <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setTeacher(t.key, { unavailable: [...t.unavailable, newAwayRow()] })}>
                    Add a time away
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Closed periods"
        subtitle="No classes then, e.g. a half-day Saturday or a weekly assembly"
        actions={
          <Button size="sm" icon={<Plus />} onClick={() => onChange(r => ({ ...r, closed: [...r.closed, newClosedRow()] }))}>
            Add closed periods
          </Button>
        }
      >
        {rules.closed.length === 0 ? (
          <p className="muted small">Every period of every school day is open for classes.</p>
        ) : (
          <div className="stack-sm">
            {rules.closed.map(c => (
              <div key={c.key} className="sch-closed">
                <Select
                  label="Day"
                  required
                  value={c.weekday}
                  onChange={e => setClosed(c.key, { weekday: e.target.value })}
                  options={dayOptions}
                  placeholder="Pick a day"
                  error={errors[`closed.${c.key}.weekday`]}
                />
                <MultiSelect
                  label="Periods"
                  value={c.periodNumbers}
                  onChange={next => setClosed(c.key, { periodNumbers: next })}
                  options={periodOptions}
                  placeholder="The whole day"
                  noun="periods"
                  error={undefined}
                />
                <MultiSelect
                  label="Sections"
                  value={c.sectionIds}
                  onChange={next => setClosed(c.key, { sectionIds: next })}
                  options={sectionOptions}
                  placeholder="Every section"
                  noun="sections"
                  error={undefined}
                />
                {removeButton("Remove these closed periods", () => onChange(r => ({ ...r, closed: r.closed.filter(x => x.key !== c.key) })))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card flush>
        <div className="accordion-item">
          <button type="button" className="accordion-trigger" aria-expanded={advanced} onClick={() => setAdvanced(a => !a)}>
            <ChevronRight className="chevron" />
            <span>Advanced</span>
            <span className="small muted" style={{ marginLeft: "auto", fontWeight: 400 }}>
              What matters most, how long to search
            </span>
          </button>
          {advanced && (
            <div className="accordion-panel stack">
              <div className="stack-sm">
                <div className="section-title">How much each wish matters (0 turns it off)</div>
                <div className="sch-weights">
                  {WEIGHTS.map(w => (
                    <TextInput
                      key={w.key}
                      label={w.label}
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      value={rules.weights[w.key]}
                      placeholder={`${w.fallback} (default)`}
                      onChange={e => onChange(r => ({ ...r, weights: { ...r.weights, [w.key]: e.target.value } }))}
                      error={errors[`weights.${w.key}`]}
                      hint={w.hint}
                    />
                  ))}
                </div>
              </div>
              <div className="sch-weights">
                <TextInput
                  label="Fresh starts"
                  type="number"
                  min={1}
                  max={40}
                  inputMode="numeric"
                  value={rules.attempts}
                  placeholder="8 (default)"
                  onChange={e => onChange(r => ({ ...r, attempts: e.target.value }))}
                  error={errors.attempts}
                  hint="More is slower, usually a little better"
                />
                <Select
                  label="Search for at most"
                  value={rules.timeLimitMs}
                  onChange={e => onChange(r => ({ ...r, timeLimitMs: e.target.value }))}
                  options={TIME_LIMITS}
                  placeholder="20 seconds (default)"
                />
                <TextInput
                  label="Seed"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={rules.seed}
                  placeholder="A new one each time"
                  onChange={e => onChange(r => ({ ...r, seed: e.target.value }))}
                  error={errors.seed}
                  hint="Same seed and rules: the same timetable"
                />
              </div>
              {rules.pinned.length > 0 && (
                <div className="row-between small">
                  <span>
                    {counted(rules.pinned.length, "class is", "classes are")} pinned to a fixed time by the earlier rules.
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => onChange(r => ({ ...r, pinned: [] }))}>
                    Unpin all
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
