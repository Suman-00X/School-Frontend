import { Navigate, type RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import { AccessLayout } from "./components/AccessLayout";
import OperatorRolesListPage from "./pages/OperatorRolesListPage";
import OperatorRoleEditorPage from "./pages/OperatorRoleEditorPage";
import OperatorRoleDetailPage from "./pages/OperatorRoleDetailPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import HandoverWizardPage from "./pages/HandoverWizardPage";

/* Routes inside the signed-in app shell.
   The "Access control" area (header tab /administration/access) has a side list of sections;
   pages about one role, and the handover wizard, are drill-in pages outside it. */
export const routes: RouteObject[] = [
  {
    path: "/administration/access",
    element: (
      <RequirePermission permission="administration.access.read">
        <AccessLayout />
      </RequirePermission>
    ),
    children: [
      { index: true, element: <Navigate to="/administration/access/operator-roles" replace /> },
      { path: "operator-roles", element: <OperatorRolesListPage /> },
      { path: "assignments", element: <AssignmentsPage kind="OPERATOR" /> },
      {
        path: "assignments/owners",
        element: (
          <RequirePermission permission="administration.access.manageOwners">
            <AssignmentsPage kind="OWNER" />
          </RequirePermission>
        )
      }
    ]
  },
  { path: "/administration/access/operator-roles/new", element: <RequirePermission permission="administration.access.manage"><OperatorRoleEditorPage /></RequirePermission> },
  { path: "/administration/access/operator-roles/:operatorRoleId/edit", element: <RequirePermission permission="administration.access.manage"><OperatorRoleEditorPage /></RequirePermission> },
  { path: "/administration/access/operator-roles/:operatorRoleId", element: <RequirePermission permission="administration.access.read"><OperatorRoleDetailPage /></RequirePermission> },
  { path: "/administration/access/handovers/new", element: <RequirePermission permission="administration.access.handOver"><HandoverWizardPage /></RequirePermission> }
];
