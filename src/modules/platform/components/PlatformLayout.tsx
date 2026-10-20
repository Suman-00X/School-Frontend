import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { BRAND_ICON } from "@/app/navigation";
import { Avatar, Button } from "@/common/ui";
import { operatorSession } from "../api/session";
import { useOperator } from "../shared/useOperator";
import "../platform.css";

/* The onboarding portal's frame: its own header, no school navigation */
export function PlatformLayout() {
  const session = useOperator();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const Brand = BRAND_ICON;

  const signOut = () => {
    operatorSession.clear();
    qc.removeQueries({ queryKey: ["platform"] });
    navigate("/platform/sign-in", { replace: true });
  };

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <NavLink to="/platform" end className="platform-brand">
          <span className="brand-mark">
            <Brand size={18} />
          </span>
          <span>
            School onboarding
            <span className="platform-brand-sub">Platform</span>
          </span>
        </NavLink>
        <nav className="platform-nav" aria-label="Portal">
          <NavLink to="/platform" end>
            Schools
          </NavLink>
          <NavLink to="/platform/schools/new">Onboard a school</NavLink>
        </nav>
        {session && (
          <div className="platform-user">
            <Avatar name={session.operator.name} />
            <span className="platform-user-text">
              <span>{session.operator.name}</span>
              <span className="platform-user-email">{session.operator.email}</span>
            </span>
            <Button variant="ghost" size="sm" icon={<LogOut size={15} />} onClick={signOut} aria-label="Sign out" title="Sign out" />
          </div>
        )}
      </header>
      <main className="platform-main">
        <Outlet />
      </main>
    </div>
  );
}
