import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import EnrollmentsPage from "./pages/EnrollmentsPage";
import PromotionWizardPage from "./pages/PromotionWizardPage";

/* The "Enrollments" header tab of Academics */
export const routes: RouteObject[] = [
  {
    path: "/academics/enrollments",
    element: (
      <RequirePermission permission="academics.enrollments.read">
        <EnrollmentsPage />
      </RequirePermission>
    )
  },
  {
    path: "/academics/enrollments/promotion",
    element: (
      <RequirePermission permission="academics.enrollments.promote">
        <PromotionWizardPage />
      </RequirePermission>
    )
  }
];
