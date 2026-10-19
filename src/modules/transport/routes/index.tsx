import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import RoutesPage from "./pages/RoutesPage";
import RouteDetailPage from "./pages/RouteDetailPage";

export const routes: RouteObject[] = [
  { path: "/transport/routes", element: <RequirePermission permission="transport.routes.read"><RoutesPage /></RequirePermission> },
  { path: "/transport/routes/:routeId", element: <RequirePermission permission="transport.routes.read"><RouteDetailPage /></RequirePermission> }
];
