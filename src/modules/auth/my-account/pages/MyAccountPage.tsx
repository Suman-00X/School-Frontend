import { useAuth } from "@/common/auth";
import { Page, PageHeader } from "@/common/ui";
import { DevicesCard } from "../components/DevicesCard";
import { PasswordCard } from "../components/PasswordCard";
import { ProfileCard } from "../components/ProfileCard";

/* SH-07 */
export default function MyAccountPage() {
  const { can } = useAuth();
  const canChangePassword = can("auth.credentials.changeOwn");
  return (
    <Page>
      <PageHeader title="My account" subtitle="Your profile, password and signed-in devices." />
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
