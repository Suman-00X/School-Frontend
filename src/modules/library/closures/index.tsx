import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import { SETUP_READERS } from "../policy";
import ClosuresPage from "./pages/ClosuresPage";

/* LB-02; inside Library › Setup */
export const setupRoutes: RouteObject[] = [
  { path: "/library/closures", element: <RequirePermission permission={SETUP_READERS}><ClosuresPage /></RequirePermission> }
];
