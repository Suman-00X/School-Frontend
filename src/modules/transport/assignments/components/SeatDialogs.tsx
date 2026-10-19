import { useEffect, type FormEvent } from "react";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Dialog, Field, RadioGroup, TextInput, useToast } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { DIRECTION_OPTIONS, routeLabel, type Direction } from "../../shared/utils/format";
import { changeSeat, endSeat, riderName, type ChangeInput, type SeatAssignment } from "../api/assignments";
import { seatErrorField } from "./AssignDrawer";
import { RouteStopFields } from "./RouteStopFields";

/* The first day a change or end may take: today, but not before the seat started */
const notBefore = (a: SeatAssignment) => (todayIso() < a.startDate ? a.startDate : todayIso());

type ChangeValues = { routeId: string; stopId: string; direction: Direction; effectiveDate: string };

/* TR-03 "Change": a new route or stop from a date. The current seat ends the day before;
   the new one is linked to it. */
export function ChangeSeatDialog({ assignment, onClose, onDone }: { assignment: SeatAssignment | null; onClose: () => void; onDone?: (a: SeatAssignment) => void }) {
  const toast = useToast();
  const form = useForm<ChangeValues>({ routeId: "", stopId: "", direction: "BOTH", effectiveDate: "" });
  const change = useApiMutation(changeSeat, { invalidate: ["/transport"] });
  const a = assignment;
  const { values, errors } = form;

  useEffect(() => {
    if (a) form.reset({ routeId: a.routeId, stopId: a.stopId, direction: a.direction, effectiveDate: notBefore(a) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const same = !!a && values.routeId === a.routeId && values.stopId === a.stopId && values.direction === a.direction;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a) return;
    form.setFormError(null);
    const errs: Record<string, string> = {};
    if (!values.routeId) errs.routeId = "Pick a route";
    if (!values.stopId) errs.stopId = "Pick a stop";
    if (!values.effectiveDate) errs.effectiveDate = "Pick the first day on the new stop";
    else if (values.effectiveDate < a.startDate) errs.effectiveDate = `On or after ${formatDate(a.startDate)}, when this seat started`;
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: ChangeInput & { id: string } = { id: a.id, routeId: values.routeId, stopId: values.stopId, effectiveDate: values.effectiveDate };
    if (values.direction !== a.direction) body.direction = values.direction;
    change.mutate(body, {
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
    <Dialog
      open={!!a}
      onClose={onClose}
      title={a ? `Change ${riderName(a)}'s seat` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="change-seat-form" variant="primary" loading={change.isPending} disabled={same}>
            Change seat
          </Button>
        </>
      }
    >
      {a && (
        <form id="change-seat-form" className="stack" onSubmit={submit} noValidate>
          <p className="muted small">
            Now on {routeLabel(a.route)}, {a.stop.name}. The current seat ends the day before the new one starts.
          </p>
          <RouteStopFields
            routeId={values.routeId}
            stopId={values.stopId}
            onRoute={id => {
              form.set("routeId", id);
              form.set("stopId", "");
            }}
            onStop={id => form.set("stopId", id)}
            errors={errors}
            keepRouteId={a.routeId}
          />
          <Field label="Direction">
            <RadioGroup aria-label="Direction" options={DIRECTION_OPTIONS} value={values.direction} onChange={v => form.set("direction", v)} />
          </Field>
          <TextInput label="First day on the new stop" type="date" required min={a.startDate} {...form.text("effectiveDate")} />
        </form>
      )}
    </Dialog>
  );
}

/* TR-03 "End": the last day the student uses transport. The seat is freed at once. */
export function EndSeatDialog({ assignment, onClose }: { assignment: SeatAssignment | null; onClose: () => void }) {
  const toast = useToast();
  const form = useForm({ endDate: "" });
  const end = useApiMutation(endSeat, { invalidate: ["/transport"] });
  const a = assignment;

  useEffect(() => {
    if (a) form.reset({ endDate: notBefore(a) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a) return;
    form.setFormError(null);
    if (!form.values.endDate) return form.setErrors({ endDate: "Pick the last day" });
    if (form.values.endDate < a.startDate) return form.setErrors({ endDate: `On or after ${formatDate(a.startDate)}, when this seat started` });
    end.mutate(
      { id: a.id, endDate: form.values.endDate },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          if (seatErrorField(err) === "endDate") {
            form.setErrors({ endDate: (err as Error).message });
            form.setFormError(null);
          } else form.setServerErrors(err);
        }
      }
    );
  };

  return (
    <Dialog
      open={!!a}
      onClose={onClose}
      title={a ? `End ${riderName(a)}'s seat?` : ""}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="end-seat-form" variant="danger" loading={end.isPending}>
            End seat
          </Button>
        </>
      }
    >
      {a && (
        <form id="end-seat-form" className="stack" onSubmit={submit} noValidate>
          <p>
            {riderName(a)} stops using {routeLabel(a.route)} ({a.stop.name}). The seat is freed for someone else straight away, even if the last day is later.
          </p>
          <TextInput label="Last day of use" type="date" required min={a.startDate} {...form.text("endDate")} />
        </form>
      )}
    </Dialog>
  );
}
