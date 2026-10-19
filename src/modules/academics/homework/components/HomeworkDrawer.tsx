import { useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Select, Switch, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { useMyTeaching } from "../../shared/api/teaching";
import { useSectionOptions, sectionTitle } from "../../shared/components/SectionSelect";
import { useSectionSubjects } from "../../timetable/api/timetable";
import { createHomework, HOMEWORK_PATH, homeworkPath, updateHomework, type Homework, type HomeworkInput } from "../api/homework";

type Values = { sectionId: string; subjectId: string; title: string; description: string; dueDate: string; maxMarks: string; allowLateSubmission: boolean };

const EMPTY: Values = { sectionId: "", subjectId: "", title: "", description: "", dueDate: "", maxMarks: "", allowLateSubmission: false };

const toValues = (h: Homework): Values => ({
  sectionId: h.sectionId,
  subjectId: h.subjectId,
  title: h.title,
  description: h.description ?? "",
  dueDate: h.dueDate,
  maxMarks: h.maxMarks === null ? "" : String(h.maxMarks),
  allowLateSubmission: h.allowLateSubmission
});

/* AC-16: set homework (homework = null) or edit one. Section and subject are fixed once set.
   A teacher picks among their sections and the subjects they teach there (a class teacher:
   every subject of their section). */
export function HomeworkDrawer({ open, homework, onClose, defaults }: { open: boolean; homework: Homework | null; onClose: () => void; defaults?: { sectionId?: string; subjectId?: string } }) {
  const toast = useToast();
  const navigate = useNavigate();
  const teaching = useMyTeaching();
  const sections = useSectionOptions();
  const form = useForm<Values>(EMPTY);
  const { values, errors } = form;
  const subjects = useSectionSubjects(values.sectionId || null);
  const create = useApiMutation(createHomework, { invalidate: [HOMEWORK_PATH] });
  const update = useApiMutation(updateHomework, { invalidate: [HOMEWORK_PATH] });

  useEffect(() => {
    if (open) form.reset(homework ? toValues(homework) : { ...EMPTY, sectionId: defaults?.sectionId ?? "", subjectId: defaults?.subjectId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, homework?.id]);

  const sectionOptions = teaching.scoped ? sections.options.filter(o => teaching.teaches(o.value)) : sections.options;
  const mine = teaching.of(values.sectionId);
  const subjectOptions = (subjects.data ?? [])
    .filter(s => !teaching.scoped || mine?.isClassTeacher || mine?.subjectIds.includes(s.subjectId))
    .map(s => ({ value: s.subjectId, label: s.subject.subjectName }));
  const minDue = homework ? homework.assignedOn : todayIso();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!homework && !values.sectionId) e.sectionId = "Pick the section";
    if (!homework && !values.subjectId) e.subjectId = "Pick the subject";
    if (!values.title.trim()) e.title = "Give it a title";
    if (!values.dueDate) e.dueDate = "Pick the due date";
    else if (values.dueDate < minDue) e.dueDate = homework ? `Can't be before ${formatDate(minDue)}, the day it was set` : "Can't be in the past";
    if (values.maxMarks) {
      const n = Number(values.maxMarks);
      if (!(n > 0 && n <= 1000)) e.maxMarks = "More than 0, at most 1000";
    } else if (homework?.maxMarks) e.maxMarks = "Marked homework keeps its marks; change the number instead";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const title = values.title.trim();
    const description = values.description.trim();
    if (!homework) {
      const body: HomeworkInput = { sectionId: values.sectionId, subjectId: values.subjectId, title, dueDate: values.dueDate, allowLateSubmission: values.allowLateSubmission };
      if (description) body.description = description;
      if (values.maxMarks) body.maxMarks = Number(values.maxMarks);
      return create.mutate(body, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(homeworkPath(res.data.id));
        },
        onError: err => form.setServerErrors(err)
      });
    }
    const patch: Parameters<typeof updateHomework>[0] = { id: homework.id };
    if (title !== homework.title) patch.title = title;
    if (description !== (homework.description ?? "")) patch.description = description;
    if (values.dueDate !== homework.dueDate) patch.dueDate = values.dueDate;
    if (values.maxMarks && Number(values.maxMarks) !== homework.maxMarks) patch.maxMarks = Number(values.maxMarks);
    if (values.allowLateSubmission !== homework.allowLateSubmission) patch.allowLateSubmission = values.allowLateSubmission;
    if (Object.keys(patch).length === 1) return onClose();
    update.mutate(patch, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => form.setServerErrors(err)
    });
  };

  const section = sections.byId.get(values.sectionId);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={homework ? "Edit homework" : "Set homework"}
      subtitle={homework ? homework.title : "Attachments can be added once it is saved."}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="homework-form" loading={create.isPending || update.isPending}>
            {homework ? "Save" : "Set homework"}
          </Button>
        </>
      }
    >
      <form id="homework-form" className="stack" onSubmit={submit} noValidate>
        {homework ? (
          <DescriptionList
            items={[
              { label: "Section", value: section ? sectionTitle(section) : "—" },
              { label: "Subject", value: homework.subject?.subjectName },
              { label: "Set on", value: formatDate(homework.assignedOn) }
            ]}
            columns={3}
          />
        ) : (
          <div className="form-grid">
            <Select
              label="Section"
              required
              {...form.text("sectionId")}
              onChange={e => {
                form.set("sectionId", e.target.value);
                form.set("subjectId", "");
              }}
              options={sectionOptions}
              placeholder={sections.isLoading ? "Loading sections…" : "Pick a section"}
            />
            <Select
              label="Subject"
              required
              {...form.text("subjectId")}
              options={subjectOptions}
              disabled={!values.sectionId}
              placeholder={!values.sectionId ? "Pick the section first" : subjects.isLoading ? "Loading subjects…" : "Pick a subject"}
              hint={teaching.scoped ? "The subjects you teach in the section" : undefined}
            />
          </div>
        )}
        <TextInput label="Title" required maxLength={200} {...form.text("title")} placeholder="Fractions – exercise 4.2" />
        <Textarea label="Instructions" rows={5} maxLength={5000} {...form.text("description")} placeholder="Optional: what to do, pages, how to hand it in" />
        <div className="form-grid">
          <TextInput label="Due date" required type="date" min={minDue} {...form.text("dueDate")} />
          <TextInput
            label="Out of (marks)"
            type="number"
            min={1}
            max={1000}
            step="any"
            {...form.text("maxMarks")}
            error={errors.maxMarks}
            hint={homework?.maxMarks ? "Marked homework stays marked" : "Leave empty for feedback only"}
          />
        </div>
        <Switch label="Accept late submissions" checked={values.allowLateSubmission} onChange={v => form.set("allowLateSubmission", v)} />
      </form>
    </Drawer>
  );
}
