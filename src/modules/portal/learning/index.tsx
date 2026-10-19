import { Navigate, type RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import OverviewPage from "./pages/OverviewPage";
import TimetablePage from "./pages/TimetablePage";
import AttendancePage from "./pages/AttendancePage";
import ResultsPage from "./pages/ResultsPage";
import CalendarPage from "./pages/CalendarPage";
import TeachingSectionsPage from "./pages/TeachingSectionsPage";
import TeachingTimetablePage from "./pages/TeachingTimetablePage";

/* Pages of one child, inside the portal layout (/me/students/:studentId/…) */
export const childRoutes: RouteObject[] = [
  { index: true, element: <OverviewPage /> },
  { path: "timetable", element: <TimetablePage /> },
  { path: "attendance", element: <AttendancePage /> },
  { path: "results", element: <ResultsPage /> }
];

/* Everyone's calendar, and teachers' own sections and week */
export const routes: RouteObject[] = [
  { path: "/me/calendar", element: <RequirePermission permission="portal.learning.calendar"><CalendarPage /></RequirePermission> },
  { path: "/me/teaching", element: <Navigate to="/me/teaching/sections" replace /> },
  { path: "/me/teaching/sections", element: <RequirePermission permission="portal.learning.teaching"><TeachingSectionsPage /></RequirePermission> },
  { path: "/me/teaching/timetable", element: <RequirePermission permission="portal.learning.teaching"><TeachingTimetablePage /></RequirePermission> }
];
