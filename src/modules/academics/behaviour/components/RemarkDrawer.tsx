import { useEffect, type FormEvent } from "react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Alert, Badge, Button, DescriptionList, Drawer, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import {
  BEHAVIOUR_PATH,
  KIND_OF,
  REMARK_CATEGORIES,
  REMARK_KINDS,
  categoryLabel,
  createRemark,
  updateRemark,
  type BehaviourRemark,
  type RemarkInput,
  type RemarkKind
} from "../api/behaviour";

type Values = { studentId: string; occurredOn: string; kind: RemarkKind | ""; category: string; remark: string; actionTaken: string };

const toValues = (r: BehaviourRemark): Values => ({
  studentId: r.studentId,
  occurredOn: r.occurredOn,
  kind: r.kind,
  category: r.category,
  remark: r.remark,
  actionTaken: r.actionTaken ?? ""
});

/* AC-18: write a remark in a student's log book (remark = null) or open one. The student is
   fixed when the drawer is opened from their profile (studentId, named fixedName). Someone who may not change
   the remark (not its author, the principal or an admin) sees it read-only. */
export function RemarkDrawer({ open, remark, studentId, fixedName, onClose }: { open: boolean; remark: BehaviourRemark | null; studentId?: string; fixedName?: string; onClose: () => void }) {
  const toast = useToast();
  const { selected, readOnly } = useAcademicYear();
  const form = useForm<Values>({ studentId: "", occurredOn: "", kind: "", category: "", remark: "", actionTaken: "" });
  const { values, errors } = form;
  const create = useApiMutation(createRemark, { invalidate: [BEHAVIOUR_PATH] });
  const update = useApiMutation(updateRemark, { invalidate: [BEHAVIOUR_PATH] });
  const today = todayIso();
  const maxDate = selected && selected.endDate < today ? selected.endDate : today;

  useEffect(() => {
    if (open) form.reset(remark ? toValues(remark) : { studentId: studentId ?? "", occurredOn: maxDate, kind: "", category: "", remark: "", actionTaken: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, remark?.id]);

  const editable = !readOnly && (!remark || !!remark.canEdit);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.studentId) e.studentId = "Pick the student";
    if (!values.occurredOn) e.occurredOn = "Pick the day it happened";
    else if (values.occurredOn > today) e.occurredOn = "Can't be in the future";
    else if (selected && (values.occurredOn < selected.startDate || values.occurredOn > selected.endDate)) e.occurredOn = `Must be within ${selected.yearName}`;
    if (!values.kind) e.kind = "Pick what kind of remark it is";
    if (!values.category) e.category = "Pick what it is about";
    if (!values.remark.trim()) e.remark = "Write the remark";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const text = values.remark.trim();
    const action = values.actionTaken.trim();
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (!remark) {
      const body: RemarkInput = { studentId: values.studentId, occurredOn: values.occurredOn, kind: values.kind as RemarkKind, category: values.category, remark: text };
      if (action) body.actionTaken = action;
      return create.mutate(body, { onSuccess: done, onError: err => form.setServerErrors(err) });
    }
    const patch: Parameters<typeof updateRemark>[0] = { id: remark.id };
    if (values.occurredOn !== remark.occurredOn) patch.occurredOn = values.occurredOn;
    if (values.kind !== remark.kind) patch.kind = values.kind as RemarkKind;
    if (values.category !== remark.category) patch.category = values.category;
    if (text !== remark.remark) patch.remark = text;
    if (action !== (remark.actionTaken ?? "")) patch.actionTaken = action;
    if (Object.keys(patch).length === 1) return onClose();
    update.mutate(patch, { onSuccess: done, onError: err => form.setServerErrors(err) });
  };

  const studentName = remark?.student ? `${remark.student.user.firstName} ${remark.student.user.lastName}` : undefined;

  if (remark && !editable)
    return (
      <Drawer open={open} onClose={onClose} title="Behaviour remark" subtitle={studentName} footer={<Button onClick={onClose}>Close</Button>}>
        <div className="stack">
          <DescriptionList
            columns={2}
            items={[
              { label: "Kind", value: <Badge tone={KIND_OF[remark.kind].tone}>{KIND_OF[remark.kind].label}</Badge> },
              { label: "About", value: categoryLabel(remark.category) },
              { label: "Happened on", value: formatDate(remark.occurredOn) },
              { label: "Written by", value: remark.recorder ? `${remark.recorder.firstName} ${remark.recorder.lastName}` : "—" },
              { label: "Remark", value: <span style={{ whiteSpace: "pre-wrap" }}>{remark.remark}</span>, wide: true },
              { label: "Action taken", value: remark.actionTaken ?? "—", wide: true },
              { label: "Parent's acknowledgement", value: remark.acknowledgedAt ? formatDate(remark.acknowledgedAt) : "Not yet", wide: true }
            ]}
          />
          {!readOnly && <p className="small muted">Only the teacher who wrote it, the principal or an admin can change it.</p>}
        </div>
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={remark ? "Edit remark" : "Write a remark"}
      subtitle={remark ? studentName : "The student and their parents see it in the app."}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="remark-form" loading={create.isPending || update.isPending}>
            {remark ? "Save" : "Add to log book"}
          </Button>
        </>
      }
    >
      <form id="remark-form" className="stack" onSubmit={submit} noValidate>
        {remark?.acknowledgedAt && (
          <Alert tone="info">A parent acknowledged this on {formatDate(remark.acknowledgedAt)}. Saving a change asks them to acknowledge it again.</Alert>
        )}
        {!remark &&
          (studentId ? (
            <TextInput label="Student" value={fixedName ?? ""} disabled readOnly />
          ) : (
            <StudentSelect
              required
              value={values.studentId}
              onChange={e => form.set("studentId", e.target.value)}
              error={errors.studentId}
              hint="Any student enrolled this year, also outside your sections"
            />
          ))}
        <Field label="Kind" required error={errors.kind}>
          <RadioGroup name="kind" aria-label="Kind" options={REMARK_KINDS.map(k => ({ value: k.value, label: k.label, description: k.description }))} value={values.kind} onChange={v => form.set("kind", v)} />
        </Field>
        <div className="form-grid">
          <Select label="About" required {...form.text("category")} options={REMARK_CATEGORIES} placeholder="Pick a category" />
          <TextInput label="Happened on" required type="date" min={selected?.startDate} max={maxDate} {...form.text("occurredOn")} />
        </div>
        <Textarea label="Remark" required rows={4} maxLength={2000} {...form.text("remark")} placeholder="What happened, in words the family will read" />
        <Textarea label="Action taken" rows={2} maxLength={1000} {...form.text("actionTaken")} placeholder="Optional: spoke to the student, parents called, detention…" />
      </form>
    </Drawer>
  );
}
