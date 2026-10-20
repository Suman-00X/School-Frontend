import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "@/common/ui/Spinner";
import { ErrorState, NoAccess, NotFound } from "@/common/ui/ErrorState";
import { Page } from "@/common/ui/PageHeader";
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

/* A module's pages: only when the module is switched on for the school; otherwise the pages
   do not exist (the navigation never links to them either) */
export function RequireModule({ module }: { module: string }) {
  const { moduleOn } = useAuth();
  if (!moduleOn(module))
    return (
      <Page>
        <NotFound message="This page does not exist." />
      </Page>
    );
  return <Outlet />;
}
