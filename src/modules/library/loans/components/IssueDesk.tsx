import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookUp, ExternalLink, SlidersHorizontal } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Button, ButtonLink, Card, Field, Switch, useToast } from "@/common/ui";
import type { Copy } from "../../shared/api/types";
import { BorrowerSelect, CopyStatusBadge, ScanInput } from "../../shared/components/LibraryBits";
import { ACCESSION, SCAN_CODE } from "../../shared/utils/labels";
import { findCopy } from "../../copies/api/copies";
import { useAccount, useIssue, type IssueInput } from "../api/loans";
import { AccountChips, StandingBox } from "./BorrowerStanding";
import { DeskLoans } from "./DeskLoans";
import type { LogEntry } from "./DeskLog";
import { IssueOptionsDialog, NO_OPTIONS, optionsSummary, type IssueOptions } from "./IssueOptionsDialog";

type Preview =
  | { state: "idle" }
  | { state: "looking"; code: string }
  | { state: "copy"; copy: Copy }
  /* No copy lookup allowed: issue by accession number blind */
  | { state: "code"; code: string }
  | { state: "error"; code: string; message: ReactNode };

const AUTO_KEY = "library.desk.autoIssue";
const readAuto = () => {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
};

const issuable = (c: Copy) => c.status === "AVAILABLE" || c.status === "ON_HOLD";

/* Issue mode: 1. the borrower, 2. the copy, Enter issues. The scan field takes focus back after each step. */
export function IssueDesk({ onLog }: { onLog: (e: Omit<LogEntry, "id" | "at">) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const borrowerId = params.get("borrower") ?? "";
  const canRead = can("library.loans.read");
  const canCopies = can("library.copies.read");
  const account = useAccount(borrowerId || null, canRead);
  const issue = useIssue();
  const [scan, setScan] = useState("");
  const [preview, setPreview] = useState<Preview>({ state: "idle" });
  const [options, setOptions] = useState<IssueOptions>(NO_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState<{ focusOverride: boolean } | null>(null);
  const [auto, setAuto] = useState(readAuto);
  const scanRef = useRef<HTMLInputElement>(null);
  const pendingCopy = useRef(params.get("copy"));

  const a = account.data;
  const blocked = !!a && !a.canBorrow;
  const borrowerName = a?.borrower.name;

  const setBorrower = (id: string) => {
    setParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (id) next.set("borrower", id);
        else next.delete("borrower");
        next.delete("copy");
        return next;
      },
      { replace: true }
    );
    setOptions(NO_OPTIONS);
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const clear = () => {
    setScan("");
    setPreview({ state: "idle" });
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const send = (target: { copyId: string } | { accessionNumber: string }, label: string) => {
    if (!borrowerId) {
      toast.warning("Pick the borrower first.");
      return;
    }
    if (blocked && !options.overrideReason) {
      setOptionsOpen({ focusOverride: true });
      return;
    }
    const body: IssueInput = { borrowerUserId: borrowerId, ...target };
    if (options.issuedOn) {
      body.issuedOn = options.issuedOn;
      body.backdateReason = options.backdateReason;
    }
    if (options.dueDate) body.dueDate = options.dueDate;
    if (options.overrideReason) body.overrideReason = options.overrideReason;
    issue.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onLog({ kind: "issue", text: res.message, tone: "success" });
        setOptions(NO_OPTIONS);
        clear();
      },
      onError: err => {
        const message = isApiError(err) ? err.message : "Something went wrong. Please try again.";
        if (/may override this with a reason/i.test(message)) setOptionsOpen({ focusOverride: true });
        const shown = /No circulation rule covers/i.test(message) ? (
          <span>
            {message}.{" "}
            {can("library.circulationRules.read") && <Link to="/library/circulation-rules">Circulation rules</Link>}
          </span>
        ) : (
          message
        );
        setPreview({ state: "error", code: label, message: shown });
        toast.error(err);
        scanRef.current?.focus();
      }
    });
  };

  const issueNow = () => {
    if (preview.state === "copy" && issuable(preview.copy)) send({ copyId: preview.copy.id }, preview.copy.accessionNumber);
    else if (preview.state === "code") send({ accessionNumber: preview.code }, preview.code);
  };

  const lookUp = async (raw: string) => {
    const code = raw.trim();
    if (!SCAN_CODE.test(code)) return setPreview({ state: "error", code, message: "A code is 3 to 64 letters, digits or -, e.g. ACC-000012" });
    if (!canCopies) {
      if (!ACCESSION.test(code)) return setPreview({ state: "error", code, message: "Type the accession number (ACC-…): barcode lookup needs copy access" });
      const acc = code.toUpperCase();
      setPreview({ state: "code", code: acc });
      if (auto && borrowerId) send({ accessionNumber: acc }, acc);
      return;
    }
    setPreview({ state: "looking", code });
    try {
      const copy = await findCopy(code);
      if (!copy) return setPreview({ state: "error", code, message: `No copy has the code ${code.toUpperCase()}` });
      setPreview({ state: "copy", copy });
      if (issuable(copy) && auto && borrowerId) send({ copyId: copy.id }, copy.accessionNumber);
    } catch (err) {
      setPreview({ state: "error", code, message: isApiError(err) ? err.message : "Couldn't look the copy up. Try again." });
    }
  };

  /* Opened from a ready hold (?borrower=…&copy=ACC-…): look the copy up once */
  useEffect(() => {
    const code = pendingCopy.current;
    if (!code) return;
    pendingCopy.current = null;
    setScan(code);
    void lookUp(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!borrowerId) return;
    scanRef.current?.focus();
  }, [borrowerId]);

  const toggleAuto = (v: boolean) => {
    setAuto(v);
    try {
      localStorage.setItem(AUTO_KEY, v ? "1" : "0");
    } catch {
      /* private mode: the choice lasts this visit */
    }
  };

  const summary = optionsSummary(options);
  const ready = (preview.state === "copy" && issuable(preview.copy)) || preview.state === "code";

  return (
    <>
      <div className="desk-grid">
        <Card
          title="Borrower"
          actions={
            borrowerId &&
            canRead && (
              <ButtonLink size="sm" variant="ghost" icon={<ExternalLink />} to={`/library/borrowers/${borrowerId}`}>
                Account
              </ButtonLink>
            )
          }
        >
          <div className="stack">
            <BorrowerSelect
              label="Who is borrowing"
              value={borrowerId}
              onChange={e => setBorrower(e.target.value)}
              placeholder="Search by name"
              known={a ? [{ userId: a.borrower.id, name: a.borrower.name, role: a.borrower.role }] : []}
              hint="Students and staff. Parents borrow through their children"
            />
            {canRead ? (
              <>
                <AccountChips account={borrowerId ? a : undefined} />
                {borrowerId ? <StandingBox account={a} /> : <div className="lib-standing muted">Pick a borrower to see what they have out and owe.</div>}
              </>
            ) : (
              <div className="lib-standing muted">Loans and fines are shown to staff who can view borrower accounts.</div>
            )}
          </div>
        </Card>

        <Card title="Copy">
          <div className="stack">
            <Field label="Scan or type the copy" hint="Accession number (ACC-000012) or barcode">
              <ScanInput
                ref={scanRef}
                className="desk-scan"
                value={scan}
                autoFocus
                placeholder="ACC-…"
                aria-label="Copy code"
                readOnly={issue.isPending}
                onChange={e => {
                  setScan(e.target.value);
                  if (preview.state !== "idle" && preview.state !== "looking") setPreview({ state: "idle" });
                }}
                onKeyDown={e => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    clear();
                  }
                }}
                onScan={code => {
                  /* Enter again on the code already shown issues it (a scanner: scan the same copy twice) */
                  const c = code.toUpperCase();
                  const same =
                    (preview.state === "copy" && (c === preview.copy.accessionNumber || c === preview.copy.barcode?.toUpperCase())) ||
                    (preview.state === "code" && c === preview.code);
                  if (ready && same) return issueNow();
                  void lookUp(code);
                }}
              />
            </Field>
            <PreviewBox preview={preview} borrowerName={borrowerName} />
            <div className="lib-line">
              <span className="lib-line-text small muted" title={summary || undefined}>
                {summary || "Issued today, due by the circulation rule"}
              </span>
              <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} onClick={() => setOptionsOpen({ focusOverride: false })} style={{ marginLeft: "auto" }}>
                Options
              </Button>
            </div>
            <div className="row-between" style={{ gap: 12 }}>
              <Switch label="Issue as soon as a copy is scanned" checked={auto} onChange={toggleAuto} />
              <Button variant="primary" icon={<BookUp />} loading={issue.isPending} disabled={!borrowerId || !ready} onClick={issueNow}>
                Issue
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <DeskLoans
        borrowerId={borrowerId}
        account={a}
        onIssueHold={code => {
          setScan(code);
          void lookUp(code);
        }}
        onLog={onLog}
      />

      <IssueOptionsDialog
        open={!!optionsOpen}
        value={options}
        blocked={blocked}
        focusOverride={optionsOpen?.focusOverride}
        onClose={() => {
          setOptionsOpen(null);
          scanRef.current?.focus();
        }}
        onSave={o => {
          setOptions(o);
          setOptionsOpen(null);
          setTimeout(() => scanRef.current?.focus(), 0);
        }}
      />
    </>
  );
}

