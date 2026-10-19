import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import VehiclesPage from "./pages/VehiclesPage";

export const routes: RouteObject[] = [
  { path: "/transport/vehicles", element: <RequirePermission permission="transport.vehicles.read"><VehiclesPage /></RequirePermission> }
];
