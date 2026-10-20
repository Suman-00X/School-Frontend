import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { BRAND_ICON } from "@/app/navigation";
import { Avatar, Button } from "@/common/ui";
import { platformKeys, systemAdminLogout } from "../api/schools";
import { useSystemAdmin } from "../shared/useSystemAdmin";
import "../platform.css";

/* The admin console's frame: its own header, no school navigation */
export function PlatformLayout() {
  const me = useSystemAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const Brand = BRAND_ICON;

  const signOut = async () => {
    try {
      await systemAdminLogout();
    } catch {
      /* the session may already be over: signing out here is what matters */
    }
    qc.removeQueries({ queryKey: platformKeys.all });
    qc.setQueryData(platformKeys.me, null);
    navigate("/adminConsole/sign-in", { replace: true });
  };

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <NavLink to="/adminConsole" end className="platform-brand">
          <span className="brand-mark">
            <Brand size={18} />
          </span>
          <span>
            Admin console
            <span className="platform-brand-sub">Platform</span>
          </span>
        </NavLink>
        <nav className="platform-nav" aria-label="Admin console">
          <NavLink to="/adminConsole" end>
            Tenants
          </NavLink>
          <NavLink to="/adminConsole/tenants/new">Onboard a school</NavLink>
        </nav>
        {me.data && (
          <div className="platform-user">
            <Avatar name={me.data.name} />
            <span className="platform-user-text">
              <span>{me.data.name}</span>
              <span className="platform-user-email">System admin · {me.data.email}</span>
            </span>
            <Button variant="ghost" size="sm" icon={<LogOut size={15} />} onClick={() => void signOut()} aria-label="Sign out" title="Sign out" />
          </div>
        )}
      </header>
      <main className="platform-main">
        <Outlet />
      </main>
    </div>
  );
}
