import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AssignmentsPage from "./pages/AssignmentsPage";

/* The drawer of one seat is a path of the list page */
export const routes: RouteObject[] = [
  { path: "/transport/assignments", element: <RequirePermission permission="transport.assignments.read"><AssignmentsPage /></RequirePermission> },
  { path: "/transport/assignments/:assignmentId", element: <RequirePermission permission="transport.assignments.read"><AssignmentsPage /></RequirePermission> }
];
