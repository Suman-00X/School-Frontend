import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";

/* Finance › Invoices (header tab); an invoice is a drill-in page */
export const routes: RouteObject[] = [
  { path: "/finance/invoices", element: <RequirePermission permission="finance.invoices.read"><InvoicesPage /></RequirePermission> },
  { path: "/finance/invoices/:invoiceId", element: <RequirePermission permission="finance.invoices.read"><InvoiceDetailPage /></RequirePermission> }
];
