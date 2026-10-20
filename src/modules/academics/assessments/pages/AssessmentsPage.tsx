/* Teacher assessments: a teacher's own tests, assignments, projects and homework, counted in the
   assessment-scheme buckets an admin sets (e.g. Teacher assessments 20% of Annual). Teachers
   see their sections. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Plus } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Select, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useMyTeaching } from "../../shared/api/teaching";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { useSectionSubjects } from "../../timetable/api/timetable";
import { ASSESSMENTS_PATH, assessmentPath, TYPE_LABELS, useBuckets, type Assessment } from "../api/assessments";
import { AssessmentDrawer } from "../components/AssessmentDrawer";

export default function AssessmentsPage() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const navigate = useNavigate();
  const teaching = useMyTeaching();
  const sections = useSectionOptions();
  const buckets = useBuckets();
  const { params, setParam, setParams, setPage } = useListParams({ sectionId: "", subjectId: "", bucketId: "" });
  const list = useApiList<Assessment>(ASSESSMENTS_PATH, params);
  const sectionSubjects = useSectionSubjects(params.sectionId || null);
  const [creating, setCreating] = useState(false);

  const canCreate =
    can("academics.assessments.manage") && !readOnly && (!teaching.scoped || teaching.sections.length > 0) && buckets.options.some(o => !o.disabled);
  const sectionOptions = teaching.scoped ? sections.options.filter(o => teaching.teaches(o.value)) : sections.options;
  const subjectOptions = (sectionSubjects.data ?? []).map(s => ({ value: s.subjectId, label: s.subject.subjectName }));
  const filtered = !!(params.sectionId || params.subjectId || params.bucketId);

  const columns: Column<Assessment>[] = [
    {
      key: "title",
      header: "Item",
      render: a => (
        <div style={{ minWidth: 180 }}>
          <div className="row" style={{ gap: 8 }}>
            <strong>{a.title}</strong>
            <Badge tone={a.assessmentType === "HOMEWORK" ? "primary" : "neutral"}>{TYPE_LABELS[a.assessmentType]}</Badge>
            {!a.counts && <Badge tone="warning">Not counted</Badge>}
          </div>
          {a.assessedOn && <div className="small muted">{formatDate(a.assessedOn)}</div>}
        </div>
      )
    },
    {
      key: "section",
      header: "Section",
      render: a => {
        const s = sections.byId.get(a.sectionId);
        return <span className="nowrap">{s ? sectionTitle(s) : (a.section?.sectionName ?? "—")}</span>;
      }
    },
    { key: "subject", header: "Subject", render: a => a.subject?.subjectName ?? "—" },
    {
      key: "bucket",
      header: "Counts toward",
      render: a =>
        a.bucket ? (
          <span className="nowrap">
            {a.bucket.name} <span className="muted small">({a.bucket.weight}% of {a.bucket.scheme.name})</span>
            {a.bucket.locked && (
              <>
                {" "}
                <Badge tone="success">Published</Badge>
              </>
            )}
          </span>
        ) : (
          "—"
        )
    },
    { key: "maxMarks", header: "Out of", align: "right", render: a => a.maxMarks },
    {
      key: "entries",
      header: "Entered",
      align: "right",
      render: a => (a.assessmentType === "HOMEWORK" ? <span className="muted small">By grading</span> : (a.entries ?? 0))
    }
  ];

  const newButton = canCreate && (
    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
      Add item
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Teacher assessments"
        subtitle={
          teaching.scoped
            ? "Your tests, assignments, projects and homework. Each subject's items are averaged into its bucket's share of the result."
            : "Tests, assignments, projects and homework teachers add to the schemes' buckets."
        }
        actions={newButton}
      />
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Section"
            className="select-sm"
            value={params.sectionId}
            onChange={e => setParams({ sectionId: e.target.value, subjectId: "" })}
            options={sectionOptions}
            placeholder="All sections"
          />
          <Select
            label="Subject"
            className="select-sm"
            value={params.subjectId}
            onChange={e => setParam("subjectId", e.target.value)}
            options={subjectOptions}
            disabled={!params.sectionId}
            placeholder={params.sectionId ? "All subjects" : "Pick a section"}
          />
          <Select label="Bucket" className="select-sm" value={params.bucketId} onChange={e => setParam("bucketId", e.target.value)} options={buckets.options.map(o => ({ ...o, disabled: false }))} placeholder="All buckets" />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={a => a.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={a => navigate(assessmentPath(a.id))}
          columns={columns}
          empty={
            filtered ? (
              <EmptyState icon={<ClipboardCheck />} title="Nothing matches" message="Try another section, subject or bucket." />
            ) : !buckets.isLoading && !buckets.options.length ? (
              <EmptyState
                icon={<ClipboardCheck />}
                title="No buckets yet"
                message="An admin first gives an assessment scheme a bucket for teachers' work (Setup › Grading › Assessment schemes), e.g. Teacher assessments 20%."
              />
            ) : (
              <EmptyState
                icon={<ClipboardCheck />}
                title="No items yet"
                message="Add class tests, assignments and projects here. Homework counts too: pick its bucket when you set it."
                actions={newButton}
              />
            )
          }
        />
      </Card>
      <AssessmentDrawer open={creating} assessment={null} onClose={() => setCreating(false)} defaults={{ sectionId: params.sectionId, subjectId: params.subjectId, bucketId: params.bucketId }} />
    </div>
  );
}
