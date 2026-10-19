import { Badge, DataTable, Drawer, EmptyState } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { componentLabel } from "../../exams/api/exams";
import { ABSENCE_LABELS, useStudentMarks, type MarkRecord } from "../api/marks";

/* AC-14 student view: everything recorded for one student in one exam (saved marks, not the grid's edits) */
export function StudentMarksDrawer({
  open,
  studentId,
  name,
  examId,
  examName,
  onClose
}: {
  open: boolean;
  studentId: string | null;
  name: string;
  examId: string;
  examName: string;
  onClose: () => void;
}) {
  const marks = useStudentMarks(open ? studentId : null, examId);
  const rows = [...(marks.data ?? [])].sort((a, b) => a.examPaper.displayCode.localeCompare(b.examPaper.displayCode));
  return (
    <Drawer open={open} onClose={onClose} wide title={name} subtitle={`Saved marks in ${examName}`}>
      <DataTable<MarkRecord>
        rows={marks.data ? rows : undefined}
        rowKey={m => m.id}
        loading={marks.isLoading}
        error={marks.error}
        onRetry={() => void marks.refetch()}
        empty={<EmptyState title="Nothing recorded yet" message="Marks appear here once they are saved." />}
        columns={[
          {
            key: "paper",
            header: "Paper",
            render: m => (
              <div>
                <div>
                  {m.examPaper.subject.subjectName}
                  {m.examPaper.component && <span className="muted"> · {componentLabel(m.examPaper.component as never)}</span>}
                </div>
                <div className="mono small muted">{m.examPaper.displayCode}</div>
              </div>
            )
          },
          {
            key: "marks",
            header: "Marks",
            align: "right",
            render: m =>
              m.isAbsent ? (
                <Badge tone={m.absenceReason === "EXEMPT" ? "info" : "warning"}>{ABSENCE_LABELS[m.absenceReason ?? "ABSENT"]}</Badge>
              ) : m.examPaper.gradingType === "GRADE" ? (
                <span className="muted">—</span>
              ) : (
                <span className="nowrap">
                  {m.marksObtained} <span className="muted">/ {m.examPaper.maxMarks}</span>
                </span>
              )
          },
          {
            key: "grade",
            header: "Grade",
            render: m =>
              m.grade ? (
                <span title={m.gradeIsManual ? "Given by the teacher" : "From the grade scale"}>
                  <strong>{m.grade}</strong>
                  {m.gradeIsManual && m.examPaper.gradingType === "MARKS" && <span className="muted small"> (set)</span>}
                </span>
              ) : (
                <span className="muted">—</span>
              )
          },
          {
            key: "remarks",
            header: "Remarks",
            render: m => m.remarks ?? <span className="muted">—</span>
          },
          {
            key: "evaluatedAt",
            header: "Saved",
            render: m => <span className="nowrap small">{formatDateTime(m.evaluatedAt)}</span>
          }
        ]}
      />
    </Drawer>
  );
}
