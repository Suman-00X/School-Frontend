import { useState } from "react";
import { ChevronRight, Download, FileX2 } from "lucide-react";
import { useApiGet } from "@/common/hooks";
import { Badge, Button, Card, DataTable, DescriptionList, EmptyState, Page, PageHeader, SkeletonBlock, useToast, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import { ordinal } from "../../shared/utils/time";
import {
  RESULT_LABELS,
  RESULT_TONES,
  downloadReportCard,
  reportCardsPath,
  reportName,
  type ReportCard,
  type ReportCards,
  type ReportLine
} from "../api/learning";

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? <span className="muted">—</span> : String(v));

/* "AB", "EX", "33 (+2)" like the printed card */
const marksCell = (l: ReportLine) => {
  if (l.status === "ABSENT") return "Absent";
  if (l.status === "EXEMPT") return "Exempt";
  if (l.status === "NOT_RECORDED") return dash(null);
  return l.graceMarks ? `${l.marksObtained} (+${l.graceMarks})` : dash(l.marksObtained);
};
const passCell = (l: ReportLine) =>
  l.status === "EXEMPT" ? <span className="muted">Exempt</span> : l.passed === null || l.passed === undefined ? dash(null) : l.passed ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Failed</Badge>;

/* What the headline shows: percentage when marks are shown, else the grade */
const headline = (r: ReportCard) => {
  if (r.display.marks && r.percentage !== null) return `${r.percentage}%`;
  if (r.display.grades && r.grade) return `Grade ${r.grade}`;
  if (r.display.gradePoints && r.gpa !== null) return `GPA ${r.gpa}`;
  return null;
};

/* PO-05 · Results and report cards: every published exam or annual result this year,
   newest first. Columns follow what the school's result policy shows to families. */
export default function ResultsPage() {
  const { student } = usePortalStudent();
  const cards = useApiGet<ReportCards>(student.current ? reportCardsPath(student.id) : null);
  const reports = [...(cards.data?.reports ?? [])].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const [open, setOpen] = useState<string | null>(null);
  const expanded = open ?? reports[0]?.snapshotId ?? null;

  return (
    <Page>
      <PageHeader title="Results" subtitle={cards.data ? `${cards.data.student.section.name} · ${studentFullName(student)}` : studentFullName(student)} />
      {!student.current ? (
        <EmptyState icon={<FileX2 />} title="Not enrolled this year" message="Results appear once the school enrolls the student and publishes them." />
      ) : cards.error ? (
        <PortalError error={cards.error} onRetry={() => void cards.refetch()} />
      ) : !cards.data ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState icon={<FileX2 />} title="No results published yet this year" message="Report cards show here as soon as the school publishes them." />
        </Card>
      ) : (
        <Card flush>
          {reports.map(r => (
            <ReportItem key={r.snapshotId} report={r} studentId={student.id} open={expanded === r.snapshotId} onToggle={() => setOpen(expanded === r.snapshotId ? "" : r.snapshotId)} />
          ))}
        </Card>
      )}
    </Page>
  );
}

