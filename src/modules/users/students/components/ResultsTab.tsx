import { useState } from "react";
import { FileDown, GraduationCap } from "lucide-react";
import { isApiError } from "@/common/api";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, SkeletonBlock, useToast } from "@/common/ui";
import { enumLabel, formatDate } from "@/common/utils/format";
import { downloadReportCard, useReportCards } from "../api/records";
import { useHideOnForbidden } from "./useHideOnForbidden";

/* Live report cards of the year, one row per exam, with the PDF */
export function ResultsTab({ studentId, onForbidden }: { studentId: string; onForbidden?: () => void }) {
  const toast = useToast();
  const cards = useReportCards(studentId);
  const [busy, setBusy] = useState<string | null>(null);
  useHideOnForbidden(cards.error, onForbidden);

  const pdf = async (examId: string) => {
    setBusy(examId);
    try {
      await downloadReportCard(studentId, examId);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  if (cards.isLoading) return <SkeletonBlock lines={4} />;
  if (isApiError(cards.error) && cards.error.status === 404)
    return <EmptyState icon={<GraduationCap />} title="Not enrolled this year" message="Report cards follow the student's enrollment in the academic year." />;
  if (cards.error) return <ErrorState error={cards.error} onRetry={() => void cards.refetch()} />;

  const data = cards.data!;
  return (
    <Card flush title="Results" subtitle={`${data.student.section.name} · roll no. ${data.student.rollNumber}`}>
      <DataTable
        rows={data.reports}
        rowKey={r => r.exam.id}
        columns={[
          {
            key: "exam",
            header: "Exam",
            render: r => (
              <div>
                <div style={{ fontWeight: 550 }}>{r.exam.examName}</div>
                <div className="small muted">
                  {enumLabel(r.exam.examType)}
                  {r.exam.startDate && ` · ${formatDate(r.exam.startDate)}`}
                </div>
              </div>
            )
          },
          { key: "marks", header: "Marks", align: "right", render: r => (r.totalMax ? `${r.totalObtained ?? 0} / ${r.totalMax}` : <span className="muted">—</span>) },
          { key: "percentage", header: "%", align: "right", render: r => (r.percentage ?? <span className="muted">—</span>) },
          { key: "grade", header: "Grade", render: r => r.grade ?? <span className="muted">—</span> },
          { key: "result", header: "Result", render: r => (r.result ? enumLabel(r.result) : <span className="muted">—</span>) },
          {
            key: "published",
            header: "",
            render: r => (r.exam.resultsPublishedAt ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Provisional</Badge>)
          },
          {
            key: "pdf",
            header: "",
            align: "right",
            render: r => (
              <Button size="sm" variant="ghost" icon={<FileDown />} loading={busy === r.exam.id} onClick={() => void pdf(r.exam.id)}>
                PDF
              </Button>
            )
          }
        ]}
        empty={<EmptyState icon={<GraduationCap />} title="No exam results this year yet." />}
      />
    </Card>
  );
}
