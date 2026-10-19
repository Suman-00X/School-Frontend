import { type FormEvent } from "react";
import { Ban, CalendarClock } from "lucide-react";
import { changedFields, useForm } from "@/common/hooks";
import {
  Alert,
  Badge,
  Button,
  DescriptionList,
  Drawer,
  ErrorState,
  RoleBadge,
  SkeletonBlock,
  StatusBadge,
  TextInput,
  Textarea,
  useToast
} from "@/common/ui";
import { formatDate, formatDateTime, fullName, todayIso } from "@/common/utils/format";
import { accessName, useAssignment, useUpdateAssignment, type Assignment } from "../api/access";

export const isLive = (a: Assignment) => a.status === "ACTIVE" || a.status === "SCHEDULED";

/* One assignment, with who made and who ended it */
export function AssignmentDetailDrawer({
  id,
  onClose,
  canChange,
  onEdit,
  onRevoke
}: {
  id: string | null;
  onClose: () => void;
  canChange: (a: Assignment) => boolean;
  onEdit: (a: Assignment) => void;
  onRevoke: (a: Assignment) => void;
}) {
  const q = useAssignment(id);
  const a = q.data;
  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={a ? `${fullName(a.user)}: ${accessName(a)}` : "Assignment"}
      subtitle={a ? `${a.moduleLabel} module` : undefined}
      footer={
        a &&
        isLive(a) &&
        canChange(a) && (
          <>
            <Button icon={<Ban />} onClick={() => onRevoke(a)}>
              Revoke
            </Button>
            <Button variant="primary" icon={<CalendarClock />} onClick={() => onEdit(a)}>
              Edit dates
            </Button>
          </>
        )
      }
    >
      {q.isLoading && <SkeletonBlock lines={8} />}
      {q.error && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {a && (
        <div className="stack">
          <DescriptionList
            items={[
              {
                label: "Person",
                value: (
                  <span className="row">
                    {fullName(a.user)} <RoleBadge role={a.user.role} />
                    {a.user.status !== "ACTIVE" && <Badge tone="danger">Inactive</Badge>}
                  </span>
                )
              },
              { label: "Email", value: a.user.email },
              { label: "Access", value: a.kind === "OWNER" ? "Owner of the module" : a.operatorRole?.name },
              { label: "Status", value: <StatusBadge status={a.status} /> },
              { label: "From", value: a.validFrom ? formatDate(a.validFrom) : "From the start" },
              { label: "Until", value: a.validTo ? formatDate(a.validTo) : "No end date" },
              { label: "Note", value: a.note, wide: true },
              { label: "Assigned by", value: a.assigner ? fullName(a.assigner) : null },
              { label: "Assigned", value: formatDateTime(a.createdAt) },
              { label: "Revoked", value: a.revokedAt ? formatDateTime(a.revokedAt) : null, hidden: !a.revokedAt },
              { label: "Revoked by", value: a.revoker ? fullName(a.revoker) : null, hidden: !a.revokedAt },
              {
                label: "Why it ended",
                value: a.revokeReason === "HANDOVER" ? "Handed over to someone else" : "Revoked",
                hidden: !a.revokedAt
              }
            ]}
          />
          {!isLive(a) && <Alert tone="info">{a.status === "REVOKED" ? "Revoked" : "Expired"} assignments are kept as history and can't be changed.</Alert>}
        </div>
      )}
    </Drawer>
  );
}

type DateValues = { validFrom: string; validTo: string; note: string };

/* Change the dates or the note; a blank date means from the start / no end */
export function EditDatesDrawer({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  return assignment ? <EditDates assignment={assignment} onClose={onClose} /> : null;
}

function EditDates({ assignment: a, onClose }: { assignment: Assignment; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateAssignment();
  const original: DateValues = { validFrom: a.validFrom ?? "", validTo: a.validTo ?? "", note: a.note ?? "" };
  const form = useForm<DateValues>(original);
  const changes = changedFields(original, form.values);
  const dirty = Object.keys(changes).length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { validFrom, validTo } = form.values;
    if (validFrom && validTo && validTo < validFrom) {
      form.setErrors({ validTo: "cannot be before the start date" });
      return;
    }
    if (!dirty) return onClose();
    update.mutate(
      { id: a.id, changes },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit dates"
      subtitle={`${fullName(a.user)}: ${accessName(a)} (${a.moduleLabel})`}
      footer={
        <>
          <Button onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="assignment-dates-form" loading={update.isPending} disabled={!dirty}>
            Save
          </Button>
        </>
      }
    >
      <form id="assignment-dates-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="From" type="date" hint="Blank: from the start" {...form.text("validFrom")} />
          <TextInput label="Until" type="date" hint="Inclusive. Blank: no end date" min={todayIso()} {...form.text("validTo")} />
        </div>
        <Textarea label="Note" rows={2} maxLength={500} {...form.text("note")} />
        <div className="small muted">To end it today, revoke it instead. Changes apply on the person's next request.</div>
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      </form>
    </Drawer>
  );
}
