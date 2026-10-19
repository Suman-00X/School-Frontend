import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, RadioGroup, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { DIRECTION_OPTIONS, type Direction } from "../../shared/utils/format";
import { assignSeat, type AssignInput, type SeatAssignment } from "../api/assignments";
import { RouteStopFields } from "./RouteStopFields";

type Values = { studentId: string; routeId: string; stopId: string; direction: Direction; startDate: string; notes: string };

/* The server's refusals, placed on the field they are about */
export function seatErrorField(err: unknown): string | null {
  if (!isApiError(err)) return null;
  const m = err.message;
  if (/is full|has no vehicle|routeId/i.test(m)) return "routeId";
  if (/stop/i.test(m)) return "stopId";
  if (/not enrolled|already uses|studentId/i.test(m)) return "studentId";
  if (/startDate|effectiveDate/i.test(m)) return /effectiveDate/.test(m) ? "effectiveDate" : "startDate";
  if (/endDate/i.test(m)) return "endDate";
  return null;
}

/* TR-03 "Assign" drawer: student, route (seats free), stop (times, fee), direction, start date */
export function AssignDrawer({
  open,
  routeId,
  studentId,
  onClose,
  onDone
}: {
  open: boolean;
  routeId?: string;
  studentId?: string;
  onClose: () => void;
  onDone?: (a: SeatAssignment) => void;
}) {
  const toast = useToast();
  const { selected: year } = useAcademicYear();
  const today = todayIso();
  const form = useForm<Values>({ studentId: "", routeId: "", stopId: "", direction: "BOTH", startDate: "", notes: "" });
  const assign = useApiMutation(assignSeat, { invalidate: ["/transport"] });
  const { values, errors } = form;

  /* Today, moved inside the year (what the server uses when no date is sent) */
  const defaultStart = year ? (today < year.startDate ? year.startDate : today > year.endDate ? year.endDate : today) : today;

  useEffect(() => {
    if (open) form.reset({ studentId: studentId ?? "", routeId: routeId ?? "", stopId: "", direction: "BOTH", startDate: defaultStart, notes: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routeId, studentId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.studentId) e.studentId = "Pick the student";
    if (!values.routeId) e.routeId = "Pick a route";
    if (!values.stopId) e.stopId = "Pick a stop";
    if (!values.startDate) e.startDate = "Pick the first day";
    else if (year && (values.startDate < year.startDate || values.startDate > year.endDate))
      e.startDate = `Must fall within ${year.yearName} (${formatDate(year.startDate)} – ${formatDate(year.endDate)})`;
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const body: AssignInput = { studentId: values.studentId, routeId: values.routeId, stopId: values.stopId, direction: values.direction, startDate: values.startDate };
    if (values.notes.trim()) body.notes = values.notes.trim();
    assign.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
        onDone?.(res.data);
      },
      onError: err => {
        const field = seatErrorField(err);
        if (field) {
          form.setErrors({ [field]: (err as Error).message });
          form.setFormError(null);
        } else form.setServerErrors(err);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Assign a seat"
      subtitle={year ? `For ${year.yearName}. The student must be enrolled in that year.` : undefined}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assign-seat-form" variant="primary" loading={assign.isPending}>
            Assign seat
          </Button>
        </>
      }
    >
      <form id="assign-seat-form" className="stack" onSubmit={submit} noValidate>
        <StudentSelect required value={values.studentId} onChange={e => form.set("studentId", e.target.value)} error={errors.studentId} />
        <RouteStopFields
          routeId={values.routeId}
          stopId={values.stopId}
          onRoute={id => {
            form.set("routeId", id);
            form.set("stopId", "");
          }}
          onStop={id => form.set("stopId", id)}
          errors={errors}
        />
        <Field label="Direction" error={errors.direction} hint="Every rider takes a full seat, whichever way they travel">
          <RadioGroup aria-label="Direction" options={DIRECTION_OPTIONS} value={values.direction} onChange={v => form.set("direction", v)} />
        </Field>
        <TextInput
          label="First day"
          type="date"
          required
          min={year?.startDate}
          max={year?.endDate}
          hint={year ? `Within ${year.yearName}` : undefined}
          {...form.text("startDate")}
        />
        <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
      </form>
    </Drawer>
  );
}
