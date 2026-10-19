import type { RouteObject } from "react-router-dom";
import { routes as hostelRoutes } from "./hostels";
import { routes as allocationRoutes } from "./allocations";
import { routes as resourceRoutes } from "./resources";
import { routes as resourceAssignmentRoutes } from "./resource-assignments";
import { routes as activityRoutes } from "./activity";

/* Routes of the hostel module: HO-01 to HO-04 and its activity tab (MA-01). Rooms live inside a hostel's page. */
export const routes: RouteObject[] = [...hostelRoutes, ...allocationRoutes, ...resourceRoutes, ...resourceAssignmentRoutes, ...activityRoutes];
