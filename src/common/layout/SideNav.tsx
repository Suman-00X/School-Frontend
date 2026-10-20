import { useState, type ReactNode } from "react";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

/* A left list of sections inside the content area (for areas with more sections than fit
   in the header), grouped and collapsible:
   <SideNavLayout groups={[{ label: "Customization", items: [{ label: "Cases status", to: "…" }] }]}>…</SideNavLayout>
   A group without a label is a plain list. Items can also be buttons (onClick + active).
   A group with collapsed starts closed, unless it holds the page being shown. A group with `to`
   and no items is a page of its own, shown as a heading: { label: "Curriculum", to: "…", items: [] }. */

export type SideNavItem = { label: string; to?: string; onClick?: () => void; active?: boolean; hidden?: boolean; end?: boolean };
export type SideNavGroup = { label?: string; collapsed?: boolean; items: SideNavItem[]; to?: string; end?: boolean; hidden?: boolean };

export function SideNavLayout({ groups, children }: { groups: SideNavGroup[]; children: ReactNode }) {
  return (
    <div className="sidenav-layout">
      <SideNav groups={groups} />
      <div className="sidenav-content">{children}</div>
    </div>
  );
}

export function SideNav({ groups }: { groups: SideNavGroup[] }) {
  const visible = groups.map(g => ({ ...g, items: g.items.filter(i => !i.hidden) })).filter(g => (g.to ? !g.hidden : g.items.length));
  return (
    <nav className="sidenav" aria-label="Sections">
      {visible.map((g, i) => (
        <Group key={g.label ?? i} group={g} />
      ))}
    </nav>
  );
}

function Group({ group }: { group: SideNavGroup }) {
  const { pathname } = useLocation();
  /* undefined: the default (closed if collapsed, but open while one of its items is the page) */
  const [toggled, setToggled] = useState<boolean | undefined>(undefined);
  /* A heading that is a page: no chevron, but a space for one so its name lines up with the others */
  if (group.to)
    return (
      <div className="sidenav-group">
        <NavLink to={group.to} end={group.end} className={({ isActive }) => `sidenav-group-label sidenav-group-link${isActive ? " active" : ""}`}>
          <span className="sidenav-group-icon" aria-hidden />
          {group.label}
        </NavLink>
      </div>
    );
  const holdsPage = group.items.some(i => (i.to ? !!matchPath({ path: i.to, end: !!i.end }, pathname) : i.active));
  const open = toggled ?? (!group.collapsed || holdsPage);
  const items = group.items.map(item =>
    item.to ? (
      <NavLink key={item.label} to={item.to} end={item.end} className={({ isActive }) => `sidenav-item${isActive ? " active" : ""}`}>
        {item.label}
      </NavLink>
    ) : (
      <button key={item.label} type="button" className={`sidenav-item${item.active ? " active" : ""}`} onClick={item.onClick}>
        {item.label}
      </button>
    )
  );
  /* No heading: indented like a heading's items, so every side list lines up */
  if (!group.label) return <div className="sidenav-group sidenav-group-plain">{items}</div>;
  return (
    <div className="sidenav-group">
      <button type="button" className="sidenav-group-label" aria-expanded={open} onClick={() => setToggled(!open)}>
        <ChevronDown className={open ? "" : "collapsed"} />
        {group.label}
      </button>
      {/* Kept in the DOM: on narrow screens the groups become one row and are never closed */}
      <div className={`sidenav-group-items${open ? "" : " is-closed"}`}>{items}</div>
    </div>
  );
}
