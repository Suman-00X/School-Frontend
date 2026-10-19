import { useState } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { ATTENDANCE_INVALIDATE, markFree, removeFree } from "../api/attendance";

const message = (e: unknown) => (isApiError(e) ? e.message : "Something went wrong. Please try again.");

/* AC-10: mark a period free (nobody of the section can cover it). Marking it again changes the reason. */
export function MarkFreeDialog({
  target,
  locked,
  onClose
}: {
  target: { sectionId: string; sectionLabel: string; date: string; periodNumber: number; periodName: string; reason?: string } | null;
  locked: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState(target?.reason ?? "");
  const [override, setOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mark = useApiMutation(markFree, { invalidate: ATTENDANCE_INVALIDATE });
  if (!target) return null;

  const submit = () => {
    setError(null);
    if (!reason.trim()) return setError("Say why the period is free.");
    if (locked && !override.trim()) return setError("This date is locked: give the reason for the change.");
    mark.mutate(
      {
        sectionId: target.sectionId,
        date: target.date,
        periodNumber: target.periodNumber,
        reason: reason.trim(),
        ...(locked && { overrideReason: override.trim() })
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: e => setError(message(e))
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Mark ${target.periodName} of ${target.sectionLabel} free`}
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mark.isPending} onClick={submit}>
            Mark free
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          {formatDate(target.date)}. A free period has no register: it is never a missing register and counts in nobody's attendance.
        </p>
        <Textarea label="Reason" required rows={2} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Science teacher on leave" error={undefined} />
        {locked && (
          <TextInput label="Reason for changing a locked date" required maxLength={500} value={override} onChange={e => setOverride(e.target.value)} error={undefined} />
        )}
      </div>
    </Dialog>
  );
}

/* Remove a free period, so its register can be taken. Past the edit window it needs a reason. */
export function RemoveFreeDialog({
  target,
  locked,
  onClose
}: {
  target: { id: string; label: string; sectionLabel: string; date: string; reason: string } | null;
  locked: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [override, setOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const remove = useApiMutation(removeFree, { invalidate: ATTENDANCE_INVALIDATE });
  if (!target) return null;

  const submit = () => {
    setError(null);
    if (locked && !override.trim()) return setError("This date is locked: give the reason for the change.");
    remove.mutate(
      { id: target.id, ...(locked && { overrideReason: override.trim() }) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: e => setError(message(e))
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Remove the free period?`}
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={submit}>
            Remove free period
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>
          {target.label} of {target.sectionLabel} on {formatDate(target.date)} is no longer free ({target.reason}). Its register can then be taken, and it counts as
          missing until it is.
        </p>
        {locked && (
          <TextInput label="Reason for changing a locked date" required maxLength={500} value={override} onChange={e => setOverride(e.target.value)} error={undefined} />
        )}
      </div>
    </Dialog>
  );
}
