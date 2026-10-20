import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import CurriculumPage from "./pages/CurriculumPage";

/* Inside Academics › Setup › Curriculum (see shared/components/SetupLayout) */
export const routes: RouteObject[] = [
  {
    path: "/academics/curriculum",
    element: (
      <RequirePermission permission={["academics.sectionSubjects.read", "academics.teacherAssignments.read"]}>
        <CurriculumPage />
      </RequirePermission>
    )
  }
];
