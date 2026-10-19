/* LB-04 · Circulation desk: issue and return, keyboard-first and scanner-friendly */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookDown, BookUp } from "lucide-react";
import { Card, Page } from "@/common/ui";
import { IssueDesk } from "../components/IssueDesk";
import { ReturnDesk } from "../components/ReturnDesk";
import { DeskLog, type LogEntry } from "../components/DeskLog";
import "../../shared/library.css";

type Mode = "issue" | "return";

export default function DeskPage() {
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("mode") === "return" ? "return" : "issue";
  const [log, setLog] = useState<LogEntry[]>([]);

  const setMode = useCallback(
    (m: Mode) =>
      setParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (m === "return") next.set("mode", "return");
          else next.delete("mode");
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  /* Alt+1 issue, Alt+2 return (anywhere on the desk) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === "Digit1") {
        e.preventDefault();
        setMode("issue");
      } else if (e.code === "Digit2") {
        e.preventDefault();
        setMode("return");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode]);

  const add = useCallback((entry: Omit<LogEntry, "id" | "at">) => setLog(l => [{ ...entry, id: `${Date.now()}-${l.length}`, at: new Date().toISOString() }, ...l].slice(0, 50)), []);

  return (
    <Page>
      <div className="row-between" style={{ minHeight: 36, gap: 12 }}>
        <div className="segmented" role="tablist" aria-label="Desk mode">
          <button type="button" role="tab" aria-selected={mode === "issue"} className={mode === "issue" ? "active" : undefined} onClick={() => setMode("issue")}>
            <BookUp /> Issue
          </button>
          <button type="button" role="tab" aria-selected={mode === "return"} className={mode === "return" ? "active" : undefined} onClick={() => setMode("return")}>
            <BookDown /> Return
          </button>
        </div>
        <div className="desk-keys">
          Scan or type a code, then <kbd>Enter</kbd> · <kbd>Alt</kbd>+<kbd>1</kbd> issue · <kbd>Alt</kbd>+<kbd>2</kbd> return · <kbd>Esc</kbd> clears
        </div>
      </div>
      {mode === "issue" ? <IssueDesk onLog={add} /> : <ReturnDesk onLog={add} />}
      <Card title="This session" subtitle="What was issued and returned at this desk since the page opened">
        <DeskLog entries={log} />
      </Card>
    </Page>
  );
}
