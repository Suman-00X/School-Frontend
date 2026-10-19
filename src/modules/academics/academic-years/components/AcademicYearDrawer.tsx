import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useForm } from "@/common/hooks";
import { Badge, Button, Checkbox, DescriptionList, Drawer, Field, Switch, TextInput, Textarea, useToast } from "@/common/ui";
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
import { isDate, latestEndFor, MAX_YEAR_MONTHS, yearDatesProblem, yearNameFor } from "../utils/yearName";
import "./academicYears.css";

type Values = { startDate: string; endDate: string; weeklyOffDays: number[]; description: string; isCurrent: boolean };

const EMPTY: Values = { startDate: "", endDate: "", weeklyOffDays: [0], description: "", isCurrent: false };

const toValues = (y: AcademicYearRecord): Values => ({
  startDate: y.startDate,
  endDate: y.endDate,
  weeklyOffDays: [...y.weeklyOffDays].sort(),
  description: y.description ?? "",
  isCurrent: y.isCurrent
});

/* The fields that changed (PATCH); the API refuses null for description, so "" clears it.
   The name is never sent: new dates rename the year. */
function patchOf(before: Values, now: Values): Partial<AcademicYearInput> {
  const out: Partial<AcademicYearInput> = {};
  if (now.startDate !== before.startDate) out.startDate = now.startDate;
  if (now.endDate !== before.endDate) out.endDate = now.endDate;
  if (now.weeklyOffDays.join() !== before.weeklyOffDays.join()) out.weeklyOffDays = now.weeklyOffDays;
  if (now.description.trim() !== before.description) out.description = now.description.trim();
  return out;
}

/* The server's date-range refusals (overlap, too long, too many calendar years, same name):
   they belong to the dates, not to one of them */
const isDatesError = (err: unknown) =>
  isApiError(err) &&
  ((err.status === 409 && /overlap|already exists|archived/i.test(err.message)) ||
    (err.status === 422 && /academic year|yearName/i.test(err.message)));

const RULES = `A year lasts at most ${MAX_YEAR_MONTHS} months, spans at most two calendar years and may not overlap another year.`;

/* AC-01 drawer. Create (year = null) or view/edit one year. No name field: the name comes from the
   dates and is previewed live. Archived years and readers without update see it read-only. */
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
  const { years } = useAcademicYear();
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

  const { startDate, endDate } = values;
  const ordered = isDate(startDate) && isDate(endDate) && endDate > startDate;
  /* Unchanged dates keep the stored name (a year named before names were derived keeps its own)
     and aren't re-checked: the server only checks dates that are sent */
  const datesChanged = !year || startDate !== year.startDate || endDate !== year.endDate;
  const derived = !datesChanged && year ? year.yearName : ordered ? yearNameFor(startDate, endDate) : null;
  const rangeProblem = datesChanged ? yearDatesProblem(startDate, endDate, years, year?.id) : null;
  /* One reserved line pair under the dates: the server's refusal, else a broken rule, else the rules */
  const datesError = errors.dates ?? rangeProblem;
  const datesHint = isDate(startDate)
    ? `Ends by ${formatDate(latestEndFor(startDate))} at the latest. ${RULES}`
    : RULES;

  const setDate = (key: "startDate" | "endDate", value: string) => {
    form.set(key, value);
    form.setErrors(e => {
      if (!e.dates) return e;
      const next = { ...e };
      delete next.dates;
      return next;
    });
  };

  const toggleDay = (d: number) =>
    form.set("weeklyOffDays", values.weeklyOffDays.includes(d) ? values.weeklyOffDays.filter(x => x !== d) : [...values.weeklyOffDays, d].sort());

  const validate = () => {
    const e: Record<string, string> = {};
    if (!startDate) e.startDate = "Pick the first day";
    if (!endDate) e.endDate = "Pick the last day";
    else if (startDate && endDate <= startDate) e.endDate = "Must be after the start date";
    if (values.weeklyOffDays.length > 6) e.weeklyOffDays = "At least one day must be a school day";
    form.setErrors(e);
    return Object.keys(e).length === 0 && !rangeProblem;
  };

  const onError = (err: unknown) => {
    if (isDatesError(err)) {
      form.setErrors({ dates: (err as Error).message });
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
      const body: AcademicYearInput = { startDate, endDate, weeklyOffDays: values.weeklyOffDays, isCurrent: values.isCurrent };
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
        <DescriptionList
          columns={1}
          items={[
            { label: "Dates", value: `${formatDate(year.startDate)} – ${formatDate(year.endDate)}` },
            { label: "Weekly off days", value: offDaysLabel(year.weeklyOffDays) },
            { label: "Description", value: year.description },
            { label: "Stopped being current", value: formatDateTime(year.currentUntil), hidden: !year.currentUntil },
            {
              label: "Archived",
              value: `${formatDateTime(year.archivedAt)}. Its dates and academic records are read-only${canEdit ? "; unarchive it to change them" : ""}.`,
              hidden: !year.archivedAt
            }
          ]}
        />
      </Drawer>
    );

  /* An edit renames the year when its dates give another name */
  const renameNote = year && derived && derived !== year.yearName ? ` · renamed from ${year.yearName} when saved` : "";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={badges}
      footerStatus={form.formError}
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
        <div className="form-grid">
          <TextInput
            label="Starts"
            type="date"
            required
            autoFocus={!year}
            className={datesError ? "invalid" : undefined}
            {...form.text("startDate")}
            onChange={e => setDate("startDate", e.target.value)}
          />
          <TextInput
            label="Ends"
            type="date"
            required
            min={startDate || undefined}
            max={isDate(startDate) ? latestEndFor(startDate) : undefined}
            className={datesError ? "invalid" : undefined}
            {...form.text("endDate")}
            onChange={e => setDate("endDate", e.target.value)}
          />
        </div>
        {/* Fixed height: the name line and two reserved lines for the rules or the refusal */}
        <div className="year-dates-summary">
          <div className="year-name-preview" title={derived ? `Name: ${derived}${renameNote}` : undefined}>
            <span className="muted">Name</span>
            {derived ? (
              <strong>{derived}</strong>
            ) : (
              <span className="muted">comes from the dates, e.g. 2026-27</span>
            )}
            {renameNote && <span className="muted">{renameNote}</span>}
          </div>
          <div
            className={`year-rules${datesError ? " field-error" : ""}`}
            role={datesError ? "alert" : undefined}
            title={datesError ?? datesHint}
          >
            {datesError ?? datesHint}
          </div>
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
