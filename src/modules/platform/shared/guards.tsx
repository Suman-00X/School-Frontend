import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ErrorState, PageLoader } from "@/common/ui";
import { useSystemAdmin } from "./useSystemAdmin";

/* The console's pages: a system admin's session cookie only (a school session does not count) */
export function RequireSystemAdmin() {
  const me = useSystemAdmin();
  const location = useLocation();
  if (me.isPending) return <PageLoader label="Opening the admin console…" />;
  if (me.error)
    return (
      <div className="page-loader full">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  if (!me.data) return <Navigate to="/adminConsole/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
