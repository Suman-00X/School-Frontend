import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  const [place, setPlace] = useState<CSSProperties>();
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => !ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node);
    const onDoc = (e: MouseEvent) => outside(e) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    /* Placed against the viewport, so it would drift: close instead */
    const onMove = (e: Event) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);
  /* In <body>, fixed to the viewport, so a table's scroll box, a card or a dialog doesn't clip or
     move it; above the trigger when there is no room below */
  useLayoutEffect(() => {
    if (!open || !ref.current || !menuRef.current) return setPlace(undefined);
    const t = ref.current.getBoundingClientRect();
    const height = menuRef.current.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (align === "side") {
      setPlace({ position: "fixed", top: Math.max(8, Math.min(t.top, vh - height - 8)), right: vw - t.left + 8, left: "auto", bottom: "auto" });
      return;
    }
    const top = t.bottom + 4 + height > vh - 8 && t.top - 4 - height >= 8 ? t.top - 4 - height : t.bottom + 4;
    setPlace({ position: "fixed", top, bottom: "auto", ...(align === "left" ? { left: t.left, right: "auto" } : { right: vw - t.right, left: "auto" }) });
  }, [open, align]);
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger(() => setOpen(o => !o), open)}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`menu${align === "left" ? " menu-left" : align === "side" ? " menu-side" : ""}`}
            role="menu"
            style={place ?? { visibility: "hidden" }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
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
