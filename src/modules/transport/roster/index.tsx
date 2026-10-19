import type { RouteObject } from "react-router-dom";
import { Navigate, useParams } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import RosterPage from "./pages/RosterPage";

/* The spec's path for one route's roster opens the roster page on that route */
function RouteRosterRedirect() {
  const { routeId = "" } = useParams();
  return <Navigate to={`/transport/rosters?routeId=${routeId}`} replace />;
}

export const routes: RouteObject[] = [
  { path: "/transport/rosters", element: <RequirePermission permission="transport.roster.read"><RosterPage /></RequirePermission> },
  { path: "/transport/routes/:routeId/roster", element: <RouteRosterRedirect /> }
];
