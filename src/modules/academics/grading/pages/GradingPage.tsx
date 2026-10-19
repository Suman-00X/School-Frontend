/* AC-06 · Grading setup (Academics › Setup): grade scales, result policies, where policies apply,
   and assessment schemes. Configuration only; publishing results is on the exams pages. */
import { useState } from "react";
import { Layers, Plus, Scale, Sigma } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Page, PageHeader, Select, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { SCHEMES_PATH, type AssessmentScheme } from "../api/assessmentSchemes";
import { GRADE_SCALES_PATH, bandSummary, passFrom, type GradeScale } from "../api/gradeScales";
import { GRADING_MODES, gradingModeLabel, RESULT_POLICIES_PATH, type ResultPolicy } from "../api/resultPolicies";
import { GradeScaleDrawer } from "../components/GradeScaleDrawer";
import { PolicyAssignments } from "../components/PolicyAssignments";
import { PolicyDrawer } from "../components/PolicyDrawer";
import { SchemeDrawer } from "../components/SchemeDrawer";
import "../../shared/components/setup.css";

const SUBTITLES: Record<string, string> = {
  scales: "Grade bands from 0% to 100%, school-wide. Exams and policies use the default unless they name another.",
  policies: "How marks become results: pass rules, grace, absences, ranking and rounding. School-wide.",
  assignments: "Which policy an exam, a class, or an exam in one class uses. The most specific one wins.",
  schemes: "Term and annual results that combine exams of the year with weights."
};

export default function GradingPage() {
  const { can } = useAuth();
  const { selected: year, readOnly } = useAcademicYear();
  const tabs: TabItem[] = [
    { id: "scales", label: "Grade scales", hidden: !can("academics.gradeScales.read") },
    { id: "policies", label: "Result policies", hidden: !can("academics.resultPolicies.read") },
    { id: "assignments", label: "Policy assignments", hidden: !can("academics.resultPolicies.read") },
    { id: "schemes", label: "Assessment schemes", hidden: !can("academics.assessmentSchemes.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const canScales = can("academics.gradeScales.manage");
  const canPolicies = can("academics.resultPolicies.manage");
  /* Schemes belong to a year: none are written in an archived one */
  const canSchemes = can("academics.assessmentSchemes.manage") && !readOnly;
  const [scale, setScale] = useState<{ scale: GradeScale | null } | null>(null);
  const [policy, setPolicy] = useState<{ policy: ResultPolicy | null } | null>(null);
  const [scheme, setScheme] = useState<{ scheme: AssessmentScheme | null } | null>(null);

  const action =
    tab === "scales" && canScales ? (
      <Button variant="primary" icon={<Plus />} onClick={() => setScale({ scale: null })}>
        New scale
      </Button>
    ) : tab === "policies" && canPolicies ? (
      <Button variant="primary" icon={<Plus />} onClick={() => setPolicy({ policy: null })}>
        New policy
      </Button>
    ) : tab === "schemes" && canSchemes ? (
      <Button variant="primary" icon={<Plus />} onClick={() => setScheme({ scheme: null })}>
        New scheme
      </Button>
    ) : undefined;

  return (
    <Page>
      <PageHeader title="Grading" subtitle={tab === "schemes" ? `${SUBTITLES.schemes} ${year ? `Showing ${year.yearName}.` : ""}` : SUBTITLES[tab]} actions={action} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "scales" && <ScalesTab onOpen={s => setScale({ scale: s })} onCreate={canScales ? () => setScale({ scale: null }) : undefined} />}
      {tab === "policies" && <PoliciesTab onOpen={p => setPolicy({ policy: p })} onCreate={canPolicies ? () => setPolicy({ policy: null }) : undefined} />}
      {tab === "assignments" && <PolicyAssignments canManage={canPolicies} />}
      {tab === "schemes" && <SchemesTab onOpen={s => setScheme({ scheme: s })} onCreate={canSchemes ? () => setScheme({ scheme: null }) : undefined} />}
      {scale && <GradeScaleDrawer key={scale.scale?.id ?? "new"} scale={scale.scale} canManage={canScales} onClose={() => setScale(null)} />}
      {policy && <PolicyDrawer key={policy.policy?.id ?? "new"} policy={policy.policy} canManage={canPolicies} onClose={() => setPolicy(null)} />}
      {scheme && <SchemeDrawer key={scheme.scheme?.id ?? "new"} scheme={scheme.scheme} canManage={canSchemes} onClose={() => setScheme(null)} />}
    </Page>
  );
}

function ScalesTab({ onOpen, onCreate }: { onOpen: (s: GradeScale) => void; onCreate?: () => void }) {
  const { params, setPage } = useListParams({});
  const list = useApiList<GradeScale>(GRADE_SCALES_PATH, { page: params.page, limit: params.limit });
  return (
    <Card flush>
      <DataTable
        rows={list.rows}
        rowKey={s => s.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={onOpen}
        empty={
          <EmptyState
            icon={<Scale />}
            title="No grade scales yet"
            message="Start from a ready-made scale (CBSE, IB, US letter grades…) or build your own bands."
            actions={
              onCreate && (
                <Button variant="primary" icon={<Plus />} onClick={onCreate}>
                  New scale
                </Button>
              )
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Scale",
            render: s => (
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ fontWeight: 550 }}>{s.name}</span>
                  {s.isDefault && <Badge tone="success">Default</Badge>}
                </div>
                {s.description && <div className="small muted">{s.description}</div>}
              </div>
            )
          },
          { key: "grades", header: "Grades", render: s => bandSummary(s.bands) },
          {
            key: "pass",
            header: "Passes from",
            render: s => {
              const p = passFrom(s.bands);
              return p === null ? <span className="muted">Every grade passes</span> : `${p}%`;
            }
          },
          { key: "points", header: "Grade points", render: s => (s.bands.some(b => b.gradePoint !== null && b.gradePoint !== undefined) ? `Up to ${Math.max(...s.bands.map(b => b.gradePoint ?? 0))}` : <span className="muted">None</span>) }
        ]}
      />
    </Card>
  );
}

