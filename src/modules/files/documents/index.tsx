import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import DocumentsPage from "./pages/DocumentsPage";

/* Routes inside the signed-in app shell (tabs by owner: ?ownerType=STUDENT|STAFF|GENERAL) */
export const routes: RouteObject[] = [
  { path: "/files", element: <RequirePermission permission="files.documents.read"><DocumentsPage /></RequirePermission> }
];
