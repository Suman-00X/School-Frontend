import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, Switch, TextInput, Textarea, useToast } from "@/common/ui";
import { dayCount } from "../../shared/utils/format";
import { createLeaveType, LEAVE_TYPES_PATH, updateLeaveType, type LeaveType, type LeaveTypeInput } from "../api/leaves";

type Values = { name: string; code: string; annualQuotaDays: string; isPaid: boolean; requiresApproval: boolean; description: string };

const EMPTY: Values = { name: "", code: "", annualQuotaDays: "", isPaid: true, requiresApproval: true, description: "" };

const toValues = (t: LeaveType): Values => ({
  name: t.name,
  code: t.code,
  annualQuotaDays: String(t.annualQuotaDays),
  isPaid: t.isPaid,
  requiresApproval: t.requiresApproval,
  description: t.description ?? ""
});

const CODE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;

/* HR-01 drawer: create (type = null) or view / edit one leave type */
export function LeaveTypeDrawer({ open, type, canEdit, onClose }: { open: boolean; type: LeaveType | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useForm<Values>(EMPTY);
  const create = useApiMutation(createLeaveType, { invalidate: [LEAVE_TYPES_PATH, "/hr/leave-balances"] });
  const update = useApiMutation(updateLeaveType, { invalidate: [LEAVE_TYPES_PATH, "/hr/leave-balances", "/hr/leave-requests"] });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(type ? toValues(type) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type?.id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Enter a name";
    if (!CODE.test(values.code.trim().toUpperCase())) e.code = "2–20 letters, digits, - or _";
    const quota = Number(values.annualQuotaDays);
    if (values.annualQuotaDays.trim() === "" || !Number.isFinite(quota)) e.annualQuotaDays = "Enter the days per year";
    else if (quota < 0 || quota > 366) e.annualQuotaDays = "Between 0 and 366";
    else if (Math.round(quota * 2) !== quota * 2) e.annualQuotaDays = "Whole or half days only";
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const body = (): LeaveTypeInput => ({
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    annualQuotaDays: Number(values.annualQuotaDays),
    isPaid: values.isPaid,
    requiresApproval: values.requiresApproval,
    description: values.description.trim()
  });

  const changes = (): Partial<LeaveTypeInput> => {
    if (!type) return {};
    const now = body();
    const out: Partial<LeaveTypeInput> = {};
    if (now.name !== type.name) out.name = now.name;
    if (now.code !== type.code) out.code = now.code;
    if (now.annualQuotaDays !== type.annualQuotaDays) out.annualQuotaDays = now.annualQuotaDays;
    if (now.isPaid !== type.isPaid) out.isPaid = now.isPaid;
    if (now.requiresApproval !== type.requiresApproval) out.requiresApproval = now.requiresApproval;
    /* "" clears the description (the API refuses null) */
    if ((now.description ?? "") !== (type.description ?? "")) out.description = now.description;
    return out;
  };

  const onError = (err: unknown) => {
    /* Duplicate code or name: show it on that field */
    if (isApiError(err) && err.status === 409) {
      form.setErrors({ [/code/i.test(err.message) ? "code" : "name"]: err.message });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const done = (res: { message: string }) => {
    toast.success(res.message);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    if (!type) {
      const b = body();
      if (!b.description) delete b.description;
      create.mutate(b, { onSuccess: done, onError });
    } else {
      const c = changes();
      if (!Object.keys(c).length) return onClose();
      update.mutate({ id: type.id, ...c }, { onSuccess: done, onError });
    }
  };

  const title = type ? type.name : "New leave type";

  if (type && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={<span className="mono">{type.code}</span>}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Quota", value: `${dayCount(type.annualQuotaDays)} a year` },
            { label: "Paid", value: type.isPaid ? <Badge tone="success">Paid</Badge> : <Badge tone="warning">Unpaid</Badge> },
            { label: "Needs approval", value: type.requiresApproval ? "Yes" : "No, approved as soon as applied" },
            { label: "Description", value: type.description }
          ]}
        />
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={type ? <span className="mono">{type.code}</span> : undefined}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="leave-type-form" variant="primary" loading={create.isPending || update.isPending}>
            {type ? "Save changes" : "Add leave type"}
          </Button>
        </>
      }
    >
      <form id="leave-type-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus={!type} maxLength={100} placeholder="Casual leave" {...form.text("name")} />
          <TextInput
            label="Code"
            required
            maxLength={20}
            placeholder="CL"
            hint="Short code shown on registers"
            {...form.text("code")}
            onChange={e => form.set("code", e.target.value.toUpperCase())}
          />
        </div>
        <TextInput
          label="Days per year"
          required
          type="number"
          inputMode="decimal"
          min={0}
          max={366}
          step={0.5}
          hint="Per calendar year. Half days allowed, e.g. 7.5"
          {...form.text("annualQuotaDays")}
        />
        <Field hint="Unpaid days count as loss of pay in payroll" error={errors.isPaid}>
          <Switch label="Paid leave" checked={values.isPaid} onChange={v => form.set("isPaid", v)} />
        </Field>
        <Field hint="When off, requests are approved as soon as they are made and marked in attendance at once" error={errors.requiresApproval}>
          <Switch label="Needs approval" checked={values.requiresApproval} onChange={v => form.set("requiresApproval", v)} />
        </Field>
        <Textarea label="Description" rows={2} maxLength={1000} hint="Shown to staff when they apply" {...form.text("description")} />
      </form>
    </Drawer>
  );
}
