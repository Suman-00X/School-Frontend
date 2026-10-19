import type { RouteObject } from "react-router-dom";
import { routes as activityRoutes } from "./activity";
import { routes as leaveRoutes } from "./leaves";
import { routes as payrollRoutes } from "./payroll";
import { routes as staffAttendanceRoutes } from "./staff-attendance";

/* Routes of the hr module (its submodules add theirs here) */
export const routes: RouteObject[] = [...staffAttendanceRoutes, ...leaveRoutes, ...payrollRoutes, ...activityRoutes];
