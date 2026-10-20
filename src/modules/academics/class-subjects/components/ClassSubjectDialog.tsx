import { useState, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Field, RadioGroup, TextInput, Textarea, useToast } from "@/common/ui";
import { SECTION_SUBJECTS_PATH } from "../../section-subjects/api/sectionSubjects";
import { TEACHER_ASSIGNMENTS_PATH } from "../../teacher-assignments/api/teacherAssignments";
import { CLASS_SUBJECTS_PATH, updateClassSubject, type ClassSubject } from "../api/classSubjects";

type Kind = "required" | "optional";

/* AC-03: a subject's settings for the whole class. Required goes to every section (a section may
   drop it), optional only to the sections given it; classes a week and the note follow to the sections. */
export function ClassSubjectDialog({ row, className, onClose }: { row: ClassSubject; className: string; onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>(row.isOptional ? "optional" : "required");
  const [weekly, setWeekly] = useState(row.weeklyNoOfClasses ? String(row.weeklyNoOfClasses) : "");
  const [description, setDescription] = useState(row.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const update = useApiMutation(updateClassSubject, { invalidate: [CLASS_SUBJECTS_PATH, SECTION_SUBJECTS_PATH, TEACHER_ASSIGNMENTS_PATH] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const n = weekly.trim() ? Number(weekly) : undefined;
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 50)) {
      setErrors({ weeklyNoOfClasses: "A whole number from 1 to 50" });
      return;
    }
    setErrors({});
    update.mutate(
      { id: row.id, isOptional: kind === "optional", ...(n !== undefined ? { weeklyNoOfClasses: n } : {}), description: description.trim() },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
          setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${row.subject.subjectName} in ${className}`}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="class-subject-form" variant="primary" loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="class-subject-form" className="stack" onSubmit={submit} noValidate>
        <Field label="Sections">
          <RadioGroup<Kind>
            aria-label="Required or optional"
            value={kind}
            onChange={setKind}
            options={[
              {
                value: "required",
                label: "Required",
                description: row.isOptional ? "The sections without it get it now" : "Every section gets it, also ones added later; one can be taken off"
              },
              { value: "optional", label: "Optional", description: "Sections keep it; give it to others or take it off section by section" }
            ]}
          />
        </Field>
        {kind !== (row.isOptional ? "optional" : "required") && (
          <p className="small muted" style={{ margin: 0 }}>
            Its code becomes <span className="mono">{row.code.slice(0, -1) + (kind === "optional" ? "0" : "1")}</span> (now{" "}
            <span className="mono">{row.code}</span>). Not possible once an exam paper or assessment uses the code.
          </p>
        )}
        <TextInput
          label="Classes a week"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          placeholder="5"
          hint="Changes it in every section too"
          value={weekly}
          error={errors.weeklyNoOfClasses}
          onChange={e => setWeekly(e.target.value)}
        />
        <Textarea label="Note" rows={2} maxLength={1000} value={description} error={errors.description} onChange={e => setDescription(e.target.value)} />
      </form>
    </Dialog>
  );
}
