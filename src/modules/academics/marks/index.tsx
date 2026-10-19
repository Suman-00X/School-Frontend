import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import MarksEntryPage from "./pages/MarksEntryPage";

/* Inside the Exams & results area (side list) */
export const areaRoutes: RouteObject[] = [
  {
    path: "/academics/marks",
    element: (
      <RequirePermission permission="academics.marks.record">
        <MarksEntryPage />
      </RequirePermission>
    )
  }
];
