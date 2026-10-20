import { useEffect, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Field, RadioGroup, Select, Textarea, useConfirm, useToast } from "@/common/ui";
import { useMyTeaching } from "../../shared/api/teaching";
import { useSectionSubjects } from "../../timetable/api/timetable";
import {
  DIARY_KINDS,
  DIARY_KIND_OF,
  DIARY_PATH,
  SUBJECT_KINDS,
  createEntry,
  dayLabel,
  deleteEntry,
  updateEntry,
  type DiaryEntry,
  type DiaryKind,
  type EntryInput,
  type EntryPatch
} from "../api/diary";

type Audience = "SECTION" | "STUDENT";
type Values = { kind: DiaryKind | ""; subjectId: string; audience: Audience; studentId: string; body: string };

const AUDIENCES: { value: Audience; label: string; description: string }[] = [
  { value: "SECTION", label: "Every family in the section", description: "The whole class reads it" },
  { value: "STUDENT", label: "One student's family", description: "Only that student and their parents see it" }
];

/* AC-20: write a line in a section's diary for a day (entry = null), or open one. A subject
   teacher writes for the subjects they teach; the class teacher and deputy can also write
   lines with no subject. Someone who isn't the author, the principal or an admin sees it read-only. */
export function DiaryEntryDrawer({
  open,
  entry,
  sectionId,
  sectionName,
  date,
  students,
  onClose
}: {
  open: boolean;
  entry: DiaryEntry | null;
  sectionId: string;
  sectionName: string;
  date: string;
  /* The section's students, for a note to one family */
  students: { value: string; label: string }[];
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const subjects = useSectionSubjects(open ? sectionId : null);
  const form = useForm<Values>({ kind: "", subjectId: "", audience: "SECTION", studentId: "", body: "" });
  const { values, errors } = form;
  const invalidate = [DIARY_PATH];
  const create = useApiMutation(createEntry, { invalidate });
  const update = useApiMutation(updateEntry, { invalidate });
  const remove = useApiMutation(deleteEntry, { invalidate });

  useEffect(() => {
    if (!open) return;
    form.reset(
      entry
        ? { kind: entry.kind, subjectId: entry.subjectId ?? "", audience: entry.studentId ? "STUDENT" : "SECTION", studentId: entry.studentId ?? "", body: entry.body }
        : { kind: "", subjectId: "", audience: "SECTION", studentId: "", body: "" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  const editable = !readOnly && (!entry || !!entry.canEdit);
  const leads = teaching.leads(sectionId);
  const mine = teaching.of(sectionId);
  const subjectOptions = (subjects.data ?? [])
    .filter(s => !teaching.scoped || mine?.isClassTeacher || mine?.subjectIds.includes(s.subjectId))
    .map(s => ({ value: s.subjectId, label: s.subject.subjectName }));
  /* A subject teacher (not leading the section) always names their subject */
  const needsSubject = (values.kind && SUBJECT_KINDS.includes(values.kind)) || !leads;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.kind) e.kind = "Pick what kind of line it is";
    if (needsSubject && !values.subjectId) e.subjectId = leads ? "Classwork and homework need a subject" : "Pick the subject you teach";
    if (values.kind === "NOTE" && values.audience === "STUDENT" && !values.studentId) e.studentId = "Pick the student";
    if (!values.body.trim()) e.body = "Write the line";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const done = (res: { message: string }) => {
    toast.success(res.message);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const kind = values.kind as DiaryKind;
    const body = values.body.trim();
    if (!entry) {
      const input: EntryInput = { sectionId, entryDate: date, kind, body };
      if (values.subjectId) input.subjectId = values.subjectId;
      if (kind === "NOTE" && values.audience === "STUDENT") input.studentId = values.studentId;
      return create.mutate(input, { onSuccess: done, onError: err => form.setServerErrors(err) });
    }
    const patch: EntryPatch = { id: entry.id };
    if (kind !== entry.kind) patch.kind = kind;
    if ((values.subjectId || null) !== entry.subjectId) patch.subjectId = values.subjectId || null;
    if (body !== entry.body) patch.body = body;
    if (Object.keys(patch).length === 1) return onClose();
    update.mutate(patch, { onSuccess: done, onError: err => form.setServerErrors(err) });
  };

  const onDelete = async () => {
    if (!entry) return;
    const ok = await confirm({ title: "Remove this line?", message: "Families will no longer see it in the diary.", confirmLabel: "Remove" });
    if (ok) remove.mutate(entry.id, { onSuccess: done, onError: err => toast.error(err) });
  };

  /* A line for one family stays a note; a line for the section can't become one */
  const kindOptions = DIARY_KINDS.filter(k => !entry?.studentId || k.value === "NOTE").map(k => ({ value: k.value, label: k.label, description: k.description }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={entry ? (editable ? "Edit diary line" : "Diary line") : "Write in the diary"}
      subtitle={`${sectionName} · ${dayLabel(date)}`}
      footerStatus={form.formError}
      footer={
        editable ? (
          <>
            {entry && (
              <Button variant="ghost" icon={<Trash2 />} onClick={() => void onDelete()} loading={remove.isPending} style={{ marginRight: "auto" }}>
                Remove
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="diary-entry-form" loading={create.isPending || update.isPending}>
              {entry ? "Save" : "Write"}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {!editable && entry ? (
        <DescriptionList
          items={[
            { label: "Kind", value: DIARY_KIND_OF[entry.kind].label },
            { label: "Subject", value: entry.subject?.subjectName ?? "—" },
            { label: "For", value: entry.student ? `${entry.student.user.firstName} ${entry.student.user.lastName}'s family` : "Every family in the section" },
            { label: "Written by", value: entry.writer ? `${entry.writer.firstName} ${entry.writer.lastName}` : "—" },
            { label: "Line", value: <span style={{ whiteSpace: "pre-wrap" }}>{entry.body}</span> }
          ]}
        />
      ) : (
        <form id="diary-entry-form" className="stack" onSubmit={submit} noValidate>
          <Field label="Kind" required error={errors.kind}>
            <RadioGroup
              aria-label="Kind"
              options={kindOptions}
              value={values.kind}
              onChange={v => {
                form.set("kind", v);
                if (v !== "NOTE") form.set("audience", "SECTION");
              }}
            />
          </Field>
          <Select
            label="Subject"
            required={needsSubject}
            {...form.text("subjectId")}
            options={subjectOptions}
            placeholder={subjects.isLoading ? "Loading subjects…" : needsSubject ? "Pick a subject" : "No subject (for the whole class)"}
            hint={teaching.scoped && !leads ? "The subjects you teach in this section" : undefined}
          />
          {values.kind === "NOTE" && !entry && (
            <Field label="For">
              <RadioGroup aria-label="For" options={AUDIENCES} value={values.audience} onChange={v => form.set("audience", v)} />
            </Field>
          )}
          {values.kind === "NOTE" && values.audience === "STUDENT" && !entry && (
            <Select label="Student" required {...form.text("studentId")} options={students} placeholder="Pick the student" />
          )}
          {entry?.student && (
            <DescriptionList items={[{ label: "For", value: `${entry.student.user.firstName} ${entry.student.user.lastName}'s family` }]} />
          )}
          <Textarea
            label="Line"
            required
            rows={4}
            maxLength={2000}
            {...form.text("body")}
            placeholder={
              values.kind === "CLASSWORK"
                ? "Chapter 4: read pages 32–35 and discussed the questions"
                : values.kind === "HOMEWORK"
                  ? "Exercise 4.2, questions 1–5, in the notebook"
                  : values.kind === "REMINDER"
                    ? "Bring crayons and an old newspaper for art tomorrow"
                    : "A message for the families"
            }
          />
        </form>
      )}
    </Drawer>
  );
}
