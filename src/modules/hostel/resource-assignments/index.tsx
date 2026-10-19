import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ResourceAssignmentsPage from "./pages/ResourceAssignmentsPage";

export const routes: RouteObject[] = [
  { path: "/hostel/resource-assignments", element: <RequirePermission permission="hostel.resourceAssignments.read"><ResourceAssignmentsPage /></RequirePermission> },
  { path: "/hostel/resource-assignments/:assignmentId", element: <RequirePermission permission="hostel.resourceAssignments.read"><ResourceAssignmentsPage /></RequirePermission> }
];
