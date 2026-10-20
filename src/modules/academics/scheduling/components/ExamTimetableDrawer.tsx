import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, History, Plus, RefreshCw, SlidersHorizontal, Trash2, X } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Badge, Button, Checkbox, Drawer, ErrorState, Field, Kpi, MultiSelect, RadioGroup, Select, SkeletonBlock, TextInput, useConfirm, useToast, type Option } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { componentLabel, EXAMS_PATH, useExamPapers, type Exam, type ExamPaper } from "../../exams/api/exams";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import {
  applyRun,
  discardRun,
  generateExamTimetable,
  runPath,
  SCHEDULING_PATH,
  useRuns,
  withoutSeed,
  type ExamAlign,
  type ExamRequest,
  type ExamRun,
  type ExamSpread
} from "../api/scheduling";
import { seconds } from "../utils/links";
import { AgentBadge, IssueList, Reasons, RunStatusBadge } from "./RunBits";
import "./scheduling.css";

type SittingRow = { key: string; name: string; startTime: string; endTime: string };

type Values = {
  startDate: string;
  endDate: string;
  sessions: SittingRow[];
  maxPapersPerDay: string;
  minGapDays: string;
  align: ExamAlign;
  spread: ExamSpread;
  restDayBefore: string[];
  keepScheduled: boolean;
  /* Not edited here: carried over from an earlier draft's rules */
  carried: Pick<ExamRequest, "durations" | "avoidDates">;
};

let seq = 0;
const sittingRow = (s: { name: string; startTime: string; endTime: string }): SittingRow => ({ key: `s${++seq}`, ...s });

const ALIGN_OPTIONS: { value: ExamAlign; label: string; description: string }[] = [
  { value: "CLASS", label: "By class", description: "Every section of a class sits a subject together: one question paper" },
  { value: "SCHOOL", label: "Whole school", description: "Every section sits a subject at the same time" },
  { value: "NONE", label: "Each section on its own", description: "Sections' papers are placed independently" }
];

const SPREAD_OPTIONS: { value: ExamSpread; label: string; description: string }[] = [
  { value: "EVEN", label: "Spread out", description: "Each section's papers over the whole window" },
  { value: "COMPACT", label: "Finish early", description: "As few days as possible from the start" }
];

const SITTING_NAMES: Option[] = ["Morning", "Midday", "Afternoon", "Evening"].map(n => ({ value: n, label: n }));
const GAP_OPTIONS: Option[] = [0, 1, 2, 3, 4, 5].map(n => ({
  value: String(n),
  label: n === 0 ? "None" : `${n} school day${n === 1 ? "" : "s"}`,
  description: n === 0 ? "Papers on back-to-back days" : undefined
}));

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
const isScheduled = (p: ExamPaper) => !!(p.examDate && p.startTime && p.endTime);

const valuesFor = (exam: Exam, request?: ExamRequest): Values => ({
  startDate: request?.startDate ?? exam.startDate ?? "",
  endDate: request?.endDate ?? exam.endDate ?? "",
  sessions: (request?.sessions?.length ? request.sessions : [{ name: "Morning", startTime: "09:30", endTime: "12:30" }]).map(sittingRow),
  maxPapersPerDay: String(request?.maxPapersPerDay ?? 1),
  minGapDays: String(request?.minGapDays ?? 0),
  align: request?.align ?? "CLASS",
  spread: request?.spread ?? "EVEN",
  restDayBefore: request?.restDayBefore ?? [],
  keepScheduled: request?.keepScheduled ?? false,
  carried: { durations: request?.durations, avoidDates: request?.avoidDates }
});

/* AC-13 › Generate timetable: plan the exam's papers over its days (sittings a day, papers a day,
   free days between, which sections sit together), look at the draft date by date, then apply it.
   Applying sets every paper's date and time through the exam's calendar event. */
