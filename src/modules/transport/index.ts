import type { RouteObject } from "react-router-dom";
import { routes as vehicleRoutes } from "./vehicles";
import { routes as routeRoutes } from "./routes";
import { routes as assignmentRoutes } from "./assignments";
import { routes as rosterRoutes } from "./roster";
import { routes as activityRoutes } from "./activity";

/* Routes of the transport module: TR-01 to TR-04 and its activity tab (MA-01) */
export const routes: RouteObject[] = [...vehicleRoutes, ...routeRoutes, ...assignmentRoutes, ...rosterRoutes, ...activityRoutes];
