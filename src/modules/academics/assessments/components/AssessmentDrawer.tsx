import { useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Field, RadioGroup, Select, Switch, TextInput, Textarea, useToast } from "@/common/ui";
import { useMyTeaching } from "../../shared/api/teaching";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { useSectionSubjects } from "../../timetable/api/timetable";
import {
  ASSESSMENTS_PATH,
  assessmentPath,
  createAssessment,
  ITEM_TYPES,
  TYPE_LABELS,
  updateAssessment,
  useBuckets,
  type Assessment,
  type AssessmentInput,
  type AssessmentPatch,
  type AssessmentType
} from "../api/assessments";

type Values = {
  bucketId: string;
  sectionId: string;
  subjectId: string;
  assessmentType: AssessmentType;
  title: string;
  assessedOn: string;
  maxMarks: string;
  counts: boolean;
  description: string;
};

const EMPTY: Values = { bucketId: "", sectionId: "", subjectId: "", assessmentType: "TEST", title: "", assessedOn: "", maxMarks: "", counts: true, description: "" };

const toValues = (a: Assessment): Values => ({
  bucketId: a.bucketId,
  sectionId: a.sectionId,
  subjectId: a.subjectId,
  assessmentType: a.assessmentType,
  title: a.title,
  assessedOn: a.assessedOn ?? "",
  maxMarks: String(a.maxMarks),
  counts: a.counts,
  description: a.description ?? ""
});

const TYPE_OPTIONS = ITEM_TYPES.map(t => ({ value: t, label: TYPE_LABELS[t] }));

/* Add a teacher's own marked item (assessment = null) or edit one. Section, subject and type are
   fixed once it exists. A homework item only changes its bucket and whether it counts: its title,
   date and marks belong to the homework. */
