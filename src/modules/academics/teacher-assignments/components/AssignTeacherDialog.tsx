import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Select, Textarea, useToast } from "@/common/ui";
import { useTeacherOptions } from "../../classes/api/sections";
import { SectionSelect, sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { useSectionSubjects } from "../../section-subjects/api/sectionSubjects";
import { assignTeacher, changeTeacher, TEACHER_ASSIGNMENTS_PATH, teacherName, type TeacherAssignment } from "../api/teacherAssignments";

/* Assign a teacher to a subject in a section, or change the teacher of an assignment.
   Whatever is known (the section, the subject, the teacher) comes in fixed; the rest is picked.
   Mount it when opened. */
export function AssignTeacherDialog({
  sectionId: fixedSection,
  subjectId: fixedSubject,
  teacherId: fixedTeacher,
  change,
  taken = [],
  onClose
}: {
  sectionId?: string;
  subjectId?: string;
  teacherId?: string;
  /* Change this assignment's teacher (remove, then add) */
  change?: TeacherAssignment;
  /* Section subjects that already have a teacher: "sectionId:subjectId" */
  taken?: string[];
  onClose: () => void;
}) {
  const toast = useToast();
  const teachers = useTeacherOptions();
  const sections = useSectionOptions();
  const [sectionId, setSectionId] = useState(change?.sectionId ?? fixedSection ?? "");
  const [subjectId, setSubjectId] = useState(change?.subjectId ?? fixedSubject ?? "");
  const [teacherId, setTeacherId] = useState(fixedTeacher ?? "");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const subjects = useSectionSubjects(sectionId || null);
  const add = useApiMutation(assignTeacher, { invalidate: [TEACHER_ASSIGNMENTS_PATH] });
  const swap = useApiMutation(changeTeacher, { invalidate: [TEACHER_ASSIGNMENTS_PATH] });

  const section = sections.byId.get(sectionId);
  const sectionLabel = section ? sectionTitle(section) : change ? change.section.sectionName : "the section";
  const subjectName = change?.subject.subjectName ?? subjects.rows?.find(s => s.subjectId === subjectId)?.subject.subjectName;
  const subjectOptions = (subjects.rows ?? []).map(s => ({
    value: s.subjectId,
    label: s.subject.subjectName,
    description: taken.includes(`${sectionId}:${s.subjectId}`) ? "Has a teacher" : s.subject.subjectCode,
    disabled: taken.includes(`${sectionId}:${s.subjectId}`)
  }));
  const teacherOptions = change ? teachers.options.filter(o => o.value !== change.teacherId) : teachers.options;

  const onError = (err: unknown) => {
    if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
    if (isApiError(err) && err.status === 422 && /not taught/i.test(err.message))
      setFormError(
        <>
          {err.message} <Link to={`${SETUP_PATHS.curriculum}?section=${sectionId}`}>Curriculum</Link>
        </>
      );
    else setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!sectionId) errs.sectionId = "Pick a section";
    if (!subjectId) errs.subjectId = "Pick a subject";
    if (!teacherId) errs.teacherId = "Pick a teacher";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (change) swap.mutate({ assignment: change, teacherId }, { onSuccess: done, onError });
    else add.mutate({ sectionId, subjectId, teacherId, ...(description.trim() ? { description: description.trim() } : {}) }, { onSuccess: done, onError });
  };

  const newName = teachers.options.find(o => o.value === teacherId)?.label;
  const title = change
    ? `Change the ${change.subject.subjectName} teacher`
    : subjectName && fixedSubject
      ? `Assign a ${subjectName} teacher`
      : "Assign a teacher";

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assign-teacher-form" variant="primary" loading={add.isPending || swap.isPending}>
            {change ? "Change teacher" : "Assign"}
          </Button>
        </>
      }
    >
      <form id="assign-teacher-form" className="stack" onSubmit={submit} noValidate>
        {fixedSection || change ? (
          <p className="muted" style={{ margin: 0 }}>
            {subjectName ?? "A subject"} in <strong>{sectionLabel}</strong>
          </p>
        ) : (
          <SectionSelect
            value={sectionId}
            required
            error={errors.sectionId}
            onChange={e => {
              setSectionId(e.target.value);
              setSubjectId("");
            }}
          />
        )}
        {!fixedSubject && !change && (
          <Select
            label="Subject"
            required
            options={subjectOptions}
            value={subjectId}
            disabled={!sectionId}
            placeholder={!sectionId ? "Pick the section first" : subjects.isLoading ? "Loading subjects…" : subjectOptions.length ? "Pick a subject" : "No subjects in this section yet"}
            hint="Only the section's subjects can have a teacher"
            error={errors.subjectId}
            onChange={e => setSubjectId(e.target.value)}
          />
        )}
        {fixedTeacher ? null : (
          <Select
            label={change ? "New teacher" : "Teacher"}
            required
            searchable
            options={teacherOptions}
            value={teacherId}
            placeholder={teachers.isLoading ? "Loading teachers…" : "Pick a teacher"}
            hint={change && newName ? `${teacherName(change.teacher)} stops teaching it; ${newName} takes over.` : change ? `Now: ${teacherName(change.teacher)}` : undefined}
            error={errors.teacherId}
            onChange={e => setTeacherId(e.target.value)}
          />
        )}
        {!change && <Textarea label="Note" rows={2} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} />}
      </form>
    </Dialog>
  );
}
