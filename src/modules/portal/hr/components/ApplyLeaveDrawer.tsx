import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useForm } from "@/common/hooks";
import { Button, Checkbox, Drawer, Field, Select, TextInput, Textarea, useToast } from "@/common/ui";

import { LEAVE_TYPES_PATH, MY_BALANCES_PATH, MY_LEAVE_PATH, applyLeave, type LeaveBalance, type LeaveType } from "../api/hr";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/* PO-11 · Apply for leave: type, dates, half day (one-day leave only) and a reason. Shows the
   type's remaining days, and warns when the type needs no approval. */
export function ApplyLeaveDrawer({ open, onClose, balances }: { open: boolean; onClose: () => void; balances: LeaveBalance[] }) {
  const { can } = useAuth();
  const toast = useToast();
  const form = useForm({ leaveTypeId: "", fromDate: "", toDate: "", halfDay: false, reason: "" });
  const v = form.values;
  /* The balances already name every type; leave types add whether approval is needed */
  const types = useApiList<LeaveType>(LEAVE_TYPES_PATH, { limit: 100 }, { enabled: open && can("hr.leaveTypes.read") });
  const apply = useApiMutation(applyLeave, { invalidate: [MY_LEAVE_PATH, MY_BALANCES_PATH] });

  const balance = balances.find(b => b.leaveTypeId === v.leaveTypeId);
  const type = types.rows?.find(t => t.id === v.leaveTypeId);
  const oneDay = !!v.fromDate && v.fromDate === v.toDate;

  const close = () => {
    form.reset();
    onClose();
  };

  const submit = () => {
    const errors: Record<string, string> = {};
    if (!v.leaveTypeId) errors.leaveTypeId = "Choose a type of leave";
    if (!v.fromDate) errors.fromDate = "Pick the first day";
    if (!v.toDate) errors.toDate = "Pick the last day";
    else if (v.fromDate && v.toDate < v.fromDate) errors.toDate = "Must be on or after the first day";
    else if (v.fromDate && v.fromDate.slice(0, 4) !== v.toDate.slice(0, 4)) errors.toDate = "Apply separately for each calendar year";
    if (!v.reason.trim()) errors.reason = "Say why you need the leave";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      return;
    }
    form.setFormError(null);
    apply.mutate(
      { leaveTypeId: v.leaveTypeId, fromDate: v.fromDate, toDate: v.toDate, halfDay: oneDay && v.halfDay, reason: v.reason.trim() },
      {
        onSuccess: res => {
          toast.success(res.message);
          close();
        },
        onError: e => form.setServerErrors(e)
      }
    );
  };

  const typeHint = balance
    ? `${days(balance.remaining)} left of ${days(balance.quota)}${balance.pending ? `, ${days(balance.pending)} waiting for approval` : ""}${balance.isPaid ? "" : " · unpaid leave"}`
    : "What kind of leave this is";

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Apply for leave"
      footerStatus={form.formError ?? (type && !type.requiresApproval ? <span className="po-warning">This will be approved at once.</span> : null)}
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
        <Select
          label="Type"
          required
          placeholder="Choose a type"
          options={balances.map(b => ({ value: b.leaveTypeId, label: b.name, description: `${days(b.remaining)} left${b.isPaid ? "" : " · unpaid"}` }))}
          hint={typeHint}
          {...form.text("leaveTypeId")}
        />
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
          <TextInput label="To" type="date" required min={v.fromDate || undefined} {...form.text("toDate")} />
        </div>
        <Field hint={oneDay ? "Morning or afternoon off" : "Only for leave of one day"} error={form.errors.halfDay}>
          <Checkbox label="Half day" checked={oneDay && v.halfDay} disabled={!oneDay} onChange={e => form.set("halfDay", e.target.checked)} />
        </Field>
        <Textarea label="Reason" required rows={4} maxLength={500} hint={`${500 - v.reason.length} characters left`} {...form.text("reason")} />
      </div>
    </Drawer>
  );
}
