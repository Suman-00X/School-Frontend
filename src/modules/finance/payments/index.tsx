import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import { areaRoutes as settlementRoutes } from "../settlements";
import { PaymentsLayout } from "./components/PaymentsLayout";
import CounterPage from "./pages/CounterPage";
import PaymentsPage from "./pages/PaymentsPage";
import RefundsPage from "./pages/RefundsPage";

const read = (page: ReactNode) => <RequirePermission permission="finance.payments.read">{page}</RequirePermission>;

/* Collect (header tab), and the Payments area: payments, refunds and settlements in one side list.
   A payment or a refund opens as a drawer over its list, so its URL keeps the list. */
export const routes: RouteObject[] = [
  {
    path: "/finance/counter",
    element: (
      <RequirePermission permission="finance.payments.collect">
        <CounterPage />
      </RequirePermission>
    )
  },
  {
    element: <PaymentsLayout />,
    children: [
      { path: "/finance/payments", element: read(<PaymentsPage />) },
      { path: "/finance/payments/:paymentId", element: read(<PaymentsPage />) },
      { path: "/finance/refunds", element: read(<RefundsPage />) },
      { path: "/finance/refunds/:refundId", element: read(<RefundsPage />) },
      ...settlementRoutes
    ]
  }
];
