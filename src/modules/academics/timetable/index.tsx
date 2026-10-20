import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import PeriodsPage from "./pages/PeriodsPage";
import TimetablePage from "./pages/TimetablePage";
import { routes as schedulingRoutes } from "../scheduling";

/* Inside Academics › Setup › Calendar (see shared/components/SetupLayout) */
export const routes: RouteObject[] = [
  { path: "/academics/periods", element: <RequirePermission permission="academics.timetable.read"><PeriodsPage /></RequirePermission> },
  { path: "/academics/timetable", element: <RequirePermission permission="academics.timetable.read"><TimetablePage /></RequirePermission> },
  /* AC-07b: generate a timetable (academics/scheduling) */
  ...schedulingRoutes
];

/* For other modules (PO-10 "my timetable"): the read-only weekly grid and its data shape */
export { TimetableGrid } from "./components/TimetableGrid";
export { MY_TIMETABLE_PATH, type TeacherTimetable, type TimetableGridData } from "./api/timetable";
