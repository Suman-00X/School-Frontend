import { useEffect, type FormEvent } from "react";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Dialog, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { studentName } from "../../shared/utils/format";
import { bedLabel, cancelAllocation, transferBed, updateAllocation, vacateBed, type Allocation } from "../api/allocations";
import { bedErrorField } from "./AllocateDrawer";
import { BedFields } from "./BedFields";

const done = (toast: ReturnType<typeof useToast>, onClose: () => void) => (res: { message: string }) => {
  toast.success(res.message);
  onClose();
};

/* UPCOMING: move the first night and the last; CURRENT: extend or shorten (the last night only) */
export function EditDatesDialog({ allocation, onClose }: { allocation: Allocation | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ fromDate: "", toDate: "", notes: "" });
  const save = useApiMutation(updateAllocation, { invalidate: ["/hostel"] });
  const a = allocation;
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
    if (upcoming && !values.fromDate) return form.setErrors({ fromDate: "Pick the first night" });
    if (values.toDate && values.toDate < values.fromDate) return form.setErrors({ toDate: "On or after the first night" });
    save.mutate(
      { id: a.id, ...body },
      {
        onSuccess: done(toast, onClose),
        onError: err => {
          const field = bedErrorField(err);
          if (field === "fromDate" || field === "toDate") {
            form.setErrors({ [field]: (err as Error).message });
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
      title={a ? (upcoming ? `Change ${studentName(a.student)}'s booking` : `Extend or shorten ${studentName(a.student)}'s stay`) : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="allocation-dates-form" variant="primary" loading={save.isPending} disabled={unchanged}>
            Save
          </Button>
        </>
      }
    >
      {a && (
        <form id="allocation-dates-form" className="stack" onSubmit={submit} noValidate>
          <p className="muted small">{bedLabel(a)}. Lockers, cupboards and tables tied to the bed follow the new dates.</p>
          <div className="form-grid">
            <TextInput
              label="First night"
              type="date"
              required
              disabled={!upcoming}
              hint={upcoming ? undefined : `Started ${formatDate(a.fromDate)}; can't move`}
              {...form.text("fromDate")}
            />
            <TextInput label="Last night" type="date" min={values.fromDate || undefined} hint="Blank: no end date" {...form.text("toDate")} />
          </div>
          <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
        </form>
      )}
    </Dialog>
  );
}

/* Another bed from a date (the first night in the new bed); the old one ends the night before */
export function TransferDialog({ allocation, onClose, onDone }: { allocation: Allocation | null; onClose: () => void; onDone?: (a: Allocation) => void }) {
  const toast = useToast();
  const form = useForm({ roomId: "", bedNumber: "", fromDate: "", notes: "" });
  const transfer = useApiMutation(transferBed, { invalidate: ["/hostel"] });
  const a = allocation;

  useEffect(() => {
    if (a) {
      const today = todayIso();
      form.reset({ roomId: "", bedNumber: "", fromDate: a.fromDate > today ? a.fromDate : today, notes: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const { values, errors } = form;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a) return;
    form.setFormError(null);
    const errs: Record<string, string> = {};
    if (!values.fromDate) errs.fromDate = "Pick the first night in the new bed";
    else if (values.fromDate < a.fromDate) errs.fromDate = `On or after ${formatDate(a.fromDate)}`;
    else if (a.toDate && values.fromDate > a.toDate) errs.fromDate = `On or before ${formatDate(a.toDate)}, the last night`;
    if (!values.roomId) errs.roomId = "Pick a room";
    if (values.roomId === a.roomId && !values.bedNumber) errs.bedNumber = "In the same room, pick the new bed";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    transfer.mutate(
      {
        id: a.id,
        roomId: values.roomId,
        fromDate: values.fromDate,
        ...(values.bedNumber && { bedNumber: Number(values.bedNumber) }),
        ...(values.notes.trim() && { notes: values.notes.trim() })
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          onDone?.(res.data);
        },
        onError: err => {
          const field = bedErrorField(err);
          if (field && field !== "toDate") {
            form.setErrors({ [field === "studentId" ? "roomId" : field]: (err as Error).message });
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
      title={a ? `Move ${studentName(a.student)} to another bed` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="transfer-form" variant="primary" loading={transfer.isPending}>
            Transfer
          </Button>
        </>
      }
    >
      {a && (
        <form id="transfer-form" className="stack" onSubmit={submit} noValidate>
          <p className="muted small">
            Now in {bedLabel(a)}. Locker and cupboard follow the bed only within the room; mess and laundry plans continue.
          </p>
          <TextInput
            label="First night in the new bed"
            type="date"
            required
            min={a.fromDate}
            max={a.toDate ?? undefined}
            hint={a.toDate ? `The new bed runs to ${formatDate(a.toDate)}, like the old one` : "The new bed has no end date, like the old one"}
            {...form.text("fromDate")}
          />
          <BedFields
            fromDate={values.fromDate}
            toDate={a.toDate ?? ""}
            roomId={values.roomId}
            bedNumber={values.bedNumber}
            onRoom={id => {
              form.set("roomId", id);
              form.set("bedNumber", "");
            }}
            onBed={b => form.set("bedNumber", b)}
            errors={errors}
            exclude={{ roomId: a.roomId, bedNumber: a.bedNumber }}
          />
          <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
        </form>
      )}
    </Dialog>
  );
}

/* A stay that has started ends on a day (today, or a planned move-out) */
export function VacateDialog({ allocation, onClose }: { allocation: Allocation | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ vacatedOn: "", notes: "" });
  const vacate = useApiMutation(vacateBed, { invalidate: ["/hostel"] });
  const a = allocation;

  useEffect(() => {
    if (a) {
      const today = todayIso();
      form.reset({ vacatedOn: a.toDate && a.toDate < today ? a.toDate : today, notes: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a) return;
    form.setFormError(null);
    const v = form.values.vacatedOn;
    if (!v) return form.setErrors({ vacatedOn: "Pick the move-out day" });
    if (v < a.fromDate) return form.setErrors({ vacatedOn: `On or after ${formatDate(a.fromDate)}` });
    if (a.toDate && v > a.toDate) return form.setErrors({ vacatedOn: `On or before ${formatDate(a.toDate)}; extend the stay first` });
    vacate.mutate(
      { id: a.id, vacatedOn: v, ...(form.values.notes.trim() && { notes: form.values.notes.trim() }) },
      {
        onSuccess: done(toast, onClose),
        onError: err => {
          if (/vacatedOn/.test((err as Error).message ?? "")) {
            form.setErrors({ vacatedOn: (err as Error).message });
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
      title={a ? `Vacate ${studentName(a.student)}'s bed?` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="vacate-form" variant="danger" loading={vacate.isPending}>
            Vacate
          </Button>
        </>
      }
    >
      {a && (
        <form id="vacate-form" className="stack" onSubmit={submit} noValidate>
          <p>
            {studentName(a.student)} moves out of {bedLabel(a)}. Lockers and plans tied to the bed end with it.
          </p>
          <TextInput label="Last night" type="date" required min={a.fromDate} max={a.toDate ?? undefined} hint="A later day plans the move-out" {...form.text("vacatedOn")} />
          <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
        </form>
      )}
    </Dialog>
  );
}

/* A booking that has not started is withdrawn */
export function CancelBookingDialog({ allocation, onClose }: { allocation: Allocation | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ reason: "" });
  const cancel = useApiMutation(cancelAllocation, { invalidate: ["/hostel"] });
  const a = allocation;

  useEffect(() => {
    if (a) form.reset({ reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a) return;
    form.setFormError(null);
    cancel.mutate({ id: a.id, reason: form.values.reason.trim() || undefined }, { onSuccess: done(toast, onClose), onError: err => form.setServerErrors(err) });
  };

  return (
    <Dialog
      open={!!a}
      onClose={onClose}
      title={a ? `Cancel ${studentName(a.student)}'s booking?` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Keep booking</Button>
          <Button type="submit" form="cancel-booking-form" variant="danger" loading={cancel.isPending}>
            Cancel booking
          </Button>
        </>
      }
    >
      {a && (
        <form id="cancel-booking-form" className="stack" onSubmit={submit} noValidate>
          <p>
            The booking of {bedLabel(a)} from {formatDate(a.fromDate)} is withdrawn, with anything tied to it. It stays in the list as cancelled.
          </p>
          <Textarea label="Reason" rows={2} maxLength={500} {...form.text("reason")} />
        </form>
      )}
    </Dialog>
  );
}
