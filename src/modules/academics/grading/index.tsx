import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import GradingPage from "./pages/GradingPage";

/* Inside Academics › Setup (see shared/components/SetupLayout). Grade scales, result policies and
   assessment schemes are configured here (their own backend submodules); results are published
   on the exams pages. */
export const routes: RouteObject[] = [
  {
    path: "/academics/grading",
    element: (
      <RequirePermission permission={["academics.gradeScales.read", "academics.resultPolicies.read", "academics.assessmentSchemes.read"]}>
        <GradingPage />
      </RequirePermission>
    )
  }
];
