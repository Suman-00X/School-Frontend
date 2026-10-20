/* AC-13 · Exams and papers: the exams of the header's academic year */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, ListPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Menu, MenuItem, PageHeader, type Column } from "@/common/ui";
import { EXAMS_PATH, EXAM_TYPE_LABELS, useAllExams, type Exam } from "../api/exams";
import { useGradeScales } from "../api/grading";
import { BulkExamsDialog } from "../components/BulkExamsDialog";
import { ExamDrawer } from "../components/ExamDrawer";
import { ResultsBadge, useRemoveExam } from "../components/ExamBits";
import { examDates } from "../utils/dates";

export default function ExamsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { selected: year, readOnly } = useAcademicYear();
  const { params, setPage } = useListParams({});
  const list = useApiList<Exam>(EXAMS_PATH, {
    page: params.page,
    limit: params.limit
  });
  const scales = useGradeScales();
  const all = useAllExams();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [planning, setPlanning] = useState(false);
  const removeExam = useRemoveExam();

  const canCreate = can("academics.exams.create") && !readOnly;
  const canEdit = can("academics.exams.update") && !readOnly;
  const canRemove = can("academics.exams.remove") && !readOnly;

  /* ?new=1 (the quick-add shortcut) opens the empty drawer */
  const [search, setSearch] = useSearchParams();
  const wantsNew = canCreate && search.get("new") === "1";
  const closeCreate = () => {
    setCreating(false);
    if (search.has("new"))
      setSearch(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete("new");
          return next;
        },
        { replace: true }
      );
  };
  const yearName = year?.yearName ?? "this year";

  const columns: Column<Exam>[] = [
    {
      key: "examName",
      header: "Exam",
      render: e => (
        <div className="row" style={{ gap: 8 }}>
          <strong>{e.examName}</strong>
          {e.examType && <Badge tone={e.examType === "FINAL" ? "primary" : "neutral"}>{EXAM_TYPE_LABELS[e.examType]}</Badge>}
        </div>
      )
    },
    {
      key: "dates",
      header: "Dates",
      render: e => <span className="nowrap">{examDates(e) || <span className="muted">Not set</span>}</span>
    },
    {
      key: "gradeScale",
      header: "Grade scale",
      render: e =>
        e.gradeScaleId ? (scales.byId.get(e.gradeScaleId)?.name ?? <span className="muted">—</span>) : <span className="muted">Policy's scale</span>
    },
    {
      key: "results",
      header: "Results",
      render: e => <ResultsBadge exam={e} />
    },
    {
      key: "description",
      header: "Description",
      render: e => <span className="muted">{e.description || "—"}</span>
    },
    ...(canEdit || canRemove
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            width: 60,
            render: (e: Exam) => (
              <div className="row-actions" onClick={ev => ev.stopPropagation()}>
                <Menu
                  trigger={toggle => (
                    <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`More actions for ${e.examName}`} title="More" />
                  )}
                >
                  {close => (
                    <>
                      {canEdit && (
                        <MenuItem
                          icon={<Pencil />}
                          onClick={() => {
                            close();
                            setEditing(e);
                          }}
                        >
                          Edit exam
                        </MenuItem>
                      )}
                      {canRemove && (
                        <MenuItem
                          icon={<Trash2 />}
                          danger
                          onClick={() => {
                            close();
                            void removeExam(e);
                          }}
                        >
                          Remove exam
                        </MenuItem>
                      )}
                    </>
                  )}
                </Menu>
              </div>
            )
          }
        ]
      : [])
  ];

  const actions = canCreate && (
    <>
      <Button icon={<ListPlus />} onClick={() => setPlanning(true)}>
        Plan several
      </Button>
      <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
        New exam
      </Button>
    </>
  );

  return (
    <div className="stack">
      <PageHeader title="Exams" subtitle={`Exams of ${yearName}, their papers and date sheets. Open an exam to add papers.`} actions={actions} />
      <Card flush>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={e => e.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={e => navigate(`${EXAMS_PATH}/${e.id}`)}
          empty={
            <EmptyState
              icon={<ClipboardList />}
              title={`No exams in ${yearName} yet`}
              message="Create the year's exams (unit tests, half-yearly, annual), then add a paper for each subject a section sits."
              actions={actions}
            />
          }
        />
      </Card>
      <ExamDrawer open={creating || wantsNew} exam={null} onClose={closeCreate} />
      {editing && <ExamDrawer open exam={editing} onClose={() => setEditing(null)} />}
      {planning && <BulkExamsDialog open onClose={() => setPlanning(false)} yearName={yearName} existing={all.exams.map(e => e.examName)} />}
    </div>
  );
}
