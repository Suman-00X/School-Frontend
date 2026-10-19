import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookCheck, HandCoins, SearchCheck } from "lucide-react";
import { api, isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Button, Card, Field, RoleBadge, Textarea, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { Copy, Loan, ReturnCondition } from "../../shared/api/types";
import { CopyStatusBadge, ScanInput } from "../../shared/components/LibraryBits";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { SCAN_CODE, isMoney, plural } from "../../shared/utils/labels";
import { findCopy } from "../../copies/api/copies";
import { LOANS_PATH, findOpenLoan, useReturn } from "../api/loans";
import { ConditionFields, useLoanActions, useReturnToasts } from "./LoanActions";
import type { LogEntry } from "./DeskLog";

type Found =
  | { state: "idle" }
  | { state: "looking"; code: string }
  | { state: "loan"; loan: Loan }
  /* A lost copy turned up: its LOST loan, for "Record found" */
  | { state: "lost"; loan: Loan }
  | { state: "none"; code: string; message: string; copy?: Copy }
  | { state: "done"; loan: Loan; message: string };

/* Return mode: scan, check the condition, Enter returns. Then the fine left and where the copy goes. */
export function ReturnDesk({ onLog }: { onLog: (e: Omit<LogEntry, "id" | "at">) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const ret = useReturn();
  const say = useReturnToasts();
  const [scan, setScan] = useState("");
  const [found, setFound] = useState<Found>({ state: "idle" });
  const [condition, setCondition] = useState<ReturnCondition>("OK");
  const [damageCharge, setDamageCharge] = useState("");
  const [notes, setNotes] = useState("");
  const [damageError, setDamageError] = useState<string | undefined>();
  const scanRef = useRef<HTMLInputElement>(null);
  const { actionsFor, dialogs, openPay } = useLoanActions({
    onDone: (loan, kind, message) => {
      onLog({ kind: kind === "pay" || kind === "waive" ? "fine" : "return", text: message, tone: "success" });
      if (kind === "found") setFound({ state: "done", loan, message });
      else setFound(f => (f.state === "done" ? { ...f, loan } : f));
      setTimeout(() => scanRef.current?.focus(), 0);
    }
  });
  const canLookUp = can("library.copies.read") && can("library.loans.read");

  const resetForm = () => {
    setCondition("OK");
    setDamageCharge("");
    setNotes("");
    setDamageError(undefined);
  };

  const lookUp = async (raw: string) => {
    const code = raw.trim();
    resetForm();
    if (!SCAN_CODE.test(code)) return setFound({ state: "none", code, message: "A code is 3 to 64 letters, digits or -, e.g. ACC-000012" });
    setFound({ state: "looking", code });
    try {
      const copy = await findCopy(code);
      if (!copy) return setFound({ state: "none", code, message: `No copy has the code ${code.toUpperCase()}` });
      const loan = await findOpenLoan(copy.id);
      if (loan) return setFound({ state: "loan", loan });
      if (copy.status === "LOST") {
        const lost = (await api.get<Loan[]>(LOANS_PATH, { copyId: copy.id, status: "LOST", limit: 1 })).data[0];
        if (lost) return setFound({ state: "lost", loan: lost });
      }
      setFound({ state: "none", code, copy, message: `${copy.accessionNumber} is not on loan` });
    } catch (err) {
      setFound({ state: "none", code, message: isApiError(err) ? err.message : "Couldn't look the copy up. Try again." });
    }
  };

  const doReturn = (e?: FormEvent) => {
    e?.preventDefault();
    if (found.state !== "loan") return;
    const charge = damageCharge.trim();
    if (condition === "DAMAGED" && charge && (!isMoney(charge) || Number(charge) <= 0)) return setDamageError("must be an amount above 0");
    const loan = found.loan;
    ret.mutate(
      { id: loan.id, condition, ...(condition === "DAMAGED" && charge ? { damageCharge: Number(charge) } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) },
      {
        onSuccess: res => {
          say(res.data, res.message);
          onLog({ kind: "return", text: res.message, tone: res.data.fineOutstanding > 0 ? "warning" : "success" });
          setFound({ state: "done", loan: res.data, message: res.message });
          setScan("");
          resetForm();
          setTimeout(() => scanRef.current?.focus(), 0);
        },
        onError: err => {
          toast.error(err);
          scanRef.current?.focus();
        }
      }
    );
  };

  if (!canLookUp)
    return (
      <Card>
        <p className="muted">Returns at the desk look the copy and its loan up, which needs access to copies and loans. Ask the library's owner to add them to your role.</p>
      </Card>
    );

  return (
    <div className="desk-grid">
      <Card title="Returned copy">
        <div className="stack">
          <Field label="Scan or type the copy" hint="Accession number (ACC-000012) or barcode">
            <ScanInput
              ref={scanRef}
              className="desk-scan"
              value={scan}
              autoFocus
              placeholder="ACC-…"
              aria-label="Copy code"
              readOnly={ret.isPending}
              onChange={e => setScan(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setScan("");
                  setFound({ state: "idle" });
                  resetForm();
                }
              }}
              onScan={code => {
                /* Enter again on the loan shown returns it */
                const c = code.toUpperCase();
                if (found.state === "loan" && (c === found.loan.copy.accessionNumber || c === found.loan.copy.barcode?.toUpperCase())) return doReturn();
                void lookUp(code);
              }}
            />
          </Field>
          <LoanPanel found={found} onPay={openPay} canPay={can("library.loans.circulate")} actionsFor={actionsFor} />
        </div>
      </Card>

      <Card title="Condition">
        <form className="stack" onSubmit={doReturn} noValidate>
          <ConditionFields
            condition={condition}
            onCondition={c => {
              setCondition(c);
              setDamageError(undefined);
            }}
            damageCharge={damageCharge}
            onDamageCharge={v => {
              setDamageCharge(v);
              setDamageError(undefined);
            }}
            damageError={damageError}
            disabled={found.state !== "loan"}
          />
          <Textarea label="Notes" rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} disabled={found.state !== "loan"} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant={condition === "LOST" ? "danger" : "primary"}
              icon={<BookCheck />}
              loading={ret.isPending}
              disabled={found.state !== "loan"}
            >
              {condition === "LOST" ? "Record as lost" : "Return"}
            </Button>
          </div>
        </form>
      </Card>
      {dialogs}
    </div>
  );
}

