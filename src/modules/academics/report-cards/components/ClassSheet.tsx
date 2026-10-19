import { FileSpreadsheet } from "lucide-react";
import { useApiGet } from "@/common/hooks";
import { Badge, Card, DataTable, EmptyState, ErrorState, StatTile, StatTiles, type Column } from "@/common/ui";
import { pct, sourcePaths, studentFullName, type ResultSheet, type SheetStudent, type Source, type SubjectRef } from "../api/reportCards";
import { LineValue, PolicyLine, ResultBadge } from "./ResultBits";

/* AC-15 Class sheet: the section's live results under the policy that applies */
export function ClassSheet({ source, sectionId, onOpenStudent }: { source: Source; sectionId: string; onOpenStudent: (s: SheetStudent) => void }) {
  const { path, query } = sourcePaths(source).sheet(sectionId);
  const sheet = useApiGet<ResultSheet>(path, query);
  const data = sheet.data;
  const st = data?.statistics;
  const d = data?.display;

  if (sheet.error) return <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />;

  /* Subjects in the order of the first student's card (every student has the same lines) */
  const first = data?.students[0];
  const subjects: { subject: SubjectRef; co: boolean; max: number | null | undefined }[] = first
    ? [
        ...first.subjects.map(l => ({ subject: l.subject, co: false, max: l.maxMarks })),
        ...first.coScholastic.map(l => ({ subject: l.subject, co: true, max: null }))
      ]
    : [];
  const statOf = new Map((st?.subjects ?? []).map(s => [s.subject.id, s]));

  const columns: Column<SheetStudent>[] = [
    { key: "roll", header: "Roll", width: 80, render: s => <span className="mono small nowrap">{s.rollNumber ?? "—"}</span> },
    {
      key: "name",
      header: "Student",
      render: s => (
        <span className="row nowrap" style={{ gap: 6 }}>
          {studentFullName(s)}
          {s.enrollmentStatus === "LEFT" && <Badge>Left</Badge>}
        </span>
      )
    },
    ...subjects.map<Column<SheetStudent>>(({ subject, co, max }) => {
      const stat = statOf.get(subject.id);
      return {
        key: `s-${subject.id}`,
        header: (
          <span
            className="rc-subject-head"
            title={`${subject.subjectName}${stat ? ` · average ${stat.average ?? "—"}, highest ${stat.highest ?? "—"}, ${stat.passed} passed` : ""}`}
          >
            {subject.subjectCode}
            {!co && d?.marks && max ? <span className="muted small"> /{max}</span> : null}
          </span>
        ),
        align: "center",
        render: s => <LineValue line={(co ? s.coScholastic : s.subjects).find(l => l.subject.id === subject.id)} showMarks={!!d?.marks} />
      };
    }),
    ...(d?.marks
      ? [
          {
            key: "total",
            header: "Total",
            align: "right" as const,
            render: (s: SheetStudent) => (s.totalObtained ?? "—") + (s.totalMax ? ` / ${s.totalMax}` : "")
          }
        ]
      : []),
    ...(d?.percentage
      ? [{ key: "pct", header: "%", align: "right" as const, render: (s: SheetStudent) => pct(s.percentage) || <span className="muted">—</span> }]
      : []),
    ...(d?.grades ? [{ key: "grade", header: "Grade", render: (s: SheetStudent) => <strong>{s.grade ?? "—"}</strong> }] : []),
    ...(d?.gradePoints
      ? [
          {
            key: "gpa",
            header: source.kind === "scheme" ? "CGPA" : "GPA",
            align: "right" as const,
            render: (s: SheetStudent) => (source.kind === "scheme" ? s.cgpa : s.gpa) ?? "—"
          }
        ]
      : []),
    { key: "result", header: "Result", render: s => <ResultBadge result={s.result} /> },
    ...(d?.sectionRank
      ? [{ key: "rank", header: "Rank", align: "right" as const, render: (s: SheetStudent) => s.rank ?? <span className="muted">—</span> }]
      : []),
    ...(d?.classRank
      ? [
          {
            key: "classRank",
            header: "Class rank",
            align: "right" as const,
            render: (s: SheetStudent) => s.classRank ?? <span className="muted">—</span>
          }
        ]
      : [])
  ];

  const loading = !data;
  return (
    <div className="stack">
      <StatTiles>
        <StatTile label="Students" loading={loading} value={st?.students} hint={st ? `${st.appeared} appeared` : undefined} />
        <StatTile
          label="Passed"
          loading={loading}
          value={st ? `${st.passed}` : undefined}
          hint={st ? `${st.passPercentage ?? 0}% · ${st.compartment} compartment · ${st.failed} failed` : undefined}
          meter={st ? (st.passPercentage ?? 0) : null}
          meterTone="success"
        />
        <StatTile
          label={d?.gradePoints ? "Average GPA" : "Average"}
          loading={loading}
          value={st ? (d?.gradePoints ? (st.averageGpa ?? "—") : pct(st.averagePercentage) || "—") : undefined}
          hint={st ? `Highest ${pct(st.highestPercentage) || "—"}` : undefined}
        />
        <StatTile
          label="Incomplete"
          loading={loading}
          value={st?.incomplete}
          hint={st ? (st.incomplete ? "Marks still to enter" : "Every mark is in") : undefined}
          hintTone={st ? (st.incomplete ? "warn" : "good") : undefined}
        />
      </StatTiles>
      <Card
        flush
        title={data ? data.section.name : "Class sheet"}
        subtitle={<span className="rc-subtitle">{data ? <PolicyLine policy={data.policy} scale={data.gradeScale} /> : " "}</span>}
      >
        <DataTable
          columns={columns}
          rows={data?.students}
          rowKey={s => s.studentId}
          loading={sheet.isLoading}
          onRowClick={onOpenStudent}
          empty={<EmptyState icon={<FileSpreadsheet />} title="No students in this section" />}
        />
      </Card>
    </div>
  );
}