function PoliciesTab({ onOpen, onCreate }: { onOpen: (p: ResultPolicy) => void; onCreate?: () => void }) {
  const { params, setParam, setPage } = useListParams({ mode: "" });
  const list = useApiList<ResultPolicy>(RESULT_POLICIES_PATH, { page: params.page, limit: params.limit, gradingMode: params.mode || undefined });
  return (
    <Card flush>
      <div className="filter-bar">
        <Select label="Results show" options={GRADING_MODES.map(m => ({ value: m.value, label: m.label }))} value={params.mode} placeholder="Any" onChange={e => setParam("mode", e.target.value)} />
      </div>
      <DataTable
        rows={list.rows}
        rowKey={p => p.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={onOpen}
        empty={
          <EmptyState
            icon={<Layers />}
            title={params.mode ? `No ${gradingModeLabel(params.mode).toLowerCase()} policies` : "No result policies yet"}
            message={params.mode ? undefined : "Results follow the built-in standard rules until you create a policy and make it the school default."}
            actions={
              onCreate &&
              !params.mode && (
                <Button variant="primary" icon={<Plus />} onClick={onCreate}>
                  New policy
                </Button>
              )
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Policy",
            render: p => (
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ fontWeight: 550 }}>{p.name}</span>
                  {p.isDefault && <Badge tone="success">School default</Badge>}
                </div>
                {p.description && <div className="small muted">{p.description}</div>}
              </div>
            )
          },
          { key: "mode", header: "Results show", render: p => <Badge>{p.gradingMode === "GPA" ? `GPA (${p.gpaScale}-point)` : gradingModeLabel(p.gradingMode)}</Badge> },
          {
            key: "pass",
            header: "Pass marks",
            render: p =>
              [p.subjectMinPercent !== null && `${p.subjectMinPercent}% a subject`, p.overallMinPercent !== null && `${p.overallMinPercent}% overall`].filter(Boolean).join(", ") || (
                <span className="muted">{p.usePaperPassMarks ? "Paper pass marks" : "—"}</span>
              )
          },
          { key: "ranking", header: "Ranks", render: p => (p.rankingMethod === "NONE" ? <span className="muted">No ranks</span> : p.rankScope === "BOTH" ? "Section and class" : p.rankScope === "CLASS" ? "Class" : "Section") }
        ]}
      />
    </Card>
  );
}

function SchemesTab({ onOpen, onCreate }: { onOpen: (s: AssessmentScheme) => void; onCreate?: () => void }) {
  const { params, setPage } = useListParams({});
  const list = useApiList<AssessmentScheme>(SCHEMES_PATH, { page: params.page, limit: params.limit });
  return (
    <Card flush>
      <DataTable
        rows={list.rows}
        rowKey={s => s.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={onOpen}
        empty={
          <EmptyState
            icon={<Sigma />}
            title="No assessment schemes this year"
            message="A scheme combines exams into one result, e.g. Term 1 = Unit test 1 (20%) + Half-yearly (80%)."
            actions={
              onCreate && (
                <Button variant="primary" icon={<Plus />} onClick={onCreate}>
                  New scheme
                </Button>
              )
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Scheme",
            render: s => (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 550 }}>{s.name}</div>
                {s.description && <div className="small muted">{s.description}</div>}
              </div>
            )
          },
          { key: "exams", header: "Exams", render: s => s.exams.map(e => `${e.exam?.examName ?? "Exam"} ${e.weight}%`).join(" + ") },
          { key: "policy", header: "Policy", render: s => s.policy?.name ?? <span className="muted">Class or school default</span> },
          { key: "published", header: "Results", render: s => (s.resultsPublishedAt ? <Badge tone="success">Published {formatDate(s.resultsPublishedAt)}</Badge> : <span className="muted">Not published</span>) }
        ]}
      />
    </Card>
  );
}
