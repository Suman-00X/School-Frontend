import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import BehaviourPage from "./pages/BehaviourPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/academics/behaviour", element: <RequirePermission permission="academics.behaviourRemarks.read"><BehaviourPage /></RequirePermission> }
];

/* The log book, for the student profile (PE-02) and the portal (PO-12) */
export { StudentBehaviourTab } from "./components/StudentBehaviourTab";
export { BehaviourLog, BehaviourKpis, NoRemarks } from "./components/BehaviourLog";
export type { BehaviourRemark, BehaviourSummary } from "./api/behaviour";
