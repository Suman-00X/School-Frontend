import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import TimetablePage from "./pages/TimetablePage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/academics/timetable", element: <RequirePermission permission="academics.timetable.read"><TimetablePage /></RequirePermission> }
];

/* For other modules (PO-10 "my timetable"): the read-only weekly grid and its data shape */
export { TimetableGrid } from "./components/TimetableGrid";
export { MY_TIMETABLE_PATH, type TeacherTimetable, type TimetableGridData } from "./api/timetable";
