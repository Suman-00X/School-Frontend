import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, MultiSelect, Select, SkeletonBlock, Switch, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { byClassOrder, CLASSES_PATH, type SchoolClass } from "../../classes/api/classes";
import { EXAMS_PATH, examPath, shortTime, useAllExams, useExamPapers } from "../../exams/api/exams";
import { useSectionOptions } from "../../shared/components/SectionSelect";
import {
  categoryLabel,
  closedReason,
  CLOSING_TYPES,
  createEvent,
  deleteEvent,
  EVENT_CATEGORIES,
  EVENT_TYPES,
  EVENTS_PATH,
  eventTone,
  eventTypeLabel,
  MAX_HOLIDAY_DAYS,
  OPEN_TYPES,
  STAFF_MEETINGS,
  updateEvent,
  useEventsBetween,
  useWorkingDays,
  WORKING_DAYS_PATH,
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarEventPatch,
  type EventCategory,
  type EventType
} from "../api/calendar";
import { ExamTimetableEditor, ExamTimetableView, groupPapers, timetableBody, validateTimetable, type Slot } from "./ExamTimetableEditor";

type Values = {
  eventType: EventType | "";
  category: EventCategory | "";
  examId: string;
  title: string;
  startDate: string;
  endDate: string;
  isHoliday: boolean;
  startTime: string;
  endTime: string;
  venue: string;
  classIds: string[];
  description: string;
};

const blank = (date = ""): Values => ({
  eventType: "",
  category: "",
  examId: "",
  title: "",
  startDate: date,
  endDate: date,
  isHoliday: false,
  startTime: "",
  endTime: "",
  venue: "",
  classIds: [],
  description: ""
});

const toValues = (e: CalendarEvent): Values => ({
  eventType: e.eventType,
  category: e.category ?? "",
  examId: e.examId ?? "",
  title: e.title,
  startDate: e.startDate,
  endDate: e.endDate,
  isHoliday: e.isHoliday,
  startTime: shortTime(e.startTime),
  endTime: shortTime(e.endTime),
  venue: e.venue ?? "",
  classIds: e.classIds ?? [],
  description: e.description ?? ""
});

export const eventDates = (e: Pick<CalendarEvent, "startDate" | "endDate">) =>
  e.endDate && e.endDate !== e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : formatDate(e.startDate);

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/* What each type asks for, as the API checks it */
const RULES: Record<EventType, { dates: "range" | "day" | "timetable"; times: "none" | "optional" | "required"; venue: boolean; classes: boolean; hint: string }> = {
  HOLIDAY: { dates: "range", times: "none", venue: false, classes: false, hint: `A day off, up to ${MAX_HOLIDAY_DAYS} days. The school is closed; no exam paper may fall on it.` },
  VACATION: { dates: "range", times: "none", venue: false, classes: false, hint: "A break of two days or more. The school is closed; no exam paper may fall in it." },
  EXAM: { dates: "timetable", times: "none", venue: false, classes: false, hint: "Its days come from the exam's timetable: give every paper a day and time. The school stays open." },
  EVENT: { dates: "range", times: "optional", venue: true, classes: true, hint: "For the whole school or some classes. Closing the school is allowed only on days without exam papers." },
  MEETING: { dates: "day", times: "required", venue: true, classes: true, hint: "On one day, with its hours. The school stays open." },
  OTHER: { dates: "range", times: "optional", venue: false, classes: false, hint: "Anything else on the calendar." }
};

/* Kinds whose label makes a good title ("Summer vacation"); a holiday is named for its day */
const TITLE_FROM_KIND: EventType[] = ["VACATION", "EVENT", "MEETING"];

