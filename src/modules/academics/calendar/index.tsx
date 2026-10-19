import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import CalendarPage from "./pages/CalendarPage";

/* Inside Academics › Setup (see shared/components/SetupLayout) */
export const routes: RouteObject[] = [
  {
    path: "/academics/calendar",
    element: (
      <RequirePermission permission="academics.calendar.read">
        <CalendarPage />
      </RequirePermission>
    )
  }
];

/* For the portal's calendar (PO-09): the same month view, read-only */
export { useEventsBetween, useWorkingDays, eventTone, eventTypeLabel, EVENT_TYPES, closedReason, type CalendarEvent } from "./api/calendar";
