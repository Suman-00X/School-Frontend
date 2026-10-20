import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ExamEligibilityPage from "./pages/ExamEligibilityPage";
import { EXAM_ELIGIBILITY_PAGE } from "./api/examEligibility";

/* Inside Academics › Setup (see shared/components/SetupLayout); each exam's eligibility is on its Admit cards tab */
export const routes: RouteObject[] = [
  {
    path: EXAM_ELIGIBILITY_PAGE,
    element: (
      <RequirePermission permission="academics.examEligibility.readPolicy">
        <ExamEligibilityPage />
      </RequirePermission>
    )
  }
];
