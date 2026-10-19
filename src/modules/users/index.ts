import type { RouteObject } from "react-router-dom";
import { routes as accountRoutes } from "./accounts";
import { routes as studentRoutes } from "./students";
import { routes as parentRoutes } from "./parents";
import { routes as teacherRoutes } from "./teachers";
import { routes as staffRoutes } from "./staff";
import { routes as activityRoutes } from "./activity";

export const routes: RouteObject[] = [...studentRoutes, ...parentRoutes, ...teacherRoutes, ...staffRoutes, ...accountRoutes, ...activityRoutes];
