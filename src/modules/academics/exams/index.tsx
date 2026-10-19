import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ExamsPage from "./pages/ExamsPage";
import ExamDetailPage from "./pages/ExamDetailPage";

/* Inside the Exams & results area (side list) */
export const areaRoutes: RouteObject[] = [
  {
    path: "/academics/exams",
    element: (
      <RequirePermission permission="academics.exams.read">
        <ExamsPage />
      </RequirePermission>
    )
  }
];

/* One exam: a drill-in page outside the area */
export const routes: RouteObject[] = [
  {
    path: "/academics/exams/:examId",
    element: (
      <RequirePermission permission="academics.exams.read">
        <ExamDetailPage />
      </RequirePermission>
    )
  }
];

import { ExamsResultsLayout } from "./components/ExamsResultsLayout";

/* Puts the area's pages (exams, marks entry, results) inside its side list */
export const resultsArea = (children: RouteObject[]): RouteObject => ({ element: <ExamsResultsLayout />, children });
