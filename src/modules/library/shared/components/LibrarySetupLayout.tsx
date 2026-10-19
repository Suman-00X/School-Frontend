import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";

/* Library › Setup: lending terms, closed days and the module's activity log in one side list */
export function LibrarySetupLayout() {
  const { can } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          {
            label: "Lending",
            items: [
              { label: "Policy", to: "/library/policy" },
              { label: "Circulation rules", to: "/library/circulation-rules" },
              { label: "Closures", to: "/library/closures" }
            ]
          },
          { items: [{ label: "Activity", to: "/library/activity", hidden: !can("library.activity.read") }] }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
