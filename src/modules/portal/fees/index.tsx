import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import FeesPage from "./pages/FeesPage";
import InvoicePage from "./pages/InvoicePage";

/* Inside the portal layout */
export const childRoutes: RouteObject[] = [
  { path: "fees", element: <RequirePermission permission="portal.fees.read"><FeesPage /></RequirePermission> }
];

/* One invoice: full width, with a drill-in header */
export const routes: RouteObject[] = [
  { path: "/me/students/:studentId/fees/invoices/:invoiceId", element: <RequirePermission permission="portal.fees.read"><InvoicePage /></RequirePermission> }
];
