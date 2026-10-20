import { useMemo, useState } from "react";
import { CalendarDays, Check, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Button, ButtonLink, Card, EmptyState, ErrorState, FormActions, Kpi, Select, SkeletonBlock, useConfirm, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useTeacherOptions } from "../../classes/api/sections";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { TIMETABLE_INVALIDATE, type GridSlot, type TimetableGridData } from "../../timetable/api/timetable";
import { TimetableGrid } from "../../timetable/components/TimetableGrid";
import {
  applyRun,
  discardRun,
  draftSectionPath,
  draftTeacherPath,
  generateClassTimetable,
  runPath,
  SCHEDULING_PATH,
  withoutSeed,
  type ClassRequest,
  type ClassRun,
  type DraftSectionGrid,
  type DraftSlot,
  type DraftTeacherGrid
} from "../api/scheduling";
import { seconds, TIMETABLE_PAGE } from "../utils/links";
import { AgentBadge, IssueList, Reasons, RunStatusBadge } from "./RunBits";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* The grid marks each lesson by what the draft does with it */
const slotClass = (slot: GridSlot) => `sch-slot-${(slot as unknown as DraftSlot).status.toLowerCase()}`;

const LEGEND = [
  { status: "new", label: "New" },
  { status: "kept", label: "Already there, stays" },
  { status: "pinned", label: "Pinned" },
  { status: "other", label: "Another section's" }
];

type View = { kind: "section" | "teacher"; id: string };

/* AC-07b step 3: a draft run. Its summary and problems, a preview of any section's or
   teacher's week as the draft would leave it, and Try another / Apply / Discard. */
