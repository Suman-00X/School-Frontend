import { useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { createExam, EXAMS_PATH, updateExam, type Exam, type ExamInput, type ExamType } from "../api/exams";
import { useGradeScales } from "../api/grading";

type Values = {
  examName: string;
  examType: ExamType | "";
  startDate: string;
  endDate: string;
  gradeScaleId: string;
  description: string;
};

const EMPTY: Values = {
  examName: "",
  examType: "INTERNAL",
  startDate: "",
  endDate: "",
  gradeScaleId: "",
  description: ""
};

const toValues = (e: Exam): Values => ({
  examName: e.examName,
  examType: e.examType ?? "",
  startDate: e.startDate ?? "",
  endDate: e.endDate ?? "",
  gradeScaleId: e.gradeScaleId ?? "",
  description: e.description ?? ""
});

const TYPE_OPTIONS = [
  {
    value: "INTERNAL" as const,
    label: "Internal",
    description: "Unit tests, mid-term, half-yearly"
  },
  {
    value: "FINAL" as const,
    label: "Final",
    description: "The year-end exam; its result decides promotion"
  }
];

/* AC-13: create an exam in the header's year, or edit one. The API can't clear a date or
   the grade scale once set, so those fields stay required when editing. */
export function ExamDrawer({ open, exam, onClose }: { open: boolean; exam: Exam | null; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm<Values>(EMPTY);
  const { scales, isLoading: scalesLoading } = useGradeScales(open);
  const create = useApiMutation(createExam, { invalidate: [EXAMS_PATH] });
  const update = useApiMutation(updateExam, { invalidate: [EXAMS_PATH] });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(exam ? toValues(exam) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam?.id]);

  const before = exam ? toValues(exam) : null;
  const changes: Partial<ExamInput> = {};
  if (before) {
    if (values.examName.trim() !== before.examName) changes.examName = values.examName.trim();
    if (values.examType && values.examType !== before.examType) changes.examType = values.examType;
    if (values.startDate !== before.startDate && values.startDate) changes.startDate = values.startDate;
    if (values.endDate !== before.endDate && values.endDate) changes.endDate = values.endDate;
    if (values.gradeScaleId !== before.gradeScaleId && values.gradeScaleId) changes.gradeScaleId = values.gradeScaleId;
    if (values.description.trim() !== before.description) changes.description = values.description.trim();
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.examName.trim()) e.examName = "Give the exam a name";
    if (before?.startDate && !values.startDate) e.startDate = "A start date can be changed but not removed";
    if (before?.endDate && !values.endDate) e.endDate = "An end date can be changed but not removed";
    if (values.startDate && values.endDate && values.endDate < values.startDate) e.endDate = "Must be on or after the start date";
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    /* A taken name is the name's problem */
    const onError = (err: unknown) => {
      if (isApiError(err) && err.status === 409 && /already exists/i.test(err.message)) {
        form.setErrors({ examName: err.message });
        form.setFormError(null);
      } else form.setServerErrors(err);
    };
    if (exam) {
      if (!Object.keys(changes).length) return;
      update.mutate(
        { id: exam.id, ...changes },
        {
          onSuccess: res => {
            toast.success(res.message);
            onClose();
          },
          onError
        }
      );
      return;
    }
    const body: ExamInput = { examName: values.examName.trim() };
    if (values.examType) body.examType = values.examType;
    if (values.startDate) body.startDate = values.startDate;
    if (values.endDate) body.endDate = values.endDate;
    if (values.gradeScaleId) body.gradeScaleId = values.gradeScaleId;
    if (values.description.trim()) body.description = values.description.trim();
    create.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
        navigate(`${EXAMS_PATH}/${res.data.id}`);
      },
      onError
    });
  };

  const busy = create.isPending || update.isPending;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={exam ? `Edit ${exam.examName}` : "New exam"}
      subtitle={exam ? undefined : "Add papers for each section after creating it"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="exam-form" variant="primary" loading={busy} disabled={!!exam && !Object.keys(changes).length}>
            {exam ? "Save changes" : "Create exam"}
          </Button>
        </>
      }
    >
      <form id="exam-form" className="stack" onSubmit={submit} noValidate>
        <TextInput label="Name" required autoFocus maxLength={100} placeholder="Half-Yearly Examination" {...form.text("examName")} />
        <Field label="Type" error={errors.examType} hint="Final exams count as the year's result when there is no annual assessment scheme">
          <RadioGroup aria-label="Exam type" options={TYPE_OPTIONS} value={values.examType} onChange={v => form.set("examType", v)} />
        </Field>
        <div className="form-grid">
          <TextInput label="Starts" type="date" required={!!before?.startDate} {...form.text("startDate")} />
          <TextInput label="Ends" type="date" required={!!before?.endDate} min={values.startDate || undefined} {...form.text("endDate")} />
        </div>
        <Select
          label="Grade scale"
          value={values.gradeScaleId}
          onChange={e => form.set("gradeScaleId", e.target.value)}
          options={scales.map(s => ({
            value: s.id,
            label: s.name,
            description: s.isDefault ? "School default" : (s.description ?? undefined)
          }))}
          placeholder={scalesLoading ? "Loading scales…" : "The result policy's scale"}
          required={!!before?.gradeScaleId}
          error={errors.gradeScaleId}
          hint={before?.gradeScaleId ? "The scale can be changed but not removed" : "Leave empty to use the scale of the result policy that applies"}
        />
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
