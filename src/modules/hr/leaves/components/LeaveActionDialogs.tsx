import { useState } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Textarea, useToast } from "@/common/ui";
import { cancelLeave, decideLeave, LEAVE_REQUESTS_PATH, type LeaveRequest } from "../api/leaves";
import { dateSpan, dayCount } from "../../shared/utils/format";

const INVALIDATE = [LEAVE_REQUESTS_PATH, "/hr/leave-balances", "/hr/staff-attendance"];

const who = (r: LeaveRequest) => [r.user?.firstName, r.user?.lastName].filter(Boolean).join(" ") || "this employee";
const what = (r: LeaveRequest) => `${r.leaveType?.name ?? "Leave"}, ${dateSpan(r.fromDate, r.toDate)} (${r.halfDay ? "half day" : dayCount(r.days)})`;

/* A 409 means someone else got there first: refresh the row and close */
const isStale = (err: unknown) => isApiError(err) && err.status === 409;

/* Approve (note optional) or reject (note required) a pending request. Give it a key per request so it starts empty. */
export function DecisionDialog({
  request,
  decision,
  onClose,
  onDone
}: {
  request: LeaveRequest | null;
  decision: "APPROVED" | "REJECTED";
  onClose: () => void;
  onDone?: (r: LeaveRequest) => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const decide = useApiMutation(decideLeave, { invalidate: INVALIDATE });
  const rejecting = decision === "REJECTED";

  const submit = () => {
    if (!request) return;
    if (rejecting && !note.trim()) return setError("Say why, so the employee knows");
    decide.mutate(
      { id: request.id, decision, note: note.trim() || undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          onDone?.(res.data);
          onClose();
        },
        onError: err => {
          if (isStale(err)) {
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
            {rejecting ? "Reject" : "Approve"} <strong>{who(request)}</strong>'s request for {what(request)}?
            {!rejecting && " The days are marked as leave on the staff register."}
          </p>
          <Textarea
            label={rejecting ? "Reason for rejecting" : "Note"}
            required={rejecting}
            rows={3}
            maxLength={500}
            autoFocus
            value={note}
            error={error}
            hint={rejecting ? "The employee sees this" : "Optional. The employee sees this"}
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

/* Cancel anyone's pending or approved request (HR administrators) */
export function CancelLeaveDialog({ request, onClose, onDone }: { request: LeaveRequest | null; onClose: () => void; onDone?: (r: LeaveRequest) => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const cancel = useApiMutation(cancelLeave, { invalidate: INVALIDATE });

  const submit = () => {
    if (!request) return;
    cancel.mutate(
      { id: request.id, reason: reason.trim() || undefined },
      {
        onSuccess: res => {
          const cleared = res.data.clearedDates?.length ? ` Removed from attendance: ${dayCount(res.data.clearedDates.length)}.` : "";
          toast.success(`${res.message}.${cleared}`);
          onDone?.(res.data);
          onClose();
        },
        onError: err => {
          if (isStale(err)) {
            toast.error(err);
            onClose();
          } else setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  return (
    <Dialog
      open={!!request}
      onClose={onClose}
      title="Cancel leave request"
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Keep it</Button>
          <Button variant="danger" loading={cancel.isPending} onClick={submit}>
            Cancel request
          </Button>
        </>
      }
    >
      {request && (
        <div className="stack">
          <p>
            Cancel <strong>{who(request)}</strong>'s request for {what(request)}?
            {request.status === "APPROVED" && " This removes the leave marks from staff attendance."}
          </p>
          <Textarea label="Reason" rows={3} maxLength={500} autoFocus value={reason} hint="Optional. The employee sees this" onChange={e => setReason(e.target.value)} />
        </div>
      )}
    </Dialog>
  );
}
