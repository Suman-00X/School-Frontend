import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import FinanceSettingsPage from "./pages/FinanceSettingsPage";

/* Inside Finance › Setup (side list) */
export const routes: RouteObject[] = [
  {
    path: "/finance/settings",
    element: (
      <RequirePermission permission={["finance.settings.read", "finance.paymentSettings.read"]}>
        <FinanceSettingsPage />
      </RequirePermission>
    )
  }
];
