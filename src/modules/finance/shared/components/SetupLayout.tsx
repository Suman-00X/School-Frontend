import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { SETUP_PATHS as P } from "../utils/paths";

/* Finance › Setup: what the school charges and how (FI-01 to FI-06), one side list.
   A fee structure opens full width with its own drill-in header. */
export function SetupLayout() {
  const { can } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          {
            label: "Fees",
            items: [
              { label: "Fee heads", to: P.feeHeads, hidden: !can("finance.feeHeads.read") },
              { label: "Fee structures", to: P.feeStructures, hidden: !can("finance.feeStructures.read") },
              { label: "Installment plans", to: P.installmentPlans, hidden: !can("finance.installmentPlans.read") },
              { label: "Student plans", to: P.planAssignments, hidden: !can("finance.installmentPlans.read") },
              { label: "Late-fee rules", to: P.lateFeeRules, hidden: !can("finance.lateFeeRules.read") }
            ]
          },
          {
            label: "Discounts",
            items: [
              { label: "Concessions", to: P.concessions, hidden: !can("finance.concessions.read") },
              { label: "Concession grants", to: P.concessionGrants, hidden: !can("finance.concessions.read") }
            ]
          },
          { items: [{ label: "Settings", to: P.settings, hidden: !can("finance.settings.read") && !can("finance.paymentSettings.read") }] }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
