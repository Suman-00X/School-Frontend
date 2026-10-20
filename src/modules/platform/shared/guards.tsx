import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOperator } from "./useOperator";

/* The portal's pages: operators only (a school session does not count) */
export function RequireOperator() {
  const session = useOperator();
  const location = useLocation();
  if (!session) return <Navigate to="/platform/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
