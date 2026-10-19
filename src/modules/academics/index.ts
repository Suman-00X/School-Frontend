import type { RouteObject } from "react-router-dom";
import { routes as academicYearRoutes } from "./academic-years";
import { routes as classRoutes } from "./classes";

/* Only the setup pages that admission needs; the rest of Academics comes later */
export const routes: RouteObject[] = [...academicYearRoutes, ...classRoutes];
