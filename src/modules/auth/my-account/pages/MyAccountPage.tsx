import { useAuth } from "@/common/auth";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Page } from "@/common/ui";
import { DevicesCard } from "../components/DevicesCard";
import { PasswordCard } from "../components/PasswordCard";
import { ProfileCard } from "../components/ProfileCard";

/* SH-07. Reached from the account menu and the shortcut panel, so a drill-in page (back home)
   rather than a tab of a module; the header names it, so no page title. */
export default function MyAccountPage() {
  const { can } = useAuth();
  const canChangePassword = can("auth.credentials.changeOwn");
  return (
    <Page>
      <DrillHeader back="/" backLabel="Back to home" title="My account" />
      <div className="stack">
        <div className={canChangePassword ? "grid-2" : undefined} style={{ alignItems: "start" }}>
          <ProfileCard />
          {canChangePassword && <PasswordCard />}
        </div>
        {can("auth.sessions.manageOwn") && <DevicesCard />}
      </div>
    </Page>
  );
}
