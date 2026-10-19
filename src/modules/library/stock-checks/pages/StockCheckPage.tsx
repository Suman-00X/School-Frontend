/* LB-07 · Stock checks: one check, its tiles, the scan panel and what is missing or out of place */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Field, Page, StatTile, StatTiles, useConfirm, useTabParam, useToast, type TabItem } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import type { MissingCopy, ScanOutcome, StockCheckSummary, UnexpectedScan } from "../../shared/api/types";
import { CopyStatusBadge, ScanInput } from "../../shared/components/LibraryBits";
import { SCAN_CODE, SCAN_RESULT_LABELS, SCAN_RESULT_TONES, plural } from "../../shared/utils/labels";
import { STOCK_CHECKS_PATH, sendScans, useCloseStockCheck, useStockCheck } from "../api/stockChecks";

const BATCH = 50;
const IDLE_MS = 4000;

type LogLine = { key: string; code: string; outcome?: ScanOutcome; error?: string };

export default function StockCheckPage() {
  const { stockCheckId = "" } = useParams();
  const { can } = useAuth();
  const q = useStockCheck(stockCheckId);
  const c = q.data;
  const isOpen = c?.status === "OPEN";
  const canScan = can("library.stockChecks.manage") && isOpen;
  const [summary, setSummary] = useState<StockCheckSummary | null>(null);
  /* Scans update the tiles at once; a refetch (e.g. after closing) takes over again */
  useEffect(() => setSummary(null), [c?.status, c?.updatedAt]);
  const shown = summary ?? c?.summary;

  const tabs: TabItem[] = [
    { id: "scan", label: "Scan", hidden: !canScan },
    { id: "missing", label: "Missing" },
    { id: "unexpected", label: "Unexpected" }
  ];
  const [tab, setTab] = useTabParam(tabs);

  const header = (
    <DrillHeader
      back="/library/stock-checks"
      backLabel="Back to stock checks"
      title={
        <span style={{ display: "inline-block", width: "min(260px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }} title={c?.title}>
          {c?.title ?? "Stock check"}
        </span>
      }
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (q.error)
    return (
      <Page>
        {header}
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );

  return (
    <Page>
      {header}
      <div className="row-between" style={{ minHeight: 34 }}>
        <span className="row muted" style={{ gap: 8 }}>
          {c && (c.status === "OPEN" ? <Badge tone="info" dot>Open</Badge> : <Badge dot>Closed {formatDate(c.closedOn)}</Badge>)}
          {c && `Started ${formatDate(c.startedOn)}${c.notes ? ` · ${c.notes}` : ""}`}
        </span>
      </div>
      <StatTiles>
        <StatTile label="Expected" value={shown?.expected} loading={!shown} hint="On the shelf, held or damaged" />
        <StatTile label="Found" value={shown?.found} loading={!shown} hint={shown && shown.expected ? `${Math.round((shown.found / shown.expected) * 100)}% of expected` : " "} />
        <StatTile label="Missing" value={shown?.missing} loading={!shown} hint={isOpen ? "Not scanned yet" : "Marked missing"} hintTone={shown?.missing ? "bad" : undefined} />
        <StatTile label="Unexpected" value={shown?.unexpected} loading={!shown} hint="Should be elsewhere" hintTone={shown?.unexpected ? "warn" : undefined} />
        <StatTile label="Unknown" value={shown?.unknown} loading={!shown} hint="No copy has the code" hintTone={shown?.unknown ? "warn" : undefined} />
      </StatTiles>
      {c && tab === "scan" && canScan && <ScanPanel checkId={c.id} title={c.title} summary={shown} onSummary={setSummary} />}
      {tab === "missing" && <MissingTab checkId={stockCheckId} isOpen={!!isOpen} />}
      {tab === "unexpected" && <UnexpectedTab checkId={stockCheckId} />}
    </Page>
  );
}

function ScanPanel({ checkId, title, summary, onSummary }: { checkId: string; title: string; summary?: StockCheckSummary; onSummary: (s: StockCheckSummary) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const close = useCloseStockCheck();
  const [code, setCode] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [sending, setSending] = useState(false);
  const pendingRef = useRef<string[]>([]);
  const seq = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  pendingRef.current = pending;

  const refreshLists = useCallback(() => {
    void qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(`${STOCK_CHECKS_PATH}/${checkId}/`) });
  }, [qc, checkId]);

  const flush = useCallback(async () => {
    const codes = pendingRef.current;
    if (!codes.length) return;
    if (idle.current) clearTimeout(idle.current);
    pendingRef.current = [];
    setPending([]);
    setSending(true);
    try {
      const res = await sendScans(checkId, codes);
      onSummary(res.data.summary);
      /* Match results to the queued lines, oldest first */
      setLog(lines => {
        const out = [...lines];
        const queue = [...res.data.results];
        for (let i = out.length - 1; i >= 0 && queue.length; i--) if (!out[i].outcome && !out[i].error && out[i].code === queue[0].code) out[i] = { ...out[i], outcome: queue.shift() };
        return out;
      });
      refreshLists();
    } catch (err) {
      const message = isApiError(err) ? err.message : "Couldn't send the scans. They are kept; try Send again.";
      if (isApiError(err) && err.status < 500 && err.status !== 409) {
        setLog(lines => lines.map(l => (codes.includes(l.code) && !l.outcome ? { ...l, error: message } : l)));
      } else {
        /* Keep them to send again */
        pendingRef.current = [...codes, ...pendingRef.current];
        setPending(pendingRef.current);
      }
      toast.error(err);
    } finally {
      setSending(false);
    }
  }, [checkId, onSummary, refreshLists, toast]);

  /* Always send what is queued before leaving */
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingRef.current.length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (idle.current) clearTimeout(idle.current);
      if (pendingRef.current.length) void sendScans(checkId, pendingRef.current).catch(() => undefined);
    };
  }, [checkId]);

  const add = (raw: string) => {
    const c = raw.trim();
    if (!SCAN_CODE.test(c)) return setInputError(`“${c}” isn't a code: 3 to 64 letters, digits or -`);
    setInputError(null);
    setCode("");
    const next = [...pendingRef.current, c];
    pendingRef.current = next;
    setPending(next);
    setLog(l => [{ key: String(++seq.current), code: c }, ...l].slice(0, 300));
    if (idle.current) clearTimeout(idle.current);
    if (next.length >= BATCH) void flush();
    else idle.current = setTimeout(() => void flush(), IDLE_MS);
  };

  const askClose = async () => {
    await flush();
    const missing = summary?.missing ?? 0;
    const ok = await confirm({
      title: `Close ${title}?`,
      message: missing
        ? `${plural(missing, "copy", "copies")} not scanned will be marked MISSING. A closed check can't be scanned again.`
        : "Every expected copy was scanned. A closed check can't be scanned again.",
      confirmLabel: "Close stock check"
    });
    if (ok) close.mutate(checkId, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };

  return (
    <Card
      title="Scan the shelves"
      subtitle={`Codes are sent every ${BATCH} scans, after a short pause, or with Send`}
      actions={
        <Button variant="danger" icon={<Lock />} onClick={() => void askClose()} loading={close.isPending}>
          Close check
        </Button>
      }
    >
      <div className="stack">
        <div className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
          <Field label="Scan or type" error={inputError} hint="Accession number or barcode; Enter after each" className="desk-scan lib-grow">
            <ScanInput
              ref={inputRef}
              value={code}
              autoFocus
              placeholder="ACC-…"
              aria-label="Scanned code"
              onChange={e => {
                setCode(e.target.value);
                setInputError(null);
              }}
              onScan={add}
            />
          </Field>
          <Button icon={<Send />} onClick={() => void flush()} loading={sending} disabled={!pending.length} style={{ marginTop: 22 }}>
            Send {pending.length || ""}
          </Button>
        </div>
        {log.length ? (
          <ul className="lib-log" aria-live="polite">
            {log.map(l => {
              const o = l.outcome;
              const tone = l.error ? "danger" : !o ? "" : o.repeated ? "muted" : SCAN_RESULT_TONES[o.result];
              return (
                <li key={l.key} className={tone ? `is-${tone}` : undefined}>
                  <span className="mono small">{l.code.toUpperCase()}</span>
                  <span className="lib-log-text">
                    {l.error ?? (!o ? <span className="muted">Waiting to send…</span> : o.title ? `${o.title}${o.accessionNumber && o.accessionNumber !== l.code.toUpperCase() ? ` (${o.accessionNumber})` : ""}` : "No copy has this code")}
                  </span>
                  <span className="small nowrap">
                    {o && (o.repeated ? <Badge>Scanned before</Badge> : <Badge tone={SCAN_RESULT_TONES[o.result]}>{o.result === "UNEXPECTED" && o.copyStatus ? `${SCAN_RESULT_LABELS.UNEXPECTED}: ${o.copyStatus.toLowerCase().replace("_", " ")}` : SCAN_RESULT_LABELS[o.result]}</Badge>)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted small">Each scan shows here: found in green, should be elsewhere in amber, unknown in red, repeated in grey.</p>
        )}
      </div>
    </Card>
  );
}

function MissingTab({ checkId, isOpen }: { checkId: string; isOpen: boolean }) {
  const { params, setPage } = useListParams({});
  const list = useApiList<MissingCopy>(`${STOCK_CHECKS_PATH}/${checkId}/missing`, { page: params.page, limit: params.limit });
  return (
    <Card flush title="Missing" subtitle={isOpen ? "Expected on the shelf but not scanned yet, in shelf order" : "Copies marked missing"}>
      <DataTable
        rows={list.rows}
        rowKey={c => c.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        empty={<EmptyState title={isOpen ? "Every expected copy has been scanned" : "Nothing went missing"} />}
        columns={[
          { key: "accessionNumber", header: "Copy", render: c => <span className="mono">{c.accessionNumber}</span> },
          { key: "title", header: "Title", render: c => c.title ?? c.book?.title ?? "—" },
          { key: "shelf", header: "Shelf", render: c => c.shelfLocation ?? c.book?.shelfLocation ?? <span className="muted">—</span> },
          { key: "status", header: "Status", render: c => <CopyStatusBadge status={c.status} /> }
        ]}
      />
    </Card>
  );
}

function UnexpectedTab({ checkId }: { checkId: string }) {
  const { params, setPage } = useListParams({});
  const list = useApiList<UnexpectedScan>(`${STOCK_CHECKS_PATH}/${checkId}/unexpected`, { page: params.page, limit: params.limit });
  return (
    <Card flush title="Unexpected" subtitle="Scanned copies whose record says they are elsewhere, and codes no copy has">
      <DataTable
        rows={list.rows}
        rowKey={s => s.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        empty={<EmptyState title="Nothing out of place" />}
        columns={[
          { key: "code", header: "Scanned", render: s => <span className="mono">{s.code}</span> },
          { key: "result", header: "Result", render: s => <Badge tone={SCAN_RESULT_TONES[s.result]}>{SCAN_RESULT_LABELS[s.result]}</Badge> },
          { key: "copyStatus", header: "Record says", render: s => (s.copyStatus ? <CopyStatusBadge status={s.copyStatus} /> : <span className="muted">—</span>) },
          { key: "copy", header: "Copy", render: s => (s.copy ? <span className="mono">{s.copy.accessionNumber}</span> : <span className="muted">—</span>) },
          { key: "title", header: "Title", render: s => s.copy?.book?.title ?? <span className="muted">—</span> },
          { key: "scannedAt", header: "When", render: s => <span className="nowrap">{formatDateTime(s.scannedAt ?? s.createdAt)}</span> }
        ]}
      />
    </Card>
  );
}
