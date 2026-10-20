import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { LEAVE_REASONS, ON_LEAVE_PATH, STUDENT_LEAVES_PATH, type StudentLeaveSession } from "@/modules/academics";
import { applyLeave, leavePath } from "../api/leave";

const LENGTHS: { value: "DAYS" | "HALF"; label: string; description: string }[] = [
  { value: "DAYS", label: "One or more days", description: "From the first day to the last" },
  { value: "HALF", label: "Half a day", description: "Morning or afternoon of one day" }
];

const HALVES: { value: Exclude<StudentLeaveSession, "FULL_DAY">; label: string }[] = [
  { value: "FORENOON", label: "Forenoon (morning)" },
  { value: "AFTERNOON", label: "Afternoon" }
];

/* PO-14 · Apply for leave: the days (or half of one day), why, and a note for the class
   teacher, who approves it. Past days can be applied for while their attendance is open. */
export function ApplyLeaveDrawer({ studentId, childName, open, onClose }: { studentId: string; childName: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ length: "DAYS" as "DAYS" | "HALF", fromDate: todayIso(), toDate: todayIso(), half: "FORENOON" as Exclude<StudentLeaveSession, "FULL_DAY">, reasonCategory: "", reason: "" });
  const v = form.values;
  const apply = useApiMutation(applyLeave, { invalidate: [leavePath(studentId), STUDENT_LEAVES_PATH, ON_LEAVE_PATH] });
  const half = v.length === "HALF";

  const close = () => {
    form.reset();
    onClose();
  };

  const submit = () => {
    const errors: Record<string, string> = {};
    if (!v.fromDate) errors.fromDate = half ? "Pick the day" : "Pick the first day";
    if (!half && !v.toDate) errors.toDate = "Pick the last day";
    else if (!half && v.fromDate && v.toDate < v.fromDate) errors.toDate = "Must be on or after the first day";
    if (!v.reasonCategory) errors.reasonCategory = "Choose a reason";
    if (!v.reason.trim()) errors.reason = "Tell the class teacher a little more";
    if (Object.keys(errors).length) return form.setErrors(errors);
    form.setFormError(null);
    apply.mutate(
      {
        studentId,
        fromDate: v.fromDate,
        toDate: half ? v.fromDate : v.toDate,
        session: half ? v.half : "FULL_DAY",
        reasonCategory: v.reasonCategory,
        reason: v.reason.trim()
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          close();
        },
        onError: e => form.setServerErrors(e)
      }
    );
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Apply for leave"
      subtitle={childName}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={apply.isPending} onClick={submit}>
            Apply
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="How long">
          <RadioGroup aria-label="How long" options={LENGTHS} value={v.length} onChange={value => form.set("length", value)} />
        </Field>
        {half ? (
          <div className="grid-2">
            <TextInput label="Day" type="date" required {...form.text("fromDate")} />
            <Field label="Which half" error={form.errors.session}>
              <RadioGroup aria-label="Which half" options={HALVES} value={v.half} onChange={value => form.set("half", value)} />
            </Field>
          </div>
        ) : (
          <div className="grid-2">
            <TextInput
              label="From"
              type="date"
              required
              {...form.text("fromDate")}
              onChange={e => {
                form.set("fromDate", e.target.value);
                if (!v.toDate || v.toDate < e.target.value) form.set("toDate", e.target.value);
              }}
            />
            <TextInput label="To" type="date" required min={v.fromDate || undefined} hint="Holidays and weekly offs are not counted" {...form.text("toDate")} />
          </div>
        )}
        <Select label="Reason" required placeholder="Choose a reason" options={LEAVE_REASONS} {...form.text("reasonCategory")} />
        <Textarea
          label="Note for the class teacher"
          required
          rows={4}
          maxLength={1000}
          placeholder="For example: fever since last night; we will see the doctor today."
          hint={`${1000 - v.reason.length} characters left`}
          {...form.text("reason")}
        />
      </div>
    </Drawer>
  );
}
