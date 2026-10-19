import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Checkbox, DescriptionList, Drawer, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { useSectionOptions, sectionTitle } from "../../shared/components/SectionSelect";
import {
  COMPONENT_LABELS,
  createPaper,
  PAPER_COMPONENTS,
  papersPath,
  shortTime,
  updatePaper,
  type Exam,
  type ExamPaper,
  type GradingType,
  type PaperComponent,
  type PaperInput,
  type PaperPatch
} from "../api/exams";

type SectionSubject = {
  id: string;
  sectionId: string;
  subjectId: string;
  subject: { id: string; subjectName: string; subjectCode: string };
};

type Values = {
  sectionId: string;
  subjectId: string;
  gradingType: GradingType;
  component: PaperComponent | "";
  examDate: string;
  startTime: string;
  endTime: string;
  room: string;
  maxMarks: string;
  passMarks: string;
  description: string;
};

const EMPTY: Values = {
  sectionId: "",
  subjectId: "",
  gradingType: "MARKS",
  component: "",
  examDate: "",
  startTime: "",
  endTime: "",
  room: "",
  maxMarks: "",
  passMarks: "",
  description: ""
};

const toValues = (p: ExamPaper): Values => ({
  sectionId: p.sectionId,
  subjectId: p.subjectId,
  gradingType: p.gradingType,
  component: p.component ?? "",
  examDate: p.examDate ?? "",
  startTime: shortTime(p.startTime),
  endTime: shortTime(p.endTime),
  room: p.room ?? "",
  maxMarks: p.maxMarks !== null ? String(p.maxMarks) : "",
  passMarks: p.passMarks !== null ? String(p.passMarks) : "",
  description: p.description ?? ""
});

const GRADING_OPTIONS = [
  {
    value: "MARKS" as const,
    label: "Marks",
    description: "Marked out of a maximum, with an optional pass mark"
  },
  {
    value: "GRADE" as const,
    label: "Grade only",
    description: "Art, conduct, sports: a grade, no marks"
  }
];

const COMPONENT_OPTIONS = [
  { value: "", label: "Whole paper", description: "The subject has one paper" },
  ...PAPER_COMPONENTS.map(c => ({
    value: c,
    label: COMPONENT_LABELS[c],
    description: "One part of the subject; add a paper per part"
  }))
];

const asNumber = (s: string) => (s.trim() === "" ? undefined : Number(s));

/* The server's refusals name a field in the text; place them under it */
const fieldOf = (message: string) =>
  /maxMarks/i.test(message)
    ? "maxMarks"
    : /passMarks/i.test(message)
      ? "passMarks"
      : /endTime/i.test(message)
        ? "endTime"
        : /sits|from .* to/i.test(message)
          ? "examDate"
          : null;

/* AC-13: add a paper (one section, optionally copied to other sections of the same class: the API
   takes one section per request) or edit one. Section, subject, grading and component are fixed
   once the paper exists. */