/* The scanned copy (title and status), or why it can't go out; one fixed-height box */
function PreviewBox({ preview, borrowerName }: { preview: Preview; borrowerName?: string }) {
  if (preview.state === "idle")
    return (
      <div className="desk-preview">
        <span className="muted">The scanned copy shows here.</span>
      </div>
    );
  if (preview.state === "looking")
    return (
      <div className="desk-preview">
        <span className="muted">Looking up {preview.code.toUpperCase()}…</span>
      </div>
    );
  if (preview.state === "error")
    return (
      <div className="desk-preview is-bad" role="alert">
        <span className="mono small">{preview.code.toUpperCase()}</span>
        <span className="text-danger small" style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {preview.message}
        </span>
      </div>
    );
  if (preview.state === "code")
    return (
      <div className="desk-preview is-ok">
        <span className="desk-preview-title mono">{preview.code}</span>
        <span className="small muted">{borrowerName ? `Press Enter again to issue it to ${borrowerName}.` : "Pick the borrower, then press Enter again."}</span>
      </div>
    );
  const c = preview.copy;
  const ok = issuable(c);
  return (
    <div className={`desk-preview ${ok ? "is-ok" : "is-bad"}`}>
      <span className="desk-preview-title" title={c.book?.title}>
        {c.book?.title ?? "Copy"}
      </span>
      <span className="row small" style={{ gap: 8, flexWrap: "nowrap" }}>
        <span className="mono">{c.accessionNumber}</span>
        <CopyStatusBadge status={c.status} />
        <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ok
            ? c.status === "ON_HOLD"
              ? "Held for a reader: issues only to them"
              : borrowerName
                ? `Press Enter again to issue to ${borrowerName}`
                : "Pick the borrower, then press Enter again"
            : c.status === "ISSUED"
              ? "Already on loan: return it first"
              : "Can't be issued"}
        </span>
      </span>
    </div>
  );
}
