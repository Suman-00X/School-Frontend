import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import SubjectCodesPage from "./pages/SubjectCodesPage";

/* Inside Academics › Setup › Policy (see shared/components/SetupLayout) */
export const routes: RouteObject[] = [
  {
    path: "/academics/subject-codes",
    element: (
      <RequirePermission permission="academics.subjectCodes.read">
        <SubjectCodesPage />
      </RequirePermission>
    )
  }
];
