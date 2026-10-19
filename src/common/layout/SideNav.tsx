import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown } from "lucide-react";

/* A left list of sections inside the content area (for areas with more sections than fit
   in the header), grouped and collapsible:
   <SideNavLayout groups={[{ label: "Customization", items: [{ label: "Cases status", to: "…" }] }]}>…</SideNavLayout>
   A group without a label is a plain list. Items can also be buttons (onClick + active). */

export type SideNavItem = { label: string; to?: string; onClick?: () => void; active?: boolean; hidden?: boolean; end?: boolean };
export type SideNavGroup = { label?: string; items: SideNavItem[] };

export function SideNavLayout({ groups, children }: { groups: SideNavGroup[]; children: ReactNode }) {
  return (
    <div className="sidenav-layout">
      <SideNav groups={groups} />
      <div className="sidenav-content">{children}</div>
    </div>
  );
}

export function SideNav({ groups }: { groups: SideNavGroup[] }) {
  const visible = groups.map(g => ({ ...g, items: g.items.filter(i => !i.hidden) })).filter(g => g.items.length);
  return (
    <nav className="sidenav" aria-label="Sections">
      {visible.map((g, i) => (
        <Group key={g.label ?? i} group={g} />
      ))}
    </nav>
  );
}

function Group({ group }: { group: SideNavGroup }) {
  const [open, setOpen] = useState(true);
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
  if (!group.label) return <div className="sidenav-group">{items}</div>;
  return (
    <div className="sidenav-group">
      <button type="button" className="sidenav-group-label" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <ChevronDown className={open ? "" : "collapsed"} />
        {group.label}
      </button>
      {open && <div className="sidenav-group-items">{items}</div>}
    </div>
  );
}
