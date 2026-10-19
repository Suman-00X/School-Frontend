import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import VendorsPage from "./pages/VendorsPage";

/* inventory/vendors (IN-02) */
export const routes: RouteObject[] = [
  { path: "/inventory/vendors", element: <RequirePermission permission="inventory.vendors.read"><VendorsPage /></RequirePermission> }
];
