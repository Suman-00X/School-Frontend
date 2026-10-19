import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

function useBodyLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

/* Side panel for viewing and editing a record */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  wide,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  useBodyLock(open);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <aside className={`drawer${wide ? " drawer-wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="drawer-header">
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <div className="small muted" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <Button variant="ghost" size="sm" icon={<X />} onClick={onClose} aria-label="Close" />
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </aside>
    </>,
    document.body
  );
}

export function Dialog({
  open,
  onClose,
  title,
  footer,
  wide,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  useBodyLock(open);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay overlay-dialog" onClick={onClose} />
      <div className={`dialog${wide ? " dialog-wide" : ""}`} role="dialog" aria-modal="true">
        <div className="dialog-header">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" icon={<X />} onClick={onClose} aria-label="Close" />
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

/* ---- confirm(): every destructive action names the record ---- */

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...o, resolve })),
    []
  );
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={!!pending}
        onClose={() => close(false)}
        title={pending?.title}
        footer={
          <>
            <Button onClick={() => close(false)}>Cancel</Button>
            <Button ref={confirmRef} variant={pending?.tone === "primary" ? "primary" : "danger"} onClick={() => close(true)}>
              {pending?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        {pending?.message}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
