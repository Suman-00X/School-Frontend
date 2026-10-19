import type { RouteObject } from "react-router-dom";
import { listRoutes as accountLists, routes as accountRoutes } from "./accounts";
import { listRoutes as studentLists, routes as studentRoutes } from "./students";
import { listRoutes as parentLists, routes as parentRoutes } from "./parents";
import { listRoutes as teacherLists, routes as teacherRoutes } from "./teachers";
import { listRoutes as staffLists, routes as staffRoutes } from "./staff";
import { listRoutes as activityLists } from "./activity";

/* The lists of User Management (Admin › User Management), shown with its side list */
export const listRoutes: RouteObject[] = [...accountLists, ...studentLists, ...parentLists, ...teacherLists, ...staffLists, ...activityLists];
/* Record and create pages */
export const routes: RouteObject[] = [...studentRoutes, ...parentRoutes, ...teacherRoutes, ...staffRoutes, ...accountRoutes];

export { UserManagementLayout } from "./shared/components/UserManagementLayout";
