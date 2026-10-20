import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import NepPolicyPage from "./pages/NepPolicyPage";

/* Inside Academics › Setup › Policy (see shared/components/SetupLayout) */
export const routes: RouteObject[] = [
  {
    path: "/academics/nep-policy",
    element: (
      <RequirePermission permission="academics.nepPolicy.read">
        <NepPolicyPage />
      </RequirePermission>
    )
  }
];
