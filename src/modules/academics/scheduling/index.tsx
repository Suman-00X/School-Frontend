import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ClassTimetableGeneratorPage from "./pages/ClassTimetableGeneratorPage";
import { GENERATE_TIMETABLE_PATH } from "./api/scheduling";

/* Inside Academics › Setup › Calendar, next to Timetables (mounted by the timetable submodule's routes) */
export const routes: RouteObject[] = [
  {
    path: GENERATE_TIMETABLE_PATH,
    element: (
      <RequirePermission permission="academics.scheduling.read">
        <ClassTimetableGeneratorPage />
      </RequirePermission>
    )
  }
];

/* For the timetable and exam pages: their ways into the generators */
export { GenerateTimetableLink } from "./components/GenerateTimetableLink";
export { GenerateExamTimetableButton, ExamTimetableDrawer } from "./components/ExamTimetableDrawer";
export { GENERATE_TIMETABLE_PATH } from "./api/scheduling";
