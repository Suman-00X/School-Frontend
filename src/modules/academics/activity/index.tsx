import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AcademicsActivityPage from "./pages/AcademicsActivityPage";

export const routes: RouteObject[] = [
  {
    path: "/academics/activity",
    element: (
      <RequirePermission permission="academics.activity.read">
        <AcademicsActivityPage />
      </RequirePermission>
    )
  }
];
