import { useState, type FormEvent } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, RadioGroup, StatusBadge, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { SectionSelect, sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { ADMISSION_TYPES, admissionLabel, ENROLLMENTS_PATH, studentLabel, updateEnrollment, type AdmissionType, type Enrollment, type EnrollmentChanges } from "../api/enrollments";

/* AC-12 roster row: view the enrollment, edit it (move section within the year, roll number,
   admission type, note), mark the student as left, or promote them. Mount it when opened. */
export function EnrollmentDrawer({ enrollment, onClose, onPromote }: { enrollment: Enrollment; onClose: () => void; onPromote: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year, readOnly } = useAcademicYear();
  const { byId } = useSectionOptions();
  const save = useApiMutation(updateEnrollment, { invalidate: [ENROLLMENTS_PATH] });
  const [sectionId, setSectionId] = useState(enrollment.sectionId);
  const [rollNumber, setRollNumber] = useState(enrollment.rollNumber ?? "");
  const [admissionType, setAdmissionType] = useState<AdmissionType>(enrollment.admissionType);
  const [description, setDescription] = useState(enrollment.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const name = studentLabel(enrollment);
  const active = enrollment.status === "ACTIVE";
  const canEdit = can("academics.enrollments.update") && !readOnly && active;
  const canPromote = can("academics.enrollments.promote") && active;
  const section = byId.get(enrollment.sectionId);
  const where = section ? sectionTitle(section) : `section ${enrollment.section.sectionName}`;

  const changes: EnrollmentChanges = {};
  if (sectionId !== enrollment.sectionId) changes.sectionId = sectionId;
  if (rollNumber.trim() !== (enrollment.rollNumber ?? "")) changes.rollNumber = rollNumber.trim();
  if (admissionType !== enrollment.admissionType) changes.admissionType = admissionType;
  if (description.trim() !== (enrollment.description ?? "")) changes.description = description.trim();
  const dirty = Object.keys(changes).length > 0;

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409 && /roll ?number/i.test(err.message)) setErrors({ rollNumber: "This roll number is already taken in the section" });
    else if (isApiError(err) && err.isValidation) {
      setErrors(err.fieldErrors());
      setFormError("Please correct the highlighted fields.");
    } else setFormError(errorMessage(err));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if ("rollNumber" in changes && !changes.rollNumber) {
      setErrors({ rollNumber: "A roll number can be changed, not removed" });
      return;
    }
    save.mutate(
      { id: enrollment.id, ...changes },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError
      }
    );
  };

  const markLeft = async () => {
    const ok = await confirm({
      title: `Mark ${name} as left?`,
      message: `${name} leaves ${where} for ${year?.yearName ?? "this year"}. Their transport seat and hostel bed end too. Their records stay.`,
      confirmLabel: "Mark as left"
    });
    if (ok)
      save.mutate(
        { id: enrollment.id, status: "LEFT" },
        {
          onSuccess: res => {
            toast.success(res.message);
            onClose();
          },
          onError: err => toast.error(err)
        }
      );
  };

  const badges = (
    <span className="row" style={{ gap: 6 }}>
      <StatusBadge status={enrollment.status} />
      <Badge>{admissionLabel(enrollment.admissionType)}</Badge>
      <span className="mono small muted">{enrollment.student.admissionNumber ?? enrollment.student.studentCode}</span>
    </span>
  );

  if (!canEdit)
    return (
      <Drawer
        open
        onClose={onClose}
        title={name}
        subtitle={badges}
        footer={
          canPromote && !readOnly ? (
            <Button variant="primary" icon={<ArrowUpRight />} onClick={onPromote}>
              Promote
            </Button>
          ) : undefined
        }
      >
        <DescriptionList
          columns={1}
          items={[
            { label: "Section", value: where },
            { label: "Roll number", value: enrollment.rollNumber && <span className="mono">{enrollment.rollNumber}</span> },
            { label: "Student code", value: <span className="mono">{enrollment.student.studentCode}</span> },
            { label: "Admission number", value: enrollment.student.admissionNumber },
            { label: "Joined as", value: admissionLabel(enrollment.admissionType) },
            { label: "Note", value: enrollment.description }
          ]}
        />
      </Drawer>
    );

  return (
    <Drawer
      open
      onClose={onClose}
      title={name}
      subtitle={badges}
      footerStatus={formError}
      footer={
        <>
          <Button variant="ghost" icon={<LogOut />} onClick={() => void markLeft()} disabled={save.isPending}>
            Mark as left
          </Button>
          {canPromote && (
            <Button icon={<ArrowUpRight />} onClick={onPromote}>
              Promote
            </Button>
          )}
          <Button type="submit" form="enrollment-form" variant="primary" loading={save.isPending} disabled={!dirty}>
            Save
          </Button>
        </>
      }
    >
      <form id="enrollment-form" className="stack" onSubmit={submit} noValidate>
        <SectionSelect
          label="Section"
          value={sectionId}
          required
          hint={`Move within ${year?.yearName ?? "the year"}; to change year, promote`}
          error={errors.sectionId}
          onChange={e => setSectionId(e.target.value)}
        />
        <TextInput
          label="Roll number"
          maxLength={20}
          className="mono"
          value={rollNumber}
          hint="Renumbering the section by the school's rule replaces it"
          error={errors.rollNumber}
          onChange={e => {
            setRollNumber(e.target.value);
            setErrors(({ rollNumber: _drop, ...rest }) => rest);
          }}
        />
        <Field label="Joined as" error={errors.admissionType}>
          <RadioGroup aria-label="Admission type" options={ADMISSION_TYPES} value={admissionType} onChange={setAdmissionType} />
        </Field>
        <Textarea label="Note" rows={2} maxLength={1000} value={description} error={errors.description} onChange={e => setDescription(e.target.value)} />
      </form>
    </Drawer>
  );
}