export function ExamTimetableDrawer({ open, exam, onClose }: { open: boolean; exam: Exam; onClose: () => void }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const toast = useToast();
  const confirm = useConfirm();
  const papers = useExamPapers(open ? exam.id : null);
  const { byId: sectionsById } = useSectionOptions(open);
  const latest = useRuns({ kind: "EXAM_TIMETABLE", examId: exam.id, limit: 1 }, { enabled: open, academicYearId: exam.academicYearId });
  const [values, setValues] = useState<Values>(() => valuesFor(exam));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const run = useApiGet<ExamRun>(runId ? runPath(runId) : null);
  const invalidate = [SCHEDULING_PATH, EXAMS_PATH, "/academics/calendar"];
  const generate = useApiMutation(generateExamTimetable, { invalidate: [SCHEDULING_PATH] });
  const apply = useApiMutation(applyRun, { invalidate });
  const discard = useApiMutation(discardRun, { invalidate: [SCHEDULING_PATH] });
  const canApply = can("academics.scheduling.apply") && !readOnly;
  const canGenerate = can("academics.scheduling.generate") && !readOnly;

  useEffect(() => {
    if (!open) return;
    setValues(valuesFor(exam));
    setErrors({});
    setStatus(null);
    setRunId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam.id]);

  const paperById = useMemo(() => new Map((papers.data ?? []).map(p => [p.id, p])), [papers.data]);
  const subjectOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const p of papers.data ?? []) names.set(p.subjectId, p.subject.subjectName);
    return [...names.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [papers.data]);
  const scheduled = (papers.data ?? []).filter(isScheduled).length;
  const sectionName = useCallback(
    (p: ExamPaper) => {
      const s = sectionsById.get(p.sectionId);
      return s ? sectionTitle(s) : `Section ${p.section.sectionName}`;
    },
    [sectionsById]
  );

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues(v => ({ ...v, [key]: value }));
  const setSitting = (key: string, patch: Partial<SittingRow>) => setValues(v => ({ ...v, sessions: v.sessions.map(s => (s.key === key ? { ...s, ...patch } : s)) }));
  const removeSitting = (key: string) =>
    setValues(v => {
      const sessions = v.sessions.filter(s => s.key !== key);
      return { ...v, sessions, maxPapersPerDay: String(Math.min(Number(v.maxPapersPerDay), sessions.length)) };
    });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.startDate) e.startDate = exam.startDate ? "Pick the first day" : "The exam has no dates: pick the first day";
    if (!values.endDate) e.endDate = exam.endDate ? "Pick the last day" : "The exam has no dates: pick the last day";
    if (values.startDate && values.endDate && values.endDate < values.startDate) e.endDate = "On or after the first day";
    values.sessions.forEach((s, i) => {
      if (!s.name.trim()) e[`sessions.${s.key}.name`] = "Name the sitting";
      if (!s.startTime) e[`sessions.${s.key}.startTime`] = "Pick the start";
      if (!s.endTime) e[`sessions.${s.key}.endTime`] = "Pick the end";
      else if (s.startTime && s.endTime <= s.startTime) e[`sessions.${s.key}.endTime`] = "After the start";
      const before = values.sessions[i - 1];
      if (before?.endTime && s.startTime && s.startTime < before.endTime) e[`sessions.${s.key}.startTime`] = `After ${before.name || "the sitting before"} ends`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const requestOf = (): ExamRequest => ({
    examId: exam.id,
    startDate: values.startDate,
    endDate: values.endDate,
    sessions: values.sessions.map(s => ({ name: s.name.trim(), startTime: s.startTime, endTime: s.endTime })),
    maxPapersPerDay: Number(values.maxPapersPerDay),
    minGapDays: Number(values.minGapDays),
    align: values.align,
    spread: values.spread,
    restDayBefore: values.restDayBefore,
    keepScheduled: values.keepScheduled,
    ...(values.carried.durations?.length && { durations: values.carried.durations }),
    ...(values.carried.avoidDates?.length && { avoidDates: values.carried.avoidDates })
  });

  const send = (body: ExamRequest) => {
    setStatus(null);
    generate.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        setRunId(res.data.id);
      },
      onError: err => setStatus(errorMessage(err))
    });
  };

  const fail = (err: unknown) => {
    setStatus(errorMessage(err));
    toast.error(err);
  };

  const r = run.data;

  const askApply = async () => {
    if (!r) return;
    setStatus(null);
    const { changes } = r.report;
    const ok = await confirm({
      title: `Apply this timetable to ${exam.examName}?`,
      message: `Sets the date and time of ${plural(changes.schedule, "paper")}${changes.keep ? `; ${plural(changes.keep, "paper keeps its", "papers keep theirs")}` : ""}, through the exam's calendar event.${
        r.request.keepScheduled ? "" : " Dates and times set before are replaced."
      }`,
      confirmLabel: "Apply",
      tone: "primary"
    });
    if (!ok) return;
    apply.mutate(
      { runId: r.id },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: fail
      }
    );
  };

  const askDiscard = async () => {
    if (!r) return;
    setStatus(null);
    const ok = await confirm({ title: "Discard this draft?", message: `${r.summary}. The exam's papers don't change.`, confirmLabel: "Discard draft" });
    if (!ok) return;
    discard.mutate(r.id, {
      onSuccess: res => {
        toast.success(res.message);
        setRunId(null);
      },
      onError: fail
    });
  };

  const last = latest.data?.[0] as ExamRun | undefined;
  const busy = generate.isPending || apply.isPending || discard.isPending;

  /* ---------- the draft ---------- */
  if (runId) {
    const incomplete = r && !r.report.score.complete;
    const isDraft = r?.status === "DRAFT";
    const footerStatus = status ?? (incomplete && isDraft ? `Only a complete draft can be applied: ${r.report.score.requiredPapers - r.report.score.placedPapers} papers have no date.` : null);
    return (
      <Drawer
        open={open}
        onClose={onClose}
        wide
        title={`Exam timetable · ${exam.examName}`}
        subtitle={r ? `Generated ${formatDateTime(r.createdAt)} · seed ${r.seed}` : "Draft"}
        footerStatus={footerStatus}
        footer={
          <>
            {canGenerate && (
              <Button
                icon={<SlidersHorizontal />}
                disabled={!r || busy}
                onClick={() => {
                  if (r) setValues(valuesFor(exam, r.request));
                  setStatus(null);
                  setRunId(null);
                }}
              >
                Change rules
              </Button>
            )}
            {canApply && isDraft && (
              <Button variant="ghost" icon={<Trash2 />} onClick={() => void askDiscard()} loading={discard.isPending} disabled={busy && !discard.isPending}>
                Discard
              </Button>
            )}
            {canGenerate && (
              <Button icon={<RefreshCw />} disabled={!r || (busy && !generate.isPending)} loading={generate.isPending} onClick={() => r && send(withoutSeed(r.request))} title="Same rules, a new search">
                Try another
              </Button>
            )}
            {canApply && (
              <Button variant="primary" icon={<Check />} disabled={!r || !isDraft || !!incomplete || (busy && !apply.isPending)} loading={apply.isPending} onClick={() => void askApply()}>
                Apply
              </Button>
            )}
          </>
        }
      >
        {run.error ? (
          <ErrorState error={run.error} onRetry={() => void run.refetch()} />
        ) : !r || papers.isLoading ? (
          <SkeletonBlock lines={10} />
        ) : (
          <ExamDraft run={r} paperById={paperById} sectionName={sectionName} />
        )}
      </Drawer>
    );
  }

  /* ---------- the rules ---------- */
  const sittingCount = values.sessions.length;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={`Generate a timetable for ${exam.examName}`}
      subtitle={`${plural(papers.data?.length ?? 0, "paper")} to place · nothing changes until you apply the draft`}
      footerStatus={generate.isPending ? <span className="muted">Searching for a timetable…</span> : status}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={<CalendarClock />}
            loading={generate.isPending}
            disabled={!canGenerate || !papers.data?.length}
            onClick={() => {
              if (validate()) send(requestOf());
              else setStatus("Check the fields marked in red.");
            }}
          >
            Generate draft
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={e => e.preventDefault()} noValidate>
        {last && (
          <div className="sch-last">
            <span className="row" style={{ gap: 6, minWidth: 0 }}>
              <RunStatusBadge run={last} />
              <AgentBadge run={last} />
              <span className="small sch-run-summary" title={last.summary}>
                Last draft: {last.summary}
              </span>
            </span>
            <span className="row" style={{ gap: 4, flexShrink: 0 }}>
              <Button size="sm" variant="ghost" icon={<History />} onClick={() => setValues(valuesFor(exam, last.request))}>
                Use its rules
              </Button>
              {last.status === "DRAFT" && (
                <Button size="sm" onClick={() => setRunId(last.id)}>
                  Open
                </Button>
              )}
            </span>
          </div>
        )}
        <div className="form-grid">
          <TextInput
            label="First day"
            type="date"
            required
            value={values.startDate}
            onChange={e => set("startDate", e.target.value)}
            error={errors.startDate}
            hint={exam.startDate ? `The exam starts ${formatDate(exam.startDate)}` : "The exam has no dates yet"}
          />
          <TextInput
            label="Last day"
            type="date"
            required
            min={values.startDate || undefined}
            value={values.endDate}
            onChange={e => set("endDate", e.target.value)}
            error={errors.endDate}
            hint="Holidays and weekly off days are skipped"
          />
        </div>

        <Field label="Sittings a day" hint="In order; a paper lasts its whole sitting">
          <div className="stack-sm">
            {values.sessions.map(s => (
              <div key={s.key} className="sch-sitting">
                <Select
                  aria-label="Sitting name"
                  creatable
                  value={s.name}
                  onChange={e => setSitting(s.key, { name: e.target.value })}
                  options={SITTING_NAMES}
                  placeholder="Name"
                  required
                  error={errors[`sessions.${s.key}.name`]}
                />
                <TextInput aria-label="Starts at" type="time" value={s.startTime} onChange={e => setSitting(s.key, { startTime: e.target.value })} error={errors[`sessions.${s.key}.startTime`]} />
                <TextInput aria-label="Ends at" type="time" value={s.endTime} onChange={e => setSitting(s.key, { endTime: e.target.value })} error={errors[`sessions.${s.key}.endTime`]} />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X />}
                  className="sch-row-remove"
                  aria-label={`Remove ${s.name || "this sitting"}`}
                  title="Remove sitting"
                  disabled={sittingCount === 1}
                  onClick={() => removeSitting(s.key)}
                />
              </div>
            ))}
            {sittingCount < 3 && (
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus />}
                  onClick={() => set("sessions", [...values.sessions, sittingRow({ name: sittingCount === 1 ? "Afternoon" : "", startTime: "", endTime: "" })])}
                >
                  Add a sitting
                </Button>
              </div>
            )}
          </div>
        </Field>

        <div className="form-grid">
          <Select
            label="Most papers a day"
            required
            value={values.maxPapersPerDay}
            onChange={e => set("maxPapersPerDay", e.target.value)}
            options={Array.from({ length: sittingCount }, (_, i) => ({ value: String(i + 1), label: plural(i + 1, "paper") }))}
            hint="For each section; at most one a sitting"
          />
          <Select label="Free days between papers" required value={values.minGapDays} onChange={e => set("minGapDays", e.target.value)} options={GAP_OPTIONS} hint="For each section" />
        </div>

        <Field label="Who sits a subject together">
          <RadioGroup aria-label="Who sits a subject together" options={ALIGN_OPTIONS} value={values.align} onChange={v => set("align", v)} />
        </Field>
        <Field label="Over the window">
          <RadioGroup aria-label="Over the window" options={SPREAD_OPTIONS} value={values.spread} onChange={v => set("spread", v)} />
        </Field>

        <MultiSelect
          label="A free day before"
          value={values.restDayBefore}
          onChange={next => set("restDayBefore", next)}
          options={subjectOptions}
          placeholder="No subject"
          noun="subjects"
          hint="Subjects that should have a free school day before them, when possible"
        />
        <Checkbox
          label={scheduled ? `Keep the ${plural(scheduled, "paper")} that already have a date and time` : "Keep papers that already have a date and time (none yet)"}
          checked={values.keepScheduled}
          disabled={!scheduled}
          onChange={e => set("keepScheduled", e.target.checked)}
        />
      </form>
    </Drawer>
  );
}

