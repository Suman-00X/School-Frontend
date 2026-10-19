import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import OperatorRolesListPage from "./pages/OperatorRolesListPage";
import OperatorRoleEditorPage from "./pages/OperatorRoleEditorPage";
import OperatorRoleDetailPage from "./pages/OperatorRoleDetailPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import HandoverWizardPage from "./pages/HandoverWizardPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/administration/access/operator-roles", element: <RequirePermission permission="administration.access.read"><OperatorRolesListPage /></RequirePermission> },
  { path: "/administration/access/operator-roles/new", element: <RequirePermission permission="administration.access.manage"><OperatorRoleEditorPage /></RequirePermission> },
  { path: "/administration/access/operator-roles/:operatorRoleId", element: <RequirePermission permission="administration.access.read"><OperatorRoleDetailPage /></RequirePermission> },
  { path: "/administration/access/assignments", element: <RequirePermission permission="administration.access.read"><AssignmentsPage /></RequirePermission> },
  { path: "/administration/access/handovers/new", element: <RequirePermission permission="administration.access.handOver"><HandoverWizardPage /></RequirePermission> }
];
