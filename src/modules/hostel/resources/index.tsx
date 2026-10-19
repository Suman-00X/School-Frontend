import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ResourcesPage from "./pages/ResourcesPage";

export const routes: RouteObject[] = [
  { path: "/hostel/resources", element: <RequirePermission permission="hostel.resources.read"><ResourcesPage /></RequirePermission> }
];
