import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import BehaviourPage from "./pages/BehaviourPage";

/* Inside the portal layout */
export const childRoutes: RouteObject[] = [
  { path: "behaviour", element: <RequirePermission permission="portal.behaviour.read"><BehaviourPage /></RequirePermission> }
];
