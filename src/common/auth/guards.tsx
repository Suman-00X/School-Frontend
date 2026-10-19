import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "@/common/ui/Spinner";
import { ErrorState, NoAccess } from "@/common/ui/ErrorState";
import { useAuth } from "./useAuth";

/* Signed-in area: sends everyone else to sign-in, remembering where they were going */
export function RequireAuth() {
  const { status, bootError, retryBoot } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoader label="Loading your school…" />;
  if (status === "error")
    return (
      <div className="page-loader full">
        <ErrorState error={bootError} onRetry={retryBoot} />
      </div>
    );
  if (status === "signedOut")
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/* Public pages (sign-in, password links): a signed-in person goes home */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <PageLoader />;
  if (status === "ready" || status === "error") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/* A page that needs one of these permissions (normally its read key) */
export function RequirePermission({ permission, children }: { permission: string | string[]; children: ReactNode }) {
  const { canAny } = useAuth();
  const keys = Array.isArray(permission) ? permission : [permission];
  if (!canAny(...keys)) return <NoAccess />;
  return <>{children}</>;
}
