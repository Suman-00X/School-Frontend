import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CaseSensitive, Ellipsis, LogOut, Menu as MenuIcon, Moon, Plus, Sun, UserRound } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useTextSize, useTheme } from "@/common/theme/preferences";
import { Avatar, Badge, Button, Menu, MenuItem, roleLabel, Select } from "@/common/ui";
import { fullName } from "@/common/utils/format";
import { activeLocation, BRAND_ICON, MODULES, QUICK_ACTIONS, tabTarget, type NavModule } from "@/app/navigation";
import { NotificationBell } from "@/modules/communication";
import { ShellHeaderContext, useShellHeaderSlot } from "./ShellHeader";

/* Left: one icon per module. Top: the module's submodule tabs (or a page's drill-in header).
   Right: a thin panel of shortcuts. Every region has a fixed size, so nothing moves the content. */

export function AppShell() {
  const { canAny } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [location.pathname]);
  const { slot, setNode, drilled } = useShellHeaderSlot();

  const modules = MODULES.map(m => ({ ...m, tabs: m.tabs.filter(t => !t.permissions || canAny(...t.permissions)) })).filter(
    m => m.tabs.length > 0
  );
  const active = activeLocation(location.pathname, modules);

  return (
    <ShellHeaderContext.Provider value={slot}>
      <div className={`shell${navOpen ? " nav-open" : ""}`}>
        <Rail modules={modules} activeId={active?.module.id} />
        <div className="rail-backdrop" onClick={() => setNavOpen(false)} />
        <header className="header">
          <Button variant="ghost" icon={<MenuIcon />} className="header-menu" onClick={() => setNavOpen(o => !o)} aria-label="Open menu" />
          <div className="header-main" ref={setNode}>
            {!drilled && active && <ModuleTabs module={active.module} />}
          </div>
          <div className="header-end">
            <YearSwitcher />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <ShortcutPanel />
      </div>
    </ShellHeaderContext.Provider>
  );
}

function useSchoolBrand() {
  const { can, session } = useAuth();
  /* Settings are readable by staff roles only; everyone else gets the name from sign-in */
  const settings = useQuery({
    queryKey: ["/administration/settings"],
    enabled: can("administration.settings.read"),
    staleTime: 30 * 60_000,
    queryFn: async () => (await api.get<{ name: string; logoUrl: string | null }>("/administration/settings")).data
  });
  return { name: settings.data?.name ?? session?.school.name ?? "", code: session?.school.code ?? "", logoUrl: settings.data?.logoUrl ?? null };
}

/* Module tiles take at most this share of the rail's height; the rest go under "More" */
const RAIL_SHARE = 0.7;