export function PaperDrawer({
  open,
  exam,
  paper,
  defaultSectionId,
  onClose
}: {
  open: boolean;
  exam: Exam;
  paper: ExamPaper | null;
  defaultSectionId?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const form = useForm<Values>(EMPTY);
  const { options: sectionOptions, byId: sectionsById, isLoading: sectionsLoading } = useSectionOptions(open);
  const [copyTo, setCopyTo] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const create = useApiMutation(createPaper);
  const update = useApiMutation(updatePaper, {
    invalidate: [papersPath(exam.id)]
  });
  const { values, errors } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(paper ? toValues(paper) : { ...EMPTY, sectionId: defaultSectionId ?? "" });
    setCopyTo(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paper?.id]);

  const subjects = useQuery({
    queryKey: ["/academics/section-subjects", { sectionId: values.sectionId, limit: 100 }],
    enabled: open && !paper && !!values.sectionId,
    queryFn: async () =>
      (
        await api.get<SectionSubject[]>("/academics/section-subjects", {
          sectionId: values.sectionId,
          limit: 100
        })
      ).data
  });
  const subjectOptions = useMemo(
    () =>
      (subjects.data ?? [])
        .map(s => ({
          value: s.subjectId,
          label: s.subject.subjectName,
          description: s.subject.subjectCode
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [subjects.data]
  );

  /* Other sections of the same class, for "also add to" */
  const section = sectionsById.get(values.sectionId);
  const siblings = section ? [...sectionsById.values()].filter(s => s.classId === section.classId && s.id !== section.id) : [];

  const before = paper ? toValues(paper) : null;
  const graded = values.gradingType === "GRADE";

  const patch: PaperPatch = {};
  if (before) {
    if (values.examDate !== before.examDate && values.examDate) patch.examDate = values.examDate;
    if (values.startTime !== before.startTime && values.startTime) patch.startTime = values.startTime;
    if (values.endTime !== before.endTime && values.endTime) patch.endTime = values.endTime;
    if (values.room.trim() !== before.room && values.room.trim()) patch.room = values.room.trim();
    if (!graded && values.maxMarks !== before.maxMarks && values.maxMarks) patch.maxMarks = Number(values.maxMarks);
    if (!graded && values.passMarks !== before.passMarks && values.passMarks) patch.passMarks = Number(values.passMarks);
    if (values.description.trim() !== before.description) patch.description = values.description.trim();
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!paper) {
      if (!values.sectionId) e.sectionId = "Pick the section that sits the paper";
      if (!values.subjectId) e.subjectId = "Pick the subject";
    }
    const max = asNumber(values.maxMarks);
    const pass = asNumber(values.passMarks);
    if (!graded) {
      if (max === undefined) e.maxMarks = "Enter the maximum marks";
      else if (!(max > 0 && max <= 1000)) e.maxMarks = "More than 0 and at most 1000";
      if (pass !== undefined && !(pass >= 0)) e.passMarks = "0 or more";
      else if (pass !== undefined && max !== undefined && pass > max) e.passMarks = "Can't be more than the maximum";
    }
    if (values.startTime && values.endTime && values.endTime <= values.startTime) e.endTime = "Must be after the start time";
    if (before) {
      const kept = "Can be changed but not removed";
      if (before.examDate && !values.examDate) e.examDate = kept;
      if (before.startTime && !values.startTime) e.startTime = kept;
      if (before.endTime && !values.endTime) e.endTime = kept;
      if (before.room && !values.room.trim()) e.room = kept;
      if (!graded && before.passMarks && !values.passMarks) e.passMarks = kept;
    }
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onError = (err: unknown) => {
    const field = fieldOf(errorMessage(err));
    if (field && !(err as { isValidation?: boolean }).isValidation) {
      form.setErrors({ [field]: errorMessage(err) });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const refresh = () =>
    qc.invalidateQueries({
      predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith(papersPath(exam.id))
    });

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    if (paper) {
      if (!Object.keys(patch).length) return;
      update.mutate(
        { examId: exam.id, paperId: paper.id, ...patch },
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
    const body: PaperInput = {
      sectionId: values.sectionId,
      subjectId: values.subjectId,
      gradingType: values.gradingType
    };
    if (values.component) body.component = values.component;
    if (values.examDate) body.examDate = values.examDate;
    if (values.startTime) body.startTime = values.startTime;
    if (values.endTime) body.endTime = values.endTime;
    if (values.room.trim()) body.room = values.room.trim();
    if (!graded) {
      body.maxMarks = Number(values.maxMarks);
      if (values.passMarks) body.passMarks = Number(values.passMarks);
    }
    if (values.description.trim()) body.description = values.description.trim();

    let first;
    try {
      first = await create.mutateAsync({ examId: exam.id, ...body });
    } catch (err) {
      onError(err);
      return;
    }
    /* One request per extra section: report each one that fails (the first paper is kept) */
    const extra = siblings.filter(s => copyTo.has(s.id));
    if (!extra.length) {
      await refresh();
      toast.success(first.message);
      onClose();
      return;
    }
    setCopying(true);
    const failed: string[] = [];
    for (const s of extra) {
      try {
        await createPaper({ examId: exam.id, ...body, sectionId: s.id });
      } catch (err) {
        failed.push(`${sectionTitle(s)}: ${errorMessage(err)}`);
      }
    }
    setCopying(false);
    await refresh();
    const done = extra.length - failed.length + 1;
    if (failed.length) {
      toast.warning(`Paper added to ${done} section${done === 1 ? "" : "s"}. Not added to ${failed.join("; ")}`);
    } else toast.success(`Paper added to ${done} sections of ${section?.class?.className ?? "the class"}`);
    onClose();
  };

  const busy = create.isPending || update.isPending || copying;
  const sectionName = (id: string) => {
    const s = sectionsById.get(id);
    return s ? sectionTitle(s) : (paper?.section.sectionName ?? "");
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={paper ? `Edit ${paper.displayCode}` : `Add a paper to ${exam.examName}`}
      subtitle={paper ? `${paper.subject.subjectName} · ${sectionName(paper.sectionId)}` : undefined}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="paper-form" variant="primary" loading={busy} disabled={!!paper && !Object.keys(patch).length}>
            {paper ? "Save changes" : copyTo.size ? `Add to ${copyTo.size + 1} sections` : "Add paper"}
          </Button>
        </>
      }
    >
      <form id="paper-form" className="stack" onSubmit={e => void submit(e)} noValidate>
        {paper ? (
          <DescriptionList
            columns={2}
            items={[
              { label: "Section", value: sectionName(paper.sectionId) },
              {
                label: "Subject",
                value: `${paper.subject.subjectName} (${paper.subject.subjectCode})`
              },
              {
                label: "Graded by",
                value: paper.gradingType === "GRADE" ? "Grade only" : "Marks"
              },
              {
                label: "Part",
                value: paper.component ? COMPONENT_LABELS[paper.component] : "Whole paper"
              }
            ]}
          />
        ) : (
          <>
            <div className="form-grid">
              <Select
                label="Section"
                required
                value={values.sectionId}
                onChange={e => {
                  form.set("sectionId", e.target.value);
                  form.set("subjectId", "");
                  setCopyTo(new Set());
                }}
                options={sectionOptions}
                placeholder={sectionsLoading ? "Loading sections…" : "Pick a section"}
                error={errors.sectionId}
              />
              <Select
                label="Subject"
                required
                value={values.subjectId}
                onChange={e => form.set("subjectId", e.target.value)}
                options={subjectOptions}
                disabled={!values.sectionId}
                placeholder={!values.sectionId ? "Pick the section first" : subjects.isLoading ? "Loading subjects…" : "Pick a subject"}
                error={errors.subjectId}
                hint={
                  values.sectionId && subjects.data && !subjects.data.length
                    ? "No subjects are set up for this section yet"
                    : "Subjects taught in the section"
                }
              />
            </div>
            <Field label="Graded by" hint="Every part of a subject is graded the same way">
              <RadioGroup aria-label="Graded by" options={GRADING_OPTIONS} value={values.gradingType} onChange={v => form.set("gradingType", v)} />
            </Field>
            <Select
              label="Part"
              value={values.component}
              required
              onChange={e => form.set("component", e.target.value as PaperComponent | "")}
              options={COMPONENT_OPTIONS}
              error={errors.component}
              hint="Split a subject into theory, practical… with one paper each"
            />
          </>
        )}
        <div className="form-grid">
          <TextInput label="Exam date" type="date" min={exam.startDate ?? undefined} max={exam.endDate ?? undefined} {...form.text("examDate")} />
          <TextInput label="Room" maxLength={30} placeholder="Room 601" {...form.text("room")} />
          <TextInput label="Starts at" type="time" {...form.text("startTime")} />
          <TextInput label="Ends at" type="time" {...form.text("endTime")} />
        </div>
        {!graded && (
          <div className="form-grid">
            <TextInput label="Maximum marks" type="number" required min={1} max={1000} step="any" inputMode="decimal" {...form.text("maxMarks")} />
            <TextInput label="Pass marks" type="number" min={0} step="any" inputMode="decimal" hint="Optional" {...form.text("passMarks")} />
          </div>
        )}
        <Textarea label="Notes" rows={2} maxLength={1000} {...form.text("description")} />
        {!paper && siblings.length > 0 && (
          <Field
            label={`Also add to other sections of ${section?.class?.className ?? "the class"}`}
            hint="Same subject, part, date, time and marks in each"
          >
            <div className="row" role="group" style={{ gap: 14 }}>
              {siblings.map(s => (
                <Checkbox
                  key={s.id}
                  label={sectionTitle(s)}
                  checked={copyTo.has(s.id)}
                  onChange={() =>
                    setCopyTo(prev => {
                      const next = new Set(prev);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </Field>
        )}
      </form>
    </Drawer>
  );
}
