import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ClassesPage from "./pages/ClassesPage";
import RollNumbersPage from "./pages/RollNumbersPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/academics/classes", element: <RequirePermission permission="academics.classes.read"><ClassesPage /></RequirePermission> },
  /* Listed under Calendar & rules in the Setup side list */
  { path: "/academics/roll-numbers", element: <RequirePermission permission="academics.enrollments.readPolicy"><RollNumbersPage /></RequirePermission> }
];
