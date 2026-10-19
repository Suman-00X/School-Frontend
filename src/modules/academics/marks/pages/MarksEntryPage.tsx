/* AC-14 · Marks entry: pick an exam and a section, then one paper's roster or every paper of the
   section as a grid; save the whole grid at once (all or nothing) */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PenLine, Save, Undo2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage, isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Button, ButtonLink, Card, EmptyState, ErrorState, FormActions, PageHeader, Select, SkeletonBlock, useConfirm, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useSectionOptions, sectionTitle } from "../../shared/components/SectionSelect";
import { fetchAll, paperTitle, timeRange, useAllExams, useExamPapers } from "../../exams/api/exams";
import { gradesOf, useGradeScales, usePolicyResolution } from "../../exams/api/grading";
import { fetchStudentMarks, inBatches, MARKS_PATH, recordMarks, useTeachingSections, type MarkEntry } from "../api/marks";
import { cellFromRecord, cellKey, cellProblem, EMPTY_CELL, entryOf, sameCell, type Cell } from "../utils/cells";
import { MarksGrid, type GridPaper, type GridStudent } from "../components/MarksGrid";
import { StudentMarksDrawer } from "../components/StudentMarksDrawer";
import "../marks.css";

type Enrollment = {
  id: string;
  studentId: string;
  rollNumber: string | null;
  status: "ACTIVE" | "LEFT";
  student: {
    id: string;
    studentCode: string;
    admissionNumber: string | null;
    user: { firstName: string; lastName: string };
  };
};

type View = "paper" | "all";
const BULK_MAX = 500;

/* "marks[3]: …" (422) or "marks.3.field" (400) -> 3 */
const entryIndex = (err: unknown): number | null => {
  if (!isApiError(err)) return null;
  const m = /^marks\[(\d+)\]/.exec(err.message);
  if (m) return Number(m[1]);
  const d = err.details.find(x => /^marks\.\d+/.test(x.field));
  return d ? Number(/^marks\.(\d+)/.exec(d.field)![1]) : null;
};
const entryMessage = (err: unknown) => {
  if (isApiError(err) && err.isValidation) {
    const d = err.details.find(x => /^marks\.\d+/.test(x.field));
    if (d) return `${d.field.replace(/^marks\.\d+\./, "")} ${d.message}`;
  }
  return errorMessage(err).replace(/^marks\[\d+\]:\s*/, "");
};

