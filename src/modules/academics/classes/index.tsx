import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ClassesPage from "./pages/ClassesPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/academics/classes", element: <RequirePermission permission="academics.classes.read"><ClassesPage /></RequirePermission> }
];
