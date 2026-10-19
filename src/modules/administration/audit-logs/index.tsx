import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AuditLogPage from "./pages/AuditLogPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/administration/audit-logs", element: <RequirePermission permission="administration.auditLogs.read"><AuditLogPage /></RequirePermission> }
];
