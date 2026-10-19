import { useNavigate } from "react-router-dom";
import { ClipboardList, Trophy } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useListParams } from "@/common/hooks";
import { Badge, BarList, Card, DataTable, EmptyState, Select, StatTile, StatTiles } from "@/common/ui";
import { enumLabel } from "@/common/utils/format";
import { DASHBOARDS_PATH, pct, type AcademicsReport } from "../api/dashboards";
import { examOption, useExams } from "../../shared/api/exams";
import { ChartCard, DashboardError, MiniTable } from "./ChartCard";

/* RP-01 Academics: one exam's results across every section that sat it */
export function AcademicsTab() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setParam } = useListParams({ examId: "" });
  const exams = useExams();
  const q = useApiGet<AcademicsReport>(params.examId ? `${DASHBOARDS_PATH}/academics` : null, { examId: params.examId });
  const d = q.data;
  const loading = !!params.examId && !d && !q.error;
  const hasGpa = d?.overall.averageGpa !== null && d?.overall.averageGpa !== undefined;

  const picker = (
    <Card flush>
      <div className="filter-bar">
        <Select
          label="Exam"
          className="select-sm"
          fieldClassName="filter-wide"
          value={params.examId}
          required
          placeholder={exams.isLoading ? "Loading exams…" : exams.data?.length === 0 ? "No exams this year" : "Pick an exam"}
          options={(exams.data ?? []).map(examOption)}
          onChange={e => setParam("examId", e.target.value)}
        />
        <span style={{ paddingBottom: 6 }}>{d && !d.exam.resultsPublishedAt ? <Badge tone="warning">Not published yet: live marks</Badge> : d ? <Badge tone="success">Results published</Badge> : null}</span>
      </div>
    </Card>
  );

  if (!params.examId)
    return (
      <div className="stack">
        {picker}
        <Card>
          <EmptyState icon={<ClipboardList />} title="Pick an exam to see its results" message="Pass rates, section averages, subject averages and the top students." />
        </Card>
      </div>
    );

  if (q.error)
    return (
      <div className="stack">
        {picker}
        <DashboardError error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );

  const o = d?.overall;
  const subjects = [...(d?.bySubject ?? [])].sort((a, b) => (b.averageMarks ?? -1) - (a.averageMarks ?? -1));

  return (
    <div className="stack" style={{ opacity: q.isFetching && d ? 0.7 : 1, transition: "opacity .15s" }}>
      {picker}
      <StatTiles>
        <StatTile loading={loading} label="Students" value={o?.students} hint={o && `${o.students - o.incomplete} with a result`} />
        <StatTile
          loading={loading}
          label="Pass rate"
          value={pct(o?.passPercentage)}
          hint={o && (o.passPercentage === null ? "No results yet" : `${o.passed} passed`)}
          meter={o?.passPercentage ?? null}
          meterTone={o?.passPercentage == null ? "primary" : o.passPercentage >= 90 ? "success" : o.passPercentage >= 70 ? "warning" : "danger"}
        />
        <StatTile loading={loading} label="Compartment" value={o?.compartment} hint="To re-sit a subject" />
        <StatTile loading={loading} label="Failed" value={o?.failed} hintTone={o?.failed ? "bad" : undefined} hint={o && (o.failed ? "Need follow-up" : "Nobody failed")} />
        <StatTile loading={loading} label="Incomplete" value={o?.incomplete} hint="Marks missing" />
        {hasGpa && <StatTile label="Average GPA" value={o!.averageGpa} hint="Across students with a GPA" />}
      </StatTiles>

      <Card flush title="By section" subtitle="Each section under its own result policy">
        <DataTable
          rows={d?.bySection}
          loading={loading}
          rowKey={s => s.section.id}
          columns={[
            { key: "section", header: "Section", render: s => <strong>{s.section.name}</strong> },
            {
              key: "policy",
              header: "Policy",
              render: s => (
                <span>
                  {s.policy.name} <span className="muted small">· {enumLabel(s.policy.gradingMode)}</span>
                </span>
              )
            },
            { key: "students", header: "Students", align: "right", render: s => `${s.appeared} / ${s.students}` },
            { key: "passed", header: "Passed", align: "right" },
            { key: "compartment", header: "Comp.", align: "right" },
            { key: "failed", header: "Failed", align: "right" },
            { key: "incomplete", header: "Incomplete", align: "right" },
            { key: "passPercentage", header: "Pass rate", align: "right", render: s => <strong>{pct(s.passPercentage)}</strong> },
            { key: "averagePercentage", header: "Average", align: "right", render: s => pct(s.averagePercentage) },
            { key: "highestPercentage", header: "Highest", align: "right", render: s => pct(s.highestPercentage) },
            ...(hasGpa ? [{ key: "averageGpa", header: "GPA", align: "right" as const, render: (s: AcademicsReport["bySection"][number]) => s.averageGpa ?? "—" }] : [])
          ]}
          empty={<EmptyState title="No section sat this exam" />}
        />
      </Card>

      <div className="dash-grid">
        <ChartCard
          title="Subject averages"
          subtitle="Average marks across every section"
          loading={loading}
          minHeight={200}
          chart={
            <BarList
              ariaLabel="Average marks by subject"
              items={subjects.map(s => ({ key: s.subject.id, label: s.subject.subjectName, value: s.averageMarks }))}
              formatValue={v => v.toFixed(1)}
              empty="No marks entered yet"
            />
          }
          table={<MiniTable head={["Subject", "Code", "Average"]} rows={subjects.map(s => [s.subject.subjectName, s.subject.subjectCode, s.averageMarks ?? "—"])} />}
        />
        <Card flush title="Top students" subtitle="Top 10">
          <DataTable
            rows={d?.toppers}
            loading={loading}
            rowKey={s => s.studentId}
            onRowClick={can("users.students.read") ? s => navigate(`/users/students/${s.studentId}?tab=results`) : undefined}
            columns={[
              { key: "rank", header: "#", width: 36, render: s => (d?.toppers.indexOf(s) ?? 0) + 1 },
              { key: "name", header: "Student", render: s => `${s.firstName} ${s.lastName}` },
              { key: "section", header: "Section" },
              { key: "percentage", header: "Score", align: "right", render: s => <strong>{pct(s.percentage)}</strong> },
              { key: "grade", header: "Grade", render: s => s.grade ?? (s.gpa !== null ? `GPA ${s.gpa}` : <span className="muted">—</span>) }
            ]}
            empty={<EmptyState icon={<Trophy />} title="No results yet" />}
          />
        </Card>
      </div>
    </div>
  );
}
