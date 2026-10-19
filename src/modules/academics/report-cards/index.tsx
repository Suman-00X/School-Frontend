import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ResultsPage from "./pages/ResultsPage";

/* Inside the Exams & results area (side list) */
export const areaRoutes: RouteObject[] = [
  {
    path: "/academics/results",
    element: (
      <RequirePermission permission={["academics.reportCards.read", "academics.assessmentSchemes.read"]}>
        <ResultsPage />
      </RequirePermission>
    )
  }
];