export function ClassDraftView({ runId, onOpenRun, onEditRules }: { runId: string; onOpenRun: (runId: string) => void; onEditRules: (request: ClassRequest) => void }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const toast = useToast();
  const confirm = useConfirm();
  const sections = useSectionOptions();
  const teachers = useTeacherOptions();
  const run = useApiGet<ClassRun>(runPath(runId));
  const [picked, setView] = useState<View | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const invalidate = [SCHEDULING_PATH, ...TIMETABLE_INVALIDATE];
  const apply = useApiMutation(applyRun, { invalidate });
  const discard = useApiMutation(discardRun, { invalidate: [SCHEDULING_PATH] });
  const again = useApiMutation(generateClassTimetable, { invalidate: [SCHEDULING_PATH] });
  const r = run.data;

  const sectionOptions = useMemo(
    () =>
      (r?.result?.sectionIds ?? [])
        .map(id => {
          const s = sections.byId.get(id);
          return { value: id, label: s ? sectionTitle(s) : (r?.report.unplaced.find(u => u.sectionId === id)?.sectionName ?? "Section"), order: s?.class?.classOrder ?? 0 };
        })
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    [r, sections.byId]
  );
  /* Until one is picked: the draft's first section in class order (the page keys this view by run) */
  const first = sectionOptions[0]?.value;
  const view: View | null = picked ?? (first ? { kind: "section", id: first } : null);
  const teacherOptions = useMemo(() => {
    const ids = new Set((r?.result?.placements ?? []).map(p => p.teacherId));
    const named = new Map(teachers.options.map(o => [o.value, o]));
    return [...ids]
      .map(id => named.get(id) ?? { value: id, label: r?.report.unplaced.find(u => u.teacherId === id)?.teacherName ?? "Teacher" })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [r, teachers.options]);

  const sectionGrid = useApiGet<DraftSectionGrid>(view?.kind === "section" ? draftSectionPath(runId, view.id) : null);
  const teacherGrid = useApiGet<DraftTeacherGrid>(view?.kind === "teacher" ? draftTeacherPath(runId, view.id) : null);
  const grid = view?.kind === "teacher" ? teacherGrid : sectionGrid;

  if (run.error) return <ErrorState error={run.error} onRetry={() => void run.refetch()} />;
  if (!r)
    return (
      <Card>
        <SkeletonBlock lines={8} />
      </Card>
    );

  const { score, changes, stats, issues, unplaced } = r.report;
  const missing = score.requiredPeriods - score.placedPeriods;
  const isDraft = r.status === "DRAFT";
  const canApply = can("academics.scheduling.apply") && !readOnly && isDraft;
  const canGenerate = can("academics.scheduling.generate") && !readOnly;
  const replace = r.request.mode === "REPLACE";

  const fail = (err: unknown) => {
    setActionError(errorMessage(err));
    toast.error(err);
  };

  const askApply = async () => {
    setActionError(null);
    const what = replace
      ? `Removes ${plural(changes.remove, "current lesson")} of ${plural(r.result?.sectionIds.length ?? 0, "section")} and adds ${changes.add}.`
      : `Adds ${plural(changes.add, "lesson")}; the ${plural(changes.keep, "lesson")} already on the timetable stay.`;
    const ok = await confirm({
      title: missing ? "Apply an incomplete timetable?" : "Apply this timetable?",
      message: (
        <div className="stack-sm">
          <p>{what}</p>
          {missing > 0 && <p>{plural(missing, "period")} could not be placed: add them by hand on Timetables afterwards.</p>}
        </div>
      ),
      confirmLabel: missing ? "Apply anyway" : "Apply",
      tone: "primary"
    });
    if (!ok) return;
    apply.mutate({ runId: r.id, allowIncomplete: missing > 0 || undefined }, { onSuccess: res => toast.success(res.message), onError: fail });
  };

  const askDiscard = async () => {
    setActionError(null);
    const ok = await confirm({
      title: "Discard this draft?",
      message: `${r.summary}. Nothing on the timetable changes; the draft stays in the list as discarded.`,
      confirmLabel: "Discard draft"
    });
    if (!ok) return;
    discard.mutate(r.id, { onSuccess: res => toast.success(res.message), onError: fail });
  };

  const tryAnother = () => {
    setActionError(null);
    again.mutate(withoutSeed(r.request), {
      onSuccess: res => {
        toast.success(res.message);
        onOpenRun(res.data.id);
      },
      onError: fail
    });
  };

  const g = grid.data;
  const lessons = g ? g.days.reduce((n, d) => n + d.slots.length, 0) : 0;
  const added = g ? g.days.reduce((n, d) => n + d.slots.filter(s => s.status === "NEW").length, 0) : 0;

  return (
    <div className="stack">
      <Card
        title={
          <span className="row" style={{ gap: 8 }}>
            {r.summary}
            <RunStatusBadge run={r} />
            <AgentBadge run={r} />
          </span>
        }
        subtitle={`Generated ${formatDateTime(r.createdAt)} · ${replace ? "Plans the whole week again" : "Keeps the lessons already placed"} · seed ${r.seed}${
          r.appliedAt ? ` · applied ${formatDateTime(r.appliedAt)}` : r.discardedAt ? ` · discarded ${formatDateTime(r.discardedAt)}` : ""
        }`}
      >
        <div className="kpis">
          <Kpi label="Periods placed" value={`${score.placedPeriods} / ${score.requiredPeriods}`} hint={missing ? `${missing} left to place by hand` : "Complete"} />
          <Kpi label="Lessons added" value={changes.add} hint={replace ? `${changes.remove} current removed` : `${changes.keep} already there stay`} />
          <Kpi label="Penalty" value={Math.round(score.cost * 10) / 10} hint="Soft rules missed; lower is better" />
          <Kpi label="Search" value={seconds(stats.elapsedMs)} hint={`${plural(stats.attempts, "fresh start")}`} />
        </div>
      </Card>

      {(issues.length > 0 || unplaced.length > 0) && (
        <Card title={unplaced.length ? "Not placed" : "Problems"} subtitle={unplaced.length ? "What the draft could not fit, and why" : undefined}>
          <div className="stack">
            {unplaced.length > 0 && (
              <ul className="sch-unplaced">
                {unplaced.map(u => (
                  <li key={`${u.sectionId}|${u.subjectId}`}>
                    <div>
                      <strong>{u.subjectName ?? "Subject"}</strong> · {u.sectionName}
                      <span className="muted">
                        {" "}
                        · {plural(u.missingPeriods, "period")} not placed{u.teacherName ? ` · ${u.teacherName}` : ""}
                      </span>
                    </div>
                    <Reasons reasons={u.reasons} />
                  </li>
                ))}
              </ul>
            )}
            {issues.length > 0 && <IssueList issues={issues} />}
          </div>
        </Card>
      )}

      <Card flush>
        <div className="tt-toolbar">
          <Select
            label="Section"
            className="select-sm"
            value={view?.kind === "section" ? view.id : ""}
            onChange={e => setView({ kind: "section", id: e.target.value })}
            options={sectionOptions}
            placeholder="Pick a section"
            required
          />
          <Select
            label="Teacher"
            className="select-sm"
            value={view?.kind === "teacher" ? view.id : ""}
            onChange={e => setView({ kind: "teacher", id: e.target.value })}
            options={teacherOptions}
            placeholder={teachers.isLoading ? "Loading teachers…" : "Pick a teacher"}
            required
          />
          <span className="tt-toolbar-note">{g && `${plural(lessons, "lesson")} · ${added} new`}</span>
        </div>
        {!view ? (
          <EmptyState icon={<CalendarDays />} title="Pick a section or a teacher" message="Their week appears here as the draft would leave it." />
        ) : grid.error ? (
          <ErrorState error={grid.error} onRetry={() => void grid.refetch()} />
        ) : !g ? (
          <div style={{ padding: 18 }}>
            <SkeletonBlock lines={6} />
          </div>
        ) : (
          <>
            <TimetableGrid
              grid={g as unknown as TimetableGridData}
              show={view.kind === "section" ? "teacher" : "section"}
              slotClassName={slotClass}
              aria-label={view.kind === "section" ? `Draft timetable of ${sectionGrid.data?.section.name ?? "the section"}` : "Draft teacher timetable"}
            />
            <div className="sch-legend">
              {LEGEND.filter(l => view.kind === "teacher" || l.status !== "other").map(l => (
                <span key={l.status}>
                  <i className={`sch-swatch sch-slot-${l.status}`} aria-hidden />
                  {l.label}
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      <FormActions error={actionError}>
        {r.status === "APPLIED" && <ButtonLink to={TIMETABLE_PAGE}>Open timetables</ButtonLink>}
        {canGenerate && (
          <Button icon={<SlidersHorizontal />} onClick={() => onEditRules(r.request)}>
            Change rules
          </Button>
        )}
        {canApply && (
          <Button icon={<Trash2 />} variant="ghost" onClick={() => void askDiscard()} loading={discard.isPending}>
            Discard
          </Button>
        )}
        {canGenerate && (
          <Button icon={<RefreshCw />} onClick={tryAnother} loading={again.isPending} title="Same rules, a new search">
            Try another
          </Button>
        )}
        {canApply && (
          <Button variant="primary" icon={<Check />} onClick={() => void askApply()} loading={apply.isPending}>
            {missing ? "Apply anyway" : "Apply"}
          </Button>
        )}
      </FormActions>
    </div>
  );
}