function ReportItem({ report: r, studentId, open, onToggle }: { report: ReportCard; studentId: string; open: boolean; onToggle: () => void }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const top = headline(r);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadReportCard(studentId, r);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="po-result-item">
      <button type="button" className="po-result-head" aria-expanded={open} onClick={onToggle}>
        <ChevronRight className="chevron" />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600 }}>{reportName(r)}</div>
          <div className="small muted">
            Published {formatDate(r.publishedAt)}
            {r.version > 1 && ` · Version ${r.version} (corrected)`}
          </div>
        </div>
        {top && <strong className="po-num">{top}</strong>}
        <Badge tone={RESULT_TONES[r.result] ?? "neutral"} dot>
          {RESULT_LABELS[r.result] ?? r.result}
        </Badge>
      </button>
      {open && (
        <div className="po-result-body">
          <SubjectsTable report={r} />
          {r.coScholastic.length > 0 && (
            <DataTable
              rows={r.coScholastic}
              rowKey={l => l.subject.id}
              columns={[
                { key: "subject", header: "Co-scholastic", render: l => l.subject.subjectName },
                { key: "grade", header: "Grade", render: l => dash(l.grade) },
                { key: "remark", header: "Remark", render: l => dash(l.remark ?? l.teacherRemarks) }
              ]}
            />
          )}
          <DescriptionList
            columns={3}
            items={[
              { label: "Total", value: r.totalObtained !== null && r.totalMax !== null ? `${r.totalObtained} / ${r.totalMax}` : null, hidden: !r.display.marks || r.kind === "SCHEME" },
              { label: "Percentage", value: r.percentage !== null ? `${r.percentage}%` : null, hidden: !r.display.marks },
              { label: "Grade", value: r.grade, hidden: !r.display.grades },
              { label: "GPA", value: r.gpa, hidden: !r.display.gradePoints },
              { label: "CGPA", value: r.cgpa, hidden: r.cgpa === null || r.cgpa === undefined },
              { label: "Rank in section", value: r.rank ? `${ordinal(r.rank)} of ${r.sectionSize}` : null, hidden: !r.rank },
              { label: "Rank in class", value: r.classRank ? `${ordinal(r.classRank)} of ${r.classSize}` : null, hidden: !r.classRank },
              { label: "Section average", value: r.sectionAverage !== null ? `${r.sectionAverage}%` : null, hidden: !r.display.marks || r.sectionAverage === null },
              { label: "Grace marks", value: r.graceTotal, hidden: !r.graceTotal },
              {
                label: "Compartment in",
                value: r.compartmentSubjects.map(s => s.subjectName).join(", "),
                hidden: !r.compartmentSubjects.length
              },
              { label: "Failed in", value: r.failedSubjects.map(s => s.subjectName).join(", "), hidden: !r.failedSubjects.length }
            ]}
          />
          <div className="row-between">
            <span className="small muted">{r.policy ? `Graded under ${r.policy.name}` : ""}</span>
            <Button icon={<Download />} loading={downloading} onClick={() => void download()}>
              Download PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectsTable({ report: r }: { report: ReportCard }) {
  const d = r.display;
  let columns: Column<ReportLine>[];
  if (r.kind === "SCHEME") {
    const exams = r.scheme?.exams ?? [];
    columns = [
      { key: "subject", header: "Subject", render: l => l.subject.subjectName },
      ...exams.map(e => ({
        key: e.examId,
        header: `${e.examName} (${e.weight}%)`,
        align: "right" as const,
        render: (l: ReportLine) => dash(l.exams?.find(x => x.examId === e.examId)?.percentage)
      })),
      ...(d.marks ? [{ key: "pct", header: "Weighted %", align: "right" as const, render: (l: ReportLine) => dash(l.percentage) }] : []),
      ...(d.grades ? [{ key: "grade", header: "Grade", render: (l: ReportLine) => dash(l.grade) }] : []),
      ...(d.gradePoints ? [{ key: "gp", header: "GP", align: "right" as const, render: (l: ReportLine) => dash(l.gradePoint) }] : []),
      { key: "passed", header: "Result", render: passCell }
    ];
  } else if (!d.marks) {
    columns = [
      { key: "subject", header: "Subject", render: l => l.subject.subjectName },
      ...(d.grades ? [{ key: "grade", header: "Grade", render: (l: ReportLine) => dash(l.grade) }] : []),
      { key: "passed", header: "Result", render: passCell }
    ];
  } else {
    columns = [
      { key: "subject", header: "Subject", render: l => l.subject.subjectName },
      { key: "marks", header: "Marks", align: "right", render: l => <span className="po-num">{marksCell(l)}</span> },
      { key: "max", header: "Out of", align: "right", render: l => dash(l.maxMarks) },
      { key: "pct", header: "%", align: "right", render: l => dash(l.percentage) },
      ...(d.grades ? [{ key: "grade", header: "Grade", render: (l: ReportLine) => dash(l.grade) }] : []),
      ...(d.gradePoints ? [{ key: "gp", header: "GP", align: "right" as const, render: (l: ReportLine) => dash(l.gradePoint) }] : []),
      { key: "passed", header: "Result", render: passCell }
    ];
  }
  return <DataTable rows={r.subjects} rowKey={l => l.subject.id} columns={columns} />;
}
