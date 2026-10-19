import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useForm } from "@/common/hooks";
import { Alert, Badge, Button, Checkbox, DescriptionList, Drawer, Field, Switch, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import {
  createAcademicYear,
  offDaysLabel,
  updateAcademicYear,
  useAcademicYearMutation,
  WEEKDAYS,
  type AcademicYearInput,
  type AcademicYearRecord
} from "../api/academicYears";

type Values = { yearName: string; startDate: string; endDate: string; weeklyOffDays: number[]; description: string; isCurrent: boolean };

const EMPTY: Values = { yearName: "", startDate: "", endDate: "", weeklyOffDays: [0], description: "", isCurrent: false };

const toValues = (y: AcademicYearRecord): Values => ({
  yearName: y.yearName,
  startDate: y.startDate,
  endDate: y.endDate,
  weeklyOffDays: [...y.weeklyOffDays].sort(),
  description: y.description ?? "",
  isCurrent: y.isCurrent
});

/* The fields that changed (PATCH); the API refuses null for description, so "" clears it */
function patchOf(before: Values, now: Values): Partial<AcademicYearInput> {
  const out: Partial<AcademicYearInput> = {};
  if (now.yearName.trim() !== before.yearName) out.yearName = now.yearName.trim();
  if (now.startDate !== before.startDate) out.startDate = now.startDate;
  if (now.endDate !== before.endDate) out.endDate = now.endDate;
  if (now.weeklyOffDays.join() !== before.weeklyOffDays.join()) out.weeklyOffDays = now.weeklyOffDays;
  if (now.description.trim() !== before.description) out.description = now.description.trim();
  return out;
}

/* Create (year = null) or view/edit one year. Archived years and readers without update see it read-only. */
export function AcademicYearDrawer({
  open,
  year,
  canEdit,
  onClose
}: {
  open: boolean;
  year: AcademicYearRecord | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const form = useForm<Values>(EMPTY);
  const create = useAcademicYearMutation(createAcademicYear, { everything: v => !!v.isCurrent });
  const update = useAcademicYearMutation(updateAcademicYear);
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(year ? toValues(year) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, year?.id]);

  const editable = canEdit && !year?.archivedAt;
  const changes = year ? patchOf(toValues(year), values) : null;

  const toggleDay = (d: number) =>
    form.set("weeklyOffDays", values.weeklyOffDays.includes(d) ? values.weeklyOffDays.filter(x => x !== d) : [...values.weeklyOffDays, d].sort());

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.yearName.trim()) e.yearName = "Enter a name, e.g. 2026-27";
    if (!values.startDate) e.startDate = "Pick the first day";
    if (!values.endDate) e.endDate = "Pick the last day";
    else if (values.startDate && values.endDate <= values.startDate) e.endDate = "Must be after the start date";
    if (values.weeklyOffDays.length > 6) e.weeklyOffDays = "At least one day must be a school day";
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409 && /yearName/.test(err.message)) {
      form.setErrors({ yearName: "A year with this name already exists" });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (!year) {
      const body: AcademicYearInput = {
        yearName: values.yearName.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
        weeklyOffDays: values.weeklyOffDays,
        isCurrent: values.isCurrent
      };
      if (values.description.trim()) body.description = values.description.trim();
      create.mutate(body, { onSuccess: done, onError });
    } else if (changes && Object.keys(changes).length) update.mutate({ id: year.id, ...changes }, { onSuccess: done, onError });
  };

  const busy = create.isPending || update.isPending;
  const title = year ? year.yearName : "New academic year";
  const badges = year && (
    <span className="row">
      {year.isCurrent && <Badge tone="success">Current</Badge>}
      {year.archivedAt && <Badge>Archived</Badge>}
    </span>
  );

  if (year && !editable)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={badges}>
        <div className="stack">
          {year.archivedAt && <Alert tone="info">Archived {formatDateTime(year.archivedAt)}. Its academic records are read-only.</Alert>}
          <DescriptionList
            columns={1}
            items={[
              { label: "Dates", value: `${formatDate(year.startDate)} – ${formatDate(year.endDate)}` },
              { label: "Weekly off days", value: offDaysLabel(year.weeklyOffDays) },
              { label: "Description", value: year.description },
              { label: "Stopped being current", value: formatDateTime(year.currentUntil), hidden: !year.currentUntil }
            ]}
          />
        </div>
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={badges}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="academic-year-form" variant="primary" loading={busy} disabled={!!changes && !Object.keys(changes).length}>
            {year ? "Save changes" : "Create year"}
          </Button>
        </>
      }
    >
      <form id="academic-year-form" className="stack" onSubmit={submit} noValidate>
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <TextInput label="Name" required maxLength={20} placeholder="2026-27" autoFocus={!year} {...form.text("yearName")} />
        <div className="form-grid">
          <TextInput label="Starts" type="date" required {...form.text("startDate")} />
          <TextInput label="Ends" type="date" required min={values.startDate || undefined} {...form.text("endDate")} />
        </div>
        <Field label="Weekly off days" hint="Days with no school every week" error={errors.weeklyOffDays}>
          <div className="row" role="group" aria-label="Weekly off days" style={{ gap: 14 }}>
            {WEEKDAYS.map((d, i) => (
              <Checkbox key={d} label={d} checked={values.weeklyOffDays.includes(i)} onChange={() => toggleDay(i)} />
            ))}
          </div>
        </Field>
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
        {!year && (
          <Field hint="The current year is the default everywhere. The previous current year stops being current.">
            <Switch label="Make this the current year" checked={values.isCurrent} onChange={v => form.set("isCurrent", v)} />
          </Field>
        )}
      </form>
    </Drawer>
  );
}
