import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import CertificatesPage from "./pages/CertificatesPage";

/* Inside the portal layout */
export const childRoutes: RouteObject[] = [
  { path: "certificates", element: <RequirePermission permission="portal.certificates.read"><CertificatesPage /></RequirePermission> }
];