/* The loan found for the scanned copy, or the outcome of the return; one fixed-height region */
function LoanPanel({
  found,
  onPay,
  canPay,
  actionsFor
}: {
  found: Found;
  onPay: (loan: Loan) => void;
  canPay: boolean;
  actionsFor: (loan: Loan) => { id: string; label: string; run: () => void }[];
}) {
  const money = useMoney();
  const box = (cls: string, children: ReactNode) => (
    <div className={`desk-preview ${cls}`} style={{ minHeight: 150, justifyContent: "flex-start", gap: 6 }}>
      {children}
    </div>
  );

  if (found.state === "idle") return box("", <span className="muted">Scan the copy that came back: its loan, borrower and fine show here.</span>);
  if (found.state === "looking") return box("", <span className="muted">Looking up {found.code.toUpperCase()}…</span>);
  if (found.state === "none")
    return box(
      "is-bad",
      <>
        <span className="mono small">{found.code.toUpperCase()}</span>
        <span className="text-danger">{found.message}</span>
        {found.copy && (
          <span className="row small" style={{ gap: 8 }}>
            {found.copy.book?.title} <CopyStatusBadge status={found.copy.status} />
          </span>
        )}
      </>
    );
  if (found.state === "lost") {
    const l = found.loan;
    const action = actionsFor(l).find(a => a.id === "found");
    return box(
      "",
      <>
        <span className="desk-preview-title">{l.book.title}</span>
        <span className="small">
          <span className="mono">{l.copy.accessionNumber}</span> was recorded as lost by {l.borrower.name} on {formatDate(l.lostOn)}.
        </span>
        {action && (
          <div>
            <Button size="sm" icon={<SearchCheck />} onClick={action.run}>
              Record found
            </Button>
          </div>
        )}
      </>
    );
  }
  if (found.state === "done") {
    const l = found.loan;
    return box(
      l.fineOutstanding > 0 ? "" : "is-ok",
      <>
        <span className="desk-preview-title">{found.message}</span>
        {l.copy.status === "ON_HOLD" && <strong className="text-warning">Keep this copy at the desk: it is held for the next reader.</strong>}
        {l.fineOutstanding > 0 ? (
          <span className="row" style={{ gap: 10 }}>
            <span>
              Fine outstanding <strong className="text-danger">{money(l.fineOutstanding)}</strong>
            </span>
            {canPay && (
              <Button size="sm" variant="primary" icon={<HandCoins />} onClick={() => onPay(l)}>
                Collect fine
              </Button>
            )}
          </span>
        ) : (
          <span className="small muted">Nothing owed. Scan the next copy.</span>
        )}
      </>
    );
  }
  const l = found.loan;
  return box(
    l.isOverdue ? "is-bad" : "is-ok",
    <>
      <span className="desk-preview-title" title={l.book.title}>
        {l.book.title}
      </span>
      <span className="row small" style={{ gap: 6 }}>
        <span className="mono">{l.copy.accessionNumber}</span> ·
        <Link to={`/library/borrowers/${l.borrowerUserId}`}>{l.borrower.name}</Link>
        <RoleBadge role={l.borrowerRole} />
      </span>
      <span className={`small${l.isOverdue ? " text-danger" : ""}`}>
        Due {formatDate(l.dueDate)}
        {l.isOverdue ? ` · ${plural(l.daysOverdue, "day")} late` : " · on time"}
      </span>
      <span className="small">
        Fine so far: <strong>{l.fineOutstanding ? money(l.fineOutstanding) : "none"}</strong>
      </span>
      <span className="small muted">Check its condition, then press Enter again (or Return).</span>
    </>
  );
}
