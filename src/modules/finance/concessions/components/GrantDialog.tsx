import { useEffect, useMemo, useState } from "react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Select, Textarea, useToast, type Option } from "@/common/ui";
import { StudentSelect } from "@/modules/users";
import { GRANTS_PATH, grantConcession, useConcessionOptions } from "../api/concessions";

/* FI-05 "Grant": a student, a concession, the year (default: the one picked in the header) and why */
export function GrantDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { concessionId?: string; studentId?: string } }) {
  const toast = useToast();
  const { years, selected } = useAcademicYear();
  const concessions = useConcessionOptions(open);
  const [studentId, setStudentId] = useState("");
  const [concessionId, setConcessionId] = useState("");
  const [yearId, setYearId] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const grant = useApiMutation(grantConcession, { invalidate: [GRANTS_PATH, "/finance/invoices", "/finance/students"] });

  useEffect(() => {
    if (!open) return;
    setStudentId(preset?.studentId ?? "");
    setConcessionId(preset?.concessionId ?? "");
    setYearId(selected && !selected.archivedAt ? selected.id : (years.find(y => y.isCurrent)?.id ?? ""));
    setReason("");
    setErrors({});
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Archived years are read-only */
  const yearOptions = useMemo<Option[]>(
    () => years.filter(y => !y.archivedAt).map(y => ({ value: y.id, label: y.yearName, description: y.isCurrent ? "Current year" : undefined })),
    [years]
  );

  const submit = () => {
    const e: Record<string, string> = {};
    if (!studentId) e.studentId = "Pick a student";
    if (!concessionId) e.concessionId = "Pick a concession";
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    grant.mutate(
      { studentId, concessionId, academicYearId: yearId || undefined, reason: reason.trim() || undefined },
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
      open={open}
      onClose={onClose}
      title="Grant a concession"
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={grant.isPending}>
            Grant
          </Button>
        </>
      }
    >
      <div className="stack">
        <StudentSelect value={studentId} onChange={e => setStudentId(e.target.value)} required error={errors.studentId} />
        <Select
          label="Concession"
          required
          options={concessions.options}
          value={concessionId}
          onChange={e => setConcessionId(e.target.value)}
          placeholder={concessions.isLoading ? "Loading…" : "Pick a concession"}
          error={errors.concessionId}
        />
        <Select label="Year" required options={yearOptions} value={yearId} onChange={e => setYearId(e.target.value)} error={errors.academicYearId} hint="The student's invoices of this year are recalculated" />
        <Textarea label="Reason" rows={2} maxLength={500} placeholder="Elder sibling in Class 8" value={reason} onChange={e => setReason(e.target.value)} error={errors.reason} />
        <p className="small muted">Unpaid invoices of the year are recalculated at once. Invoices with any payment are never changed.</p>
      </div>
    </Dialog>
  );
}
