import { useEffect, useRef, useState, type ReactNode } from "react";

/* A small dropdown: <Menu trigger={(open) => <Button …/>}>{close => …items}</Menu> */
export function Menu({
  trigger,
  children,
  align = "right"
}: {
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  /* right: below, right edges aligned; left: below, left edges aligned; side: to the left of the trigger */
  align?: "left" | "right" | "side";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(() => setOpen(o => !o), open)}
      {open && (
        <div className={`menu${align === "left" ? " menu-left" : align === "side" ? " menu-side" : ""}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  disabled
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="menuitem" className={`menu-item${danger ? " danger" : ""}`} onClick={onClick} disabled={disabled}>
      {icon}
      {children}
    </button>
  );
}
