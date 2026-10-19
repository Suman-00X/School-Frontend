import type { RouteObject } from "react-router-dom";
import { setupRoutes as policyRoutes } from "./policy";
import { setupRoutes as ruleRoutes } from "./circulation-rules";
import { setupRoutes as closureRoutes } from "./closures";
import { setupRoutes as activityRoutes } from "./activity";
import { routes as bookRoutes } from "./books";
import { routes as loanRoutes } from "./loans";
import { routes as holdRoutes } from "./holds";
import { routes as stockCheckRoutes } from "./stock-checks";
import { routes as reportRoutes } from "./reports";
import { setupArea } from "./shared/routes";

/* Routes of the library module (LB-01 to LB-08 and its activity tab) */
export const routes: RouteObject[] = [
  ...loanRoutes,
  ...holdRoutes,
  ...bookRoutes,
  ...stockCheckRoutes,
  ...reportRoutes,
  setupArea([...policyRoutes, ...ruleRoutes, ...closureRoutes, ...activityRoutes])
];
