import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Button, Card, DataTable, Dialog, EmptyState, Select, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { useSubjectOptions } from "../../subjects/api/subjects";
import { addSectionSubject, removeSectionSubject, SECTION_SUBJECTS_PATH, useSectionSubjects, type SectionSubject } from "../api/sectionSubjects";

/* AC-03, "By section": the subjects one section of the header's year is taught, with add and remove */
export function SectionSubjectsPanel({ sectionId }: { sectionId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year, readOnly } = useAcademicYear();
  const { byId } = useSectionOptions();
  const section = byId.get(sectionId);
  const label = section ? sectionTitle(section) : "this section";
  const list = useSectionSubjects(sectionId);
  const [adding, setAdding] = useState(false);
  const remove = useApiMutation(removeSectionSubject, { invalidate: [SECTION_SUBJECTS_PATH, "/academics/teacher-assignments"] });

  const canAdd = can("academics.sectionSubjects.create") && !readOnly;
  const canRemove = can("academics.sectionSubjects.remove") && !readOnly;

  const askRemove = async (row: SectionSubject) => {
    const ok = await confirm({
      title: `Remove ${row.subject.subjectName} from ${label}?`,
      message: `${label} stops having ${row.subject.subjectName} in ${year?.yearName ?? "this year"}. Its timetable lessons and teacher assignment for it may need changing too.`,
      confirmLabel: "Remove subject"
    });
    if (ok) remove.mutate(row.id, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };

  const total = (list.rows ?? []).reduce((n, r) => n + (r.weeklyNoOfClasses ?? 0), 0);

  return (
    <Card
      flush
      title={label}
      subtitle={list.rows ? `${list.rows.length} subject${list.rows.length === 1 ? "" : "s"} · ${total} classes a week` : `Subjects in ${year?.yearName ?? "the year"}`}
      actions={
        <>
          <Link to={`${SETUP_PATHS.teacherAssignments}?section=${sectionId}`} className="btn btn-sm btn-ghost">
            Teachers
          </Link>
          {canAdd && (
            <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
              Add subject
            </Button>
          )}
        </>
      }
    >
      <DataTable
        rows={list.rows}
        rowKey={r => r.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            icon={<BookOpen />}
            title={`No subjects in ${label} yet`}
            message="Add the subjects this section is taught; teachers and the timetable come after."
            actions={
              canAdd && (
                <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
                  Add subject
                </Button>
              )
            }
          />
        }
        columns={[
          { key: "code", header: "Code", width: 110, render: r => <span className="mono">{r.subject.subjectCode}</span> },
          { key: "name", header: "Subject", render: r => <strong style={{ fontWeight: 550 }}>{r.subject.subjectName}</strong> },
          { key: "displayCode", header: "Section code", render: r => <span className="mono muted">{r.displayCode}</span> },
          { key: "weekly", header: "A week", align: "right", width: 90, render: r => r.weeklyNoOfClasses ?? <span className="muted">—</span> },
          { key: "description", header: "Note", render: r => <span className="muted">{r.description || "—"}</span> },
          ...(canRemove
            ? [
                {
                  key: "actions",
                  header: "",
                  align: "right" as const,
                  width: 56,
                  render: (r: SectionSubject) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      aria-label={`Remove ${r.subject.subjectName}`}
                      title="Remove from the section"
                      onClick={() => void askRemove(r)}
                    />
                  )
                }
              ]
            : [])
        ]}
      />
      {adding && <AddSectionSubjectDialog sectionId={sectionId} label={label} taken={(list.rows ?? []).map(r => r.subjectId)} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddSectionSubjectDialog({ sectionId, label, taken, onClose }: { sectionId: string; label: string; taken: string[]; onClose: () => void }) {
  const toast = useToast();
  const subjects = useSubjectOptions();
  const [subjectId, setSubjectId] = useState("");
  const [weekly, setWeekly] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const add = useApiMutation(addSectionSubject, { invalidate: [SECTION_SUBJECTS_PATH] });

  const options = subjects.options.filter(o => !taken.includes(o.value));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!subjectId) errs.subjectId = "Pick a subject";
    const n = weekly.trim() ? Number(weekly) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 50)) errs.weeklyNoOfClasses = "A whole number from 1 to 50";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    add.mutate(
      { sectionId, subjectId, ...(n !== null ? { weeklyNoOfClasses: n } : {}), ...(description.trim() ? { description: description.trim() } : {}) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
          if (isApiError(err) && err.status === 409) setErrors({ subjectId: err.message });
          else setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Add a subject to ${label}`}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="section-subject-form" variant="primary" loading={add.isPending}>
            Add subject
          </Button>
        </>
      }
    >
      <form id="section-subject-form" className="stack" onSubmit={submit} noValidate>
        <Select
          label="Subject"
          required
          searchable
          options={options}
          value={subjectId}
          placeholder={subjects.isLoading ? "Loading subjects…" : options.length ? "Pick a subject" : "Every subject is already added"}
          hint={
            <>
              Missing one? Create it on the <Link to={SETUP_PATHS.subjects}>Subjects</Link> tab first.
            </>
          }
          error={errors.subjectId}
          onChange={e => {
            setSubjectId(e.target.value);
            setErrors(({ subjectId: _drop, ...rest }) => rest);
          }}
        />
        <TextInput
          label="Classes a week"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          placeholder="5"
          hint="Optional; the timetable shows it as a target"
          value={weekly}
          error={errors.weeklyNoOfClasses}
          onChange={e => setWeekly(e.target.value)}
        />
        <Textarea label="Note" rows={2} maxLength={1000} value={description} error={errors.description} onChange={e => setDescription(e.target.value)} />
      </form>
    </Dialog>
  );
}
