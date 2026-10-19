import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import TeacherAssignmentsPage from "./pages/TeacherAssignmentsPage";

/* Inside Academics › Setup (see shared/components/SetupLayout) */
export const routes: RouteObject[] = [
  {
    path: "/academics/teacher-assignments",
    element: (
      <RequirePermission permission="academics.teacherAssignments.read">
        <TeacherAssignmentsPage />
      </RequirePermission>
    )
  }
];
