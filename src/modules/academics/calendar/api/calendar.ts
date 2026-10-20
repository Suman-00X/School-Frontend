import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import type { Tone } from "@/common/ui";
import { fetchAll } from "../../shared/api/fetchAll";

/* School calendar of one academic year (the header's year) */
export type EventType = "HOLIDAY" | "VACATION" | "EXAM" | "EVENT" | "MEETING" | "OTHER";

/* What kind of holiday, vacation, event or meeting it is; exams and Other have none */
export type EventCategory =
  | "NATIONAL"
  | "FESTIVAL"
  | "REGIONAL"
  | "SCHOOL"
  | "SUMMER"
  | "WINTER"
  | "FESTIVAL_BREAK"
  | "TERM_BREAK"
  | "SPORTS_DAY"
  | "ANNUAL_DAY"
  | "CULTURAL"
  | "CELEBRATION"
  | "COMPETITION"
  | "FIELD_TRIP"
  | "WORKSHOP"
  | "PARENT_TEACHER"
  | "PARENT_ORIENTATION"
  | "STAFF"
  | "MANAGEMENT";

export type CalendarEvent = {
  id: string;
  academicYearId: string;
  /* An exam's is the exam's name */
  title: string;
  eventType: EventType;
  category: EventCategory | null;
  /* EXAM: the exam whose timetable this is (its dates are the first and last paper's) */
  examId: string | null;
  startDate: string;
  /* Inclusive; equals startDate for a one-day event */
  endDate: string;
  /* The school is closed on these days */
  isHoliday: boolean;
  /* "09:00:00": a meeting's hours (required), an event's (optional) */
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  /* Events and parent meetings: the classes taking part; null for the whole school */
  classIds: string[] | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/* EXAM: every paper of the exam once */
export type TimetableRow = { paperId: string; examDate: string; startTime: string; endTime: string };

export type CalendarEventInput = {
  /* Not for an exam: it is named after the exam */
  title?: string;
  eventType: EventType;
  category?: EventCategory;
  examId?: string;
  timetable?: TimetableRow[];
  /* Not for an exam: its timetable sets them */
  startDate?: string;
  endDate?: string;
  isHoliday?: boolean;
  /* null clears them (update) */
  startTime?: string | null;
  endTime?: string | null;
  /* "" clears it */
  venue?: string;
  /* [] for the whole school */
  classIds?: string[];
  /* "" clears it */
  description?: string;
};

/* The type and exam are fixed once the event exists */
export type CalendarEventPatch = Partial<Omit<CalendarEventInput, "eventType" | "examId">>;

export type ClosedDay = { date: string; reason: "WEEKLY_OFF" | EventType; title?: string };
export type WorkingDays = { from: string; to: string; workingDays: string[]; closedDays: ClosedDay[] };

export const EVENTS_PATH = "/academics/calendar/events";
export const WORKING_DAYS_PATH = "/academics/calendar/working-days";

export const EVENT_TYPES: { value: EventType; label: string; tone: Tone; description: string }[] = [
  { value: "HOLIDAY", label: "Holiday", tone: "danger", description: "A day off, e.g. a festival" },
  { value: "VACATION", label: "Vacation", tone: "warning", description: "A break of several days" },
  { value: "EXAM", label: "Exam", tone: "primary", description: "Exam days" },
  { value: "EVENT", label: "Event", tone: "success", description: "Sports day, annual day, a trip" },
  { value: "MEETING", label: "Meeting", tone: "info", description: "Parent-teacher or staff meeting" },
  { value: "OTHER", label: "Other", tone: "neutral", description: "Anything else" }
];

/* Holidays and vacations always close the school; exams and meetings never do */
export const CLOSING_TYPES: EventType[] = ["HOLIDAY", "VACATION"];
export const OPEN_TYPES: EventType[] = ["EXAM", "MEETING"];

/* A holiday is a few days at most; a longer break is a vacation (as the API) */
export const MAX_HOLIDAY_DAYS = 7;

export const EVENT_CATEGORIES: Partial<Record<EventType, { value: EventCategory; label: string; description: string }[]>> = {
  HOLIDAY: [
    { value: "NATIONAL", label: "National holiday", description: "Independence Day, Republic Day, Gandhi Jayanti" },
    { value: "FESTIVAL", label: "Festival", description: "Diwali, Eid, Christmas, Pongal" },
    { value: "REGIONAL", label: "State or local holiday", description: "Declared by the state or district" },
    { value: "SCHOOL", label: "Declared by the school", description: "Weather, elections, an emergency" }
  ],
  VACATION: [
    { value: "SUMMER", label: "Summer vacation", description: "The long break between terms" },
    { value: "WINTER", label: "Winter vacation", description: "Around the new year" },
    { value: "FESTIVAL_BREAK", label: "Festival break", description: "Dussehra, Puja or Diwali break" },
    { value: "TERM_BREAK", label: "Term break", description: "A few days between terms" }
  ],
  EVENT: [
    { value: "SPORTS_DAY", label: "Sports day", description: "Athletics, matches, house events" },
    { value: "ANNUAL_DAY", label: "Annual day", description: "The school's annual function" },
    { value: "CULTURAL", label: "Cultural programme", description: "Music, dance, drama" },
    { value: "CELEBRATION", label: "Celebration", description: "Independence Day assembly, Children's Day" },
    { value: "COMPETITION", label: "Competition", description: "Quiz, olympiad, science fair" },
    { value: "FIELD_TRIP", label: "Field trip", description: "An outing or excursion" },
    { value: "WORKSHOP", label: "Workshop", description: "A talk, camp or training session" }
  ],
  MEETING: [
    { value: "PARENT_TEACHER", label: "Parent-teacher meeting", description: "Parents meet the teachers" },
    { value: "PARENT_ORIENTATION", label: "Parent orientation", description: "For new parents, or a new term" },
    { value: "STAFF", label: "Staff meeting", description: "Teachers and staff" },
    { value: "MANAGEMENT", label: "Management meeting", description: "Principal, management or board" }
  ]
};

/* Meetings for staff only: no classes */
export const STAFF_MEETINGS: EventCategory[] = ["STAFF", "MANAGEMENT"];

export const categoryLabel = (t: EventType, c: EventCategory | null | undefined) => EVENT_CATEGORIES[t]?.find(o => o.value === c)?.label ?? "";

export const eventTypeLabel = (t: EventType | string) => EVENT_TYPES.find(e => e.value === t)?.label ?? t;
export const eventTone = (t: EventType): Tone => EVENT_TYPES.find(e => e.value === t)?.tone ?? "neutral";

export const createEvent = (body: CalendarEventInput) => api.post<CalendarEvent>(EVENTS_PATH, body);
export const updateEvent = ({ id, ...body }: CalendarEventPatch & { id: string }) => api.patch<CalendarEvent>(`${EVENTS_PATH}/${id}`, body);
export const deleteEvent = (id: string) => api.delete<CalendarEvent>(`${EVENTS_PATH}/${id}`);

/* Events overlapping [from, to] */
export function useEventsBetween(from: string, to: string, eventType: string, yearId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [EVENTS_PATH, { from, to, eventType, yearId, all: true }],
    enabled,
    placeholderData: prev => prev,
    queryFn: () => fetchAll<CalendarEvent>(EVENTS_PATH, { from, to, eventType: eventType || undefined })
  });
}

/* Working and closed days in [from, to] (clamped by the API to the academic year) */
export function useWorkingDays(from: string, to: string, yearId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [WORKING_DAYS_PATH, { from, to, yearId }],
    enabled,
    placeholderData: prev => prev,
    queryFn: async () => {
      const res = await api.get<WorkingDays>(WORKING_DAYS_PATH, { from, to });
      return res.data;
    }
  });
}

/* "Weekly off", "Holiday: Gandhi Jayanti" */
export const closedReason = (c: ClosedDay) => (c.reason === "WEEKLY_OFF" ? "Weekly off" : `${eventTypeLabel(c.reason)}${c.title ? `: ${c.title}` : ""}`);
