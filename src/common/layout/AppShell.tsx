import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, LogOut, Menu as MenuIcon, UserRound } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Avatar, Button, Menu, MenuItem, roleLabel } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { BRAND_ICON, NAVIGATION } from "@/app/navigation";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <Sidebar />
      <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />
      <div className="main">
        <Topbar onMenu={() => setNavOpen(o => !o)} />
        <YearBanner />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function useSchoolLogo() {
  const { can } = useAuth();
  /* Settings are readable by staff roles only; everyone else gets the name from sign-in */
  return useQuery({
    queryKey: ["/administration/settings"],
    enabled: can("administration.settings.read"),
    staleTime: 30 * 60_000,
    queryFn: async () => (await api.get<{ name: string; logoUrl: string | null }>("/administration/settings")).data
  });
}

function Sidebar() {
  const { session, canAny } = useAuth();
  const settings = useSchoolLogo();
  const Brand = BRAND_ICON;
  const groups = NAVIGATION.map(g => ({
    ...g,
    items: g.items.filter(i => !i.permissions || canAny(...i.permissions))
  })).filter(g => g.items.length > 0);

  return (
    <nav className="sidebar" aria-label="Main">
      <NavLink to="/" className="sidebar-brand">
        <span className="brand-mark">{settings.data?.logoUrl ? <img src={settings.data.logoUrl} alt="" /> : <Brand size={18} />}</span>
        <span style={{ minWidth: 0 }}>
          <div className="brand-name">{settings.data?.name ?? session?.school.name}</div>
          <div className="brand-code">{session?.school.code}</div>
        </span>
      </NavLink>
      {groups.map((g, i) => (
        <div className="nav-group" key={g.label ?? i}>
          {g.label && <div className="nav-group-label">{g.label}</div>}
          {g.items.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { me, session, signOut } = useAuth();
  const navigate = useNavigate();
  const name = fullName(me?.account ?? session?.user) || "Account";
  const role = me?.role ?? session?.user.role;

  return (
    <header className="topbar">
      <Button variant="ghost" icon={<MenuIcon />} className="menu-toggle" onClick={onMenu} aria-label="Open menu" />
      <div className="topbar-spacer" />
      <YearSwitcher />
      <Menu
        trigger={(toggle, open) => (
          <button className="user-button" onClick={toggle} aria-expanded={open} aria-haspopup="menu">
            <Avatar name={name} />
            <span className="user-text">
              <div className="user-name">{name}</div>
              <div className="user-role">{roleLabel(role)}</div>
            </span>
            <ChevronDown size={15} className="muted" />
          </button>
        )}
      >
        {close => (
          <>
            <div className="menu-header">{me?.account.email ?? session?.user.email}</div>
            <MenuItem
              icon={<UserRound />}
              onClick={() => {
                close();
                navigate("/me/account");
              }}
            >
              My account
            </MenuItem>
            <div className="menu-sep" />
            <MenuItem
              icon={<LogOut />}
              danger
              onClick={() => {
                close();
                void signOut();
              }}
            >
              Sign out
            </MenuItem>
          </>
        )}
      </Menu>
    </header>
  );
}

function YearSwitcher() {
  const { canSwitch, years, selected, select } = useAcademicYear();
  if (!canSwitch || years.length === 0) return null;
  return (
    <select
      className="select select-sm"
      style={{ width: "auto", minWidth: 150 }}
      aria-label="Academic year"
      value={selected?.id ?? ""}
      onChange={e => {
        const y = years.find(x => x.id === e.target.value);
        select(y && !y.isCurrent ? y.id : null);
      }}
    >
      {years.map(y => (
        <option key={y.id} value={y.id}>
          {y.yearName}
          {y.isCurrent ? " (current)" : y.archivedAt ? " (archived)" : ""}
        </option>
      ))}
    </select>
  );
}

function YearBanner() {
  const { selected, readOnly, canSwitch } = useAcademicYear();
  if (!canSwitch || !readOnly || !selected) return null;
  return (
    <div className="year-banner" role="status">
      <AlertTriangle />
      {selected.yearName} is archived and read-only.
    </div>
  );
}
