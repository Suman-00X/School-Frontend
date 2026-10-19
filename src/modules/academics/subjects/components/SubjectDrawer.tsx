import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, RadioGroup, Switch, TextInput, Textarea, useToast } from "@/common/ui";
import { createSubject, SUBJECT_CODE, SUBJECT_TYPES, SUBJECTS_PATH, subjectTypeLabel, updateSubject, type Subject, type SubjectInput, type SubjectType } from "../api/subjects";

type Values = { subjectCode: string; subjectName: string; subjectType: SubjectType | ""; isOptional: boolean; description: string };

const EMPTY: Values = { subjectCode: "", subjectName: "", subjectType: "THEORY", isOptional: false, description: "" };

const toValues = (s: Subject): Values => ({
  subjectCode: s.subjectCode,
  subjectName: s.subjectName,
  subjectType: s.subjectType ?? "",
  isOptional: s.isOptional,
  description: s.description ?? ""
});

/* A duplicate (409) names the field it clashes on */
const duplicateField = (err: unknown) =>
  isApiError(err) && err.status === 409 ? (/code/i.test(err.message) ? "subjectCode" : /named/i.test(err.message) ? "subjectName" : null) : null;

/* AC-03 drawer: create (subject = null), or view and edit one subject. Read-only without update. */
export function SubjectDrawer({ open, subject, canEdit, onClose }: { open: boolean; subject: Subject | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const form = useForm<Values>(EMPTY);
  const create = useApiMutation(createSubject, { invalidate: [SUBJECTS_PATH] });
  const update = useApiMutation(updateSubject, { invalidate: [SUBJECTS_PATH, "/academics/section-subjects"] });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(subject ? toValues(subject) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject?.id]);

  if (subject && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={subject.subjectName} subtitle={<span className="mono">{subject.subjectCode}</span>}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Code", value: <span className="mono">{subject.subjectCode}</span> },
            { label: "Type", value: subjectTypeLabel(subject.subjectType) },
            { label: "Optional", value: subject.isOptional ? <Badge tone="info">Optional</Badge> : "No, every student takes it" },
            { label: "Description", value: subject.description }
          ]}
        />
      </Drawer>
    );

  /* PATCH sends only what changed; "" clears the description */
  const changes: Partial<SubjectInput> = {};
  if (subject) {
    const before = toValues(subject);
    if (values.subjectCode.trim().toUpperCase() !== before.subjectCode) changes.subjectCode = values.subjectCode.trim().toUpperCase();
    if (values.subjectName.trim() !== before.subjectName) changes.subjectName = values.subjectName.trim();
    if (values.subjectType && values.subjectType !== before.subjectType) changes.subjectType = values.subjectType;
    if (values.isOptional !== before.isOptional) changes.isOptional = values.isOptional;
    if (values.description.trim() !== before.description) changes.description = values.description.trim();
  }
  const unchanged = !!subject && Object.keys(changes).length === 0;

  const validate = () => {
    const e: Record<string, string> = {};
    const code = values.subjectCode.trim().toUpperCase();
    if (!code) e.subjectCode = "Type a short code, e.g. MAT";
    else if (!SUBJECT_CODE.test(code)) e.subjectCode = "2–10 letters, digits or -, starting with a letter";
    if (!values.subjectName.trim()) e.subjectName = "Type the subject's name";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const onError = (err: unknown) => {
    const field = duplicateField(err);
    if (field) {
      form.setErrors({ [field]: (err as Error).message });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (subject) update.mutate({ id: subject.id, ...changes }, { onSuccess: done, onError });
    else {
      const body: SubjectInput = {
        subjectCode: values.subjectCode.trim().toUpperCase(),
        subjectName: values.subjectName.trim(),
        isOptional: values.isOptional
      };
      if (values.subjectType) body.subjectType = values.subjectType;
      if (values.description.trim()) body.description = values.description.trim();
      create.mutate(body, { onSuccess: done, onError });
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={subject ? subject.subjectName : "New subject"}
      subtitle={subject ? <span className="mono">{subject.subjectCode}</span> : "School-wide: every year and section can use it"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="subject-form" variant="primary" loading={create.isPending || update.isPending} disabled={unchanged}>
            {subject ? "Save changes" : "Create subject"}
          </Button>
        </>
      }
    >
      <form id="subject-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput
            label="Code"
            required
            autoFocus={!subject}
            maxLength={10}
            placeholder="MAT"
            hint="Used in timetables and reports"
            {...form.text("subjectCode")}
            onChange={e => form.set("subjectCode", e.target.value.toUpperCase())}
          />
          <TextInput label="Name" required maxLength={100} placeholder="Mathematics" {...form.text("subjectName")} />
        </div>
        <Field label="Type" error={errors.subjectType}>
          <RadioGroup aria-label="Subject type" options={SUBJECT_TYPES} value={values.subjectType} onChange={v => form.set("subjectType", v)} />
        </Field>
        <Field hint="Students choose it (e.g. a second language); others take it by default">
          <Switch label="Optional subject" checked={values.isOptional} onChange={v => form.set("isOptional", v)} />
        </Field>
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
