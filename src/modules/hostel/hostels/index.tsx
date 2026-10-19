import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import HostelsPage from "./pages/HostelsPage";
import HostelDetailPage from "./pages/HostelDetailPage";

export const routes: RouteObject[] = [
  { path: "/hostel/hostels", element: <RequirePermission permission="hostel.hostels.read"><HostelsPage /></RequirePermission> },
  { path: "/hostel/hostels/:hostelId", element: <RequirePermission permission="hostel.hostels.read"><HostelDetailPage /></RequirePermission> }
];
