import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import SettingsPage from "./pages/SettingsPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/administration/settings", element: <RequirePermission permission="administration.settings.read"><SettingsPage /></RequirePermission> }
];
