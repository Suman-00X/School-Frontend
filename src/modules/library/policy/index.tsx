import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import PolicyPage from "./pages/PolicyPage";

/* LB-01 Policy tab; inside Library › Setup. Everyone holds library.policy.read, so the page opens
   for library staff (any staff read key) and the policy's managers. */
const SETUP_READERS = ["library.policy.manage", "library.circulationRules.manage", "library.closures.manage", "library.books.read", "library.loans.read"];

export const setupRoutes: RouteObject[] = [
  { path: "/library/policy", element: <RequirePermission permission={SETUP_READERS}><PolicyPage /></RequirePermission> }
];

export { SETUP_READERS };