export default function MarksEntryPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { readOnly, selected: year } = useAcademicYear();
  const [search, setSearch] = useSearchParams();
  const examId = search.get("examId") ?? "";
  const sectionId = search.get("sectionId") ?? "";
  const view: View = search.get("view") === "all" ? "all" : "paper";
  const setQuery = (patch: Record<string, string>) =>
    setSearch(
      prev => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true }
    );

  const { exams, isLoading: examsLoading } = useAllExams();
  const exam = exams.find(e => e.id === examId);
  const papers = useExamPapers(examId || null);
  const teaching = useTeachingSections();
  const { byId: sectionsById } = useSectionOptions();
  const scales = useGradeScales();

  /* What this person may mark: a teacher only their subjects (class teacher: every subject) */
  const markable = useMemo(() => (papers.data ?? []).filter(p => teaching.canMark(p.sectionId, p.subjectId)), [papers.data, teaching]);
  const sectionChoices = useMemo(() => {
    const ids = [...new Set(markable.map(p => p.sectionId))];
    return ids
      .map(id => {
        const s = sectionsById.get(id);
        const fallback = markable.find(p => p.sectionId === id)!.section.sectionName;
        return {
          id,
          label: s ? sectionTitle(s) : `Section ${fallback}`,
          order: s ? (s.class?.classOrder ?? 0) * 100 + s.sectionName.charCodeAt(0) : 1e9
        };
      })
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [markable, sectionsById]);
  const sectionPapers = useMemo(
    () => markable.filter(p => p.sectionId === sectionId).sort((a, b) => a.displayCode.localeCompare(b.displayCode)),
    [markable, sectionId]
  );
  const paperId =
    search.get("paperId") && sectionPapers.some(p => p.id === search.get("paperId")) ? search.get("paperId")! : (sectionPapers[0]?.id ?? "");
  const paper = sectionPapers.find(p => p.id === paperId);

  /* Roster: every enrollment of the section (left students shown, not editable) */
  const roster = useQuery({
    queryKey: ["/academics/enrollments", { sectionId, all: true }],
    enabled: !!sectionId,
    queryFn: () => fetchAll<Enrollment>("/academics/enrollments", { sectionId })
  });
  const students: GridStudent[] = useMemo(
    () =>
      [...(roster.data ?? [])]
        .sort(
          (a, b) =>
            (a.status === b.status ? 0 : a.status === "LEFT" ? 1 : -1) ||
            String(a.rollNumber ?? "~").localeCompare(String(b.rollNumber ?? "~"), undefined, { numeric: true })
        )
        .map(e => ({
          studentId: e.studentId,
          rollNumber: e.rollNumber,
          name: `${e.student.user.firstName} ${e.student.user.lastName}`,
          sub: e.status === "LEFT" ? "Left the section" : (e.student.admissionNumber ?? e.student.studentCode),
          left: e.status === "LEFT"
        })),
    [roster.data]
  );

  /* Marks already saved. GET /academics/marks takes one student at a time (no per-paper read), so
     the grid asks for each student of the roster, a few at a time. */
  const saved = useQuery({
    queryKey: [MARKS_PATH, "grid", { examId, sectionId, students: students.map(s => s.studentId) }],
    enabled: !!examId && !!sectionId && students.length > 0,
    queryFn: async () => {
      const ids = new Set(sectionPapers.map(p => p.id));
      const byId = new Map(sectionPapers.map(p => [p.id, p]));
      const lists = await inBatches(students, 6, s => fetchStudentMarks(s.studentId, examId));
      const out: Record<string, Cell> = {};
      lists.flat().forEach(m => {
        if (ids.has(m.examPaperId)) out[cellKey(m.studentId, m.examPaperId)] = cellFromRecord(m, byId.get(m.examPaperId)!);
      });
      return out;
    }
  });
  const originals = useMemo(() => saved.data ?? {}, [saved.data]);

  /* The grid's edits on top of what is saved */
  const [edits, setEdits] = useState<Record<string, Cell>>({});
  const [serverRowErrors, setServerRowErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentView, setStudentView] = useState<GridStudent | null>(null);
  const cells = useMemo(() => ({ ...originals, ...edits }), [originals, edits]);

  /* Which grades a graded paper takes: the policy's co-scholastic scale, else the exam's or policy's scale */
  const hasGraded = sectionPapers.some(p => p.gradingType === "GRADE");
  const resolution = usePolicyResolution(hasGraded ? examId : undefined, hasGraded ? sectionId : undefined);
  const gradeList = useMemo(() => {
    const policy = resolution.data?.policy;
    const id = policy?.coScholasticScaleId ?? exam?.gradeScaleId ?? policy?.gradeScaleId;
    const scale = (id ? scales.byId.get(id) : null) ?? scales.defaultScale;
    return scale ? gradesOf(scale).map(b => b.grade) : null;
  }, [resolution.data, exam?.gradeScaleId, scales.byId, scales.defaultScale]);

  const paperById = useMemo(() => new Map(sectionPapers.map(p => [p.id, p])), [sectionPapers]);
  const dirtyKeys = Object.keys(edits).filter(k => !sameCell(edits[k], originals[k]));
  const problems = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(edits)) {
      if (sameCell(edits[key], originals[key])) continue;
      const p = paperById.get(key.split(":")[1]!);
      if (!p) continue;
      const problem = cellProblem(p, edits[key]!, originals[key], p.gradingType === "GRADE" ? gradeList : null);
      if (problem) out[key] = problem;
    }
    return out;
  }, [edits, originals, paperById, gradeList]);

  /* A row's line: the server's refusal, else the first problem in the row */
  const rowErrors = useMemo(() => {
    const out: Record<string, string> = { ...serverRowErrors };
    for (const [key, problem] of Object.entries(problems)) {
      const [studentId, pid] = key.split(":") as [string, string];
      if (out[studentId]) continue;
      const p = paperById.get(pid);
      out[studentId] = view === "all" && p ? `${p.subject.subjectCode}: ${problem}` : problem;
    }
    return out;
  }, [problems, serverRowErrors, paperById, view]);

  const change = (studentId: string, pid: string, patch: Partial<Cell>) => {
    const key = cellKey(studentId, pid);
    setEdits(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? originals[key] ?? EMPTY_CELL), ...patch }
    }));
    setServerRowErrors(prev => {
      if (!prev[studentId]) return prev;
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    setFormError(null);
  };

  /* Leaving the exam or section drops unsaved edits: ask first */
  const guard = async (run: () => void) => {
    if (dirtyKeys.length) {
      const ok = await confirm({
        title: `Discard ${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? "" : "s"}?`,
        message: "The marks you typed in this grid haven't been saved yet.",
        confirmLabel: "Discard changes"
      });
      if (!ok) return;
    }
    setEdits({});
    setServerRowErrors({});
    setFormError(null);
    run();
  };

  const save = async () => {
    setFormError(null);
    setServerRowErrors({});
    if (Object.keys(problems).length) {
      setFormError(
        `Fix the ${Object.keys(problems).length === 1 ? "entry" : `${Object.keys(problems).length} entries`} marked in red first. Nothing was saved.`
      );
      return;
    }
    const keys = dirtyKeys;
    /* What was sent: a cell typed into again while saving stays an edit */
    const sent: Record<string, Cell> = Object.fromEntries(keys.map(k => [k, edits[k]!]));
    const entries: MarkEntry[] = keys.map(k => {
      const [studentId, pid] = k.split(":") as [string, string];
      return entryOf(studentId, paperById.get(pid)!, edits[k]!);
    });
    setSaving(true);
    const savedKeys: string[] = [];
    try {
      for (let at = 0; at < entries.length; at += BULK_MAX) {
        const chunk = entries.slice(at, at + BULK_MAX);
        try {
          const res = await recordMarks(chunk);
          savedKeys.push(...keys.slice(at, at + BULK_MAX));
          toast.success(res.message);
        } catch (err) {
          const i = entryIndex(err);
          const entry = i !== null ? chunk[i] : undefined;
          const student = entry && students.find(s => s.studentId === entry.studentId);
          if (entry) setServerRowErrors({ [entry.studentId]: entryMessage(err) });
          const what = savedKeys.length ? `The first ${savedKeys.length} entries were saved; the rest were not.` : "Nothing was saved.";
          setFormError(student ? `${student.name}: ${entryMessage(err)}. ${what}` : `${errorMessage(err).replace(/\.$/, "")}. ${what}`);
          break;
        }
      }
    } finally {
      /* Reload what is saved first, then drop the saved edits, so the grid never shows the old marks */
      if (savedKeys.length) {
        await qc.invalidateQueries({
          predicate: q =>
            typeof q.queryKey[0] === "string" && (q.queryKey[0].startsWith(MARKS_PATH) || q.queryKey[0].startsWith("/academics/report-cards"))
        });
        setEdits(prev => {
          const next = { ...prev };
          for (const k of savedKeys) if (sameCell(next[k], sent[k])) delete next[k];
          return next;
        });
      }
      setSaving(false);
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: `Discard ${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? "" : "s"}?`,
      message: "The grid goes back to the marks that are saved.",
      confirmLabel: "Discard changes"
    });
    if (!ok) return;
    setEdits({});
    setServerRowErrors({});
    setFormError(null);
  };

  const gridPapers: GridPaper[] = (view === "paper" ? (paper ? [paper] : []) : sectionPapers).map(p => ({
    paper: p,
    grades: p.gradingType === "GRADE" ? gradeList : null,
    canEdit: !readOnly
  }));

  const examOptions = exams.map(e => ({
    value: e.id,
    label: e.examName,
    description: e.resultsPublishedAt ? "Results published" : undefined
  }));
  const sectionOptions = sectionChoices.map(s => ({
    value: s.id,
    label: s.label
  }));
  const paperOptions = sectionPapers.map(p => ({
    value: p.id,
    label: paperTitle(p),
    description: p.displayCode
  }));

  /* One fixed line above the grid: the published warning, else the paper's facts */
  const note = !exam
    ? ""
    : exam.resultsPublishedAt
      ? "Results are published. Changes reach families only after a new version is published (Report cards & publishing)."
      : view === "paper" && paper
        ? [
            paper.displayCode,
            paper.gradingType === "GRADE" ? "graded" : `out of ${paper.maxMarks}${paper.passMarks !== null ? `, pass ${paper.passMarks}` : ""}`,
            paper.examDate && formatDate(paper.examDate),
            timeRange(paper)
          ]
            .filter(Boolean)
            .join(" · ")
        : `${sectionPapers.length} paper${sectionPapers.length === 1 ? "" : "s"}. Tab moves across, Enter moves down.`;

  const body = () => {
    if (!examId)
      return (
        <EmptyState
          icon={<PenLine />}
          title="Pick an exam and a section"
          message={
            examsLoading
              ? "Loading exams…"
              : exams.length
                ? "Then enter marks for one paper, or for every paper of the section at once."
                : `No exams in ${year?.yearName ?? "this year"} yet.`
          }
        />
      );
    if (papers.error) return <ErrorState error={papers.error} onRetry={() => void papers.refetch()} />;
    if (papers.isLoading || teaching.isLoading) return <SkeletonBlock lines={6} />;
    if (!sectionChoices.length)
      return (
        <EmptyState
          icon={<PenLine />}
          title="No papers to mark in this exam"
          message={teaching.teacher ? "None of the subjects you teach has a paper in this exam yet." : "Add papers to the exam first."}
          actions={<ButtonLink to={`/academics/exams/${examId}`}>Open the exam</ButtonLink>}
        />
      );
    if (!sectionId)
      return (
        <EmptyState
          icon={<PenLine />}
          title="Pick a section"
          message={`${sectionChoices.length} section${sectionChoices.length === 1 ? "" : "s"} sit papers you can mark.`}
        />
      );
    if (roster.error) return <ErrorState error={roster.error} onRetry={() => void roster.refetch()} />;
    if (saved.error) return <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />;
    if (roster.isLoading || (students.length > 0 && saved.isLoading)) return <SkeletonBlock lines={8} />;
    if (!students.length) return <EmptyState title="No students in this section" message="Enroll students in the section first." />;
    if (!gridPapers.length) return <EmptyState title="No paper picked" />;
    return (
      <MarksGrid
        students={students}
        papers={gridPapers}
        cells={cells}
        originals={originals}
        onChange={change}
        rowErrors={rowErrors}
        cellErrors={problems}
        readOnly={readOnly}
        detail={view === "paper"}
        onOpenStudent={id => setStudentView(students.find(s => s.studentId === id) ?? null)}
      />
    );
  };

  const showActions = !!examId && !!sectionId && students.length > 0 && !readOnly;
  const status = formError ?? (dirtyKeys.length ? `${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? "" : "s"}` : null);

  return (
    <div className="stack">
      <PageHeader title="Marks entry" subtitle="Marks, grades and absences for an exam, one section at a time." />
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Exam"
            className="select-sm"
            value={examId}
            options={examOptions}
            placeholder={examsLoading ? "Loading exams…" : "Pick an exam"}
            required
            onChange={e =>
              void guard(() =>
                setQuery({
                  examId: e.target.value,
                  sectionId: "",
                  paperId: ""
                })
              )
            }
          />
          <Select
            label="Section"
            className="select-sm"
            value={sectionId}
            options={sectionOptions}
            placeholder={!examId ? "Pick the exam first" : "Pick a section"}
            required
            disabled={!examId || !sectionOptions.length}
            onChange={e => void guard(() => setQuery({ sectionId: e.target.value, paperId: "" }))}
          />
          <div className="field">
            <span className="field-label">Show</span>
            <div className="mg-toggle" role="group" aria-label="Show">
              <Button
                size="sm"
                variant={view === "paper" ? "primary" : "default"}
                aria-pressed={view === "paper"}
                onClick={() => setQuery({ view: "" })}
              >
                One paper
              </Button>
              <Button
                size="sm"
                variant={view === "all" ? "primary" : "default"}
                aria-pressed={view === "all"}
                onClick={() => setQuery({ view: "all" })}
              >
                All papers
              </Button>
            </div>
          </div>
          <Select
            label="Paper"
            className="select-sm"
            value={view === "paper" ? paperId : ""}
            options={paperOptions}
            placeholder={view === "all" ? "Every paper of the section" : "Pick a paper"}
            required
            disabled={view === "all" || !paperOptions.length}
            onChange={e => setQuery({ paperId: e.target.value })}
          />
        </div>
        <div className={`mg-note${exam?.resultsPublishedAt ? " is-warning" : ""}`} title={note}>
          {note}
        </div>
        {body()}
        {showActions && (
          <div className="mg-actions">
            <FormActions
              error={
                formError ? (
                  status
                ) : (
                  <span className="muted" style={{ fontWeight: 400 }}>
                    {status}
                  </span>
                )
              }
            >
              <Button icon={<Undo2 />} disabled={!dirtyKeys.length || saving} onClick={() => void discard()}>
                Discard
              </Button>
              <Button variant="primary" icon={<Save />} loading={saving} disabled={!dirtyKeys.length} onClick={() => void save()}>
                Save marks
              </Button>
            </FormActions>
          </div>
        )}
        {!readOnly && examId && sectionId && students.length > 0 && (
          <div className="mg-legend small muted">
            In a marks cell: <kbd>A</kbd> absent · <kbd>M</kbd> medical · <kbd>E</kbd> exempt · <kbd>Delete</kbd> clears it · <kbd>Enter</kbd> next
            student
          </div>
        )}
      </Card>
      {exam && (
        <StudentMarksDrawer
          open={!!studentView}
          studentId={studentView?.studentId ?? null}
          name={studentView?.name ?? ""}
          examId={exam.id}
          examName={exam.examName}
          onClose={() => setStudentView(null)}
        />
      )}
    </div>
  );
}
