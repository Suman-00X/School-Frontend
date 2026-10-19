import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, TextInput, Textarea, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { allocateBed, type AllocateInput, type Allocation } from "../api/allocations";
import { BedFields } from "./BedFields";

export type AllocatePrefill = { roomId?: string; bedNumber?: number; fromDate?: string; toDate?: string; studentId?: string };

type Values = { studentId: string; roomId: string; bedNumber: string; fromDate: string; toDate: string; notes: string };

/* The server's refusals, placed on the field they are about */
export function bedErrorField(err: unknown): string | null {
  if (!isApiError(err)) return null;
  const m = err.message;
  if (/^Bed \d+ in .* is booked|bed \d+ does not exist/i.test(m)) return "bedNumber";
  if (/already has bed|not actively enrolled|cannot stay in|studentId/i.test(m)) return "studentId";
  if (/closed|under maintenance|no bed free|roomId/i.test(m)) return "roomId";
  if (/toDate/.test(m)) return "toDate";
  if (/fromDate|start/i.test(m)) return "fromDate";
  return null;
}

/* HO-02 "Allocate": a bed for a student from a date (a later date books ahead), open-ended or to a last night */
export function AllocateDrawer({ open, prefill, onClose, onDone }: { open: boolean; prefill?: AllocatePrefill; onClose: () => void; onDone?: (a: Allocation) => void }) {
  const toast = useToast();
  const form = useForm<Values>({ studentId: "", roomId: "", bedNumber: "", fromDate: "", toDate: "", notes: "" });
  const allocate = useApiMutation(allocateBed, { invalidate: ["/hostel"] });
  const { values, errors } = form;
  const today = todayIso();

  useEffect(() => {
    if (open)
      form.reset({
        studentId: prefill?.studentId ?? "",
        roomId: prefill?.roomId ?? "",
        bedNumber: prefill?.bedNumber ? String(prefill.bedNumber) : "",
        fromDate: prefill?.fromDate && prefill.fromDate > today ? prefill.fromDate : today,
        toDate: prefill?.toDate ?? "",
        notes: ""
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    const errs: Record<string, string> = {};
    if (!values.studentId) errs.studentId = "Pick the student";
    if (!values.fromDate) errs.fromDate = "Pick the first night";
    if (values.toDate && values.fromDate && values.toDate < values.fromDate) errs.toDate = "On or after the first night";
    if (!values.roomId) errs.roomId = "Pick a room";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: AllocateInput = { studentId: values.studentId, roomId: values.roomId, fromDate: values.fromDate };
    if (values.bedNumber) body.bedNumber = Number(values.bedNumber);
    if (values.toDate) body.toDate = values.toDate;
    if (values.notes.trim()) body.notes = values.notes.trim();
    allocate.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
        onDone?.(res.data);
      },
      onError: err => {
        const field = bedErrorField(err);
        if (field) {
          form.setErrors({ [field]: (err as Error).message });
          form.setFormError(null);
        } else form.setServerErrors(err);
      }
    });
  };

  const future = values.fromDate > today;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Allocate a bed"
      subtitle="One bed per student at a time. A later first night books the bed ahead."
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="allocate-form" variant="primary" loading={allocate.isPending}>
            {future ? "Book bed" : "Allocate bed"}
          </Button>
        </>
      }
    >
      <form id="allocate-form" className="stack" onSubmit={submit} noValidate>
        <StudentSelect required value={values.studentId} onChange={e => form.set("studentId", e.target.value)} error={errors.studentId} />
        <div className="form-grid">
          <TextInput label="First night" type="date" required hint={future ? "In the future: a booking" : "Today or later"} {...form.text("fromDate")} />
          <TextInput label="Last night" type="date" min={values.fromDate || undefined} hint="Blank: no end date" {...form.text("toDate")} />
        </div>
        <BedFields
          fromDate={values.fromDate}
          toDate={values.toDate}
          roomId={values.roomId}
          bedNumber={values.bedNumber}
          onRoom={id => {
            form.set("roomId", id);
            form.set("bedNumber", "");
          }}
          onBed={b => form.set("bedNumber", b)}
          errors={errors}
        />
        <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
      </form>
    </Drawer>
  );
}
