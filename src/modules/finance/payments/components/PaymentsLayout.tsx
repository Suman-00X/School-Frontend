import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { OPS_PATHS } from "../../shared/utils/opsPaths";

/* Finance › Payments: money in (payments), money back (refunds) and gateway payouts (settlements) */
export function PaymentsLayout() {
  const { can } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          {
            items: [
              { label: "Payments", to: OPS_PATHS.payments, hidden: !can("finance.payments.read") },
              { label: "Refunds", to: OPS_PATHS.refunds, hidden: !can("finance.payments.read") },
              { label: "Gateway settlements", to: OPS_PATHS.settlements, hidden: !can("finance.settlements.read") }
            ]
          }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
