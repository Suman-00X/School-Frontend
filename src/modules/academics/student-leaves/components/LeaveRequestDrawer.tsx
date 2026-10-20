import { useState } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, DescriptionList, Dialog, Drawer, StatusBadge, Textarea, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import {
  ON_LEAVE_PATH,
  STUDENT_LEAVES_PATH,
  decideLeave,
  leaveDates,
  leaveDays,
  reasonLabel,
  sectionName,
  studentName,
  type StudentLeave
} from "../api/studentLeaves";

const personName = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : "—");

/* Approving changes absences already marked to excused, so the attendance pages refresh too */
const INVALIDATE = [STUDENT_LEAVES_PATH, ON_LEAVE_PATH, "/academics/attendance"];

/* AC-09c drawer: the whole request, its decision or cancellation, and Approve / Reject for
   the class teacher or deputy, the principal or an admin */
export function LeaveRequestDrawer({
  request: r,
  onClose,
  onDecide
}: {
  request: StudentLeave | null;
  onClose: () => void;
  onDecide: (r: StudentLeave, decision: "APPROVED" | "REJECTED") => void;
}) {
  return (
    <Drawer
      open={!!r}
      onClose={onClose}
      title={r ? studentName(r) : "Leave request"}
      subtitle={r && <span className="row" style={{ gap: 6 }}>{sectionName(r)} <StatusBadge status={r.status} /></span>}
      footerStatus={r?.status === "PENDING" && !r.canDecide ? "The class teacher or deputy of this section decides." : undefined}
      footer={
        r?.canDecide ? (
          <>
            <Button variant="danger" onClick={() => onDecide(r, "REJECTED")}>
              Reject
            </Button>
            <Button variant="primary" onClick={() => onDecide(r, "APPROVED")}>
              Approve
            </Button>
          </>
        ) : undefined
      }
    >
      {r && (
        <DescriptionList
          columns={2}
          items={[
            { label: "Dates", value: leaveDates(r) },
            { label: "School days", value: leaveDays(r.days) },
            { label: "Reason", value: reasonLabel(r.reasonCategory) },
            { label: "Applied", value: `${formatDateTime(r.createdAt)} by ${personName(r.requester)}` },
            { label: "What the parent wrote", value: <span style={{ whiteSpace: "pre-wrap" }}>{r.reason}</span>, wide: true },
            { label: r.status === "REJECTED" ? "Rejected" : "Approved", value: `${formatDateTime(r.decidedAt)} by ${personName(r.decider)}`, hidden: !r.decidedAt },
            { label: "Note to the family", value: r.decisionNote, hidden: !r.decisionNote, wide: true },
            { label: "Cancelled", value: `${formatDateTime(r.cancelledAt)} by ${personName(r.canceller)}`, hidden: !r.cancelledAt },
            { label: "Why", value: r.cancelReason, hidden: !r.cancelReason, wide: true }
          ]}
        />
      )}
    </Drawer>
  );
}

/* Approve (note optional) or reject (reason required). Give it a key per request so it starts empty. */
export function LeaveDecisionDialog({
  request,
  decision,
  onClose,
  onDone
}: {
  request: StudentLeave | null;
  decision: "APPROVED" | "REJECTED";
  onClose: () => void;
  onDone?: (r: StudentLeave) => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const decide = useApiMutation(decideLeave, { invalidate: INVALIDATE });
  const rejecting = decision === "REJECTED";

  const submit = () => {
    if (!request) return;
    if (rejecting && !note.trim()) return setError("Say why, so the family knows");
    decide.mutate(
      { id: request.id, decision, note: note.trim() || undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          onDone?.(res.data);
          onClose();
        },
        onError: err => {
          /* 409: decided or withdrawn meanwhile */
          if (isApiError(err) && err.status === 409) {
            toast.error(err);
            onClose();
          } else if (isApiError(err) && err.isValidation) setError(err.fieldErrors().note ?? err.message);
          else setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  return (
    <Dialog
      open={!!request}
      onClose={onClose}
      title={rejecting ? "Reject leave request" : "Approve leave request"}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={rejecting ? "danger" : "primary"} loading={decide.isPending} onClick={submit}>
            {rejecting ? "Reject" : "Approve"}
          </Button>
        </>
      }
    >
      {request && (
        <div className="stack">
          <p>
            {rejecting ? "Reject" : "Approve"} leave for <strong>{studentName(request)}</strong> on {leaveDates(request)} ({leaveDays(request.days)})?
            {!rejecting && " Absences already marked on those days become excused, and the register shows the leave."}
          </p>
          <Textarea
            label={rejecting ? "Reason for rejecting" : "Note to the family"}
            required={rejecting}
            rows={3}
            maxLength={500}
            autoFocus
            value={note}
            error={error}
            hint={rejecting ? "The parents see this" : "Optional. The parents see this"}
            onChange={e => {
              setNote(e.target.value);
              setError(null);
            }}
          />
        </div>
      )}
    </Dialog>
  );
}
