import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { ASSIGNMENTS_PATH, HANDOVER_PATH, OWNERS_PATH, ROLES_PATH } from "../utils/paths";
import "../access.css";

/* Access control: operator roles, who holds them, module owners and handovers */
export function AccessLayout() {
  const { can } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          { items: [{ label: "Operator roles", to: ROLES_PATH }] },
          {
            label: "Assignments",
            items: [
              { label: "Operators", to: ASSIGNMENTS_PATH, end: true },
              { label: "Owners", to: OWNERS_PATH, hidden: !can("administration.access.manageOwners") }
            ]
          },
          { items: [{ label: "Hand over work", to: HANDOVER_PATH, hidden: !can("administration.access.handOver") }] }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
