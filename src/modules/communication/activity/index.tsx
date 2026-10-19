import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import CommunicationActivityPage from "./pages/CommunicationActivityPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/communication/activity", element: <RequirePermission permission="communication.activity.read"><CommunicationActivityPage /></RequirePermission> }
];
