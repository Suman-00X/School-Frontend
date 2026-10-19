/* AC-16 · Homework: work set for sections, with how many students handed it in and how many
   were graded. Teachers see their sections. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotebookPen, Plus } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Page, Select, TextInput, type Column } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { useMyTeaching } from "../../shared/api/teaching";
import { PageIntro } from "../../shared/components/PageIntro";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { useSectionSubjects } from "../../timetable/api/timetable";
import { HOMEWORK_PATH, homeworkPath, useSubjects, type Homework } from "../api/homework";
import { HomeworkDrawer } from "../components/HomeworkDrawer";

export default function HomeworkListPage() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const navigate = useNavigate();
  const teaching = useMyTeaching();
  const sections = useSectionOptions();
  const { params, setParam, setParams, setPage } = useListParams({ sectionId: "", subjectId: "", from: "", to: "" });
  const list = useApiList<Homework>(HOMEWORK_PATH, params);
  const allSubjects = useSubjects();
  const sectionSubjects = useSectionSubjects(params.sectionId || null);
  const [creating, setCreating] = useState(false);
  const today = todayIso();

  /* A teacher can set homework once they teach somewhere */
  const canCreate = can("academics.homework.manage") && !readOnly && (!teaching.scoped || teaching.sections.length > 0);
  const subjectOptions = params.sectionId
    ? (sectionSubjects.data ?? []).map(s => ({ value: s.subjectId, label: s.subject.subjectName }))
    : (allSubjects.data ?? []).map(s => ({ value: s.id, label: s.subjectName }));
  const filtered = !!(params.sectionId || params.subjectId || params.from || params.to);

  const columns: Column<Homework>[] = [
    {
      key: "title",
      header: "Title",
      render: h => (
        <div style={{ minWidth: 180 }}>
          <strong>{h.title}</strong>
          <div className="small muted">Set {formatDate(h.assignedOn)}</div>
        </div>
      )
    },
    {
      key: "section",
      header: "Section",
      render: h => {
        const s = sections.byId.get(h.sectionId);
        return <span className="nowrap">{s ? sectionTitle(s) : "—"}</span>;
      }
    },
    { key: "subject", header: "Subject", render: h => h.subject?.subjectName ?? "—" },
    {
      key: "dueDate",
      header: "Due",
      render: h => (
        <span className="row nowrap" style={{ gap: 6 }}>
          {formatDate(h.dueDate)}
          {h.dueDate < today ? <Badge>Past</Badge> : h.dueDate === today ? <Badge tone="warning">Today</Badge> : null}
        </span>
      )
    },
    {
      key: "submissions",
      header: "Submitted / graded",
      align: "right",
      render: h => (
        <span className="nowrap">
          {h.submissions?.submitted ?? 0} / {h.submissions?.graded ?? 0}
        </span>
      )
    },
    { key: "maxMarks", header: "Marks", align: "right", render: h => (h.maxMarks === null ? <span className="muted">Feedback</span> : `out of ${h.maxMarks}`) },
    { key: "late", header: "Late allowed", render: h => (h.allowLateSubmission ? "Yes" : <span className="muted">No</span>) }
  ];

  const newButton = canCreate && (
    <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
      Set homework
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={newButton}>
        {teaching.scoped ? "Homework in your sections. Open one to see who handed it in and to grade it." : "Homework set across the school, by due date. Open one to see submissions."}
      </PageIntro>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Section"
            className="select-sm"
            value={params.sectionId}
            onChange={e => setParams({ sectionId: e.target.value, subjectId: "" })}
            options={sections.options}
            placeholder="All sections"
          />
          <Select label="Subject" className="select-sm" value={params.subjectId} onChange={e => setParam("subjectId", e.target.value)} options={subjectOptions} placeholder="All subjects" />
          <TextInput label="Due from" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="Due to" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={h => h.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={h => navigate(homeworkPath(h.id))}
          columns={columns}
          empty={
            filtered ? (
              <EmptyState icon={<NotebookPen />} title="No homework matches" message="Try another section, subject or due dates." />
            ) : (
              <EmptyState icon={<NotebookPen />} title="No homework yet" message="Homework set for a section shows here with its submissions." actions={newButton} />
            )
          }
        />
      </Card>
      <HomeworkDrawer open={creating} homework={null} onClose={() => setCreating(false)} defaults={{ sectionId: params.sectionId, subjectId: params.subjectId }} />
    </Page>
  );
}
