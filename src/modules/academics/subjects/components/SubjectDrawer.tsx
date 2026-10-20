import { useEffect, useState, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { changedFields, useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, RadioGroup, TextInput, Textarea, useToast } from "@/common/ui";
import { CLASS_SUBJECTS_PATH } from "../../class-subjects/api/classSubjects";
import { SECTION_SUBJECTS_PATH } from "../../section-subjects/api/sectionSubjects";
import { createSubject, SUBJECT_CODE, SUBJECT_TYPES, SUBJECTS_PATH, subjectTypeLabel, updateSubject, type Subject, type SubjectType } from "../api/subjects";
import { suggestCode } from "../utils/subjectCode";

type Kind = "required" | "optional";

type Values = { subjectName: string; subjectCode: string; subjectType: SubjectType | ""; kind: Kind; description: string };

const EMPTY: Values = { subjectName: "", subjectCode: "", subjectType: "THEORY", kind: "required", description: "" };

const toValues = (s: Subject): Values => ({
  subjectName: s.subjectName,
  subjectCode: s.subjectCode,
  subjectType: s.subjectType ?? "",
  kind: s.isOptional ? "optional" : "required",
  description: s.description ?? ""
});

const toBody = (v: Values) => ({
  subjectName: v.subjectName.trim(),
  subjectCode: v.subjectCode.trim().toUpperCase(),
  subjectType: v.subjectType,
  isOptional: v.kind === "optional",
  description: v.description.trim()
});

/* AC-03: add a subject to the school's list, or view/edit one. Its name, code and type are
   the same in every class; whether it is optional is only the default when a class is given it. */
export function SubjectDrawer({
  open,
  subject,
  subjects,
  canEdit,
  onClose
}: {
  open: boolean;
  subject: Subject | null;
  /* Every subject, for the code suggestion */
  subjects: Subject[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const form = useForm<Values>(EMPTY);
  const [codeTouched, setCodeTouched] = useState(false);
  /* Class and section subjects embed the subject's name and code */
  const invalidate = [SUBJECTS_PATH, CLASS_SUBJECTS_PATH, SECTION_SUBJECTS_PATH, "/academics/teacher-assignments"];
  const create = useApiMutation(createSubject, { invalidate });
  const update = useApiMutation(updateSubject, { invalidate });
  const { values } = form;

  useEffect(() => {
    if (open) {
      form.reset(subject ? toValues(subject) : EMPTY);
      setCodeTouched(!!subject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject?.id]);

  const changes = subject ? changedFields(toBody(toValues(subject)), toBody(values)) : null;

  const setName = (name: string) => {
    form.set("subjectName", name);
    if (!codeTouched) form.set("subjectCode", suggestCode(name, new Set(subjects.filter(s => s.id !== subject?.id).map(s => s.subjectCode))));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.subjectName.trim()) e.subjectName = "Type the subject's name";
    const code = values.subjectCode.trim().toUpperCase();
    if (!code) e.subjectCode = "Type a short code, e.g. MAT";
    else if (!SUBJECT_CODE.test(code)) e.subjectCode = "2–6 letters, no digits";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  /* A duplicate (409) names its field */
  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409) {
      form.setErrors({ [/code/i.test(err.message) ? "subjectCode" : "subjectName"]: err.message });
      form.setFormError(err.message);
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
    if (!subject) {
      const { subjectType, description, ...body } = toBody(values);
      create.mutate({ ...body, ...(subjectType ? { subjectType } : {}), ...(description ? { description } : {}) }, { onSuccess: done, onError });
    } else if (changes && Object.keys(changes).length) {
      /* The API refuses null: an emptied note is sent as "" */
      const { subjectType, description, ...rest } = changes;
      update.mutate(
        { id: subject.id, ...rest, ...(subjectType ? { subjectType } : {}), ...(description !== undefined ? { description: description ?? "" } : {}) },
        { onSuccess: done, onError }
      );
    }
  };

  const title = subject ? subject.subjectName : "New subject";
  const badge = subject && <Badge tone={subject.isOptional ? "info" : undefined}>{subject.isOptional ? "Usually optional" : "Usually required"}</Badge>;

  if (subject && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={badge}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Code", value: <span className="mono">{subject.subjectCode}</span> },
            { label: "Type", value: subjectTypeLabel(subject.subjectType) || null },
            { label: "Note", value: subject.description }
          ]}
        />
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={badge}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="subject-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!changes && !Object.keys(changes).length}>
            {subject ? "Save changes" : "Add subject"}
          </Button>
        </>
      }
    >
      <form id="subject-form" className="stack" onSubmit={submit} noValidate>
        <TextInput
          label="Name"
          required
          autoFocus={!subject}
          maxLength={100}
          placeholder="Mathematics"
          hint={subject ? "Renames it in every class and section" : undefined}
          {...form.text("subjectName")}
          onChange={e => setName(e.target.value)}
        />
        <div className="grid-2">
          <TextInput
            label="Code"
            required
            maxLength={6}
            placeholder="MAT"
            hint="Letters only. Each class adds three digits: MAT221"
            {...form.text("subjectCode")}
            onChange={e => {
              form.set("subjectCode", e.target.value.toUpperCase());
              setCodeTouched(true);
            }}
          />
          <Field label="Type">
            <RadioGroup<SubjectType>
              aria-label="Type"
              options={SUBJECT_TYPES.map(t => ({ value: t.value, label: t.label }))}
              value={values.subjectType}
              onChange={v => form.set("subjectType", v)}
            />
          </Field>
        </div>
        <Field label="When a class is given it" hint="Only the default: each class can choose for itself">
          <RadioGroup<Kind>
            aria-label="Required or optional"
            value={values.kind}
            onChange={v => form.set("kind", v)}
            options={[
              { value: "required", label: "Required", description: "Every section of the class gets it" },
              { value: "optional", label: "Optional", description: "Only the sections picked get it" }
            ]}
          />
        </Field>
        <Textarea label="Note" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
