import { useEffect, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, Select, Switch, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import {
  CLOSING_TYPES,
  createEvent,
  deleteEvent,
  EVENT_TYPES,
  EVENTS_PATH,
  eventTone,
  eventTypeLabel,
  updateEvent,
  WORKING_DAYS_PATH,
  type CalendarEvent,
  type CalendarEventInput,
  type EventType
} from "../api/calendar";

type Values = { title: string; eventType: EventType | ""; startDate: string; endDate: string; isHoliday: boolean; description: string };

const toValues = (e: CalendarEvent): Values => ({
  title: e.title,
  eventType: e.eventType,
  startDate: e.startDate,
  endDate: e.endDate,
  isHoliday: e.isHoliday,
  description: e.description ?? ""
});

export const eventDates = (e: Pick<CalendarEvent, "startDate" | "endDate">) =>
  e.endDate && e.endDate !== e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : formatDate(e.startDate);

/* AC-05 drawer: a new event (event = null, optionally on a clicked day) or one event to view,
   edit or delete. Read-only for those who can't change the calendar, or in an archived year. */
export function EventDrawer({
  open,
  event,
  date,
  canEdit,
  canDelete,
  onClose
}: {
  open: boolean;
  event: CalendarEvent | null;
  /* New event on this day */
  date?: string;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year } = useAcademicYear();
  const form = useForm<Values>({ title: "", eventType: "", startDate: "", endDate: "", isHoliday: false, description: "" });
  const invalidate = [EVENTS_PATH, WORKING_DAYS_PATH];
  const create = useApiMutation(createEvent, { invalidate });
  const update = useApiMutation(updateEvent, { invalidate });
  const remove = useApiMutation(deleteEvent, { invalidate });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(event ? toValues(event) : { title: "", eventType: "", startDate: date ?? "", endDate: date ?? "", isHoliday: false, description: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, date]);

  const askDelete = async () => {
    if (!event) return;
    const ok = await confirm({
      title: `Delete ${event.title}?`,
      message: `${event.title} (${eventDates(event)}) is removed from the calendar.${event.isHoliday ? " Those days become school days again." : ""}`,
      confirmLabel: "Delete event"
    });
    if (ok)
      remove.mutate(event.id, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => toast.error(err)
      });
  };

  if (event && !canEdit)
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title={event.title}
        subtitle={<Badge tone={eventTone(event.eventType)}>{eventTypeLabel(event.eventType)}</Badge>}
        footer={
          canDelete ? (
            <Button variant="danger" icon={<Trash2 />} loading={remove.isPending} onClick={() => void askDelete()}>
              Delete
            </Button>
          ) : undefined
        }
      >
        <DescriptionList
          columns={1}
          items={[
            { label: "Dates", value: eventDates(event) },
            { label: "School", value: event.isHoliday ? "Closed" : "Open as usual" },
            { label: "Description", value: event.description }
          ]}
        />
      </Drawer>
    );

  const closingType = !!values.eventType && CLOSING_TYPES.includes(values.eventType);
  const closed = closingType || values.isHoliday;

  const body = (): CalendarEventInput => ({
    title: values.title.trim(),
    eventType: values.eventType as EventType,
    startDate: values.startDate,
    endDate: values.endDate || values.startDate,
    isHoliday: closed,
    description: values.description.trim()
  });

  const changes: Partial<CalendarEventInput> = {};
  if (event) {
    const now = body();
    if (now.title !== event.title) changes.title = now.title;
    if (now.eventType !== event.eventType) changes.eventType = now.eventType;
    if (now.startDate !== event.startDate) changes.startDate = now.startDate;
    if (now.endDate !== event.endDate) changes.endDate = now.endDate;
    if (now.isHoliday !== event.isHoliday) changes.isHoliday = now.isHoliday;
    if ((now.description ?? "") !== (event.description ?? "")) changes.description = now.description;
  }
  const unchanged = !!event && Object.keys(changes).length === 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.title.trim()) e.title = "Give the event a name";
    if (!values.eventType) e.eventType = "Pick a type";
    if (!values.startDate) e.startDate = "Pick the first day";
    if (values.endDate && values.startDate && values.endDate < values.startDate) e.endDate = "Must be on or after the first day";
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  /* 422 "Event dates must fall within the academic year (…)" belongs to the dates */
  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 422 && /dates?/i.test(err.message)) {
      form.setErrors({ startDate: err.message });
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
    if (event) update.mutate({ id: event.id, ...changes }, { onSuccess: done, onError });
    else {
      const b = body();
      if (!b.description) delete b.description;
      create.mutate(b, { onSuccess: done, onError });
    }
  };

  const setType = (t: EventType) => {
    form.set("eventType", t);
    /* Holidays and vacations close the school; other types stay open unless switched */
    if (!event || t !== event.eventType) form.set("isHoliday", CLOSING_TYPES.includes(t));
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={event ? event.title : "New event"}
      subtitle={event ? <Badge tone={eventTone(event.eventType)}>{eventTypeLabel(event.eventType)}</Badge> : `In ${year?.yearName ?? "the year"} (${formatDate(year?.startDate)} – ${formatDate(year?.endDate)})`}
      footerStatus={form.formError}
      footer={
        <>
          {event && canDelete && (
            <Button variant="ghost" icon={<Trash2 />} loading={remove.isPending} onClick={() => void askDelete()}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="event-form" variant="primary" loading={create.isPending || update.isPending} disabled={unchanged}>
            {event ? "Save changes" : "Add to calendar"}
          </Button>
        </>
      }
    >
      <form id="event-form" className="stack" onSubmit={submit} noValidate>
        <TextInput label="Title" required autoFocus={!event} maxLength={150} placeholder="Diwali" {...form.text("title")} />
        <Select
          label="Type"
          required
          options={EVENT_TYPES.map(t => ({ value: t.value, label: t.label, description: t.description }))}
          value={values.eventType}
          placeholder="Pick a type"
          error={errors.eventType}
          onChange={e => setType(e.target.value as EventType)}
        />
        <div className="form-grid">
          <TextInput
            label="From"
            type="date"
            required
            min={year?.startDate}
            max={year?.endDate}
            {...form.text("startDate")}
            onChange={e => {
              const v = e.target.value;
              form.set("startDate", v);
              if (!values.endDate || values.endDate < v || values.endDate === values.startDate) form.set("endDate", v);
            }}
          />
          <TextInput label="To" type="date" min={values.startDate || year?.startDate} max={year?.endDate} hint="Same day for a one-day event" {...form.text("endDate")} />
        </div>
        {/* Same place for every type: a switch, or for holidays and vacations a fixed note */}
        <Field hint={closingType ? `${eventTypeLabel(values.eventType)}s always close the school` : "Closed days don't count as working days for attendance"}>
          <Switch label="School closed" checked={closed} disabled={closingType} onChange={v => form.set("isHoliday", v)} />
        </Field>
        <Textarea label="Description" rows={3} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