export function AssessmentDrawer({
  open,
  assessment,
  onClose,
  defaults
}: {
  open: boolean;
  assessment: Assessment | null;
  onClose: () => void;
  defaults?: { sectionId?: string; subjectId?: string; bucketId?: string };
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const teaching = useMyTeaching();
  const sections = useSectionOptions();
  const buckets = useBuckets(open);
  const form = useForm<Values>(EMPTY);
  const { values, errors } = form;
  const subjects = useSectionSubjects(values.sectionId || null);
  const create = useApiMutation(createAssessment, { invalidate: [ASSESSMENTS_PATH] });
  const update = useApiMutation(updateAssessment, { invalidate: [ASSESSMENTS_PATH] });
  const homework = !!assessment?.homeworkId;

  useEffect(() => {
    if (open)
      form.reset(
        assessment
          ? toValues(assessment)
          : { ...EMPTY, sectionId: defaults?.sectionId ?? "", subjectId: defaults?.subjectId ?? "", bucketId: defaults?.bucketId ?? "" }
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assessment?.id]);

  /* One bucket: pick it for them */
  useEffect(() => {
    const open_ = buckets.options.filter(o => !o.disabled);
    if (open && !assessment && !values.bucketId && open_.length === 1) form.set("bucketId", open_[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, buckets.options.length]);

  const sectionOptions = teaching.scoped ? sections.options.filter(o => teaching.teaches(o.value)) : sections.options;
  const mine = teaching.of(values.sectionId);
  const subjectOptions = (subjects.data ?? [])
    .filter(s => !teaching.scoped || mine?.isClassTeacher || mine?.subjectIds.includes(s.subjectId))
    .map(s => ({ value: s.subjectId, label: s.subject.subjectName }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.bucketId) e.bucketId = "Pick the bucket it counts toward";
    if (!assessment && !values.sectionId) e.sectionId = "Pick the section";
    if (!assessment && !values.subjectId) e.subjectId = "Pick the subject";
    if (!homework) {
      if (!values.title.trim()) e.title = "Give it a title, e.g. Class test 1";
      const n = Number(values.maxMarks);
      if (!values.maxMarks) e.maxMarks = "How many marks is it out of?";
      else if (!(n > 0 && n <= 1000)) e.maxMarks = "More than 0, at most 1000";
    }
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const title = values.title.trim();
    const description = values.description.trim();
    if (!assessment) {
      const body: AssessmentInput = {
        bucketId: values.bucketId,
        sectionId: values.sectionId,
        subjectId: values.subjectId,
        assessmentType: values.assessmentType,
        title,
        maxMarks: Number(values.maxMarks),
        counts: values.counts
      };
      if (values.assessedOn) body.assessedOn = values.assessedOn;
      if (description) body.description = description;
      return create.mutate(body, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(assessmentPath(res.data.id));
        },
        onError: err => form.setServerErrors(err)
      });
    }
    const patch: AssessmentPatch = {};
    if (values.bucketId !== assessment.bucketId) patch.bucketId = values.bucketId;
    if (values.counts !== assessment.counts) patch.counts = values.counts;
    if (!homework) {
      if (title !== assessment.title) patch.title = title;
      if (values.assessedOn && values.assessedOn !== (assessment.assessedOn ?? "")) patch.assessedOn = values.assessedOn;
      if (Number(values.maxMarks) !== assessment.maxMarks) patch.maxMarks = Number(values.maxMarks);
      if (description !== (assessment.description ?? "")) patch.description = description;
    }
    if (!Object.keys(patch).length) return onClose();
    update.mutate(
      { id: assessment.id, ...patch },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };

  const section = sections.byId.get(values.sectionId);
  const bucket = buckets.byId.get(values.bucketId);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={assessment ? `Edit ${assessment.title}` : "Add a test, assignment or project"}
      subtitle={
        homework
          ? "Homework: its title, due date and marks are set on the homework."
          : "Marks you give are averaged with the subject's other items into the bucket's share of the result."
      }
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="assessment-form" loading={create.isPending || update.isPending}>
            {assessment ? "Save" : "Add and enter marks"}
          </Button>
        </>
      }
    >
      <form id="assessment-form" className="stack" onSubmit={submit} noValidate>
        <Select
          label="Counts toward"
          required
          {...form.text("bucketId")}
          options={buckets.options}
          placeholder={buckets.isLoading ? "Loading buckets…" : buckets.options.length ? "Pick a bucket" : "No buckets yet"}
          hint={
            bucket
              ? `${bucket.weight}% of ${bucket.scheme.name}, shared by every item of the subject`
              : !buckets.isLoading && !buckets.options.length
                ? "An admin adds buckets to an assessment scheme (Setup › Grading)"
                : undefined
          }
        />
        {assessment ? (
          <DescriptionList
            items={[
              { label: "Section", value: section ? sectionTitle(section) : (assessment.section?.sectionName ?? "—") },
              { label: "Subject", value: assessment.subject?.subjectName ?? "—" },
              { label: "Type", value: TYPE_LABELS[assessment.assessmentType] }
            ]}
            columns={3}
          />
        ) : (
          <>
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
            <Field label="Type" hint="A label only: every item counts the same in the average">
              <RadioGroup name="assessmentType" aria-label="Type" options={TYPE_OPTIONS} value={values.assessmentType} onChange={v => form.set("assessmentType", v)} />
            </Field>
          </>
        )}
        {!homework && (
          <>
            <TextInput label="Title" required maxLength={120} {...form.text("title")} placeholder="Class test 1" />
            <div className="form-grid">
              <TextInput label="Out of (marks)" required type="number" min={1} max={1000} step="any" {...form.text("maxMarks")} error={errors.maxMarks} />
              <TextInput label="Date" type="date" {...form.text("assessedOn")} hint="Optional" />
            </div>
            <Textarea label="Notes" rows={2} maxLength={1000} {...form.text("description")} placeholder="Optional: chapters covered, rubric" />
          </>
        )}
        <Switch
          label="Counts toward the final result"
          checked={values.counts}
          onChange={v => form.set("counts", v)}
        />
        {!values.counts && <p className="small muted">Kept with its marks (a practice test, say) but left out of the average.</p>}
      </form>
    </Drawer>
  );
}
