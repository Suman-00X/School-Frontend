import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ExportsPage from "./pages/ExportsPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  {
    path: "/reports/exports",
    element: (
      <RequirePermission permission={["reports.exports.students", "reports.exports.attendance", "reports.exports.fees", "reports.exports.results"]}>
        <ExportsPage />
      </RequirePermission>
    )
  }
];
