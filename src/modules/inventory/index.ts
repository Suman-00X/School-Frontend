import type { RouteObject } from "react-router-dom";
import { routes as activityRoutes } from "./activity";
import { routes as categoryRoutes } from "./categories";
import { routes as itemRoutes } from "./items";
import { routes as reportRoutes } from "./reports";
import { routes as stockRoutes } from "./stock";
import { routes as vendorRoutes } from "./vendors";

/* Routes of the inventory module (its submodules add theirs here) */
export const routes: RouteObject[] = [...itemRoutes, ...stockRoutes, ...reportRoutes, ...vendorRoutes, ...categoryRoutes, ...activityRoutes];
