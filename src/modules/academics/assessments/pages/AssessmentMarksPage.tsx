/* One teacher assessment: its details and every student's marks. ABSENT counts 0%; EXEMPT and
   MEDICAL leave the item out for that student; an empty row counts 0% once anyone has marks.
   Homework items take their marks from grading the submissions: only a status is set here. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NotebookPen, Pencil, Save, Trash2 } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiMutation } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorState, Page, Select, SkeletonBlock, useConfirm, useToast } from "@/common/ui";
import { formatDate, fullName } from "@/common/utils/format";
import {
  ASSESSMENTS_PATH,
  deleteAssessment,
  percentLabel,
  recordItemMarks,
  STATUS_LABELS,
  TYPE_LABELS,
  useItemMarks,
  type EntryStatus,
  type ItemMarks,
  type MarksEntry
} from "../api/assessments";
import { AssessmentDrawer } from "../components/AssessmentDrawer";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import "../../marks/marks.css";

type Row = { status: EntryStatus | ""; marks: string; remarks: string };

const rowOf = (s: ItemMarks["students"][number], homework: boolean): Row => ({
  status: s.status ?? "",
  marks: homework || s.marksObtained === null ? "" : String(s.marksObtained),
  remarks: s.remarks ?? ""
});

const sameRow = (a: Row, b: Row) => a.status === b.status && a.marks === b.marks && a.remarks === b.remarks;

export default function AssessmentMarksPage() {
  const { assessmentId = "" } = useParams();
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const q = useItemMarks(assessmentId);
  const sections = useSectionOptions();
  const save = useApiMutation(recordItemMarks, { invalidate: [ASSESSMENTS_PATH] });
  const remove = useApiMutation(deleteAssessment, { invalidate: [ASSESSMENTS_PATH] });
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const data = q.data;
  const item = data?.assessment;
  const homework = !!item?.homeworkId;
  const originals = useMemo(() => Object.fromEntries((data?.students ?? []).map(s => [s.studentId, rowOf(s, homework)])), [data, homework]);
  useEffect(() => {
    setRows(originals);
    setErrors({});
  }, [originals]);

  const locked = !!item?.bucket?.locked;
  const canEdit = can("academics.assessments.manage") && !readOnly && !locked;
  const changed = Object.keys(rows).filter(id => originals[id] && !sameRow(rows[id], originals[id]));

  const statusOptions = [
    { value: "", label: homework ? "From grading" : "—" },
    ...(homework ? [] : [{ value: "MARKED", label: STATUS_LABELS.MARKED }]),
    { value: "ABSENT", label: STATUS_LABELS.ABSENT, description: "Counts as 0%" },
    { value: "EXEMPT", label: STATUS_LABELS.EXEMPT, description: "Left out of the student's average" },
    { value: "MEDICAL", label: STATUS_LABELS.MEDICAL, description: "Left out of the student's average" }
  ];

  const setRow = (studentId: string, patch: Partial<Row>) => {
    setRows(rs => {
      const next = { ...rs[studentId], ...patch };
      /* Typing marks marks the student; an absence clears the marks */
      if (patch.marks !== undefined && patch.marks !== "" && !homework) next.status = "MARKED";
      if (patch.status && patch.status !== "MARKED") next.marks = "";
      return { ...rs, [studentId]: next };
    });
    setErrors(({ [studentId]: _drop, ...rest }) => rest);
  };

  const submit = () => {
    if (!item) return;
    const errs: Record<string, string> = {};
    const entries: MarksEntry[] = [];
    for (const studentId of changed) {
      const r = rows[studentId];
      const had = originals[studentId].status !== "";
      const remarks = r.remarks.trim() || undefined;
      const marked = r.status === "MARKED" || (!homework && r.status === "" && r.marks !== "");
      if (marked) {
        const n = Number(r.marks);
        if (r.marks === "") {
          if (had) entries.push({ studentId, clear: true });
          continue;
        }
        if (!(n >= 0 && n <= item.maxMarks)) {
          errs[studentId] = `0 to ${item.maxMarks}`;
          continue;
        }
        entries.push({ studentId, status: "MARKED", marksObtained: n, remarks });
      } else if (r.status) entries.push({ studentId, status: r.status, remarks });
      else if (had) entries.push({ studentId, clear: true });
    }
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error("Fix the highlighted marks first");
    if (!entries.length) return;
    save.mutate({ id: item.id, marks: entries }, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };

  const askRemove = async () => {
    if (!item) return;
    const ok = await confirm({
      title: `Remove ${item.title}?`,
      message: "The item and its marks are removed, and the bucket's averages are worked out without it.",
      confirmLabel: "Remove item",
      tone: "danger"
    });
    if (ok)
      remove.mutate(item.id, {
        onSuccess: res => {
          toast.success(res.message);
          navigate(ASSESSMENTS_PATH, { replace: true });
        },
        onError: err => toast.error(err)
      });
  };

  const header = <DrillHeader back={ASSESSMENTS_PATH} backLabel="Back to teacher assessments" title={item?.title ?? ""} />;
  if (q.error)
    return (
      <Page>
        {header}
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  if (!data || !item)
    return (
      <Page>
        {header}
        <SkeletonBlock lines={10} />
      </Page>
    );

  return (
    <Page>
      {header}
      <Card>
        <div className="row-between" style={{ gap: 16, flexWrap: "wrap" }}>
          <div className="stack-sm" style={{ gap: 6, minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <Badge tone={homework ? "primary" : "neutral"}>{TYPE_LABELS[item.assessmentType]}</Badge>
              {item.counts ? <Badge tone="success">Counts</Badge> : <Badge tone="warning">Not counted</Badge>}
              {locked && <Badge>Results published: locked</Badge>}
            </div>
            <div className="row small muted" style={{ gap: 14, flexWrap: "wrap" }}>
              <span>
                {(() => {
                  const s = sections.byId.get(item.sectionId);
                  return s ? sectionTitle(s) : `Section ${item.section?.sectionName ?? ""}`;
                })()}{" "}
                · {item.subject?.subjectName}
              </span>
              <span>Out of {item.maxMarks}</span>
              {item.assessedOn && <span>{formatDate(item.assessedOn)}</span>}
              {item.bucket && (
                <span>
                  Counts toward {item.bucket.name} ({item.bucket.weight}% of {item.bucket.scheme.name})
                </span>
              )}
            </div>
          </div>
          <div className="row">
            {homework && item.homeworkId && (
              <ButtonLink icon={<NotebookPen />} to={`/academics/homework/${item.homeworkId}`}>
                Open homework
              </ButtonLink>
            )}
            {canEdit && (
              <Button icon={<Pencil />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {canEdit && !homework && (
              <Button icon={<Trash2 />} variant="danger" loading={remove.isPending} onClick={() => void askRemove()}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card flush>
        {data.students.length ? (
          <div className="table-wrap">
            <table className="table marks-grid is-detail">
              <thead>
                <tr>
                  <th className="mg-roll">Roll</th>
                  <th className="mg-name">Student</th>
                  <th className="mg-paper">
                    <div className="mg-paper-name">Marks</div>
                    <div className="mg-paper-max">{homework ? "from grading" : `out of ${item.maxMarks}`}</div>
                  </th>
                  <th className="mg-attendance">Status</th>
                  <th className="mg-remarks">Remarks</th>
                  <th className="align-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map(s => {
                  const r = rows[s.studentId] ?? originals[s.studentId];
                  const error = errors[s.studentId];
                  const left = s.enrollmentStatus !== "ACTIVE";
                  return (
                    <tr key={s.studentId} className={[error && "mg-row-error", left && "mg-row-left"].filter(Boolean).join(" ") || undefined}>
                      <td className="mg-roll mono small">{s.rollNumber ?? "—"}</td>
                      <td className="mg-name">
                        <div className="mg-student">{fullName(s)}</div>
                        <div className={`mg-sub${error ? " is-error" : ""}`}>{error ?? (left ? "Left the section" : "")}</div>
                      </td>
                      <td className="mg-paper">
                        {homework ? (
                          <span>{s.marksObtained ?? <span className="muted">—</span>}</span>
                        ) : (
                          <input
                            className="input input-sm mg-input"
                            type="number"
                            min={0}
                            max={item.maxMarks}
                            step="any"
                            aria-label={`Marks of ${fullName(s)}`}
                            value={r.marks}
                            disabled={!canEdit || (r.status !== "" && r.status !== "MARKED")}
                            onChange={e => setRow(s.studentId, { marks: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="mg-attendance">
                        <Select
                          className="select-sm"
                          aria-label={`Status of ${fullName(s)}`}
                          options={statusOptions}
                          value={r.status}
                          disabled={!canEdit}
                          onChange={e => setRow(s.studentId, { status: e.target.value as EntryStatus | "" })}
                        />
                      </td>
                      <td className="mg-remarks">
                        <input
                          className="input input-sm"
                          maxLength={500}
                          aria-label={`Remarks for ${fullName(s)}`}
                          value={r.remarks}
                          disabled={!canEdit || (homework && !r.status)}
                          onChange={e => setRow(s.studentId, { remarks: e.target.value })}
                        />
                      </td>
                      <td className="align-right nowrap">{percentLabel(s.percentage)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No students in the section" message="Students enrolled in the section show here." />
        )}
      </Card>

      {canEdit && (
        <div className="row-between">
          <span className="small muted">
            {changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"} not saved` : "Percentages refresh after saving."}
          </span>
          <Button variant="primary" icon={<Save />} disabled={!changed.length} loading={save.isPending} onClick={submit}>
            Save marks
          </Button>
        </div>
      )}
      <AssessmentDrawer open={editing} assessment={item} onClose={() => setEditing(false)} />
    </Page>
  );
}
