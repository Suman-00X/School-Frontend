import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import FilesActivityPage from "./pages/FilesActivityPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/files/activity", element: <RequirePermission permission="files.activity.read"><FilesActivityPage /></RequirePermission> }
];