/* The draft by date → sitting → subject → sections */
function ExamDraft({ run, paperById, sectionName }: { run: ExamRun; paperById: Map<string, ExamPaper>; sectionName: (p: ExamPaper) => string }) {
  const { score, issues, unplaced, changes, stats, window: span } = run.report;

  const days = useMemo(() => {
    type Subject = { key: string; title: string; time: string; sections: string[]; kept: boolean };
    type Sitting = { key: string; name: string; time: string; subjects: Map<string, Subject> };
    const byDate = new Map<string, Map<string, Sitting>>();
    for (const row of run.result?.rows ?? []) {
      const paper = paperById.get(row.paperId);
      const sittingKey = row.session ?? row.startTime;
      const named = run.request.sessions?.find(s => s.name === row.session);
      if (!byDate.has(row.examDate)) byDate.set(row.examDate, new Map());
      const sittings = byDate.get(row.examDate)!;
      if (!sittings.has(sittingKey))
        sittings.set(sittingKey, {
          key: sittingKey,
          name: row.session ?? (row.kept ? "Already scheduled" : "Sitting"),
          time: named ? `${named.startTime}–${named.endTime}` : `${hhmm(row.startTime)}–${hhmm(row.endTime)}`,
          subjects: new Map()
        });
      const sitting = sittings.get(sittingKey)!;
      const title = paper ? `${paper.subject.subjectName}${paper.component ? ` · ${componentLabel(paper.component)}` : ""}` : "Paper";
      const time = `${hhmm(row.startTime)}–${hhmm(row.endTime)}`;
      const key = `${paper?.subjectId ?? row.paperId}|${paper?.component ?? ""}|${time}|${row.kept ? 1 : 0}`;
      const subject = sitting.subjects.get(key) ?? { key, title, time: time === sitting.time ? "" : time, sections: [], kept: !!row.kept };
      subject.sections.push(paper ? sectionName(paper) : "A section");
      sitting.subjects.set(key, subject);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, sittings]) => ({
        date,
        sittings: [...sittings.values()]
          .sort((a, b) => a.time.localeCompare(b.time))
          .map(s => ({ ...s, subjects: [...s.subjects.values()].sort((a, b) => a.title.localeCompare(b.title)) }))
      }));
  }, [run, paperById, sectionName]);

  const weekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8 }}>
        <strong>{run.summary}</strong>
        <RunStatusBadge run={run} />
        <AgentBadge run={run} />
      </div>
      <div className="kpis">
        <Kpi label="Papers placed" value={`${score.placedPapers} / ${score.requiredPapers}`} hint={score.complete ? "Complete" : `${score.requiredPapers - score.placedPapers} without a date`} />
        <Kpi
          label="Dates"
          value={score.firstDate ? `${days.length} day${days.length === 1 ? "" : "s"}` : "—"}
          hint={score.firstDate ? `${formatDate(score.firstDate)} – ${formatDate(score.lastDate)}` : undefined}
        />
        <Kpi label="Window" value={span ? `${span.schoolDays} school days` : "—"} hint={span?.closedDays ? `${span.closedDays} closed days skipped` : undefined} />
        <Kpi label="Search" value={seconds(stats.elapsedMs)} hint={changes.keep ? `${changes.keep} papers kept` : `${stats.attempts} fresh starts`} />
      </div>

      {(issues.length > 0 || unplaced.length > 0) && (
        <div className="stack-sm">
          <div className="section-title">{unplaced.length ? "Not placed" : "Problems"}</div>
          {unplaced.length > 0 && (
            <ul className="sch-unplaced">
              {unplaced.map(u => (
                <li key={u.paperIds.join(",")}>
                  <div>
                    <strong>{u.subjectName}</strong>
                    <span className="muted"> · {u.sectionNames.join(", ")}</span>
                  </div>
                  <Reasons reasons={u.reasons} />
                </li>
              ))}
            </ul>
          )}
          {issues.length > 0 && <IssueList issues={issues} links={false} />}
        </div>
      )}

      <div className="sch-exam-days">
        {days.map(d => (
          <section key={d.date} className="sch-exam-day">
            <div className="sch-exam-date">
              <strong className="nowrap">{formatDate(d.date)}</strong>
              <span className="small muted">{weekday(d.date)}</span>
            </div>
            <div className="stack-sm" style={{ minWidth: 0 }}>
              {d.sittings.map(s => (
                <div key={s.key} className="sch-exam-sitting">
                  <div className="small muted">
                    {s.name} · {s.time}
                  </div>
                  <ul>
                    {s.subjects.map(x => (
                      <li key={x.key}>
                        <span className="sch-exam-subject">
                          {x.title}
                          {x.time && <span className="small muted"> · {x.time}</span>}
                          {x.kept && <Badge>Kept</Badge>}
                        </span>
                        <span className="small muted">{x.sections.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* The exam page's "Generate timetable" button, with its drawer */
export function GenerateExamTimetableButton({ exam }: { exam: Exam }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const papers = useExamPapers(exam.id);
  const [open, setOpen] = useState(false);
  if (!can("academics.scheduling.generate") || readOnly) return null;
  const none = !!papers.data && papers.data.length === 0;
  return (
    <>
      <Button icon={<CalendarClock />} onClick={() => setOpen(true)} disabled={none} title={none ? "Add the exam's papers first" : "Plan every paper's date and time"}>
        Generate timetable
      </Button>
      <ExamTimetableDrawer open={open} exam={exam} onClose={() => setOpen(false)} />
    </>
  );
}
