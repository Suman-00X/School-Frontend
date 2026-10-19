import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import CategoriesPage from "./pages/CategoriesPage";

/* inventory/categories (IN-01) */
export const routes: RouteObject[] = [
  { path: "/inventory/categories", element: <RequirePermission permission="inventory.categories.read"><CategoriesPage /></RequirePermission> }
];
