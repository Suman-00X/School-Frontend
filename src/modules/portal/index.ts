import { createElement } from "react";
import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import { PortalLayout, routes as sharedRoutes } from "./shared";
import { childRoutes as learningChildren, routes as learningRoutes } from "./learning";
import { childRoutes as homeworkChildren, routes as homeworkRoutes } from "./homework";
import { childRoutes as feesChildren, routes as feesRoutes } from "./fees";
import { childRoutes as transportHostelChildren } from "./transport-hostel";
import { routes as libraryRoutes } from "./library";
import { routes as hrRoutes } from "./hr";

/* My school: a child's pages share the portal layout (child switcher + side list);
   records (a homework, an invoice) open full width; then everyone's self-service pages */
export const routes: RouteObject[] = [
  ...sharedRoutes,
  {
    path: "/me/students/:studentId",
    element: createElement(RequirePermission, { permission: "portal.learning.students", children: createElement(PortalLayout) }),
    children: [...learningChildren, ...homeworkChildren, ...feesChildren, ...transportHostelChildren]
  },
  ...homeworkRoutes,
  ...feesRoutes,
  ...learningRoutes,
  ...libraryRoutes,
  ...hrRoutes
];
