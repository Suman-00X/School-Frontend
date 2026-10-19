import { BookDown, BookUp, HandCoins, Info } from "lucide-react";

export type LogEntry = { id: string; at: string; kind: "issue" | "return" | "fine" | "note"; text: string; tone?: "success" | "warning" | "danger" };

const ICONS = { issue: BookUp, return: BookDown, fine: HandCoins, note: Info };

/* The desk's running list of what happened (newest first) */
export function DeskLog({ entries }: { entries: LogEntry[] }) {
  if (!entries.length) return <p className="muted small">Nothing yet. Issued and returned books appear here.</p>;
  return (
    <ul className="lib-log" aria-live="polite">
      {entries.map(e => {
        const Icon = ICONS[e.kind];
        return (
          <li key={e.id} className={e.tone ? `is-${e.tone}` : undefined}>
            <Icon size={16} />
            <span className="lib-log-text" title={e.text}>
              {e.text}
            </span>
            <span className="small muted nowrap">{new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
          </li>
        );
      })}
    </ul>
  );
}