function Rail({ modules, activeId }: { modules: NavModule[]; activeId?: string }) {
  const brand = useSchoolBrand();
  const { can } = useAuth();
  const Brand = BRAND_ICON;
  const railRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(modules.length);

  /* How many tiles fit: measured from a rendered tile, so the larger text size is counted too */
  useLayoutEffect(() => {
    const rail = railRef.current;
    const items = itemsRef.current;
    if (!rail || !items) return;
    const measure = () => {
      const tile = items.querySelector<HTMLElement>(".rail-item");
      if (!tile) return;
      const gap = parseFloat(getComputedStyle(items).rowGap) || 0;
      const step = tile.offsetHeight + gap;
      setFit(Math.max(1, Math.floor((rail.clientHeight * RAIL_SHARE + gap) / step)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    observer.observe(items);
    return () => observer.disconnect();
  }, []);

  const overflowing = modules.length > fit;
  const shown = overflowing ? modules.slice(0, fit - 1) : modules;
  const rest = overflowing ? modules.slice(fit - 1) : [];

  return (
    <nav className="rail" aria-label="Modules" ref={railRef}>
      <NavLink to="/" className="rail-brand" title={`${brand.name} (${brand.code})`}>
        {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : <Brand size={20} />}
      </NavLink>
      <div className="rail-items" ref={itemsRef}>
        {shown.map(m => (
          <NavLink key={m.id} to={tabTarget(m.tabs[0]!, can)} className={() => `rail-item${m.id === activeId ? " active" : ""}`} aria-current={m.id === activeId ? "page" : undefined}>
            <span className="rail-icon">
              <m.icon />
            </span>
            <span className="rail-label">{m.label}</span>
          </NavLink>
        ))}
        {rest.length > 0 && <RailMore modules={rest} activeId={activeId} />}
      </div>
    </nav>
  );
}

/* The modules that don't fit in the rail, in a panel beside it */
function RailMore({ modules, activeId }: { modules: NavModule[]; activeId?: string }) {
  const { can } = useAuth();
  const location = useLocation();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const holdsActive = modules.some(m => m.id === activeId);

  useEffect(() => setAnchor(null), [location.pathname]);
  useEffect(() => {
    if (!anchor) return;
    const onDoc = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setAnchor(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAnchor(null);
    const onResize = () => setAnchor(null);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [anchor]);

  return (
    <div className="rail-more" ref={wrapRef}>
      <button
        type="button"
        className={`rail-item${holdsActive || anchor ? " active" : ""}`}
        aria-expanded={!!anchor}
        aria-haspopup="menu"
        onClick={e => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
      >
        <span className="rail-icon">
          <Ellipsis />
        </span>
        <span className="rail-label">More</span>
      </button>
      {anchor && (
        /* Fixed, so the rail's scroll box doesn't clip it; it grows upward from the button's bottom edge */
        <div className="rail-more-panel" role="menu" style={{ left: anchor.right + 8, bottom: Math.max(8, window.innerHeight - anchor.bottom) }}>
          {modules.map(m => (
            <NavLink
              key={m.id}
              role="menuitem"
              to={tabTarget(m.tabs[0]!, can)}
              className={() => `rail-more-item${m.id === activeId ? " active" : ""}`}
              aria-current={m.id === activeId ? "page" : undefined}
              onClick={() => setAnchor(null)}
            >
              <m.icon />
              {m.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleTabs({ module }: { module: NavModule }) {
  const location = useLocation();
  const { can } = useAuth();
  const active = activeLocation(location.pathname, [module]);
  return (
    <nav className="header-tabs" aria-label={module.label}>
      {module.tabs.map(t => (
        <NavLink key={t.to} to={tabTarget(t, can)} className={() => `header-tab${active?.tab.to === t.to ? " active" : ""}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

function YearSwitcher() {
  const { canSwitch, years, selected, select, readOnly } = useAcademicYear();
  if (!canSwitch || years.length === 0) return null;
  return (
    <div className="year-switch">
      <Select
        className="select-sm"
        aria-label="Academic year"
        value={selected?.id ?? ""}
        options={years.map(y => ({ value: y.id, label: y.yearName + (y.isCurrent ? " (current)" : y.archivedAt ? " (archived)" : "") }))}
        onChange={e => {
          const y = years.find(x => x.id === e.target.value);
          select(y && !y.isCurrent ? y.id : null);
        }}
      />
      {/* Always rendered so switching years never moves the header */}
      <span className="year-flag" aria-live="polite">
        {readOnly && <Badge tone="warning">Read-only</Badge>}
      </span>
    </div>
  );
}

function UserMenu() {
  const { me, session, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const name = fullName(me?.account ?? session?.user) || "Account";
  return (
    <Menu
      trigger={(toggleMenu, open) => (
        <button className="avatar-button" onClick={toggleMenu} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" title={name}>
          <Avatar name={name} />
        </button>
      )}
    >
      {close => (
        <>
          <div className="menu-header">
            <div style={{ color: "var(--text)", fontWeight: 600 }}>{name}</div>
            <div>{roleLabel(me?.role ?? session?.user.role)}</div>
            <div>{me?.account.email ?? session?.user.email}</div>
          </div>
          <div className="menu-sep" />
          <MenuItem
            icon={<UserRound />}
            onClick={() => {
              close();
              navigate("/me/account");
            }}
          >
            My account
          </MenuItem>
          {/* The shortcut panel is hidden on phones; its theme switch lives here too */}
          <MenuItem icon={theme === "dark" ? <Sun /> : <Moon />} onClick={toggle}>
            {theme === "dark" ? "Day mode" : "Night mode"}
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
  );
}

function ShortcutPanel() {
  const { canAny } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const { size, toggle: toggleSize } = useTextSize();
  const actions = QUICK_ACTIONS.filter(a => canAny(...a.permissions));
  return (
    <aside className="shortcuts" aria-label="Shortcuts">
      <div className="shortcuts-group">
        {actions.length > 0 && (
          <Menu
            align="side"
            trigger={(toggle, open) => (
              <button className="shortcut shortcut-primary" onClick={toggle} aria-expanded={open} aria-label="Quick add" title="Quick add">
                <Plus />
              </button>
            )}
          >
            {close => (
              <>
                <div className="menu-header">Quick add</div>
                {actions.map(a => (
                  <MenuItem
                    key={a.to}
                    icon={<a.icon />}
                    onClick={() => {
                      close();
                      navigate(a.to);
                    }}
                  >
                    {a.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        )}
        <button className="shortcut" onClick={() => navigate("/me/account")} aria-label="My account" title="My account">
          <UserRound />
        </button>
      </div>
      <div className="shortcuts-group">
        <button
          className={`shortcut${size === "large" ? " on" : ""}`}
          onClick={toggleSize}
          aria-pressed={size === "large"}
          aria-label="Larger text"
          title={size === "large" ? "Normal text size" : "Larger text"}
        >
          <CaseSensitive />
        </button>
        <button className="shortcut" onClick={toggleTheme} aria-label={theme === "dark" ? "Day mode" : "Night mode"} title={theme === "dark" ? "Day mode" : "Night mode"}>
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>
      </div>
    </aside>
  );
}
