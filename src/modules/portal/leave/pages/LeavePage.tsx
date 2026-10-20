import { useState } from "react";
import { CalendarPlus, Plane } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, Dialog, EmptyState, Page, PageHeader, StatusBadge, Tabs, Textarea, useToast, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { ON_LEAVE_PATH, STUDENT_LEAVES_PATH, leaveDates, leaveDays, reasonLabel, type StudentLeave } from "@/modules/academics";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import { cancelLeave, leavePath } from "../api/leave";
import { ApplyLeaveDrawer } from "../components/ApplyLeaveDrawer";

const TABS = [
  { id: "", label: "All" },
  { id: "PENDING", label: "Waiting" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Not approved" },
  { id: "CANCELLED", label: "Cancelled" }
];

const personName = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : "");

/* What the school said, or why it was withdrawn */
const outcome = (r: StudentLeave) => {
  if (r.status === "PENDING") return <span className="muted">Waiting for the class teacher</span>;
  if (r.status === "CANCELLED") return <span className="muted">Cancelled on {formatDate(r.cancelledAt)}{r.cancelReason ? `: ${r.cancelReason}` : ""}</span>;
  return (
    <span>
      {r.decider && <span className="muted">{personName(r.decider)}, {formatDate(r.decidedAt)}</span>}
      {r.decisionNote && <span style={{ display: "block" }}>{r.decisionNote}</span>}
    </span>
  );
};

/* PO-14 · Leave: a parent applies for the child's leave (days or half a day) and follows the
   class teacher's decision; pending leave, or approved leave before it starts, can be
   cancelled. The student sees the list. */
export default function LeavePage() {
  const { student } = usePortalStudent();
  const { can } = useAuth();
  const toast = useToast();
  const canApply = can("portal.leaveRequests.apply");
  const canCancel = can("portal.leaveRequests.cancel");
  const { params, setParams, setPage } = useListParams({ status: "" });
  const path = leavePath(student.id);
  const list = useApiList<StudentLeave>(path, { status: params.status || undefined, page: params.page, limit: params.limit });
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState<StudentLeave | null>(null);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancel = useApiMutation(cancelLeave, { invalidate: [path, STUDENT_LEAVES_PATH, ON_LEAVE_PATH] });

  const closeCancel = () => {
    setCancelling(null);
    setCancelError(null);
    setReason("");
  };
  const confirmCancel = () => {
    if (!cancelling) return;
    setCancelError(null);
    cancel.mutate(
      { studentId: student.id, requestId: cancelling.id, reason: reason.trim() || undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          closeCancel();
        },
        onError: e => setCancelError(errorMessage(e))
      }
    );
  };

  const columns: Column<StudentLeave>[] = [
    {
      key: "dates",
      header: "Dates",
      render: r => (
        <span className="row nowrap" style={{ gap: 6 }}>
          <strong>{leaveDates(r)}</strong>
          {r.session !== "FULL_DAY" && <Badge tone="info">½ day</Badge>}
        </span>
      )
    },
    { key: "days", header: "School days", align: "right", render: r => <span className="nowrap">{leaveDays(r.days)}</span> },
    {
      key: "reason",
      header: "Reason",
      render: r => (
        <span style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 300 }}>
          <span>{reasonLabel(r.reasonCategory)}</span>
          <span className="small muted" title={r.reason} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.reason}
          </span>
        </span>
      )
    },
    { key: "status", header: "Status", render: r => <StatusBadge status={r.status} label={r.status === "REJECTED" ? "Not approved" : undefined} /> },
    { key: "outcome", header: "From the school", render: outcome },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 90,
      render: r =>
        canCancel && r.canCancel ? (
          <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
            Cancel
          </Button>
        ) : null
    }
  ];

  return (
    <Page>
      <PageHeader
        title="Leave"
        subtitle={studentFullName(student)}
        actions={
          canApply && (
            <Button variant="primary" icon={<CalendarPlus />} onClick={() => setApplying(true)}>
              Apply for leave
            </Button>
          )
        }
      />
      {list.error ? (
        <PortalError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <Card flush>
          <div style={{ padding: "0 14px" }}>
            <Tabs tabs={TABS} value={params.status} onChange={id => setParams({ status: id })} />
          </div>
          <DataTable
            rows={list.rows}
            rowKey={r => r.id}
            loading={list.isLoading}
            meta={list.meta}
            onPageChange={setPage}
            columns={columns}
            empty={
              <EmptyState
                icon={<Plane />}
                title={params.status ? "No requests here" : "No leave requests this year"}
                message={canApply ? "When your child will miss school, apply here: the class teacher approves it and the absence is excused." : "Leave your parents apply for shows here."}
              />
            }
          />
        </Card>
      )}

      {canApply && <ApplyLeaveDrawer studentId={student.id} childName={studentFullName(student)} open={applying} onClose={() => setApplying(false)} />}

      <Dialog
        open={!!cancelling}
        onClose={closeCancel}
        title={cancelling ? `Cancel the leave on ${leaveDates(cancelling)}?` : ""}
        footerStatus={cancelError}
        footer={
          <>
            <Button onClick={closeCancel}>Keep it</Button>
            <Button variant="danger" loading={cancel.isPending} onClick={confirmCancel}>
              Cancel leave
            </Button>
          </>
        }
      >
        <div className="stack-sm">
          <p>{cancelling?.status === "APPROVED" ? "The class teacher is told that your child will be in school after all." : "The request is withdrawn before the class teacher decides."}</p>
          <Textarea label="Reason" rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} hint="Optional" />
        </div>
      </Dialog>
    </Page>
  );
}
