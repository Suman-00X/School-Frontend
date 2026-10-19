import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import TransportActivityPage from "./pages/TransportActivityPage";

export const routes: RouteObject[] = [
  { path: "/transport/activity", element: <RequirePermission permission="transport.activity.read"><TransportActivityPage /></RequirePermission> }
];