/* AC-05 drawer: a new event (event = null, optionally on a clicked day) or one event to view,
   edit or delete. Pick the type, then what kind it is (or which exam), then its details.
   Read-only for those who can't change the calendar, or in an archived year. */
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
  const { can } = useAuth();
  const { selected: year } = useAcademicYear();
  const form = useForm<Values>(blank());
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const invalidate = [EVENTS_PATH, WORKING_DAYS_PATH, EXAMS_PATH];
  const create = useApiMutation(createEvent, { invalidate });
  const update = useApiMutation(updateEvent, { invalidate });
  const remove = useApiMutation(deleteEvent, { invalidate });
  const { values, errors } = form;
  const type = values.eventType || null;
  const rules = type ? RULES[type] : null;
  const isExam = type === "EXAM";

  /* Exams of the year, those already on the calendar, their papers, sections and closed days */
  const exams = useAllExams(open && isExam);
  const examEvents = useEventsBetween(year?.startDate ?? "", year?.endDate ?? "", "EXAM", year?.id, open && isExam && !event);
  const papers = useExamPapers(open && isExam ? values.examId : null);
  const sections = useSectionOptions(open && isExam);
  const closedDays = useWorkingDays(year?.startDate ?? "", year?.endDate ?? "", year?.id, open && isExam);
  const classes = useApiList<SchoolClass>(CLASSES_PATH, { limit: 100 }, { enabled: open && !!rules?.classes });

  const groups = useMemo(() => groupPapers(papers.data ?? [], sections.byId), [papers.data, sections.byId]);
  const closedOn = useMemo(() => new Map((closedDays.data?.closedDays ?? []).map(c => [c.date, closedReason(c)])), [closedDays.data]);

  useEffect(() => {
    if (!open) return;
    form.reset(event ? toValues(event) : blank(date));
    setSlots(Object.fromEntries(groups.map(g => [g.key, g.initial])));
    setSlotErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, date]);

  /* The exam's papers arrive: the timetable starts from their current schedule */
  useEffect(() => {
    setSlots(Object.fromEntries(groups.map(g => [g.key, g.initial])));
    setSlotErrors({});
  }, [groups]);

  const askDelete = async () => {
    if (!event) return;
    const ok = await confirm({
      title: `Delete ${event.title}?`,
      message: `${event.title} (${eventDates(event)}) is removed from the calendar.${event.isHoliday ? " Those days become school days again." : ""}${event.examId ? " The exam and its papers' dates stay as they are." : ""}`,
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

  const classOptions = (classes.rows ? [...classes.rows].sort(byClassOrder) : []).map(c => ({ value: c.id, label: c.className }));
  const classNames = (ids: string[] | null) => {
    if (!ids?.length) return "Whole school";
    const byId = new Map((classes.rows ?? []).map(c => [c.id, c.className]));
    return ids.map(id => byId.get(id) ?? "A class").join(", ");
  };

  const examLink = event?.examId && can("academics.exams.read") && (
    <Link to={examPath(event.examId)} onClick={onClose}>
      Open the exam
    </Link>
  );

  if (event && !canEdit)
    return (
      <Drawer
        open={open}
        onClose={onClose}
        wide={!!event.examId}
        title={event.title}
        subtitle={<Badge tone={eventTone(event.eventType)}>{categoryLabel(event.eventType, event.category) || eventTypeLabel(event.eventType)}</Badge>}
        footer={
          canDelete ? (
            <Button variant="danger" icon={<Trash2 />} loading={remove.isPending} onClick={() => void askDelete()}>
              Delete
            </Button>
          ) : undefined
        }
      >
        <div className="stack">
          <DescriptionList
            columns={1}
            items={[
              { label: "Type", value: eventTypeLabel(event.eventType) },
              { label: "Dates", value: eventDates(event) },
              { label: "Hours", value: event.startTime ? `${shortTime(event.startTime)}–${shortTime(event.endTime)}` : null, hidden: !event.startTime },
              { label: "Venue", value: event.venue, hidden: !event.venue },
              { label: "For", value: classNames(event.classIds), hidden: !RULES[event.eventType].classes || STAFF_MEETINGS.includes(event.category as EventCategory) },
              { label: "School", value: event.isHoliday ? "Closed" : "Open as usual" },
              { label: "Description", value: event.description },
              { label: "Exam", value: examLink || null, hidden: !examLink }
            ]}
          />
          {event.examId && can("academics.exams.read") && <ReadTimetable examId={event.examId} />}
        </div>
      </Drawer>
    );

  const categories = type ? EVENT_CATEGORIES[type] : undefined;
  const staffMeeting = type === "MEETING" && STAFF_MEETINGS.includes(values.category as EventCategory);
  const showClasses = !!rules?.classes && !staffMeeting;
  const fixedClosed = type ? CLOSING_TYPES.includes(type) : false;
  const fixedOpen = type ? OPEN_TYPES.includes(type) : false;
  const closed = fixedClosed || (!fixedOpen && values.isHoliday);

  const takenExams = new Set((examEvents.data ?? []).map(e => e.examId).filter(Boolean));
  const examOptions = exams.exams
    .filter(x => !takenExams.has(x.id) || x.id === event?.examId)
    .map(x => ({ value: x.id, label: x.examName, description: x.startDate ? eventDates({ startDate: x.startDate, endDate: x.endDate ?? x.startDate }) : "No dates yet" }));
  const pickedExam = exams.exams.find(x => x.id === values.examId);

  const setType = (t: EventType) => {
    form.set("eventType", t);
    form.set("category", "");
    form.set("examId", "");
    form.set("isHoliday", CLOSING_TYPES.includes(t));
    if (RULES[t].dates === "day") form.set("endDate", values.startDate);
    if (RULES[t].times === "none") {
      form.set("startTime", "");
      form.set("endTime", "");
    }
    if (TITLE_FROM_KIND.includes(values.eventType as EventType) && values.title === categoryLabel(values.eventType as EventType, values.category || null)) form.set("title", "");
  };

  const setCategory = (c: EventCategory) => {
    const previous = categoryLabel(type!, values.category || null);
    form.set("category", c);
    if (TITLE_FROM_KIND.includes(type!) && (!values.title.trim() || values.title === previous)) form.set("title", categoryLabel(type!, c));
    if (type === "MEETING" && STAFF_MEETINGS.includes(c)) form.set("classIds", []);
  };

  const setStart = (v: string) => {
    form.set("startDate", v);
    if (rules?.dates === "day" || !values.endDate || values.endDate < v || values.endDate === values.startDate) form.set("endDate", v);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!type) e.eventType = "Pick a type";
    if (categories && !values.category) e.category = `Pick what kind of ${type!.toLowerCase()} it is`;
    if (!isExam && !values.title.trim()) e.title = "Give the event a name";
    if (rules && rules.dates !== "timetable") {
      if (!values.startDate) e.startDate = "Pick the day";
      else if (values.endDate && values.endDate < values.startDate) e.endDate = "On or after the first day";
      else if (values.endDate) {
        const n = days(values.startDate, values.endDate);
        if (type === "HOLIDAY" && n > MAX_HOLIDAY_DAYS) e.endDate = `At most ${MAX_HOLIDAY_DAYS} days; a longer break is a vacation`;
        if (type === "VACATION" && n < 2) e.endDate = "Two days or more; a single day off is a holiday";
      }
    }
    if (rules?.times === "required") {
      if (!values.startTime) e.startTime = "Pick the start";
      if (!values.endTime) e.endTime = "Pick the end";
    } else if (rules?.times === "optional" && !!values.startTime !== !!values.endTime) e[values.startTime ? "endTime" : "startTime"] = "Give both times, or neither";
    if (values.startTime && values.endTime && values.endTime <= values.startTime) e.endTime = "After the start";
    if (isExam && !values.examId) e.examId = "Pick the exam";
    form.setErrors(e);
    const se = isExam ? validateTimetable(groups, slots, d => closedOn.get(d) ?? null) : {};
    setSlotErrors(se);
    if (isExam && values.examId && !groups.length && !papers.isLoading) {
      form.setFormError("The exam has no papers yet: add them on the exam's page first");
      return false;
    }
    return !Object.keys(e).length && !Object.keys(se).length;
  };

  const timetableChanged = groups.some(g => {
    const s = slots[g.key];
    return g.differs || !s || s.examDate !== g.initial.examDate || s.startTime !== g.initial.startTime || s.endTime !== g.initial.endTime;
  });

  const createBody = (): CalendarEventInput => {
    const b: CalendarEventInput = { eventType: type! };
    if (isExam) return { ...b, examId: values.examId, timetable: timetableBody(groups, slots), ...(values.description.trim() ? { description: values.description.trim() } : {}) };
    Object.assign(b, {
      title: values.title.trim(),
      startDate: values.startDate,
      endDate: rules!.dates === "day" ? values.startDate : values.endDate || values.startDate,
      isHoliday: closed
    });
    if (values.category) b.category = values.category;
    if (values.startTime) Object.assign(b, { startTime: values.startTime, endTime: values.endTime });
    if (rules!.venue && values.venue.trim()) b.venue = values.venue.trim();
    if (showClasses && values.classIds.length) b.classIds = values.classIds;
    if (values.description.trim()) b.description = values.description.trim();
    return b;
  };

  const changes = (): CalendarEventPatch => {
    if (!event) return {};
    const was = toValues(event);
    const c: CalendarEventPatch = {};
    if (isExam) {
      if (timetableChanged) c.timetable = timetableBody(groups, slots);
    } else {
      const endDate = rules!.dates === "day" ? values.startDate : values.endDate || values.startDate;
      if (values.title.trim() !== was.title) c.title = values.title.trim();
      if (values.category && values.category !== was.category) c.category = values.category;
      if (values.startDate !== was.startDate) c.startDate = values.startDate;
      if (endDate !== was.endDate) c.endDate = endDate;
      if (closed !== was.isHoliday) c.isHoliday = closed;
      if (values.startTime !== was.startTime) c.startTime = values.startTime || null;
      if (values.endTime !== was.endTime) c.endTime = values.endTime || null;
      if (values.venue.trim() !== was.venue) c.venue = values.venue.trim();
      const ids = showClasses ? values.classIds : [];
      if ([...ids].sort().join() !== [...was.classIds].sort().join()) c.classIds = ids;
    }
    if (values.description.trim() !== was.description) c.description = values.description.trim();
    return c;
  };
  const unchanged = !!event && !Object.keys(changes()).length;

  /* Field errors come back by name; the timetable's and type rules' 409/422 messages go to the footer */
  const onError = (err: unknown) => {
    if (isApiError(err) && err.isValidation) form.setServerErrors(err);
    else form.setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (event) update.mutate({ id: event.id, ...changes() }, { onSuccess: done, onError });
    else create.mutate(createBody(), { onSuccess: done, onError });
  };

  const typeOptions = EVENT_TYPES.map(t => ({ value: t.value, label: t.label, description: t.description }));
  const subtitle = event ? (
    <Badge tone={eventTone(event.eventType)}>{eventTypeLabel(event.eventType)}</Badge>
  ) : (
    `In ${year?.yearName ?? "the year"} (${formatDate(year?.startDate)} – ${formatDate(year?.endDate)})`
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide={isExam && !!values.examId}
      title={event ? event.title : "New event"}
      subtitle={subtitle}
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
            {event ? "Save changes" : isExam ? "Add exam to calendar" : "Add to calendar"}
          </Button>
        </>
      }
    >
      <form id="event-form" className="stack" onSubmit={submit} noValidate>
        {/* 1. The type (fixed once the event exists), 2. what kind, or which exam */}
        <div className="form-grid">
          {event ? (
            <TextInput label="Type" value={eventTypeLabel(event.eventType)} disabled hint="Fixed once added: delete and add again to change it" />
          ) : (
            <Select label="Type" required options={typeOptions} value={values.eventType} placeholder="Pick a type" error={errors.eventType} onChange={e => setType(e.target.value as EventType)} />
          )}
          {categories && (
            <Select
              label="Kind"
              required
              options={categories}
              value={values.category}
              placeholder={`What kind of ${type!.toLowerCase()}`}
              error={errors.category}
              onChange={e => setCategory(e.target.value as EventCategory)}
            />
          )}
          {isExam &&
            (event ? (
              <TextInput label="Exam" value={event.title} disabled hint={examLink || undefined} />
            ) : (
              <Select
                label="Exam"
                required
                searchable
                options={examOptions}
                value={values.examId}
                placeholder={exams.isLoading ? "Loading exams…" : examOptions.length ? "Which exam" : "No exam left to add"}
                hint={
                  <>
                    Missing one? Create it on <Link to={EXAMS_PATH}>Exams</Link>
                  </>
                }
                error={errors.examId}
                onChange={e => form.set("examId", e.target.value)}
              />
            ))}
        </div>

        {rules && <p className="small muted">{rules.hint}</p>}

        {rules && !isExam && (
          <>
            <TextInput
              label="Title"
              required
              maxLength={150}
              placeholder={type === "HOLIDAY" ? "Diwali" : type === "MEETING" ? "Parent-teacher meeting" : "Annual day"}
              {...form.text("title")}
            />
            <div className="form-grid">
              <TextInput
                label={rules.dates === "day" ? "Day" : "From"}
                type="date"
                required
                min={year?.startDate}
                max={year?.endDate}
                {...form.text("startDate")}
                onChange={e => setStart(e.target.value)}
              />
              {rules.dates === "range" && (
                <TextInput
                  label="To"
                  type="date"
                  min={values.startDate || year?.startDate}
                  max={year?.endDate}
                  hint={type === "VACATION" ? "At least the next day" : "Same day for a one-day event"}
                  {...form.text("endDate")}
                />
              )}
            </div>
            {rules.times !== "none" && (
              <div className="form-grid">
                <TextInput label="Starts" type="time" required={rules.times === "required"} hint={rules.times === "optional" ? "Optional: leave both empty for all day" : undefined} {...form.text("startTime")} />
                <TextInput label="Ends" type="time" required={rules.times === "required"} {...form.text("endTime")} />
              </div>
            )}
            {rules.venue && <TextInput label="Venue" maxLength={100} placeholder={type === "MEETING" ? "Classrooms" : "School ground"} {...form.text("venue")} />}
            {showClasses && (
              <MultiSelect
                label="For"
                noun="classes"
                searchable
                options={classOptions}
                value={values.classIds}
                onChange={ids => form.set("classIds", ids)}
                placeholder="Whole school"
                hint={type === "MEETING" ? "The classes whose parents are invited; none for every class" : "The classes taking part; none for the whole school"}
              />
            )}
            {/* Same place for every type: a switch, or a fixed note */}
            <Field
              hint={
                fixedClosed
                  ? `${eventTypeLabel(type!)}s always close the school`
                  : fixedOpen
                    ? `The school stays open for a ${type!.toLowerCase()}`
                    : "Closed days don't count as working days for attendance; no exam paper may fall on them"
              }
            >
              <Switch label="School closed" checked={closed} disabled={fixedClosed || fixedOpen} onChange={v => form.set("isHoliday", v)} />
            </Field>
          </>
        )}

        {isExam && values.examId && (
          <Field label="Timetable" required hint="Every paper needs a day and time; the exam's days on the calendar are its first and last paper's">
            {papers.isLoading || sections.isLoading ? (
              <SkeletonBlock lines={4} />
            ) : groups.length ? (
              <ExamTimetableEditor groups={groups} slots={slots} onChange={setSlots} errors={slotErrors} min={year?.startDate} max={year?.endDate} />
            ) : (
              <p className="small">
                {pickedExam?.examName ?? "The exam"} has no papers yet. Add its papers on <Link to={examPath(values.examId)}>the exam&apos;s page</Link> first, then
                come back to set its timetable.
              </p>
            )}
          </Field>
        )}

        {rules && <Textarea label="Description" rows={3} maxLength={1000} {...form.text("description")} />}
      </form>
    </Drawer>
  );
}

/* The exam's timetable, read-only */
function ReadTimetable({ examId }: { examId: string }) {
  const papers = useExamPapers(examId);
  const sections = useSectionOptions();
  const groups = useMemo(() => groupPapers(papers.data ?? [], sections.byId), [papers.data, sections.byId]);
  if (papers.isLoading) return <SkeletonBlock lines={3} />;
  return groups.length ? (
    <Field label="Timetable">
      <ExamTimetableView groups={groups} />
    </Field>
  ) : null;
}
