import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AssessmentMarksPage from "./pages/AssessmentMarksPage";
import AssessmentsPage from "./pages/AssessmentsPage";

/* Inside the Exams & results area (side list) */
export const areaRoutes: RouteObject[] = [
  {
    path: "/academics/assessments",
    element: (
      <RequirePermission permission="academics.assessments.read">
        <AssessmentsPage />
      </RequirePermission>
    )
  }
];

/* One item and its marks: a drill-in page outside the area */
export const routes: RouteObject[] = [
  {
    path: "/academics/assessments/:assessmentId",
    element: (
      <RequirePermission permission="academics.assessments.read">
        <AssessmentMarksPage />
      </RequirePermission>
    )
  }
];

export { useBuckets, type Bucket } from "./api/assessments";
