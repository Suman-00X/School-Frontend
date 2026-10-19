import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage, isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { StudentSelect } from "@/modules/users";
import { SectionSelect } from "../../shared/components/SectionSelect";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { ADMISSION_TYPES, enroll, ENROLLMENTS_PATH, promote, studentLabel, useYearSections, type AdmissionType, type Enrollment } from "../api/enrollments";

/* Years a student can be promoted into: any other year that isn't archived, later ones first */
export function useTargetYears() {
  const { years, selected } = useAcademicYear();
  const options = years
    .filter(y => y.id !== selected?.id && !y.archivedAt)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map(y => ({ value: y.id, label: y.yearName, description: y.isCurrent ? "Current year" : y.startDate > (selected?.startDate ?? "") ? "Next" : "Earlier" }));
  /* The year right after the selected one, if there is one */
  const next = years.filter(y => !y.archivedAt && y.startDate > (selected?.endDate ?? "")).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return { options, defaultId: next?.id ?? "" };
}

/* Enroll an existing student (one with no enrollment this year) in a section */
export function EnrollDialog({ sectionId: initialSection, onClose }: { sectionId: string; onClose: () => void }) {
  const toast = useToast();
  const { selected: year } = useAcademicYear();
  const [studentId, setStudentId] = useState("");
  const [sectionId, setSectionId] = useState(initialSection);
  const [rollNumber, setRollNumber] = useState("");
  const [admissionType, setAdmissionType] = useState<AdmissionType>("NEW");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const add = useApiMutation(enroll, { invalidate: [ENROLLMENTS_PATH] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!studentId) errs.studentId = "Pick a student";
    if (!sectionId) errs.sectionId = "Pick a section";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    add.mutate(
      {
        studentId,
        sectionId,
        admissionType,
        ...(rollNumber.trim() ? { rollNumber: rollNumber.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {})
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          if (isApiError(err) && err.status === 409 && /roll ?number/i.test(err.message)) setErrors({ rollNumber: "This roll number is already taken in the section" });
          else if (isApiError(err) && err.status === 409) setErrors({ studentId: err.message });
          else if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
          setFormError(errorMessage(err));
        }
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Enroll a student in ${year?.yearName ?? "this year"}`}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="enroll-form" variant="primary" loading={add.isPending}>
            Enroll
          </Button>
        </>
      }
    >
      <form id="enroll-form" className="stack" onSubmit={submit} noValidate>
        <StudentSelect
          value={studentId}
          required
          error={errors.studentId}
          hint={
            <>
              An existing student. New ones are admitted from <Link to="/users/students/new">Admit a student</Link>.
            </>
          }
          onChange={e => setStudentId(e.target.value)}
        />
        <SectionSelect value={sectionId} required error={errors.sectionId} onChange={e => setSectionId(e.target.value)} />
        <TextInput
          label="Roll number"
          maxLength={20}
          className="mono"
          placeholder="Next in the section"
          hint="Empty: the next number at the end of the section"
          value={rollNumber}
          error={errors.rollNumber}
          onChange={e => setRollNumber(e.target.value)}
        />
        <Field label="Joins as">
          <RadioGroup aria-label="Admission type" options={ADMISSION_TYPES} value={admissionType} onChange={setAdmissionType} />
        </Field>
        <Textarea label="Note" rows={2} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} />
      </form>
    </Dialog>
  );
}

/* Promote one student into a section of another year; this year's enrollment closes */
export function PromoteDialog({ enrollment, onClose }: { enrollment: Enrollment; onClose: () => void }) {
  const toast = useToast();
  const { selected: year } = useAcademicYear();
  const targets = useTargetYears();
  const [toYear, setToYear] = useState(targets.defaultId);
  const [toSection, setToSection] = useState("");
  const [admissionType, setAdmissionType] = useState<AdmissionType>("PROMOTED");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const sections = useYearSections(toYear);
  const run = useApiMutation(promote, { invalidate: [ENROLLMENTS_PATH] });
  const name = studentLabel(enrollment);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!toYear) errs.toAcademicYearId = "Pick the year";
    if (!toSection) errs.toSectionId = "Pick the section";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length || !year) return;
    run.mutate(
      { studentId: enrollment.studentId, fromAcademicYearId: year.id, toAcademicYearId: toYear, toSectionId: toSection, admissionType },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
          setFormError(errorMessage(err));
        }
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Promote ${name}`}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="promote-form" variant="primary" loading={run.isPending} disabled={!targets.options.length}>
            Promote
          </Button>
        </>
      }
    >
      <form id="promote-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted" style={{ margin: 0 }}>
          {name} gets a place in the section you pick; their {year?.yearName ?? "current"} enrollment is closed (marked left).
        </p>
        <Select
          label="Into year"
          required
          options={targets.options}
          value={toYear}
          placeholder={targets.options.length ? "Pick the year" : "No other year yet"}
          hint={
            targets.options.length ? undefined : (
              <>
                Create next year on <Link to={SETUP_PATHS.academicYears}>Academic years</Link> first.
              </>
            )
          }
          error={errors.toAcademicYearId}
          onChange={e => {
            setToYear(e.target.value);
            setToSection("");
          }}
        />
        <Select
          label="Into section"
          required
          searchable
          options={sections.options}
          value={toSection}
          disabled={!toYear}
          placeholder={!toYear ? "Pick the year first" : sections.isLoading ? "Loading sections…" : sections.options.length ? "Pick the section" : "That year has no sections yet"}
          error={errors.toSectionId}
          onChange={e => setToSection(e.target.value)}
        />
        <Field label="Joins as">
          <RadioGroup aria-label="Admission type" options={ADMISSION_TYPES} value={admissionType} onChange={setAdmissionType} />
        </Field>
      </form>
    </Dialog>
  );
}
