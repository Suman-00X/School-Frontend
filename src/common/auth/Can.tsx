import type { ReactNode } from "react";
import { useAuth } from "./useAuth";

/* Renders children only when the person holds one of the permissions */
export function Can({ permission, children, fallback = null }: { permission: string | string[]; children: ReactNode; fallback?: ReactNode }) {
  const { canAny } = useAuth();
  const keys = Array.isArray(permission) ? permission : [permission];
  return <>{canAny(...keys) ? children : fallback}</>;
}
