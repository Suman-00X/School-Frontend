import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import HostelActivityPage from "./pages/HostelActivityPage";

export const routes: RouteObject[] = [
  { path: "/hostel/activity", element: <RequirePermission permission="hostel.activity.read"><HostelActivityPage /></RequirePermission> }
];
