import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Dialog, Drawer, ErrorState, SkeletonBlock, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, formatMoney, todayIso } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { PhaseBadge } from "../../shared/components/Badges";
import { END_REASON_LABELS, resourceTypeLabel, studentName } from "../../shared/utils/format";
import {
  cancelResourceAssignment,
  releaseResource,
  RESOURCE_ASSIGNMENTS_PATH,
  updateResourceAssignment,
  type ResourceAssignment
} from "../api/resourceAssignments";

type DialogKind = "dates" | "release" | "cancel" | null;

const holding = (a: ResourceAssignment) => `${a.resource.name} (${resourceTypeLabel(a.resource).toLowerCase()})`;

/* HO-04 drawer: one resource assignment; Edit dates and Release (current) or Cancel (upcoming) */
export function ResourceAssignmentDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const currency = useSchoolCurrency();
  const q = useApiGet<ResourceAssignment>(id ? `${RESOURCE_ASSIGNMENTS_PATH}/${id}` : null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const a = q.data;
  const canManage = can("hostel.resourceAssignments.manage");
  const open = a?.phase === "CURRENT" || a?.phase === "UPCOMING";
  const upcoming = a?.phase === "UPCOMING";

  return (
    <>
      <Drawer
        open={!!id}
        onClose={onClose}
        title={a ? a.resource.name : "Resource"}
        subtitle={
          <span className="row" style={{ gap: 8, minHeight: 22 }}>
            {a ? (
              <>
                <span>{studentName(a.student)}</span>
                <PhaseBadge phase={a.phase} />
              </>
            ) : (
              <span className="skeleton" style={{ display: "inline-block", width: 140, height: 12 }} />
            )}
          </span>
        }
        footerStatus={canManage && a && !open ? <span className="muted">Nothing more to do: this is {a.phase === "CANCELLED" ? "cancelled" : "over"}</span> : null}
        footer={
          canManage ? (
            a && !open ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <>
                {!a?.endReason && (
                  <Button variant="danger" disabled={!a} onClick={() => setDialog(upcoming ? "cancel" : "release")}>
                    {upcoming ? "Cancel" : "Release"}
                  </Button>
                )}
                <Button variant="primary" disabled={!a} onClick={() => setDialog("dates")}>
                  Edit dates
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !a ? (
          <SkeletonBlock lines={6} />
        ) : (
          <DescriptionList
            items={[
              { label: "Type", value: resourceTypeLabel(a.resource) },
              { label: "Student", value: `${studentName(a.student)} · ${a.student.admissionNumber}` },
              {
                label: "Bed",
                value: a.allocation ? (
                  can("hostel.allocations.read") ? (
                    <Link to={`/hostel/allocations/${a.allocation.id}?view=list`}>Bed {a.allocation.bedNumber}</Link>
                  ) : (
                    `Bed ${a.allocation.bedNumber}`
                  )
                ) : (
                  "Not tied to a bed"
                )
              },
              { label: "Fee", value: a.resource.monthlyFee ? `${formatMoney(a.resource.monthlyFee, currency)} a month` : null },
              { label: "From", value: formatDate(a.fromDate) },
              { label: "To", value: a.toDate ? formatDate(a.toDate) : a.allocation ? "With the bed" : "No end date" },
              { label: "Ended by", value: a.endReason ? (END_REASON_LABELS[a.endReason] ?? a.endReason) : null, hidden: !a.endReason },
              { label: "Notes", value: a.notes ? <span style={{ whiteSpace: "pre-line" }}>{a.notes}</span> : null, wide: true }
            ]}
          />
        )}
      </Drawer>
      <DatesDialog assignment={dialog === "dates" ? (a ?? null) : null} onClose={() => setDialog(null)} />
      <ReleaseDialog assignment={dialog === "release" ? (a ?? null) : null} onClose={() => setDialog(null)} />
      <CancelDialog assignment={dialog === "cancel" ? (a ?? null) : null} onClose={() => setDialog(null)} />
    </>
  );
}

function DatesDialog({ assignment: a, onClose }: { assignment: ResourceAssignment | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ fromDate: "", toDate: "", notes: "" });
  const save = useApiMutation(updateResourceAssignment, { invalidate: ["/hostel"] });
  const upcoming = a?.phase === "UPCOMING";

  useEffect(() => {
    if (a) form.reset({ fromDate: a.fromDate, toDate: a.toDate ?? "", notes: a.notes ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const { values } = form;
  const body = a
    ? {
        ...(upcoming && values.fromDate !== a.fromDate && { fromDate: values.fromDate }),
        ...((values.toDate || null) !== a.toDate && { toDate: values.toDate || null }),
        ...(values.notes.trim() !== (a.notes ?? "") && { notes: values.notes.trim() })
      }
    : {};
  const unchanged = Object.keys(body).length === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a || unchanged) return;
    form.setFormError(null);
    if (values.toDate && values.toDate < values.fromDate) return form.setErrors({ toDate: "On or after the first day" });
    save.mutate(
      { id: a.id, ...body },
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
    <Dialog
      open={!!a}
      onClose={onClose}
      title={a ? `Dates of ${holding(a)}` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="ra-dates-form" variant="primary" loading={save.isPending} disabled={unchanged}>
            Save
          </Button>
        </>
      }
    >
      {a && (
        <form id="ra-dates-form" className="stack" onSubmit={submit} noValidate>
          <p className="muted small">
            {studentName(a.student)}.{a.allocation ? " The dates must stay within the bed's stay." : ""}
          </p>
          <div className="form-grid">
            <TextInput label="From" type="date" required disabled={!upcoming} hint={upcoming ? undefined : `Started ${formatDate(a.fromDate)}; can't move`} {...form.text("fromDate")} />
            <TextInput label="To" type="date" min={values.fromDate || undefined} hint="Blank: no end date" {...form.text("toDate")} />
          </div>
          <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
        </form>
      )}
    </Dialog>
  );
}

function ReleaseDialog({ assignment: a, onClose }: { assignment: ResourceAssignment | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ releasedOn: "", notes: "" });
  const release = useApiMutation(releaseResource, { invalidate: ["/hostel"] });

  useEffect(() => {
    if (a) form.reset({ releasedOn: a.toDate && a.toDate < todayIso() ? a.toDate : todayIso(), notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a) return;
    form.setFormError(null);
    const v = form.values.releasedOn;
    if (!v) return form.setErrors({ releasedOn: "Pick the day it is handed back" });
    if (v < a.fromDate) return form.setErrors({ releasedOn: `On or after ${formatDate(a.fromDate)}` });
    release.mutate(
      { id: a.id, releasedOn: v, ...(form.values.notes.trim() && { notes: form.values.notes.trim() }) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          if (/releasedOn/.test((err as Error).message ?? "")) {
            form.setErrors({ releasedOn: (err as Error).message });
            form.setFormError(null);
          } else form.setServerErrors(err);
        }
      }
    );
  };

  return (
    <Dialog
      open={!!a}
      onClose={onClose}
      title={a ? `Release ${a.resource.name}?` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="ra-release-form" variant="danger" loading={release.isPending}>
            Release
          </Button>
        </>
      }
    >
      {a && (
        <form id="ra-release-form" className="stack" onSubmit={submit} noValidate>
          <p>
            {studentName(a.student)} hands back {holding(a)}.
          </p>
          <TextInput label="Last day" type="date" required min={a.fromDate} max={a.toDate ?? undefined} hint="A later day plans the hand-back" {...form.text("releasedOn")} />
          <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
        </form>
      )}
    </Dialog>
  );
}

function CancelDialog({ assignment: a, onClose }: { assignment: ResourceAssignment | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ reason: "" });
  const cancel = useApiMutation(cancelResourceAssignment, { invalidate: ["/hostel"] });

  useEffect(() => {
    if (a) form.reset({ reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a) return;
    form.setFormError(null);
    cancel.mutate(
      { id: a.id, reason: form.values.reason.trim() || undefined },
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
    <Dialog
      open={!!a}
      onClose={onClose}
      title={a ? `Cancel ${a.resource.name} for ${studentName(a.student)}?` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Keep it</Button>
          <Button type="submit" form="ra-cancel-form" variant="danger" loading={cancel.isPending}>
            Cancel assignment
          </Button>
        </>
      }
    >
      {a && (
        <form id="ra-cancel-form" className="stack" onSubmit={submit} noValidate>
          <p>
            {holding(a)} from {formatDate(a.fromDate)} is withdrawn before it starts. It stays in the list as cancelled.
          </p>
          <Textarea label="Reason" rows={2} maxLength={500} {...form.text("reason")} />
        </form>
      )}
    </Dialog>
  );
}
