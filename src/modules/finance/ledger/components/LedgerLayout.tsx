import { Outlet } from "react-router-dom";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import "../../shared/operations.css";

/* Finance › Ledger: the double-entry books (FI-13), one side list */
export function LedgerLayout() {
  return (
    <Page>
      <SideNavLayout
        groups={[
          {
            label: "Books",
            items: [
              { label: "Accounts", to: OPS_PATHS.accounts },
              { label: "Journal entries", to: OPS_PATHS.journal }
            ]
          },
          {
            label: "Reports",
            items: [
              { label: "Trial balance", to: OPS_PATHS.trialBalance },
              { label: "Income summary", to: OPS_PATHS.incomeSummary }
            ]
          }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
