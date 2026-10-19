import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AllocationsPage from "./pages/AllocationsPage";
import RolloverPage from "./pages/RolloverPage";

/* One allocation's drawer is a path of the page; the static rollover segment outranks it */
export const routes: RouteObject[] = [
  { path: "/hostel/allocations", element: <RequirePermission permission="hostel.allocations.read"><AllocationsPage /></RequirePermission> },
  { path: "/hostel/allocations/rollover", element: <RequirePermission permission="hostel.allocations.manage"><RolloverPage /></RequirePermission> },
  { path: "/hostel/allocations/:allocationId", element: <RequirePermission permission="hostel.allocations.read"><AllocationsPage /></RequirePermission> }
];
