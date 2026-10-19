import type { ReactNode } from "react";
import { Card, DataTable, DescriptionList, type Column } from "@/common/ui";
import { componentLabel, type PaperComponent } from "../../exams/api/exams";
import { lineStatusLabel, pct, type StudentReport, type SubjectLine } from "../api/reportCards";
import { LineValue, PolicyLine, ResultBadge } from "./ResultBits";

/* One report card (AC-15 Student tab, and a published snapshot): the result, then the subjects.
   Columns follow the policy's display flags (no marks for pass/fail, grades only when used). */
export function ReportCardView({ report, actions, title }: { report: StudentReport; actions?: ReactNode; title?: ReactNode }) {
  const d = report.display;
  const scheme = report.kind === "SCHEME";
  const examsOf = report.scheme?.exams ?? [];

  const columns: Column<SubjectLine>[] = [
    {
      key: "subject",
      header: "Subject",
      render: l => (
        <div>
          <div>{l.subject.subjectName}</div>
          {l.components && l.components.length > 1 && (
            <div className="small muted">
              {l.components
                .map(
                  c =>
                    `${componentLabel(c.component as PaperComponent) || c.displayCode} ${c.status === "ABSENT" ? "AB" : c.status === "EXEMPT" ? "EX" : (c.marksObtained ?? "–")}/${c.maxMarks ?? "–"}`
                )
                .join(" · ")}
            </div>
          )}
        </div>
      )
    },
    ...(scheme
      ? examsOf.map<Column<SubjectLine>>(e => ({
          key: `exam-${e.examId}`,
          header: (
            <span title={`${e.examName}, weight ${e.weight}%`}>
              {e.examName} <span className="muted small">({e.weight}%)</span>
            </span>
          ),
          align: "right",
          render: l => {
            const part = l.exams?.find(x => x.examId === e.examId);
            if (!part) return <span className="muted">—</span>;
            if (part.status === "ABSENT") return "AB";
            if (part.status === "EXEMPT") return "EX";
            if (part.status === "NOT_RECORDED") return <span className="muted">–</span>;
            return d.percentage ? pct(part.percentage) : (part.grade ?? "—");
          }
        }))
      : []),
    ...(d.marks
      ? [
          { key: "max", header: "Out of", align: "right" as const, render: (l: SubjectLine) => l.maxMarks ?? <span className="muted">—</span> },
          { key: "marks", header: "Marks", align: "right" as const, render: (l: SubjectLine) => <LineValue line={l} showMarks /> }
        ]
      : []),
    ...(d.percentage
      ? [{ key: "pct", header: "%", align: "right" as const, render: (l: SubjectLine) => pct(l.percentage) || <span className="muted">—</span> }]
      : []),
    ...(d.grades ? [{ key: "grade", header: "Grade", render: (l: SubjectLine) => <strong>{l.grade ?? "—"}</strong> }] : []),
    ...(d.gradePoints ? [{ key: "gp", header: "Grade point", align: "right" as const, render: (l: SubjectLine) => l.gradePoint ?? "—" }] : []),
    { key: "status", header: "", render: l => <span className={l.passed === false ? "rc-failed small" : "small muted"}>{lineStatusLabel(l)}</span> }
  ];

  const rank = (n: number | null, of: number | null) => (n === null ? null : of ? `${n} of ${of}` : String(n));

  return (
    <div className="stack">
      <Card title={title} actions={actions}>
        <div className="stack">
          <div className="row" style={{ gap: 10 }}>
            <ResultBadge result={report.result} />
            <PolicyLine policy={report.policy} scale={report.gradeScale} />
          </div>
          <DescriptionList
            columns={3}
            items={[
              {
                label: "Total",
                value: report.totalObtained !== null && report.totalMax ? `${report.totalObtained} / ${report.totalMax}` : null,
                hidden: !d.marks
              },
              { label: "Percentage", value: pct(report.percentage), hidden: !d.percentage },
              { label: "Grade", value: report.grade, hidden: !d.grades },
              { label: "GPA", value: report.gpa, hidden: !d.gradePoints },
              { label: "CGPA", value: report.cgpa, hidden: !d.gradePoints || !scheme },
              { label: "Rank in section", value: rank(report.rank, report.sectionSize), hidden: !d.sectionRank },
              { label: "Rank in class", value: rank(report.classRank, report.classSize), hidden: !d.classRank },
              { label: "Grace marks", value: report.graceTotal, hidden: !report.graceTotal },
              { label: "Section average", value: pct(report.sectionAverage), hidden: !d.percentage },
              {
                label: "Failed in",
                value: report.failedSubjects.map(s => s.subjectName).join(", "),
                hidden: !report.failedSubjects.length
              },
              {
                label: "Compartment in",
                value: report.compartmentSubjects.map(s => s.subjectName).join(", "),
                hidden: !report.compartmentSubjects.length
              }
            ]}
          />
        </div>
      </Card>
      <Card flush title="Subjects">
        <DataTable columns={columns} rows={report.subjects} rowKey={l => l.subject.id} empty={<span className="muted">No subjects</span>} />
      </Card>
      {report.coScholastic.length > 0 && (
        <Card flush title="Co-scholastic">
          <DataTable
            rows={report.coScholastic}
            rowKey={l => l.subject.id}
            columns={[
              { key: "subject", header: "Subject", render: l => l.subject.subjectName },
              {
                key: "grade",
                header: "Grade",
                render: l => (
                  <strong>
                    <LineValue line={l} showMarks={false} />
                  </strong>
                )
              },
              { key: "remark", header: "Descriptor", render: l => l.remark ?? <span className="muted">—</span> },
              { key: "teacherRemarks", header: "Teacher's remarks", render: l => l.teacherRemarks ?? <span className="muted">—</span> }
            ]}
          />
        </Card>
      )}
    </div>
  );
}
