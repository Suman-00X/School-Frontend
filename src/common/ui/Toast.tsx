import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { errorMessage } from "@/common/api";

type Tone = "success" | "danger" | "warning" | "info";
type Toast = { id: number; tone: Tone; message: ReactNode };

type ToastApi = {
  show: (message: ReactNode, tone?: Tone) => void;
  success: (message: ReactNode) => void;
  error: (errOrMessage: unknown) => void;
  warning: (message: ReactNode) => void;
};

const Ctx = createContext<ToastApi | null>(null);
const ICONS = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle, info: Info };
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const show = useCallback(
    (message: ReactNode, tone: Tone = "info") => {
      const id = ++seq;
      setToasts(t => [...t.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "danger" ? 8000 : 5000);
    },
    [dismiss]
  );
  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: m => show(m, "success"),
      /* Pass the caught error: its API message is shown as is */
      error: e => show(typeof e === "string" ? e : errorMessage(e), "danger"),
      warning: m => show(m, "warning")
    }),
    [show]
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === "danger" ? "alert" : "status"}>
              <Icon />
              <div>{t.message}</div>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
