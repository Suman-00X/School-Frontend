import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import SubjectsPage from "./pages/SubjectsPage";

/* Inside Academics › Setup (see shared/components/SetupLayout) */
export const routes: RouteObject[] = [
  {
    path: "/academics/subjects",
    element: (
      <RequirePermission permission={["academics.subjects.read", "academics.sectionSubjects.read"]}>
        <SubjectsPage />
      </RequirePermission>
    )
  }
];
