import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AcademicYearsPage from "./pages/AcademicYearsPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/academics/academic-years", element: <RequirePermission permission="academics.academicYears.read"><AcademicYearsPage /></RequirePermission> }
];
