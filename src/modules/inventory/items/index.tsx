import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ItemDetailPage from "./pages/ItemDetailPage";
import ItemsPage from "./pages/ItemsPage";

/* inventory/items (IN-03) */
export const routes: RouteObject[] = [
  { path: "/inventory/items", element: <RequirePermission permission="inventory.items.read"><ItemsPage /></RequirePermission> },
  { path: "/inventory/items/:itemId", element: <RequirePermission permission="inventory.items.read"><ItemDetailPage /></RequirePermission> }
];
