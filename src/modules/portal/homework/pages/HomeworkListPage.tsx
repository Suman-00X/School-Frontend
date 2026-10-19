import { useNavigate } from "react-router-dom";
import { BookOpenCheck } from "lucide-react";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Card, DataTable, EmptyState, Page, PageHeader, Tabs, type Column } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import { HOMEWORK_STATUS_LABELS, HOMEWORK_STATUS_TONES, homeworkListPath, type Homework } from "../api/homework";

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "submitted", label: "Submitted" },
  { id: "graded", label: "Graded" }
];
const EMPTY: Record<string, { title: string; message: string }> = {
  pending: { title: "Nothing pending", message: "New homework from the teachers shows here." },
  submitted: { title: "Nothing waiting for marks", message: "Submitted homework stays here until the teacher grades it." },
  graded: { title: "Nothing graded yet", message: "Marks and feedback show here once the teacher grades a submission." }
};

/* PO-04 · Homework: the child's homework this year by status. Rows open the homework. */
export default function HomeworkListPage() {
  const { student } = usePortalStudent();
  const navigate = useNavigate();
  const { params, setParams, setPage } = useListParams({ status: "pending" });
  const list = useApiList<Homework>(homeworkListPath(student.id), { status: params.status, page: params.page, limit: params.limit });
  const today = todayIso();

  const columns: Column<Homework>[] = [
    { key: "subject", header: "Subject", width: 150, render: h => h.subject?.subjectName ?? <span className="muted">—</span> },
    { key: "title", header: "Title", render: h => <strong style={{ fontWeight: 550 }}>{h.title}</strong> },
    {
      key: "dueDate",
      header: "Due",
      width: 130,
      render: h => {
        const late = (h.myStatus === "NOT_SUBMITTED" || h.myStatus === "RETURNED") && h.dueDate < today;
        return <span className={`nowrap${late ? " po-danger" : ""}`}>{formatDate(h.dueDate)}</span>;
      }
    },
    {
      key: "status",
      header: "Status",
      width: 150,
      render: h => (
        <Badge tone={HOMEWORK_STATUS_TONES[h.myStatus]} dot>
          {HOMEWORK_STATUS_LABELS[h.myStatus]}
        </Badge>
      )
    },
    {
      key: "marks",
      header: "Marks",
      width: 90,
      align: "right",
      render: h =>
        h.mySubmission?.marksAwarded !== null && h.mySubmission?.marksAwarded !== undefined ? (
          <span className="po-num">
            {h.mySubmission.marksAwarded}
            {h.maxMarks ? ` / ${h.maxMarks}` : ""}
          </span>
        ) : (
          <span className="muted">{h.maxMarks ? `– / ${h.maxMarks}` : "—"}</span>
        )
    }
  ];

  return (
    <Page>
      <PageHeader title="Homework" subtitle={studentFullName(student)} />
      <Card flush>
        <div style={{ padding: "0 14px" }}>
          <Tabs tabs={TABS} value={params.status} onChange={id => setParams({ status: id })} />
        </div>
        {list.error ? (
          <PortalError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            rows={list.rows}
            rowKey={h => h.id}
            loading={list.isLoading}
            columns={columns}
            meta={list.meta}
            onPageChange={setPage}
            onRowClick={h => navigate(`${homeworkListPath(student.id)}/${h.id}`)}
            empty={<EmptyState icon={<BookOpenCheck />} title={EMPTY[params.status]?.title ?? "Nothing here"} message={EMPTY[params.status]?.message} />}
          />
        )}
      </Card>
    </Page>
  );
}
