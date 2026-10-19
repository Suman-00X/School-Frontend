import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Switch, TextInput, useConfirm, useToast } from "@/common/ui";
import { createPeriod, deletePeriod, hhmm, TIMETABLE_INVALIDATE, updatePeriod, type Period, type PeriodInput } from "../api/timetable";

type Values = { periodNumber: string; name: string; startTime: string; endTime: string; isBreak: boolean };

const toValues = (p: Period): Values => ({
  periodNumber: String(p.periodNumber),
  name: p.name,
  startTime: hhmm(p.startTime),
  endTime: hhmm(p.endTime),
  isBreak: p.isBreak
});

/* AC-07 bell schedule drawer: add (period = null) or view/edit one period or break.
   Overlapping times come back as 409 ("This time overlaps Period 3 (09:40–10:20)") and are shown
   under the times. */
export function PeriodDrawer({
  open,
  period,
  periods,
  canEdit,
  onClose
}: {
  open: boolean;
  period: Period | null;
  periods: Period[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const form = useForm<Values>({ periodNumber: "", name: "", startTime: "", endTime: "", isBreak: false });
  const create = useApiMutation(createPeriod, { invalidate: TIMETABLE_INVALIDATE });
  const update = useApiMutation(updatePeriod, { invalidate: TIMETABLE_INVALIDATE });
  const remove = useApiMutation(deletePeriod, { invalidate: TIMETABLE_INVALIDATE });
  const { values, errors } = form;

  /* A new period follows the last one: next number, starting when it ends */
  useEffect(() => {
    if (!open) return;
    if (period) return form.reset(toValues(period));
    const last = [...periods].sort((a, b) => a.endTime.localeCompare(b.endTime)).at(-1);
    const next = Math.max(0, ...periods.map(p => p.periodNumber)) + 1;
    form.reset({ periodNumber: String(next), name: "", startTime: last ? hhmm(last.endTime) : "", endTime: "", isBreak: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, period?.id]);

  const validate = () => {
    const e: Record<string, string> = {};
    const n = Number(values.periodNumber);
    if (!values.periodNumber || !Number.isInteger(n) || n < 1 || n > 20) e.periodNumber = "A whole number from 1 to 20";
    else if (periods.some(p => p.periodNumber === n && p.id !== period?.id)) e.periodNumber = `Number ${n} is already used`;
    if (!values.name.trim()) e.name = "Give it a name, e.g. Period 1 or Lunch";
    if (!values.startTime) e.startTime = "Pick the start time";
    if (!values.endTime) e.endTime = "Pick the end time";
    else if (values.startTime && values.endTime <= values.startTime) e.endTime = "Must be after the start";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const onError = (err: unknown) => {
    /* Overlaps and order problems belong to the times */
    if (isApiError(err) && err.status === 409) {
      form.setErrors(/periodNumber/.test(err.message) ? { periodNumber: "This number is already used in the year" } : { endTime: err.message });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const body: PeriodInput = {
      periodNumber: Number(values.periodNumber),
      name: values.name.trim(),
      startTime: values.startTime,
      endTime: values.endTime,
      isBreak: values.isBreak
    };
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (!period) return create.mutate(body, { onSuccess: done, onError });
    const before = toValues(period);
    const patch: Partial<PeriodInput> = {};
    if (body.periodNumber !== period.periodNumber) patch.periodNumber = body.periodNumber;
    if (body.name !== period.name) patch.name = body.name;
    if (body.startTime !== before.startTime) patch.startTime = body.startTime;
    if (body.endTime !== before.endTime) patch.endTime = body.endTime;
    if (body.isBreak !== period.isBreak) patch.isBreak = body.isBreak;
    if (!Object.keys(patch).length) return onClose();
    update.mutate({ id: period.id, ...patch }, { onSuccess: done, onError });
  };

  const askDelete = async () => {
    if (!period) return;
    const ok = await confirm({
      title: `Delete ${period.name}?`,
      message: `${period.name} (${hhmm(period.startTime)}–${hhmm(period.endTime)}) is removed from the bell schedule. Lessons placed in it no longer show on the timetable.`,
      confirmLabel: "Delete"
    });
    if (!ok) return;
    remove.mutate(period.id, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: e => form.setServerErrors(e)
    });
  };

  const title = period ? period.name : "New period";
  const subtitle = period?.isBreak ? <Badge>Break</Badge> : undefined;

  if (period && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Number", value: period.periodNumber },
            { label: "Time", value: `${hhmm(period.startTime)}–${hhmm(period.endTime)}` },
            { label: "Kind", value: period.isBreak ? "Break: no lessons" : "Lesson period" }
          ]}
        />
      </Drawer>
    );

  const busy = create.isPending || update.isPending;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footerStatus={form.formError}
      footer={
        <>
          {period && (
            <Button variant="ghost" onClick={() => void askDelete()} loading={remove.isPending}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="period-form" loading={busy}>
            {period ? "Save" : "Add period"}
          </Button>
        </>
      }
    >
      <form id="period-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Number" required type="number" min={1} max={20} {...form.text("periodNumber")} hint="Bell order, 1 to 20" />
          <TextInput label="Name" required maxLength={50} {...form.text("name")} placeholder="Period 1" />
          <TextInput label="Starts" required type="time" {...form.text("startTime")} />
          <TextInput label="Ends" required type="time" {...form.text("endTime")} error={errors.endTime} />
        </div>
        <Switch label="Break (recess, lunch): no lessons or registers" checked={values.isBreak} onChange={v => form.set("isBreak", v)} />
      </form>
    </Drawer>
  );
}
