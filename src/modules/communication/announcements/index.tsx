import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AnnouncementsPage from "./pages/AnnouncementsPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/communication/announcements", element: <RequirePermission permission="communication.announcements.read"><AnnouncementsPage /></RequirePermission> }
];
