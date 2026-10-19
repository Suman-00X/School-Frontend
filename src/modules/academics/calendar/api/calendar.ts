import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import type { Tone } from "@/common/ui";
import { fetchAll } from "../../shared/api/fetchAll";

/* School calendar of one academic year (the header's year) */
export type EventType = "HOLIDAY" | "VACATION" | "EXAM" | "EVENT" | "MEETING" | "OTHER";

export type CalendarEvent = {
  id: string;
  academicYearId: string;
  title: string;
  eventType: EventType;
  startDate: string;
  /* Inclusive; equals startDate for a one-day event */
  endDate: string;
  /* The school is closed on these days */
  isHoliday: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventInput = {
  title: string;
  eventType: EventType;
  startDate: string;
  endDate?: string;
  isHoliday?: boolean;
  /* "" clears it */
  description?: string;
};

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

/* Holidays and vacations close the school unless told otherwise */
export const CLOSING_TYPES: EventType[] = ["HOLIDAY", "VACATION"];

export const eventTypeLabel = (t: EventType | string) => EVENT_TYPES.find(e => e.value === t)?.label ?? t;
export const eventTone = (t: EventType): Tone => EVENT_TYPES.find(e => e.value === t)?.tone ?? "neutral";

export const createEvent = (body: CalendarEventInput) => api.post<CalendarEvent>(EVENTS_PATH, body);
export const updateEvent = ({ id, ...body }: Partial<CalendarEventInput> & { id: string }) => api.patch<CalendarEvent>(`${EVENTS_PATH}/${id}`, body);
export const deleteEvent = (id: string) => api.delete<CalendarEvent>(`${EVENTS_PATH}/${id}`);

/* Events overlapping [from, to] */
export function useEventsBetween(from: string, to: string, eventType: string, yearId: string | undefined) {
  return useQuery({
    queryKey: [EVENTS_PATH, { from, to, eventType, yearId, all: true }],
    placeholderData: prev => prev,
    queryFn: () => fetchAll<CalendarEvent>(EVENTS_PATH, { from, to, eventType: eventType || undefined })
  });
}

/* Working and closed days in [from, to] (clamped by the API to the academic year) */
export function useWorkingDays(from: string, to: string, yearId: string | undefined) {
  return useQuery({
    queryKey: [WORKING_DAYS_PATH, { from, to, yearId }],
    placeholderData: prev => prev,
    queryFn: async () => {
      const res = await api.get<WorkingDays>(WORKING_DAYS_PATH, { from, to });
      return res.data;
    }
  });
}

/* "Weekly off", "Holiday: Gandhi Jayanti" */
export const closedReason = (c: ClosedDay) => (c.reason === "WEEKLY_OFF" ? "Weekly off" : `${eventTypeLabel(c.reason)}${c.title ? `: ${c.title}` : ""}`);
